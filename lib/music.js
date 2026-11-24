// Background music: a slow ambient piece made up as it plays (drifting pad
// chords, a low drone and soft bell notes in long echoes), or the tracks in
// a folder of your own, shuffled. GStreamer does the sound; everything here
// runs on the main loop (bus messages and timers), never in GStreamer's
// streaming threads.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// GStreamer is loaded the first time music plays, not at startup: its
// first initialization scans every plugin, which can take a long while
// on a fresh system and would hold up the whole shell.
let Gst = null, GstController = null, loading = null;
function loadGst() {
    loading ??= (async () => {
        try {
            Gst = (await import('gi://Gst?version=1.0')).default;
            GstController = (await import('gi://GstController?version=1.0')).default;
            Gst.init(null);
        } catch (e) {
            console.warn(`Orrery: no GStreamer, so no music: ${e.message}`);
            Gst = null;
        }
    })();
    return loading;
}

const SECOND = 1e9;            // GStreamer time is in nanoseconds
const CHORD_SECONDS = 18;
const GLIDE_SECONDS = 6;
const LOOKAHEAD = 3 * SECOND;
const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.oga', '.opus', '.flac', '.wav', '.m4a', '.aac'];

// Pad chords (four voices, Hz): A sus2, F, C maj7, G sus2.
const CHORDS = [
    [110.00, 164.81, 246.94, 329.63],
    [87.31, 174.61, 220.00, 261.63],
    [130.81, 196.00, 246.94, 329.63],
    [98.00, 146.83, 220.00, 293.66],
];
// Bell notes: A minor pentatonic, which sits well over every chord.
const BELLS = [329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
const DETUNE = 0.35;           // Hz between the two oscillators of a pad voice

const FX = 'audioecho delay=420000000 max-delay=1000000000 intensity=0.45 feedback=0.55 ! ' +
    'audioecho delay=1130000000 max-delay=2000000000 intensity=0.35 feedback=0.45 ! ' +
    'audiocheblimit mode=low-pass cutoff=2800 poles=4 ! ';

function ambientDescription(fx, sink = 'autoaudiosink') {
    const caps = 'audio/x-raw,format=F32LE,rate=48000,channels=1';
    const src = (name, wave = 'sine') => `audiotestsrc name=${name} wave=${wave} volume=0 samplesperbuffer=1024 ! ${caps} ! mix. `;
    let desc = `audiomixer name=mix ! audioconvert ! ${fx ? FX : ''}volume name=master volume=0 ! audioconvert ! audioresample ! ${sink} `;
    for (let v = 0; v < 4; v++)
        desc += src(`pad${v}a`) + src(`pad${v}b`);
    desc += src('drone0') + src('drone1');
    for (let b = 0; b < 3; b++)
        desc += src(`bell${b}`) + src(`bell${b}h`);
    desc += src('wind', 'pink-noise');
    return desc;
}

// The folder's tracks play in a helper process (music-player.js), not in
// gnome-shell: what a file holds decides which demuxers and decoders
// GStreamer loads, and a bad file should not take the desktop with it. This
// stands in for its playbin: uri, volume and set_state, with onEnd and
// onError for what its bus would say.
class TrackPlayer {
    constructor({onEnd, onError}) {
        const gjs = GLib.find_program_in_path('gjs') ?? GLib.find_program_in_path('gjs-console');
        if (!gjs)
            throw new Error('gjs is missing');
        const script = GLib.filename_from_uri(GLib.uri_resolve_relative(import.meta.url, 'music-player.js', GLib.UriFlags.NONE))[0];
        this._proc = Gio.Subprocess.new([gjs, '-m', script],
            Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE);
        this._cancellable = new Gio.Cancellable();
        this._stdin = this._proc.get_stdin_pipe();
        this._queue = [];
        this._rest = null;      // what a short write left over
        this._writing = false;
        this.dead = false;
        this._onEnd = onEnd;
        this._onError = onError;

        const out = new Gio.DataInputStream({base_stream: this._proc.get_stdout_pipe(), close_base_stream: true});
        const read = () => out.read_line_async(GLib.PRIORITY_DEFAULT, this._cancellable, (s, res) => {
            let line = null;
            try {
                [line] = s.read_line_finish_utf8(res);
            } catch {
                return;     // cancelled: destroyed
            }
            if (line === null)
                return;     // it has gone; wait_async below says so
            if (line === 'eos')
                this._onEnd();
            else if (line.startsWith('error '))
                this._onError(line.slice(6));
            read();
        });
        read();
        this._proc.wait_async(this._cancellable, () => {
            if (this._cancellable.is_cancelled())
                return;
            this.dead = true;
            this._onError('the music player stopped');
        });
    }

    set uri(uri) {
        this._send(`uri ${uri}`);
    }

    set volume(v) {
        this._send(`volume ${v.toFixed(3)}`);
    }

    set_state(state) {
        const name = {[Gst.State.PLAYING]: 'playing', [Gst.State.PAUSED]: 'paused', [Gst.State.READY]: 'ready'}[state];
        if (name)
            this._send(`state ${name}`);
    }

    // Written in turn, never waiting on the helper: the shell must not
    // block on it. Of the volume steps of a fade, only the latest counts.
    _send(line) {
        if (this.dead || this._cancellable.is_cancelled())
            return;
        if (line.startsWith('volume '))
            this._queue = this._queue.filter(x => !x.startsWith('volume '));
        this._queue.push(line);
        this._flush();
    }

    _flush() {
        if (this._writing || !this._rest && !this._queue.length)
            return;
        this._writing = true;
        const data = this._rest ?? new TextEncoder().encode(`${this._queue.join('\n')}\n`);
        this._rest = null;
        this._queue = [];
        this._stdin.write_bytes_async(new GLib.Bytes(data), GLib.PRIORITY_DEFAULT, this._cancellable, (s, res) => {
            let n;
            try {
                n = s.write_bytes_finish(res);
            } catch {
                return;     // cancelled, or it has gone
            }
            if (n < data.length)
                this._rest = data.subarray(n);
            this._writing = false;
            this._flush();
        });
    }

    // Closing its stdin ends it; the kill is for one that hangs.
    destroy() {
        this._cancellable.cancel();
        try {
            this._stdin.close(null);
        } catch {
            // Already gone.
        }
        this._proc.force_exit();
    }
}

export class Music {
    // onError(message) is called when nothing can play. sink replaces the
    // speakers (the tests render to a file).
    constructor({onError, sink} = {}) {
        this._onError = onError;
        this._sink = sink;
        this._source = 'ambient';
        this._folder = '';
        this._volume = 0.35;
        this._wanted = false;
        this._level = 0;
        this._fadeId = 0;
        this._tickId = 0;
    }

    get playing() {
        return this._wanted;
    }

    setVolume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this._wanted && !this._fadeId)
            this._setLevel(this._volume);
    }

    // kind: 'ambient' or 'folder'
    setSource(kind, folder = '') {
        if (kind === this._source && folder === this._folder)
            return;
        this._source = kind;
        this._folder = folder;
        const was = this._wanted;
        this._teardown();
        if (was) {
            this._wanted = false;
            this.play();
        }
    }

    async play() {
        if (this._wanted)
            return;
        this._wanted = true;
        await loadGst();
        if (!this._wanted || !Gst)
            return;
        if (!this._pipeline && !this._build())
            return;
        this._pipeline.set_state(Gst.State.PLAYING);
        if (this._source === 'ambient' && !this._tickId) {
            this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._compose();
                return GLib.SOURCE_CONTINUE;
            });
            this._compose();
        }
        this._fade(this._volume, 2500);
    }

    // release: let go of the sound device too (when muted, rather than just
    // waiting for the desktop to show again).
    pause({release = false} = {}) {
        if (!this._wanted) {
            if (release && !this._fadeId)
                this._teardown();
            return;
        }
        this._wanted = false;
        this._fade(0, 1200, () => {
            if (this._wanted)
                return;
            if (release)
                this._teardown();
            else
                this._pipeline?.set_state(Gst.State.PAUSED);
        });
    }

    destroy() {
        this._wanted = false;
        this._teardown();
    }

    // ---- Pipeline ----

    _build() {
        try {
            if (this._source === 'folder')
                return this._buildPlayer();
            try {
                this._pipeline = Gst.parse_launch(ambientDescription(true, this._sink));
            } catch {
                // No echo or filter plugins: play it dry.
                this._pipeline = Gst.parse_launch(ambientDescription(false, this._sink));
            }
            this._master = this._pipeline.get_by_name('master');
            this._setupAmbient();
        } catch (e) {
            this._fail(`could not start the music: ${e.message}`);
            return false;
        }
        this._watchBus();
        return true;
    }

    _buildPlayer() {
        this._tracks = this._listTracks();
        if (!this._tracks.length) {
            this._fail(this._folder ? `no music files in ${this._folder}` : 'no music folder chosen');
            return false;
        }
        if (!this._startPlayer())
            return false;
        this._nextTrack();
        return true;
    }

    // A track that will not play is dropped, unless it was the last one. If
    // it took the player down with it, a new player takes over.
    _trackFailed(message) {
        if (this._tracks.length <= 1) {
            this._fail(message);
            return;
        }
        console.warn(`Orrery: skipping a track: ${message}`);
        this._tracks.splice(this._trackIndex--, 1);
        if (this._pipeline.dead) {
            this._pipeline.destroy();
            this._pipeline = this._master = null;
            if (!this._startPlayer())
                return;
            this._pipeline.volume = this._level;
        }
        this._nextTrack();
    }

    _startPlayer() {
        try {
            this._pipeline = this._master = new TrackPlayer({
                onEnd: () => this._nextTrack(),
                onError: message => this._trackFailed(message),
            });
            return true;
        } catch (e) {
            this._fail(`could not start the music player: ${e.message}`);
            return false;
        }
    }

    _listTracks() {
        const out = [];
        try {
            const dir = Gio.File.new_for_path(this._folder.replace(/^~/, GLib.get_home_dir()));
            const e = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
            for (let info; (info = e.next_file(null));) {
                const name = info.get_name();
                if (info.get_file_type() === Gio.FileType.REGULAR && AUDIO_EXTENSIONS.some(x => name.toLowerCase().endsWith(x)))
                    out.push(dir.get_child(name).get_uri());
            }
        } catch (e) {
            console.warn(`Orrery: cannot read the music folder: ${e.message}`);
        }
        return out.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    }

    _nextTrack() {
        this._trackIndex = ((this._trackIndex ?? -1) + 1) % this._tracks.length;
        this._pipeline.set_state(Gst.State.READY);
        this._pipeline.uri = this._tracks[this._trackIndex];
        if (this._wanted)
            this._pipeline.set_state(Gst.State.PLAYING);
    }

    _watchBus() {
        const bus = this._pipeline.get_bus();
        bus.add_signal_watch();
        this._busId = bus.connect('message', (_b, msg) => {
            if (msg.type === Gst.MessageType.ERROR)
                this._fail(msg.parse_error()[0].message);
        });
    }

    _teardown() {
        for (const id of [this._fadeId, this._tickId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._fadeId = this._tickId = 0;
        if (this._pipeline instanceof TrackPlayer) {
            this._pipeline.destroy();
        } else if (this._pipeline) {
            const bus = this._pipeline.get_bus();
            if (this._busId)
                bus.disconnect(this._busId);
            bus.remove_signal_watch();
            this._pipeline.set_state(Gst.State.NULL);
        }
        this._pipeline = this._master = null;
        this._busId = 0;
        this._voices = null;
        this._level = 0;
    }

    _fail(message) {
        console.warn(`Orrery: ${message}`);
        this._wanted = false;
        this._teardown();
        this._onError?.(message);
    }

    _setLevel(v) {
        this._level = v;
        if (this._master)
            this._master.volume = v;
    }

    _fade(to, ms, done) {
        if (this._fadeId)
            GLib.source_remove(this._fadeId);
        const from = this._level, t0 = GLib.get_monotonic_time();
        this._fadeId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
            const k = Math.min(1, (GLib.get_monotonic_time() - t0) / 1000 / ms);
            this._setLevel(from + (to - from) * k * k * (3 - 2 * k));
            if (k < 1)
                return GLib.SOURCE_CONTINUE;
            this._fadeId = 0;
            done?.();
            return GLib.SOURCE_REMOVE;
        });
    }

    // ---- The ambient piece ----

    // Each oscillator's frequency and volume follow control curves that are
    // written a few seconds ahead of where the stream is.
    _setupAmbient() {
        const control = (name, prop, mode = GstController.InterpolationMode.LINEAR) => {
            const el = this._pipeline.get_by_name(name);
            const cs = new GstController.InterpolationControlSource();
            cs.mode = mode;
            el.add_control_binding(GstController.DirectControlBinding.new_absolute(el, prop, cs));
            return {el, cs, points: []};
        };
        const lfo = (name, hz, offset, amplitude) => {
            const el = this._pipeline.get_by_name(name);
            const cs = new GstController.LFOControlSource({frequency: hz, offset, amplitude, waveform: GstController.LFOWaveform.SINE});
            el.add_control_binding(GstController.DirectControlBinding.new_absolute(el, 'volume', cs));
        };
        this._voices = {pads: [], bells: []};
        for (let v = 0; v < 4; v++) {
            const pair = ['a', 'b'].map(x => control(`pad${v}${x}`, 'freq'));
            pair.forEach((p, i) => lfo(`pad${v}${'ab'[i]}`, 0.021 + 0.013 * v + 0.004 * i, 0.055 - 0.008 * v, 0.03));
            this._voices.pads.push(pair);
        }
        this._pipeline.get_by_name('drone0').set({freq: 55});
        this._pipeline.get_by_name('drone1').set({freq: 82.41});
        lfo('drone0', 0.017, 0.07, 0.03);
        lfo('drone1', 0.011, 0.035, 0.025);
        lfo('wind', 0.007, 0.006, 0.004);
        for (let b = 0; b < 3; b++) {
            this._voices.bells.push({
                freq: control(`bell${b}`, 'freq', GstController.InterpolationMode.NONE),
                freqH: control(`bell${b}h`, 'freq', GstController.InterpolationMode.NONE),
                vol: control(`bell${b}`, 'volume'),
                volH: control(`bell${b}h`, 'volume'),
            });
        }
        this._chord = 0;
        this._nextChord = 0;
        this._nextBell = 2 * SECOND;
        this._bellVoice = 0;
    }

    _point(c, t, value) {
        c.cs.set(t, value);
        c.points.push(t);
        // Forget points well behind the stream.
        while (c.points.length > 12 && c.points[0] < t - 60 * SECOND)
            c.cs.unset(c.points.shift());
    }

    _compose() {
        if (!this._pipeline || !this._voices)
            return;
        const [ok, pos] = this._pipeline.query_position(Gst.Format.TIME);
        const now = ok ? pos : 0;
        while (this._nextChord < now + LOOKAHEAD) {
            const t = Math.max(this._nextChord, now + 0.2 * SECOND);
            const chord = CHORDS[this._chord % CHORDS.length];
            this._voices.pads.forEach((pair, v) => pair.forEach((p, i) => {
                const f = chord[v] + (i ? DETUNE : 0);
                if (!p.points.length) {
                    this._point(p, 0, f);
                } else {
                    this._point(p, t, p.last ?? f);
                    this._point(p, t + GLIDE_SECONDS * SECOND, f);
                }
                p.last = f;
            }));
            this._chord++;
            this._nextChord = t + CHORD_SECONDS * SECOND;
        }
        while (this._nextBell < now + LOOKAHEAD) {
            const t = Math.max(this._nextBell, now + 0.2 * SECOND);
            const voice = this._voices.bells[this._bellVoice++ % 3];
            const f = BELLS[Math.floor(Math.random() * BELLS.length)] / (Math.random() < 0.25 ? 2 : 1);
            const peak = 0.05 + 0.04 * Math.random();
            this._point(voice.freq, t, f);
            this._point(voice.freqH, t, 2 * f);
            for (const [c, k] of [[voice.vol, 1], [voice.volH, 0.22]]) {
                this._point(c, t, 0);
                this._point(c, t + 0.03 * SECOND, peak * k);
                this._point(c, t + 1.2 * SECOND, peak * k * 0.35);
                this._point(c, t + 5.5 * SECOND, 0);
            }
            // Sparse and unhurried: a note every 3 to 10 seconds, now and
            // then a quick second one.
            this._nextBell = t + (Math.random() < 0.2 ? 0.6 : 3 + 7 * Math.random()) * SECOND;
        }
    }
}

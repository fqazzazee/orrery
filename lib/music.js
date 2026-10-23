// Background music: a slow ambient piece made up as it plays (drifting pad
// chords, a low drone and soft bell notes in long echoes), or the tracks in
// a folder of your own, shuffled. GStreamer does the sound; everything here
// runs on the main loop (bus messages and timers), never in GStreamer's
// streaming threads.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

let Gst = null, GstController = null;
const loading = (async () => {
    try {
        Gst = (await import('gi://Gst?version=1.0')).default;
        GstController = (await import('gi://GstController?version=1.0')).default;
        Gst.init(null);
    } catch (e) {
        console.warn(`Orrery: no GStreamer, so no music: ${e.message}`);
        Gst = null;
    }
})();

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
        await loading;
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
        this._pipeline = Gst.ElementFactory.make('playbin', 'orrery-music');
        if (!this._pipeline) {
            this._fail('GStreamer’s playbin is missing');
            return false;
        }
        this._master = this._pipeline;
        this._pipeline.volume = 0;
        this._nextTrack();
        this._watchBus();
        return true;
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
            if (msg.type === Gst.MessageType.EOS && this._source === 'folder') {
                this._nextTrack();
            } else if (msg.type === Gst.MessageType.ERROR) {
                const [err] = msg.parse_error();
                if (this._source === 'folder' && this._tracks.length > 1) {
                    console.warn(`Orrery: skipping a track: ${err.message}`);
                    this._tracks.splice(this._trackIndex--, 1);
                    this._nextTrack();
                } else {
                    this._fail(err.message);
                }
            }
        });
    }

    _teardown() {
        for (const id of [this._fadeId, this._tickId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._fadeId = this._tickId = 0;
        if (this._pipeline) {
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

// Plays the tracks of your music folder for lib/music.js, in a process of
// its own rather than in gnome-shell: what a file holds, not its name,
// decides which demuxers and decoders GStreamer loads, so a bad or hostile
// file can at worst take this player down, not the desktop.
//
// Commands on stdin, one a line: "uri <file uri>", "state playing|paused|
// ready", "volume <0..1>". It answers on stdout with "eos" and "error
// <message>", and quits when stdin closes.
//
//   gjs -m music-player.js

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import Gst from 'gi://Gst?version=1.0';
import System from 'system';

Gst.init(null);
const loop = new GLib.MainLoop(null, false);

// Nothing that streams: a "track" that is really an HLS, DASH or SDP
// description would otherwise have it fetch from the network. Without
// these the file fails like any unplayable one, and is skipped.
for (const f of Gst.Registry.get().get_feature_list(Gst.ElementFactory.$gtype)) {
    if (/Adaptive|Network/.test(f.get_metadata('klass') ?? ''))
        f.set_rank(Gst.Rank.NONE);
}

const out = new Gio.DataOutputStream({base_stream: new GioUnix.OutputStream({fd: 1, close_fd: false})});
const say = line => {
    try {
        out.put_string(`${line.replace(/\n/g, ' ')}\n`, null);
        out.flush(null);
    } catch {
        loop.quit();    // nobody listening
    }
};

const player = Gst.ElementFactory.make('playbin', 'orrery-music');
if (!player) {
    say('error GStreamer’s playbin is missing');
    System.exit(1);
}
// Sound only: no video or subtitle decoders. (GstPlayFlags AUDIO and
// SOFT_VOLUME, which are not introspected.)
player.flags = (1 << 1) | (1 << 4);
player.volume = 0;
const bus = player.get_bus();
bus.add_signal_watch();
// One error a track: a file that fails often posts several.
let failed = false;
bus.connect('message', (_b, msg) => {
    if (msg.type === Gst.MessageType.EOS) {
        say('eos');
    } else if (msg.type === Gst.MessageType.ERROR && !failed) {
        failed = true;
        say(`error ${msg.parse_error()[0].message}`);
    }
});

const STATES = {playing: Gst.State.PLAYING, paused: Gst.State.PAUSED, ready: Gst.State.READY};
const input = new Gio.DataInputStream({base_stream: new GioUnix.InputStream({fd: 0, close_fd: false})});
const read = () => input.read_line_async(GLib.PRIORITY_DEFAULT, null, (s, res) => {
    let line = null;
    try {
        [line] = s.read_line_finish_utf8(res);
    } catch {
        // A broken pipe: as good as closed.
    }
    if (line === null) {
        loop.quit();
        return;
    }
    const [cmd, ...rest] = line.split(' ');
    const arg = rest.join(' ');
    if (cmd === 'uri' && arg.startsWith('file://')) {
        player.uri = arg;
        failed = false;
    }
    else if (cmd === 'state' && arg in STATES)
        player.set_state(STATES[arg]);
    else if (cmd === 'volume' && Number.isFinite(Number(arg)))
        player.volume = Math.max(0, Math.min(1, Number(arg)));
    read();
});
read();
loop.run();
player.set_state(Gst.State.NULL);

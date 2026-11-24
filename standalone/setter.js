// Setting a picture as the wallpaper, the way each desktop expects.

import GLib from 'gi://GLib';

const has = cmd => !!GLib.find_program_in_path(cmd);
const uri = file => GLib.filename_to_uri(file, null);

function sh(argv) {
    try {
        const [, , err, status] = GLib.spawn_sync(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
        if (status !== 0)
            printerr(`orrery-wallpaper: ${argv[0]} failed: ${new TextDecoder().decode(err).trim()}`);
        return status === 0;
    } catch (e) {
        printerr(`orrery-wallpaper: ${argv[0]}: ${e.message}`);
        return false;
    }
}

function output(argv) {
    try {
        const [, out] = GLib.spawn_sync(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
        return new TextDecoder().decode(out);
    } catch {
        return '';
    }
}

const readText = file => {
    try {
        return new TextDecoder().decode(GLib.file_get_contents(file)[1]).trim();
    } catch {
        return '';
    }
};

// A long-running wallpaper program (swaybg): start a new one, then stop the
// one before, so the screen is never bare. The old pid is kept in a file, as
// one-shot `apply` runs are separate processes; it waits here rather than on
// a timeout, because `apply` exits without running a main loop.
function respawn(argv) {
    const dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'orrery']);
    GLib.mkdir_with_parents(dir, 0o755);
    const pidFile = GLib.build_filenamev([dir, `${argv[0]}.pid`]);
    const old = readText(pidFile);
    const [, pid] = GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => GLib.spawn_close_pid(pid));
    GLib.file_set_contents(pidFile, String(pid));
    // Only if that pid is still one of ours, not a reused number.
    if (/^\d+$/.test(old) && readText(`/proc/${old}/comm`) === argv[0]) {
        GLib.usleep(1500 * 1000);
        sh(['kill', old]);
    }
    return true;
}

// COSMIC's background service reads its own config, not GSettings, and
// reloads when the file changes.
function setCosmic(file) {
    const dir = GLib.build_filenamev([GLib.get_user_config_dir(), 'cosmic', 'com.system76.CosmicBackground', 'v1']);
    GLib.mkdir_with_parents(dir, 0o755);
    const entry = `(
    output: "all",
    source: Path(${JSON.stringify(file)}),
    filter_by_theme: false,
    rotation_frequency: 300,
    filter_method: Lanczos,
    scaling_mode: Zoom,
    sampling_method: Alphanumeric,
)`;
    try {
        GLib.file_set_contents(GLib.build_filenamev([dir, 'same-on-all']), 'true');
        GLib.file_set_contents(GLib.build_filenamev([dir, 'all']), entry);
        return true;
    } catch (e) {
        printerr(`orrery-wallpaper: cannot write COSMIC's background settings: ${e.message}`);
        return false;
    }
}

export function detectDesktop() {
    const env = name => (GLib.getenv(name) ?? '').toLowerCase();
    const desktop = `${env('XDG_CURRENT_DESKTOP')}:${env('DESKTOP_SESSION')}`;
    if (env('HYPRLAND_INSTANCE_SIGNATURE'))
        return 'hyprland';
    if (env('SWAYSOCK'))
        return 'sway';
    for (const name of ['kde', 'xfce', 'cinnamon', 'mate', 'budgie', 'lxqt', 'lxde', 'pantheon', 'deepin', 'cosmic',
        'niri', 'river', 'labwc', 'wayfire', 'unity', 'gnome']) {
        if (desktop.includes(name))
            return name;
    }
    return env('WAYLAND_DISPLAY') ? 'wayland' : 'x11';
}

// Set `file` (a PNG) as the wallpaper on every screen. True if it worked.
export function applyWallpaper(file) {
    switch (detectDesktop()) {
    case 'kde':
        return sh(['plasma-apply-wallpaperimage', file]);
    case 'xfce': {
        const props = output(['xfconf-query', '-c', 'xfce4-desktop', '-l']).split('\n').filter(p => p.endsWith('/last-image'));
        if (!props.length)
            props.push('/backdrop/screen0/monitor0/workspace0/last-image');
        return props.every(p => sh(['xfconf-query', '-c', 'xfce4-desktop', '-p', p, '--create', '-t', 'string', '-s', file]));
    }
    case 'cinnamon':
        return sh(['gsettings', 'set', 'org.cinnamon.desktop.background', 'picture-uri', uri(file)]) &&
            sh(['gsettings', 'set', 'org.cinnamon.desktop.background', 'picture-options', 'zoom']);
    case 'mate':
        return sh(['gsettings', 'set', 'org.mate.background', 'picture-filename', file]) &&
            sh(['gsettings', 'set', 'org.mate.background', 'picture-options', 'zoom']);
    case 'lxqt':
        return sh(['pcmanfm-qt', '--set-wallpaper', file, '--wallpaper-mode=zoom']);
    case 'lxde':
        return sh(['pcmanfm', '--set-wallpaper', file, '--wallpaper-mode=crop']);
    case 'sway':
        return sh(['swaymsg', 'output', '*', 'bg', file, 'fill']);
    case 'hyprland':
        if (output(['pgrep', '-x', 'hyprpaper']).trim()) {
            return sh(['hyprctl', 'hyprpaper', 'preload', file]) &&
                sh(['hyprctl', 'hyprpaper', 'wallpaper', `,${file}`]) &&
                sh(['hyprctl', 'hyprpaper', 'unload', 'unused']);
        }
        break;
    case 'cosmic':
        return setCosmic(file);
    case 'budgie':
    case 'gnome':
    case 'pantheon':
    case 'unity':
        // (On GNOME the extension is the better way; this is a fallback.)
        if (has('gsettings'))
            return sh(['gsettings', 'set', 'org.gnome.desktop.background', 'picture-uri', uri(file)]) &&
                sh(['gsettings', 'set', 'org.gnome.desktop.background', 'picture-uri-dark', uri(file)]) &&
                sh(['gsettings', 'set', 'org.gnome.desktop.background', 'picture-options', 'zoom']);
        break;
    }
    // Anything else: the usual standalone wallpaper tools.
    if (GLib.getenv('WAYLAND_DISPLAY')) {
        if (has('swww') && output(['pgrep', '-x', 'swww-daemon']).trim())
            return sh(['swww', 'img', '--transition-type', 'none', file]);
        if (has('swaybg'))
            return respawn(['swaybg', '-m', 'fill', '-i', file]);
    }
    if (has('feh'))
        return sh(['feh', '--no-fehbg', '--bg-fill', file]);
    if (has('nitrogen'))
        return sh(['nitrogen', '--set-zoom-fill', '--save', file]);
    if (has('xwallpaper'))
        return sh(['xwallpaper', '--zoom', file]);
    printerr(`orrery-wallpaper: do not know how to set the wallpaper on ${detectDesktop()}; the picture is at ${file}`);
    return false;
}

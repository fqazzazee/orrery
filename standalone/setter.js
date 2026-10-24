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

// A long-running wallpaper program (swaybg): start a new one, then stop the
// one before, so the screen is never bare.
let background = null;
function respawn(argv) {
    const [, pid] = GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => GLib.spawn_close_pid(pid));
    const old = background;
    background = pid;
    if (old)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
            sh(['kill', String(old)]);
            return GLib.SOURCE_REMOVE;
        });
    return true;
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
    case 'budgie':
    case 'gnome':
    case 'pantheon':
    case 'unity':
    case 'cosmic':
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

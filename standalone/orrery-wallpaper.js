// orrery-wallpaper: Orrery for desktops other than GNOME Shell.
//
//   orrery-wallpaper render [FILE] [--size WxH] [--date ISO]   draw one picture
//   orrery-wallpaper apply                                      draw it and set it as the wallpaper
//   orrery-wallpaper daemon [--every MINUTES]                   keep the wallpaper up to date
//   orrery-wallpaper live [--speed DAYS_PER_SECOND]             animated background (Wayland layer-shell)
//
// Options for every command: --tilt DEG --azimuth DEG --scale sqrt|log|linear
// --no-hud --no-labels --no-trails --no-moons --zoom PERCENT

import Cairo from 'cairo';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import System from 'system';

import * as Astro from '../lib/astro.js';
import {MISSIONS, buildTrajectories} from '../lib/missions.js';
import {drawScene, makeView} from './scene.js';
import {applyWallpaper, detectDesktop} from './setter.js';

const USAGE = `Usage: orrery-wallpaper COMMAND [options]

Commands:
  render [FILE]   Draw the solar system as it is now into FILE (PNG)
  apply           Draw it and set it as the desktop wallpaper
  daemon          Keep the wallpaper up to date (every 10 minutes by default)
  live            Animated background on Wayland compositors with layer-shell
                  (Sway, Hyprland, niri, labwc, river, Wayfire, COSMIC, KDE Plasma)

Options:
  --size WxH          picture size (default: the screen, else 3840x2160)
  --date ISO          a date to show instead of now (e.g. 1989-08-25)
  --every MINUTES     how often the daemon redraws (default 10)
  --speed DAYS        live mode: simulated days per second (default 0 = real time)
  --tilt DEG          camera tilt from above the Sun (default 58)
  --azimuth DEG       camera rotation (default 0)
  --scale MODE        sqrt, log or linear distances (default sqrt)
  --zoom PERCENT      default 100
  --no-hud --no-labels --no-trails --no-moons --no-missions
`;

function parse(argv) {
    const opts = {command: argv[0], files: []};
    for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        const value = () => argv[++i];
        if (a === '--size') {
            const [w, h] = value().split('x').map(Number);
            opts.size = [w, h];
        } else if (a === '--date') {
            opts.date = value();
        } else if (a === '--every') {
            opts.every = Number(value());
        } else if (a === '--speed') {
            opts.speed = Number(value());
        } else if (a === '--tilt') {
            opts.tilt = Number(value());
        } else if (a === '--azimuth') {
            opts.azimuth = Number(value());
        } else if (a === '--scale') {
            opts.scale = value();
        } else if (a === '--zoom') {
            opts.zoom = Number(value()) / 100;
        } else if (a.startsWith('--no-')) {
            opts[a.slice(5)] = false;
        } else if (a === '-h' || a === '--help') {
            opts.command = 'help';
        } else {
            opts.files.push(a);
        }
    }
    return opts;
}

async function screenSize() {
    try {
        // GDK has no display until GTK is initialised. init_check, unlike
        // init, just returns false when there is no screen (cron, ssh).
        const Gtk = (await import('gi://Gtk?version=4.0')).default;
        const Gdk = (await import('gi://Gdk?version=4.0')).default;
        const display = Gtk.init_check() ? Gdk.Display.get_default() : null;
        const monitors = display?.get_monitors();
        if (monitors?.get_n_items()) {
            const m = monitors.get_item(0);
            // get_scale (GTK 4.14) is the fractional one, e.g. 1.5.
            const g = m.get_geometry(), scale = m.get_scale?.() ?? m.get_scale_factor();
            return [Math.round(g.width * scale), Math.round(g.height * scale)];
        }
    } catch {
        // No display: fall back.
    }
    return [3840, 2160];
}

const jdOf = opts => opts.date ? Astro.jdFromMs(Date.parse(opts.date.length === 10 ? `${opts.date}T12:00:00Z` : opts.date)) : Astro.jdNow();

function sceneOptions(opts) {
    return {
        hud: opts.hud !== false, labels: opts.labels !== false, trails: opts.trails !== false,
        moons: opts.moons !== false, fact: opts.hud !== false,
    };
}

export function renderFile(file, [W, H], jd, opts, trajectories) {
    const surface = new Cairo.ImageSurface(Cairo.Format.RGB24, W, H);
    const cr = new Cairo.Context(surface);
    // Big screens get proportionally bigger planets and text.
    const k = Math.max(1, Math.min(W / 1920, H / 1080));
    cr.scale(k, k);
    const view = makeView(W / k, H / k, {tilt: opts.tilt, azimuth: opts.azimuth, scale: opts.scale, zoom: opts.zoom});
    const date = opts.date ? `Showing ${Astro.formatDate(jd)}` : `The solar system on ${Astro.formatDate(jd)}, as it really is`;
    drawScene(cr, view, jd, opts.missions === false ? [] : trajectories, {...sceneOptions(opts), caption: date});
    cr.$dispose();
    surface.writeToPNG(file);
}

// Draw into the cache and return the file. Two names in turn, as some
// desktops only reload when the path changes: the older of the two (by what
// is on disk, so one-shot `apply` runs alternate too) is replaced, never the
// one on screen. It is drawn under a temporary name and renamed into place,
// so nothing ever reads half a picture.
function renderCached(size, jd, opts, trajectories) {
    const dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'orrery']);
    GLib.mkdir_with_parents(dir, 0o755);
    const age = name => {
        try {
            const info = Gio.File.new_for_path(name).query_info('time::modified,time::modified-usec', Gio.FileQueryInfoFlags.NONE, null);
            return info.get_attribute_uint64('time::modified') * 1e6 + info.get_attribute_uint32('time::modified-usec');
        } catch {
            return -1;      // missing: use it first
        }
    };
    const [a, b] = [0, 1].map(n => GLib.build_filenamev([dir, `wallpaper-${n}.png`]));
    const file = age(a) <= age(b) ? a : b;
    const tmp = `${file}.tmp`;
    try {
        renderFile(tmp, size, jd, opts, trajectories);
        if (GLib.rename(tmp, file) !== 0)
            throw new Error(`cannot write ${file}`);
    } finally {
        GLib.unlink(tmp);   // only left over if something failed
    }
    return file;
}

async function main(argv) {
    const opts = parse(argv);
    if (!opts.command || opts.command === 'help') {
        print(USAGE);
        return 0;
    }
    const trajectories = buildTrajectories(MISSIONS);
    switch (opts.command) {
    case 'render': {
        const file = opts.files[0] ?? 'orrery.png';
        renderFile(file, opts.size ?? await screenSize(), jdOf(opts), opts, trajectories);
        print(file);
        return 0;
    }
    case 'apply': {
        const file = renderCached(opts.size ?? await screenSize(), jdOf(opts), opts, trajectories);
        return applyWallpaper(file) ? 0 : 1;
    }
    case 'daemon': {
        const every = Math.max(1, opts.every ?? 10);
        const size = opts.size ?? await screenSize();
        print(`orrery-wallpaper: ${detectDesktop()} desktop, redrawing every ${every} min`);
        const loop = new GLib.MainLoop(null, false);
        const tick = () => {
            try {
                applyWallpaper(renderCached(size, Astro.jdNow(), opts, trajectories));
            } catch (e) {
                printerr(`orrery-wallpaper: ${e.message}`);
            }
            return GLib.SOURCE_CONTINUE;
        };
        tick();
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, every * 60, tick);
        loop.run();
        return 0;
    }
    case 'live': {
        const {runLive} = await import('./live.js');
        // Same start as render: a date alone is noon UTC.
        return runLive(opts, trajectories, sceneOptions(opts), jdOf(opts));
    }
    default:
        printerr(USAGE);
        return 2;
    }
}

const code = await main(System.programArgs);
System.exit(code);

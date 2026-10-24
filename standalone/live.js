// The animated background, for Wayland compositors with the layer-shell
// protocol (Sway, Hyprland, niri, labwc, river, Wayfire, COSMIC, KDE
// Plasma): a full-screen surface on the background layer, under every
// window. Planets spin, moons circle and craft fly; the parts that move
// slowly (stars, belts, orbits, trails, text) are drawn into cached
// pictures and refreshed now and then.

import Cairo from 'cairo';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

import * as Astro from '../lib/astro.js';
import {BODY} from '../lib/bodies.js';
import {drawBackdrop, drawBodies, drawHud, drawTrails, makeView} from './scene.js';

let LayerShell = null;
try {
    LayerShell = (await import('gi://Gtk4LayerShell?version=1.0')).default;
} catch {
    // Checked below.
}

const FPS = 24;
const SPIN_DAY = 12;            // real seconds for one turn of the Earth
const SLOW_SECONDS = 2;         // how often the cached layers are redrawn

export function runLive(opts, trajectories, sceneOpts) {
    if (!LayerShell || !LayerShell.is_supported()) {
        printerr('orrery-wallpaper: live mode needs a Wayland compositor with layer-shell (Sway, Hyprland, niri, labwc, river, ' +
            'Wayfire, COSMIC, KDE Plasma) and gtk4-layer-shell. Use "orrery-wallpaper daemon" elsewhere.');
        return 1;
    }
    const app = new Gtk.Application({application_id: 'io.github.fqazzazee.OrreryWallpaper'});
    app.connect('activate', () => {
        const win = new Gtk.ApplicationWindow({application: app, title: 'Orrery'});
        LayerShell.init_for_window(win);
        LayerShell.set_layer(win, LayerShell.Layer.BACKGROUND);
        LayerShell.set_namespace(win, 'orrery');
        for (const edge of [LayerShell.Edge.TOP, LayerShell.Edge.BOTTOM, LayerShell.Edge.LEFT, LayerShell.Edge.RIGHT])
            LayerShell.set_anchor(win, edge, true);
        LayerShell.set_exclusive_zone(win, -1);
        LayerShell.set_keyboard_mode(win, LayerShell.KeyboardMode.NONE);

        const area = new Gtk.DrawingArea();
        win.set_child(area);

        const speed = opts.speed ?? 0;           // days per second; 0 is real time
        const start = opts.date ? Astro.jdFromMs(Date.parse(opts.date)) : Astro.jdNow();
        const t0 = GLib.get_monotonic_time();
        const now = () => (GLib.get_monotonic_time() - t0) / 1e6;
        const jdAt = s => speed ? start + s * speed : Astro.jdNow();

        let cache = null;   // {w, h, view, backdrop, trails, at}
        let hud = null;     // {surface, at}
        const layer = (w, h, paint) => {
            const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, w, h);
            const cr = new Cairo.Context(surface);
            paint(cr);
            cr.$dispose();
            return surface;
        };
        const rebuild = (w, h, s) => {
            const view = makeView(w, h, {tilt: opts.tilt, azimuth: opts.azimuth, scale: opts.scale, zoom: opts.zoom});
            const jd = jdAt(s);
            cache = {
                w, h, view, at: s,
                backdrop: layer(w, h, cr => drawBackdrop(cr, view, jd, sceneOpts)),
                trails: sceneOpts.trails ? layer(w, h, cr => drawTrails(cr, view, jd, trajectories)) : null,
            };
        };
        // The date and mission list: every second when replaying, else every
        // half minute, which is also how long each fact stays up.
        const redrawHud = s => {
            hud = {at: s, surface: layer(cache.w, cache.h, cr => drawHud(cr, cache.view, jdAt(s), trajectories, {
                ...sceneOpts, fact: !speed && sceneOpts.fact,
                caption: speed ? `Replaying · ${speed} days per second` : 'Live · the solar system right now',
            }))};
        };

        area.set_draw_func((_a, cr, w, h) => {
            const s = now();
            if (!cache || cache.w !== w || cache.h !== h || s - cache.at > SLOW_SECONDS) {
                const resized = cache?.w !== w || cache?.h !== h;
                rebuild(w, h, s);
                if (resized)
                    hud = null;
            }
            if (sceneOpts.hud && (!hud || s - hud.at > (speed ? 1 : 30)))
                redrawHud(s);
            for (const surface of [cache.backdrop, cache.trails]) {
                if (surface) {
                    cr.setSourceSurface(surface, 0, 0);
                    cr.paint();
                }
            }
            // Planets turn on a slower clock than the real one, as in the
            // extension, so their spin can be seen.
            drawBodies(cr, cache.view, jdAt(s), trajectories, {
                ...sceneOpts,
                spinPhase: b => 2 * Math.PI * s / (Math.abs(BODY[b.id].rotationHours) / 23.9345 * SPIN_DAY) * Math.sign(BODY[b.id].rotationHours),
            });
            if (sceneOpts.hud && hud) {
                cr.setSourceSurface(hud.surface, 0, 0);
                cr.paint();
            }
        });
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.round(1000 / FPS), () => {
            area.queue_draw();
            return GLib.SOURCE_CONTINUE;
        });
        win.present();
    });
    return app.run([]);
}

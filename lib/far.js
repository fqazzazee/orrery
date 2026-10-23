// What shows when the view zooms out past the planets: the bubble of the
// solar wind, rings of light-travel time, the Oort cloud, the nearest stars,
// and where the escaping spacecraft are headed, with the years they get
// there.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as A from './astro.js';
import * as R from './render.js';
import {label} from './ui.js';

const LY = 63241;   // AU in a light-year

// Spheres around the Sun, drawn as their rings in the plane of the planets
// (so things in that plane are inside or outside them as they look).
const SHELLS = [
    {r: 90, name: 'Termination shock', rank: 5, au: true, rgb: [0.55, 0.75, 1], alpha: 0.22, dash: [3, 4]},
    {r: 120, name: 'Heliopause', rank: 0, au: true, rgb: [0.55, 0.85, 1], alpha: 0.35},
    {r: 173.1, name: '1 light-day', rank: 4, rgb: [1, 1, 1], alpha: 0.12, dash: [1, 5]},
    {r: 1212, name: '1 light-week', rank: 3, rgb: [1, 1, 1], alpha: 0.12, dash: [1, 5]},
    {r: 5260, name: '1 light-month', rank: 2, rgb: [1, 1, 1], alpha: 0.12, dash: [1, 5]},
    {r: LY, name: '1 light-year', rank: 1, rgb: [1, 1, 1], alpha: 0.14, dash: [1, 5]},
];

// The nearest stars: [name, RA, Dec (degrees), light-years].
const STARS = [
    ['Alpha Centauri', 219.902, -60.834, 4.37],
    ['Proxima Centauri', 217.429, -62.680, 4.24],
    ['Barnard’s Star', 269.452, 4.693, 5.96],
];

// Years to mark along the escaping craft's paths.
const MILESTONES = [2100, 2300, 3000, 10000, 40000];

export class FarLayer {
    constructor(parent) {
        this.actor = new Clutter.Actor({opacity: 0, visible: false});
        parent.add_child(this.actor);
        this._canvas = new St.DrawingArea();
        this._canvas.connect('repaint', a => this._paint(a));
        this.actor.add_child(this._canvas);
        this._labels = new Clutter.Actor();
        this.actor.add_child(this._labels);

        // The Oort cloud: a flattened inner part (the Hills cloud) and a
        // round outer shell, as fixed random points.
        const rnd = R.seeded(1950);
        const dir = flat => {
            const z = (rnd() * 2 - 1) * (flat ? 0.45 : 1), th = rnd() * 2 * Math.PI, s = Math.sqrt(1 - z * z);
            return [s * Math.cos(th), s * Math.sin(th), z];
        };
        this._oort = [];
        for (let i = 0; i < 900; i++)
            this._oort.push([A.scale(dir(true), 2000 * 10 ** rnd()), 0.5 + rnd() * 0.5]);
        for (let i = 0; i < 1500; i++)
            this._oort.push([A.scale(dir(false), 20000 * 5 ** rnd()), 0.3 + rnd() * 0.7]);
        this._stars = STARS.map(([name, ra, dec, ly]) => ({name, ly, p: A.scale(A.equatorialToEcliptic(ra, dec), ly * LY)}));
        this._texts = new Map();
    }

    destroy() {
        this.actor.destroy();
    }

    // trajectories: the missions, for the escaping ones' future paths.
    layout({proj, W, H, area, trajectories}) {
        const u = proj.zoomOut;
        const k = Math.max(0, Math.min(1, (u - 0.02) / 0.15));
        this.actor.visible = k > 0;
        if (!k)
            return;
        this.actor.opacity = Math.round(255 * k * k * (3 - 2 * k));
        this._proj = proj;
        this._W = W;
        this._H = H;
        this._area = area;
        this._craft = trajectories.filter(tr => tr.segments.some(s => s.kind === 'escape') || tr.mission.id === 'newhorizons');
        this._canvas.set_size(W, H);
        this._canvas.queue_repaint();
        this._placeLabels();
    }

    _text(key, text, styleClass = 'orrery-far-label') {
        let l = this._texts.get(key);
        if (!l) {
            l = label(styleClass, text);
            this._labels.add_child(l);
            this._texts.set(key, l);
        }
        if (l.text !== text)
            l.text = text;
        l.show();
        return l;
    }

    _placeLabels() {
        const p = this._proj;
        const {left, right, top, bottom} = this._area;
        const maxR = Math.hypot(this._W, this._H) / 2;
        for (const l of this._texts.values())
            l.hide();
        // Labels go where they fit on screen and clear of each other.
        const placed = [];
        const put = (l, x, y) => {
            const w = l.get_preferred_width(-1)[1], h = l.get_preferred_height(-1)[1];
            const r = [x, y, x + w, y + h];
            if (x < left + 4 || x + w > right - 4 || y < top + 30 || y + h > bottom - 4 ||
                placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) {
                l.hide();
                return;
            }
            placed.push(r);
            l.set_position(Math.round(x), Math.round(y));
        };
        // Shell names where the rings cross a ray just above the right-hand
        // side, clear of the HUD.
        const ang = 8 * Math.PI / 180;
        // Most telling first, so the others give way when crowded.
        for (const s of [...SHELLS].sort((a, b) => a.rank - b.rank)) {
            const rho = p.radiusPx(s.r);
            if (rho < 40 || rho > maxR)
                continue;
            const [x, y] = this._ring(s.r, ang);
            const l = this._text(s.name, s.au ? `${s.name.toUpperCase()} · ${s.r} AU` : s.name.toUpperCase());
            put(l, x + 4, y - 14);
        }
        const region = (key, text, r, a) => {
            const rho = p.radiusPx(r);
            if (rho < 60 || rho > maxR * 0.95)
                return;
            put(this._text(key, text, 'orrery-far-region'), p.cx + rho * Math.cos(a), p.cy - rho * Math.sin(a) * 0.9);
        };
        region('kuiper', 'KUIPER BELT', 44, 0.35);
        region('hills', 'INNER OORT CLOUD', 6000, 0.5);
        region('oort', 'OORT CLOUD · TRILLIONS OF COMETS', 45000, 0.42);
        for (const s of this._stars) {
            if (this._endOn(s.p))
                continue;
            const [x, y] = p.project(s.p);
            const l = this._text(s.name, `${s.name} · ${s.ly} ly`, 'orrery-far-star');
            put(l, x + 7, y - 7);
        }
        // Years along the Voyagers' way out.
        for (const tr of this._craft.filter(t => t.mission.id.startsWith('voyager'))) {
            for (const year of MILESTONES) {
                const pos = tr.position(A.jd(`${year}-01-01`));
                if (!pos || this._endOn(pos))
                    continue;
                const [x, y] = p.project(pos);
                const l = this._text(`${tr.mission.id}${year}`, `${year}`, 'orrery-far-year');
                l.set_style(`color: ${tr.mission.color};`);
                put(l, x + 5, y + 2);
            }
        }
    }

    // A point on the ring of radius r (AU) in the plane of the planets, at
    // angle a (radians, from the right, counterclockwise on screen).
    _ring(r, a) {
        const p = this._proj, rho = p.radiusPx(r);
        return [p.cx + rho * Math.cos(a), p.cy - rho * p.squash * Math.sin(a)];
    }

    // Seen nearly end-on (heading at or away from the camera), a point lands
    // near the middle, misleadingly; its label is left off.
    _endOn(q) {
        const v = this._proj.view(q), n = A.norm(q);
        return Math.hypot(v[0], v[1]) < 0.35 * n;
    }

    _paint(area) {
        const cr = area.get_context();
        const p = this._proj;
        const maxR = Math.hypot(this._W, this._H);
        // The heliosheath, faintly filled, under its shells.
        const ellipse = (r, negative = false) => {
            cr.save();
            cr.translate(p.cx, p.cy);
            cr.scale(1, Math.max(0.05, p.squash));
            if (negative)
                cr.arcNegative(0, 0, p.radiusPx(r), 2 * Math.PI, 0);
            else
                cr.arc(0, 0, p.radiusPx(r), 0, 2 * Math.PI);
            cr.restore();
        };
        ellipse(120);
        ellipse(90, true);
        cr.setSourceRGBA(0.45, 0.7, 1, 0.05);
        cr.fill();
        for (const s of SHELLS) {
            const rho = p.radiusPx(s.r);
            if (rho < 6 || rho > maxR)
                continue;
            cr.newPath();
            ellipse(s.r);
            cr.setSourceRGBA(...s.rgb, s.alpha);
            cr.setLineWidth(1);
            cr.setDash(s.dash ?? [], 0);
            cr.stroke();
        }
        cr.setDash([], 0);
        R.drawDots(cr, this._oort.map(([q, a]) => [...p.project(q).slice(0, 2), a]), 0.45, 0.7);

        // Orbits of the farthest known worlds.
        for (const id of ['sedna', 'eris']) {
            const pts = A.orbitPoints(A.planetOrbit(id, 0)).map(q => p.project(q));
            R.strokePath(cr, pts, R.hexToRgb(id === 'sedna' ? '#d8806a' : '#e6e1dc'), 0.22, 1, [2, 3]);
        }

        // Where the escaping craft go from here: dashed to 40,000 AD, with
        // a tick at each milestone year.
        const now = A.jdNow();
        for (const tr of this._craft) {
            const rgb = R.hexToRgb(tr.mission.color);
            const pts = [];
            for (const year of [new Date().getUTCFullYear(), 2050, 2100, 2200, 2300, 2500, 3000, 5000, 10000, 20000, 40000]) {
                const pos = tr.position(Math.max(now, A.jd(`${year}-01-01`)));
                if (pos)
                    pts.push(p.project(pos));
            }
            R.strokePath(cr, pts, rgb, 0.35, 1, [3, 4]);
            if (tr.mission.id.startsWith('voyager')) {
                for (const year of MILESTONES) {
                    const pos = tr.position(A.jd(`${year}-01-01`));
                    if (!pos || this._endOn(pos))
                        continue;
                    const [x, y] = p.project(pos);
                    cr.setSourceRGBA(...rgb, 0.8);
                    cr.arc(x, y, 2, 0, 2 * Math.PI);
                    cr.fill();
                }
            }
        }

        // The nearest stars.
        for (const s of this._stars) {
            if (this._endOn(s.p))
                continue;
            const [x, y] = p.project(s.p);
            R.drawStar(cr, x, y, s.name.startsWith('Alpha') ? 4 : 2.5);
        }
        cr.$dispose();
    }
}

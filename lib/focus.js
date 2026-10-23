// A close-up of one planet: the planet large in the middle, turned the way
// it really faces, with its moons where they really are, the satellites and
// spacecraft circling it, and the landing sites on its surface.
//
// Near the planet the scale is true (low orbits skim the surface, rings keep
// their size); farther out it turns logarithmic, so the outer moons, the
// geostationary belt or Juno's long loops still fit on screen.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as A from './astro.js';
import {BODY, GM, moonsOf} from './bodies.js';
import * as R from './render.js';
import {LANDERS, MISSION_ORBITS, SATELLITES, orbitOf} from './satellites.js';
import {label} from './ui.js';

const LOG_K = 0.25;
const MIN_LAP_SECONDS = 4;       // the quickest orbit takes at least this long
const MIN_SPIN_SECONDS = 20;     // and the planet turns no faster than this
const L_KM = 1.5e6;              // Sun-Earth L1 and L2 from Earth

const hashUnit = name => {
    let h = 2166136261;
    for (const c of name)
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
};

// A small St.DrawingArea moved by translation.
function sprite(parent, size, paint) {
    const area = new St.DrawingArea({width: size, height: size});
    area.connect('repaint', a => {
        const cr = a.get_context();
        paint(cr, size);
        cr.$dispose();
    });
    parent.add_child(area);
    area.queue_repaint();
    return area;
}

export class PlanetView {
    // ctx: {view(v), area {left, right, top, bottom}, W, H, unit, trajectories,
    //       showLabels}
    constructor(parent, id, ctx) {
        this.id = id;
        this._ctx = ctx;
        this._body = BODY[id];
        this.actor = new Clutter.Actor({width: ctx.W, height: ctx.H});
        parent.add_child(this.actor);
        this._orbits = new St.DrawingArea({width: ctx.W, height: ctx.H});
        this._orbits.connect('repaint', a => this._paintOrbits(a));
        this.actor.add_child(this._orbits);
        this._stage = new Clutter.Actor();
        this.actor.add_child(this._stage);
        this._labels = new Clutter.Actor();
        this.actor.add_child(this._labels);

        const {left, right, top, bottom} = ctx.area;
        this.cx = (left + right) / 2;
        this.cy = (top + bottom) / 2;
        this._minDim = Math.min(right - left, bottom - top);
        this._pole = A.equatorialToEcliptic(...this._body.pole);
        this._poleView = A.unit(ctx.view(this._pole));
        this._build();
    }

    destroy() {
        this.actor.destroy();
    }

    // ---- Scale ----

    // Planet radii -> screen radii: true out to x0, logarithmic beyond.
    _m(x) {
        return x <= this._x0 ? x : this._x0 * (1 + LOG_K * Math.log(x / this._x0));
    }

    // A vector from the planet's center (km, ecliptic) -> [x, y, depth].
    _place(v) {
        const r = A.norm(v);
        if (!r)
            return [this.cx, this.cy, 0];
        const d = this._ctx.view(v);
        const px = this.RF * this._m(r / this._body.radiusKm) / r;
        return [this.cx + d[0] * px, this.cy - d[1] * px, d[2] * px];
    }

    // ---- Building ----

    _build() {
        const id = this.id, Rkm = this._body.radiusKm;
        const rings = R.RINGS[id];
        this._x0 = Math.max(2.5, rings ? rings.at(-1)[1] + 0.25 : 0);
        this.items = [];

        for (const m of moonsOf(id))
            this.items.push({id: m.id, kind: 'moon', name: m.name.replace(/^The /, ''), color: m.color, moon: m, reach: m.a});
        for (const s of SATELLITES.filter(x => x.planet === id)) {
            const orbit = {...orbitOf(s.orbit, id), peri: 360 * hashUnit(`${s.id}w`)};
            const item = {id: s.id, kind: s.planes ? 'swarm' : 'sat', name: s.short ?? s.name, color: s.color, data: s,
                from: A.jd(s.from), to: s.to ? A.jd(s.to) : Infinity, reach: orbit.a * (1 + orbit.e)};
            item.orbits = [];
            const planes = s.planes ?? 1, per = s.perPlane ?? 1;
            for (let k = 0; k < planes; k++) {
                for (let j = 0; j < per; j++) {
                    const o = {...orbit, node: (orbit.node ?? 0) + 360 * k / planes, phase: 360 * (j / per + k / (planes * per)) + 360 * hashUnit(s.id)};
                    o.frame = A.satelliteFrame(o, this._pole);
                    item.orbits.push(o);
                }
            }
            this.items.push(item);
        }
        for (const l of LANDERS.filter(x => x.planet === id))
            this.items.push({id: l.id, kind: 'lander', name: l.name, color: '#f2d6a0', data: l, from: A.jd(l.from), to: Infinity, reach: Rkm});
        if (id === 'earth') {
            for (const lp of ['l1', 'l2'])
                this.items.push({id: lp, kind: 'lpoint', name: lp.toUpperCase(), color: '#9fb4d8', reach: L_KM});
        }
        // Spacecraft from the mission list that stay here (or at L1/L2).
        for (const tr of this._ctx.trajectories) {
            for (const seg of tr.segments.filter(sg => sg.kind === 'stay')) {
                const here = seg.body === id || id === 'earth' && (seg.body === 'l1' || seg.body === 'l2');
                if (!here)
                    continue;
                const m = tr.mission;
                const spec = MISSION_ORBITS[`${m.id}:${id}`] ?? MISSION_ORBITS[m.id];
                const item = {id: `tr:${m.id}`, kind: 'mission', tr, seg, name: m.short ?? m.name, color: m.color,
                    from: seg.t0, to: Math.min(seg.t1, tr.end), at: seg.body};
                if (spec?.follow) {
                    item.follow = spec.follow;
                } else if (seg.body === id) {
                    const o = {...orbitOf(spec ?? {peri: Rkm * 0.5, apo: Rkm * 3, i: 20, node: 360 * hashUnit(m.id)}, id), peri: 360 * hashUnit(`${m.id}w`)};
                    o.phase = 360 * hashUnit(`${m.id}p`);
                    o.frame = A.satelliteFrame(o, this._pole);
                    item.orbits = [o];
                    item.reach = o.a * (1 + o.e);
                }
                this.items.push(item);
            }
        }

        // Size the planet so the farthest thing fits.
        const reach = Math.max(Rkm * 3, ...this.items.map(it => it.reach ?? 0));
        this.RF = Math.max(0.07 * this._minDim, Math.min(0.17 * this._minDim, 0.45 * this._minDim / this._m(reach / Rkm)));

        this._buildPlanet();
        const showLabels = this._ctx.showLabels;
        for (const it of this.items) {
            const rgb = R.hexToRgb(it.color);
            if (it.kind === 'moon') {
                const r = Math.max(this.RF * it.moon.radiusKm / Rkm, 2.2 + 3.2 * Math.sqrt(it.moon.radiusKm / 2634));
                it.R = r;
                it.size = Math.ceil(2 * r + 2);
                it.sprites = [sprite(this._stage, it.size, cr => R.drawMoon(cr, it.size, rgb, this._light ?? [1, 0, 0]))];
            } else if (it.kind === 'swarm') {
                it.R = 2;
                it.size = 5;
                it.sprites = it.orbits.map(() => sprite(this._stage, 5, cr => R.drawSpeck(cr, 5, rgb)));
            } else if (it.kind === 'lpoint') {
                it.R = 4;
                it.size = 11;
                it.sprites = [sprite(this._stage, 11, cr => R.drawMarker(cr, 11, rgb, 0.6))];
            } else if (it.kind === 'lander') {
                it.R = 3;
                it.size = 7;
                it.sprites = [sprite(this._stage, 7, cr => R.drawSpeck(cr, 7, rgb))];
            } else {
                it.R = 4;
                it.size = 9;
                it.sprites = [sprite(this._stage, 9, cr => R.drawCraft(cr, 9, rgb))];
            }
            it.front = it.sprites.map(() => true);
            if (showLabels || it.kind !== 'lander') {
                it.label = label(it.kind === 'moon' ? 'orrery-focus-moon' : 'orrery-focus-label', it.kind === 'moon' ? it.name.toUpperCase() : it.name);
                if (it.kind !== 'moon')
                    it.label.set_style(`color: ${it.color};`);
                this._labels.add_child(it.label);
            }
        }
    }

    _buildPlanet() {
        const id = this.id, r = this.RF;
        const size = 2 * R.spriteExtent(id, r);
        this._size = size;
        const pole = this._poleView;
        this.planet = new Clutter.Actor({width: size, height: size});
        this._stage.add_child(this.planet);
        this.planet.set_translation(this.cx - size / 2, this.cy - size / 2, 0);
        const layer = paint => {
            const area = new St.DrawingArea({width: size, height: size});
            area.connect('repaint', a => {
                const cr = a.get_context();
                paint(cr, a);
                cr.$dispose();
            });
            this.planet.add_child(area);
            return area;
        };
        if (R.RINGS[id])
            layer(cr => R.drawRings(cr, size, id, r, pole, -1));
        this._surface = layer((cr, area) => {
            const scale = area.get_resource_scale();
            if (this._cache?.scale !== scale)
                this._cache = R.bandCache(id, size, r, pole, scale);
            R.drawSurface(cr, size, id, r, {pole, phase: this._phase ?? 0, cache: this._cache});
        });
        this._shade = layer(cr => R.drawShade(cr, size, r, this._light ?? [1, 0, 0], this._body.atmosphere));
        if (R.RINGS[id])
            layer(cr => R.drawRings(cr, size, id, r, pole, +1));
    }

    // How fast time runs here (simulated seconds per second): the quickest
    // orbit takes MIN_LAP_SECONDS, and the planet turns no faster than once
    // in MIN_SPIN_SECONDS.
    get rate() {
        let fastest = Infinity;
        for (const it of this.items) {
            if (it.kind === 'moon')
                fastest = Math.min(fastest, Math.abs(it.moon.period) * A.DAY_S);
            else if (it.orbits?.length)
                fastest = Math.min(fastest, A.satellitePeriodS(it.orbits[0].a, GM[this.id]));
        }
        const spin = Math.abs(this._body.rotationHours) * 3600 / MIN_SPIN_SECONDS;
        const lap = isFinite(fastest) ? fastest / MIN_LAP_SECONDS : spin;
        return Math.max(1, Math.min(lap, spin));
    }

    // ---- Every frame ----

    update(jd) {
        const id = this.id, gm = GM[id];
        const planetPos = A.planetPosition(id, jd);
        const earth = A.planetPosition('earth', jd);
        // Turn the planet and light it.
        const light = A.unit(this._ctx.view(A.scale(planetPos, -1)));
        if (!this._light || A.dot(light, this._light) < 0.99999) {
            this._light = light;
            this._shade.queue_repaint();
            for (const it of this.items.filter(x => x.kind === 'moon'))
                it.sprites[0].queue_repaint();
        }
        const phase = R.phaseFor(this._poleView, A.unit(this._ctx.view(A.primeMeridian(id, jd, this._body.pole))));
        if (this._phase === undefined || Math.abs(Math.atan2(Math.sin(phase - this._phase), Math.cos(phase - this._phase))) * this.RF > 0.6) {
            this._phase = phase;
            this._surface.queue_repaint();
        }

        const sunDir = A.unit(A.scale(planetPos, -1));
        const [e1, e2] = A.planeBasis(this._pole);
        let visibleKey = '';
        for (const it of this.items) {
            const on = it.from === undefined || jd >= it.from && jd < it.to;
            it.on = on;
            visibleKey += on ? '1' : '0';
            it.sprites.forEach(s => {
                s.visible = on;
            });
            if (!on) {
                it.label?.hide();
                continue;
            }
            const spots = [];
            if (it.kind === 'moon') {
                const a = A.moonAngle(it.moon, jd, earth);
                const [b1, b2] = it.moon.ecliptic ? A.planeBasis([0, 0, 1]) : [e1, e2];
                spots.push(this._place(A.scale(A.add(A.scale(b1, Math.cos(a)), A.scale(b2, Math.sin(a))), it.moon.a)));
            } else if (it.kind === 'lpoint') {
                spots.push(this._place(A.scale(sunDir, it.id === 'l1' ? L_KM : -L_KM)));
            } else if (it.kind === 'lander') {
                const p = R.surfacePoint(this._poleView, this._phase, it.data.lat, it.data.lon);
                spots.push([this.cx + p[0] * this.RF, this.cy - p[1] * this.RF, p[2] > 0.05 ? 1e6 : -1e6]);
            } else if (it.kind === 'mission' && it.at !== id) {
                // Looping around L1 or L2.
                const lp = this.items.find(x => x.id === it.at);
                const ang = jd * 2 * Math.PI / 180 + 2 * Math.PI * hashUnit(it.id);
                const rr = 9 + 4 * hashUnit(`${it.id}r`);
                spots.push([(lp.x ?? this.cx) + rr * Math.cos(ang), (lp.y ?? this.cy) + rr * 0.55 * Math.sin(ang), 1]);
            } else if (it.follow) {
                const m = this.items.find(x => x.id === it.follow);
                const ang = jd * 2 * Math.PI / 0.3 + 1;
                spots.push([(m?.x ?? this.cx) + 8 * Math.cos(ang), (m?.y ?? this.cy) + 5 * Math.sin(ang), (m?.depth ?? 0) + 1]);
            } else {
                for (const o of it.orbits)
                    spots.push(this._place(A.satellitePosition(o, this._pole, gm, jd)));
            }
            spots.forEach(([x, y, depth], k) => {
                const s = it.sprites[k];
                s.set_translation(Math.round(x - it.size / 2), Math.round(y - it.size / 2), 0);
                const front = it.kind === 'lander' ? depth > 0 : depth >= 0 || Math.hypot(x - this.cx, y - this.cy) > this.RF * 1.02;
                if (it.kind === 'lander')
                    s.visible = front;
                if (front !== it.front[k]) {
                    it.front[k] = front;
                    if (front)
                        this._stage.set_child_above_sibling(s, this.planet);
                    else
                        this._stage.set_child_below_sibling(s, this.planet);
                }
            });
            [it.x, it.y, it.depth] = spots[0];
            it.hidden = it.kind === 'lander' && spots[0][2] < 0;
        }
        if (visibleKey !== this._visibleKey) {
            this._visibleKey = visibleKey;
            this._orbits.queue_repaint();
        }
    }

    // Names, placed beside their things; less important ones give way.
    placeLabels(featured) {
        const placed = [[this.cx - this.RF, this.cy - this.RF, this.cx + this.RF, this.cy + this.RF]];
        const order = [...this.items].sort((a, b) => (featured(b) - featured(a)) || (rank(a) - rank(b)));
        for (const it of order) {
            if (!it.label)
                continue;
            const show = it.on && !it.hidden && (it.kind !== 'lander' || featured(it));
            if (!show) {
                it.label.hide();
                continue;
            }
            const w = it.label.width || it.label.get_preferred_width(-1)[1];
            const h = it.label.height || it.label.get_preferred_height(-1)[1];
            const x = Math.round(it.x + it.R + 3), y = Math.round(it.y - h / 2);
            const r = [x, y, x + w, y + h];
            // Low orbits are over the planet anyway; only moons keep off it.
            const others = it.kind === 'moon' ? placed : placed.slice(1);
            const clash = others.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
            it.label.visible = featured(it) || !clash;
            if (it.label.visible) {
                it.label.set_translation(x, y, 0);
                placed.push(r);
            }
        }
    }

    _paintOrbits(area) {
        const cr = area.get_context();
        const ring = pts => {
            if (pts.length < 2)
                return;
            cr.moveTo(pts[0][0], pts[0][1]);
            for (const [x, y] of pts.slice(1))
                cr.lineTo(x, y);
        };
        const [e1, e2] = A.planeBasis(this._pole);
        cr.setLineWidth(0.9);
        for (const it of this.items) {
            if (!it.on)
                continue;
            const rgb = R.hexToRgb(it.color);
            if (it.kind === 'moon') {
                const [b1, b2] = it.moon.ecliptic ? A.planeBasis([0, 0, 1]) : [e1, e2];
                ring(Array.from({length: 121}, (_, i) => {
                    const a = i / 120 * 2 * Math.PI;
                    return this._place(A.scale(A.add(A.scale(b1, Math.cos(a)), A.scale(b2, Math.sin(a))), it.moon.a));
                }));
                cr.setSourceRGBA(0.8, 0.84, 0.92, 0.16);
                cr.stroke();
            } else if (it.orbits && it.kind !== 'lander') {
                const seen = new Set();
                for (const o of it.orbits) {
                    // One path per plane for constellations.
                    const key = Math.round(o.node);
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    ring(Array.from({length: 121}, (_, i) => {
                        const E = i / 120 * 2 * Math.PI;
                        const x = o.a * (Math.cos(E) - o.e), y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
                        return this._place(A.add(A.scale(o.frame.p, x), A.scale(o.frame.q, y)));
                    }));
                    cr.setSourceRGBA(...rgb, it.kind === 'swarm' ? 0.07 : 0.22);
                    cr.stroke();
                }
            }
        }
        cr.$dispose();
    }

    // ---- Picking ----

    hitTest(x, y) {
        let best = null, bestD = Infinity;
        for (const it of this.items) {
            if (!it.on || it.hidden)
                continue;
            const pts = it.kind === 'swarm'
                ? it.sprites.map(s => [s.translation_x + it.size / 2, s.translation_y + it.size / 2])
                : [[it.x, it.y]];
            for (const [px, py] of pts) {
                const d = Math.hypot(x - px, y - py);
                if (d < Math.max(6, it.R + 3) && d < bestD)
                    [best, bestD] = [it, d];
            }
        }
        if (best)
            return best.tr ? {tr: best.tr} : {id: best.id};
        if (Math.hypot(x - this.cx, y - this.cy) < this.RF + 4)
            return {id: this.id};
        return null;
    }

    // [x, y, radius] of a subject on screen, or null.
    targetOf(subject) {
        if (!subject.tr && subject.id === this.id)
            return [this.cx, this.cy, this.RF + 4];
        const it = this.items.find(x => subject.tr ? x.tr === subject.tr : x.id === subject.id);
        return it?.on && !it.hidden && it.x !== undefined ? [it.x, it.y, it.R + 4] : null;
    }

    has(subject) {
        return !!this.targetOf(subject);
    }

    // Ids of what is here now, for the rotating fact cards.
    get present() {
        return this.items.filter(it => it.on && !it.tr && it.kind !== 'lpoint').map(it => it.id);
    }
}

const rank = it => ({moon: 0, mission: 1, sat: 2, swarm: 3, lpoint: 4, lander: 5})[it.kind] ?? 6;


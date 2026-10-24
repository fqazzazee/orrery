// A close-up of one planet: the planet large in the middle, turned the way
// it really faces, with its moons where they really are, the satellites and
// spacecraft circling it, and the landing sites on its surface.
//
// Near the planet the scale is true (low orbits skim the surface, rings keep
// their size); farther out it turns logarithmic, so the outer moons, the
// geostationary belt or Juno's long loops still fit on screen.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Astro from './astro.js';
import {BODY, GM, moonsOf} from './bodies.js';
import * as Render from './render.js';
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
        this._pole = Astro.equatorialToEcliptic(...this._body.pole);
        this._poleView = Astro.unit(ctx.view(this._pole));
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
        const r = Astro.norm(v);
        if (!r)
            return [this.cx, this.cy, 0];
        const d = this._ctx.view(v);
        const px = this.RF * this._m(r / this._body.radiusKm) / r;
        return [this.cx + d[0] * px, this.cy - d[1] * px, d[2] * px];
    }

    // ---- Building ----

    _build() {
        const id = this.id, Rkm = this._body.radiusKm;
        const rings = Render.RINGS[id];
        this._x0 = Math.max(2.5, rings ? rings.at(-1)[1] + 0.25 : 0);
        this.items = [];

        for (const m of moonsOf(id))
            this.items.push({id: m.id, kind: 'moon', name: m.name.replace(/^The /, ''), color: m.color, moon: m, reach: m.a});
        for (const s of SATELLITES.filter(x => x.planet === id)) {
            const orbit = {...orbitOf(s.orbit, id), peri: 360 * hashUnit(`${s.id}w`)};
            const item = {id: s.id, kind: s.planes ? 'swarm' : 'sat', name: s.short ?? s.name, color: s.color, data: s,
                from: Astro.jd(s.from), to: s.to ? Astro.jd(s.to) : Infinity, reach: orbit.a * (1 + orbit.e)};
            item.orbits = [];
            const planes = s.planes ?? 1, per = s.perPlane ?? 1;
            for (let k = 0; k < planes; k++) {
                for (let j = 0; j < per; j++) {
                    const o = {...orbit, node: (orbit.node ?? 0) + 360 * k / planes, phase: 360 * (j / per + k / (planes * per)) + 360 * hashUnit(s.id)};
                    o.frame = Astro.satelliteFrame(o, this._pole);
                    item.orbits.push(o);
                }
            }
            this.items.push(item);
        }
        for (const l of LANDERS.filter(x => x.planet === id))
            this.items.push({id: l.id, kind: 'lander', name: l.name, color: '#f2d6a0', data: l, from: Astro.jd(l.from), to: Infinity, reach: Rkm});
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
                    o.frame = Astro.satelliteFrame(o, this._pole);
                    item.orbits = [o];
                    item.reach = o.a * (1 + o.e);
                }
                this.items.push(item);
            }
        }

        // Size the planet so the farthest thing fits.
        const reach = Math.max(Rkm * 3, ...this.items.map(item => item.reach ?? 0));
        this.RF = Math.max(0.07 * this._minDim, Math.min(0.17 * this._minDim, 0.45 * this._minDim / this._m(reach / Rkm)));

        this._buildPlanet();
        const showLabels = this._ctx.showLabels;
        for (const item of this.items) {
            const rgb = Render.hexToRgb(item.color);
            if (item.kind === 'moon') {
                const r = Math.max(this.RF * item.moon.radiusKm / Rkm, 2.2 + 3.2 * Math.sqrt(item.moon.radiusKm / 2634));
                item.R = r;
                item.size = Math.ceil(2 * r + 2);
                item.sprites = [sprite(this._stage, item.size, cr => Render.drawMoon(cr, item.size, rgb, this._light ?? [1, 0, 0]))];
            } else if (item.kind === 'swarm') {
                item.R = 2;
                item.size = 5;
                item.sprites = item.orbits.map(() => sprite(this._stage, 5, cr => Render.drawSpeck(cr, 5, rgb)));
            } else if (item.kind === 'lpoint') {
                item.R = 4;
                item.size = 11;
                item.sprites = [sprite(this._stage, 11, cr => Render.drawMarker(cr, 11, rgb, 0.6))];
            } else if (item.kind === 'lander') {
                item.R = 3;
                item.size = 7;
                item.sprites = [sprite(this._stage, 7, cr => Render.drawSpeck(cr, 7, rgb))];
            } else {
                item.R = 4;
                item.size = 9;
                item.sprites = [sprite(this._stage, 9, cr => Render.drawCraft(cr, 9, rgb))];
            }
            item.front = item.sprites.map(() => true);
            if (showLabels || item.kind !== 'lander') {
                item.label = label(item.kind === 'moon' ? 'orrery-focus-moon' : 'orrery-focus-label', item.kind === 'moon' ? item.name.toUpperCase() : item.name);
                if (item.kind !== 'moon')
                    item.label.set_style(`color: ${item.color};`);
                this._labels.add_child(item.label);
            }
        }
    }

    _buildPlanet() {
        const id = this.id, r = this.RF;
        const size = 2 * Render.spriteExtent(id, r);
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
        if (Render.RINGS[id])
            layer(cr => Render.drawRings(cr, size, id, r, pole, -1));
        this._surface = layer((cr, area) => {
            const scale = area.get_resource_scale();
            if (this._cache?.scale !== scale)
                this._cache = Render.bandCache(id, size, r, pole, scale);
            Render.drawSurface(cr, size, id, r, {pole, phase: this._phase ?? 0, cache: this._cache});
        });
        this._shade = layer(cr => Render.drawShade(cr, size, r, this._light ?? [1, 0, 0], this._body.atmosphere));
        if (Render.RINGS[id])
            layer(cr => Render.drawRings(cr, size, id, r, pole, +1));
    }

    // How fast time runs here (simulated seconds per second): the quickest
    // orbit takes MIN_LAP_SECONDS, and the planet turns no faster than once
    // in MIN_SPIN_SECONDS.
    get rate() {
        let fastest = Infinity;
        for (const item of this.items) {
            if (item.kind === 'moon')
                fastest = Math.min(fastest, Math.abs(item.moon.period) * Astro.DAY_S);
            else if (item.orbits?.length)
                fastest = Math.min(fastest, Astro.satellitePeriodS(item.orbits[0].a, GM[this.id]));
        }
        const spin = Math.abs(this._body.rotationHours) * 3600 / MIN_SPIN_SECONDS;
        const lap = isFinite(fastest) ? fastest / MIN_LAP_SECONDS : spin;
        return Math.max(1, Math.min(lap, spin));
    }

    // ---- Every frame ----

    update(jd) {
        const id = this.id, gm = GM[id];
        const planetPos = Astro.planetPosition(id, jd);
        const earth = Astro.planetPosition('earth', jd);
        // Turn the planet and light it.
        const light = Astro.unit(this._ctx.view(Astro.scale(planetPos, -1)));
        if (!this._light || Astro.dot(light, this._light) < 0.99999) {
            this._light = light;
            this._shade.queue_repaint();
            for (const item of this.items.filter(x => x.kind === 'moon'))
                item.sprites[0].queue_repaint();
        }
        const phase = Render.phaseFor(this._poleView, Astro.unit(this._ctx.view(Astro.primeMeridian(id, jd, this._body.pole))));
        if (this._phase === undefined || Math.abs(Math.atan2(Math.sin(phase - this._phase), Math.cos(phase - this._phase))) * this.RF > 0.6) {
            this._phase = phase;
            this._surface.queue_repaint();
        }

        const sunDir = Astro.unit(Astro.scale(planetPos, -1));
        const [e1, e2] = Astro.planeBasis(this._pole);
        let visibleKey = '';
        for (const item of this.items) {
            const on = item.from === undefined || jd >= item.from && jd < item.to;
            item.on = on;
            visibleKey += on ? '1' : '0';
            item.sprites.forEach(s => {
                s.visible = on;
            });
            if (!on) {
                item.label?.hide();
                continue;
            }
            const spots = [];
            if (item.kind === 'moon') {
                const a = Astro.moonAngle(item.moon, jd, earth);
                const [b1, b2] = item.moon.ecliptic ? Astro.planeBasis([0, 0, 1]) : [e1, e2];
                spots.push(this._place(Astro.scale(Astro.add(Astro.scale(b1, Math.cos(a)), Astro.scale(b2, Math.sin(a))), item.moon.a)));
            } else if (item.kind === 'lpoint') {
                spots.push(this._place(Astro.scale(sunDir, item.id === 'l1' ? L_KM : -L_KM)));
            } else if (item.kind === 'lander') {
                const p = Render.surfacePoint(this._poleView, this._phase, item.data.lat, item.data.lon);
                spots.push([this.cx + p[0] * this.RF, this.cy - p[1] * this.RF, p[2] > 0.05 ? 1e6 : -1e6]);
            } else if (item.kind === 'mission' && item.at !== id) {
                // Looping around L1 or L2.
                const lp = this.items.find(x => x.id === item.at);
                const ang = jd * 2 * Math.PI / 180 + 2 * Math.PI * hashUnit(item.id);
                const rr = 9 + 4 * hashUnit(`${item.id}r`);
                spots.push([(lp.x ?? this.cx) + rr * Math.cos(ang), (lp.y ?? this.cy) + rr * 0.55 * Math.sin(ang), 1]);
            } else if (item.follow) {
                const m = this.items.find(x => x.id === item.follow);
                const ang = jd * 2 * Math.PI / 0.3 + 1;
                spots.push([(m?.x ?? this.cx) + 8 * Math.cos(ang), (m?.y ?? this.cy) + 5 * Math.sin(ang), (m?.depth ?? 0) + 1]);
            } else {
                for (const o of item.orbits)
                    spots.push(this._place(Astro.satellitePosition(o, this._pole, gm, jd)));
            }
            spots.forEach(([x, y, depth], k) => {
                const s = item.sprites[k];
                s.set_translation(Math.round(x - item.size / 2), Math.round(y - item.size / 2), 0);
                const front = item.kind === 'lander' ? depth > 0 : depth >= 0 || Math.hypot(x - this.cx, y - this.cy) > this.RF * 1.02;
                if (item.kind === 'lander')
                    s.visible = front;
                if (front !== item.front[k]) {
                    item.front[k] = front;
                    if (front)
                        this._stage.set_child_above_sibling(s, this.planet);
                    else
                        this._stage.set_child_below_sibling(s, this.planet);
                }
            });
            [item.x, item.y, item.depth] = spots[0];
            item.hidden = item.kind === 'lander' && spots[0][2] < 0;
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
        for (const item of order) {
            if (!item.label)
                continue;
            const show = item.on && !item.hidden && (item.kind !== 'lander' || featured(item));
            if (!show) {
                item.label.hide();
                continue;
            }
            const w = item.label.width || item.label.get_preferred_width(-1)[1];
            const h = item.label.height || item.label.get_preferred_height(-1)[1];
            const x = Math.round(item.x + item.R + 3), y = Math.round(item.y - h / 2);
            const r = [x, y, x + w, y + h];
            // Low orbits are over the planet anyway; only moons keep off it.
            const others = item.kind === 'moon' ? placed : placed.slice(1);
            const clash = others.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
            item.label.visible = featured(item) || !clash;
            if (item.label.visible) {
                item.label.set_translation(x, y, 0);
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
        const [e1, e2] = Astro.planeBasis(this._pole);
        cr.setLineWidth(0.9);
        for (const item of this.items) {
            if (!item.on)
                continue;
            const rgb = Render.hexToRgb(item.color);
            if (item.kind === 'moon') {
                const [b1, b2] = item.moon.ecliptic ? Astro.planeBasis([0, 0, 1]) : [e1, e2];
                ring(Array.from({length: 121}, (_, i) => {
                    const a = i / 120 * 2 * Math.PI;
                    return this._place(Astro.scale(Astro.add(Astro.scale(b1, Math.cos(a)), Astro.scale(b2, Math.sin(a))), item.moon.a));
                }));
                cr.setSourceRGBA(0.8, 0.84, 0.92, 0.16);
                cr.stroke();
            } else if (item.orbits && item.kind !== 'lander') {
                const seen = new Set();
                for (const o of item.orbits) {
                    // One path per plane for constellations.
                    const key = Math.round(o.node);
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    ring(Array.from({length: 121}, (_, i) => {
                        const E = i / 120 * 2 * Math.PI;
                        const x = o.a * (Math.cos(E) - o.e), y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
                        return this._place(Astro.add(Astro.scale(o.frame.p, x), Astro.scale(o.frame.q, y)));
                    }));
                    cr.setSourceRGBA(...rgb, item.kind === 'swarm' ? 0.07 : 0.22);
                    cr.stroke();
                }
            }
        }
        cr.$dispose();
    }

    // ---- Picking ----

    hitTest(x, y) {
        let best = null, bestD = Infinity;
        for (const item of this.items) {
            if (!item.on || item.hidden)
                continue;
            const pts = item.kind === 'swarm'
                ? item.sprites.map(s => [s.translation_x + item.size / 2, s.translation_y + item.size / 2])
                : [[item.x, item.y]];
            for (const [px, py] of pts) {
                const d = Math.hypot(x - px, y - py);
                if (d < Math.max(6, item.R + 3) && d < bestD)
                    [best, bestD] = [item, d];
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
        const item = this.items.find(x => subject.tr ? x.tr === subject.tr : x.id === subject.id);
        return item?.on && !item.hidden && item.x !== undefined ? [item.x, item.y, item.R + 4] : null;
    }

    has(subject) {
        return !!this.targetOf(subject);
    }

    // Ids of what is here now, for the rotating fact cards.
    get present() {
        return this.items.filter(item => item.on && !item.tr && item.kind !== 'lpoint').map(item => item.id);
    }
}

const rank = item => ({moon: 0, mission: 1, sat: 2, swarm: 3, lpoint: 4, lander: 5})[item.kind] ?? 6;


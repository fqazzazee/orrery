// Missions to the Moon. They never leave Earth's neighborhood, so their
// paths are built around Earth (km from its center) instead of the Sun:
// Kepler arcs from a parking orbit out to where the Moon is on the day of
// arrival, and back down to Earth for those that return.
//
// Near the Moon, both views draw it far larger than the space around it,
// so what happens there (orbits, landings, swinging around the far side) is
// given relative to the Moon, in Moon radii, and drawn around the Moon's
// sprite. The two blend over the last few hours of an approach.
//
// Event fields, beyond those in missions.js:
//   kind     also land and liftoff; arrive is going into lunar orbit, depart
//            leaving it (or, at 'earth', leaving Earth orbit for the Moon)
//   site     [latitude, longitude east] of a landing or an impact
//   orbit    {alt km, i degrees to the Moon's equator, node}, or 'nrho' (a
//            long halo over the poles) or 'dro' (a wide, backward orbit)
//   alt      closest approach of a flyby, km above the surface
//   path     of the leg into this event: 'direct' (default), 'loops' (an
//            Earth orbit raised step by step), 'far' (the slow way, out past
//            the Moon and back, letting the Sun's pull do the work) or
//            'spiral' (ion engine)
//   loops    how many loops, for 'loops'

import * as Astro from './astro.js';
import {GM} from './bodies.js';

const MOON_R = 1737.4;
const GM_MOON = 4902.8;
const PARKING = 6571;            // a low Earth orbit, km from the center
const ENTRY = 6471;              // where a returning capsule meets the air
const BLEND = 0.35;              // days over which an approach joins the Moon
const TAU = 2 * Math.PI;
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const lerp = (a, b, k) => Astro.add(Astro.scale(a, 1 - k), Astro.scale(b, k));

// The Moon's orbital plane at time t: [unit toward the Moon, unit 90° on in
// the direction it moves, normal].
function moonPlane(t) {
    const m0 = Astro.moonPosition(t), m1 = Astro.moonPosition(t + 0.05);
    const n = Astro.unit(Astro.cross(m0, m1));
    const u = Astro.unit(m0);
    return [u, Astro.cross(n, u), n];
}

// A frame fixed to the Moon, which keeps one face to Earth: x toward Earth
// (longitude 0), y toward 90° east, z the north pole.
function moonFrame(t) {
    const x = Astro.unit(Astro.scale(Astro.moonPosition(t), -1));
    const z = Astro.unit(Astro.sub([0, 0, 1], Astro.scale(x, x[2])));
    return [x, Astro.cross(z, x), z];
}

function sitePoint([lat, lon], t, r = 1) {
    const [x, y, z] = moonFrame(t);
    const [b, l] = [lat * Math.PI / 180, lon * Math.PI / 180];
    return Astro.scale(Astro.add(Astro.add(Astro.scale(x, Math.cos(b) * Math.cos(l)), Astro.scale(y, Math.cos(b) * Math.sin(l))),
        Astro.scale(z, Math.sin(b))), r);
}

function rotate(v, n, rad) {
    return Astro.rotateAbout(v, n, rad * 180 / Math.PI);
}

// Mean anomaly from true anomaly, for an ellipse of eccentricity e, keeping
// count of whole laps so a sweep can go past 2π.
function meanOf(nu, e) {
    const lap = Math.floor(nu / TAU);
    const v = nu - lap * TAU;
    const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(v / 2), Math.sqrt(1 + e) * Math.cos(v / 2));
    const M = E - e * Math.sin(E);
    return (M < 0 ? M + TAU : M) + lap * TAU;
}

function trueOf(M, e) {
    // Newton's method from E = π converges for any ellipse.
    let E = Math.PI;
    for (let k = 0; k < 50; k++) {
        const step = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= step;
        if (Math.abs(step) < 1e-12)
            break;
    }
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

// An arc of the ellipse (periapsis rp, eccentricity e, periapsis toward
// `peri`, in the plane with normal n) from true anomaly nu0 to nu1, timed
// by Kepler's law and stretched to fit [t0, t1].
function arc({rp, e, peri, n, nu0, nu1, t0, t1}) {
    const p = rp * (1 + e);
    const q = Astro.cross(n, peri);
    const [M0, M1] = [meanOf(nu0, e), meanOf(nu1, e)];
    return t => {
        const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
        const M = M0 + (M1 - M0) * k;
        const lap = Math.floor(M / TAU);
        const nu = trueOf(M - lap * TAU, e);
        const r = p / (1 + e * Math.cos(nu));
        return Astro.add(Astro.scale(peri, r * Math.cos(nu)), Astro.scale(q, r * Math.sin(nu)));
    };
}

// Days from periapsis to distance r on the ellipse (rp, ra) around Earth.
function timeTo(rp, ra, r) {
    const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
    const nu = Math.acos(Math.max(-1, Math.min(1, (a * (1 - e * e) / r - 1) / e)));
    return meanOf(nu, e) * Math.sqrt(a ** 3 / GM.earth) / Astro.DAY_S;
}

// The transfer ellipse that climbs from rp to r in `days`: its apogee, or
// that of the slowest one (apogee at r) when there is more time than that.
function apogeeFor(rp, r, days) {
    if (timeTo(rp, r, r) <= days)
        return r;
    let [lo, hi] = [r, 1e7];
    for (let k = 0; k < 60; k++) {
        const mid = Math.sqrt(lo * hi);
        if (timeTo(rp, mid, r) > days)
            lo = mid;
        else
            hi = mid;
    }
    return hi;
}

// A lunar orbit, relative to the Moon in Moon radii. Low orbits are drawn a
// little higher than they are so they clear the Moon on screen.
function lunarOrbit(spec = {}, seed = 0) {
    if (spec === 'nrho') {
        // Close over the north pole, far over the south, once a week.
        const [rp, ra] = [1.6, 4.4], period = 6.56;
        return {kind: 'nrho', period, alt: null, shape: {rp, e: (ra - rp) / (ra + rp), i: 90, node: 90, flip: true}};
    }
    if (spec === 'dro') {
        // Wide and backward, nearly in the Moon's orbital plane.
        return {kind: 'dro', period: 12, alt: null, shape: {rp: 3.2, e: 0, i: 178, node: 0}};
    }
    const alt = spec.alt ?? 100;
    const r = MOON_R + alt;
    const period = Astro.satellitePeriodS(r, GM_MOON) / Astro.DAY_S;
    return {kind: 'low', period, alt, shape: {rp: Math.max(1.4, r / MOON_R), e: 0, i: spec.i ?? 90, node: spec.node ?? 360 * seed}};
}

// Where on a lunar orbit (Moon radii, ecliptic) at time t, from the
// moment it was entered.
function orbitPoint(orbit, t0, t) {
    const {rp, e, i, node, flip} = orbit.shape;
    const h = Astro.fromLonLat(node, 0);
    const k = Astro.cross([0, 0, 1], h);
    const ir = i * Math.PI / 180;
    const up = Astro.add(Astro.scale(k, Math.cos(ir)), Astro.scale([0, 0, 1], Math.sin(ir)));
    const M = TAU * ((t - t0) / orbit.period % 1);
    const nu = e ? trueOf(M, e) : M;
    const r = rp * (1 + e) / (1 + e * Math.cos(nu));
    // An NRHO's low point is over the north pole.
    const [a, b] = flip ? [up, Astro.scale(h, -1)] : [h, up];
    return Astro.add(Astro.scale(a, r * Math.cos(nu)), Astro.scale(b, r * Math.sin(nu)));
}

export class LunarTrajectory {
    constructor(mission) {
        this.mission = mission;
        this.lunar = true;
        this.events = mission.events.map(ev => ({...ev, t: Astro.jd(ev.date), mission})).sort((a, b) => a.t - b.t);
        this.launch = this.events[0].t;
        this.segments = [];
        this.end = Infinity;
        this._build();
    }

    _build() {
        const evs = this.events.filter(ev => ev.at);
        const seed = this._seed();
        let orbit = null;          // the lunar orbit last entered
        let orbitT0 = 0;
        let site = null;
        // What happens next to the Moon at the start of event i, in Moon radii.
        const nearAt = (ev, t) => {
            if (ev.kind === 'land' || ev.kind === 'liftoff' || ev.kind === 'end' && ev.site)
                return sitePoint(ev.site ?? site, t);
            if (ev.kind === 'arrive') {
                const o = lunarOrbit(ev.orbit, seed);
                return orbitPoint(o, t, t);
            }
            if (ev.kind === 'flyby')
                return this._swing(ev, t)(t);
            return orbit ? orbitPoint(orbit, orbitT0, t) : [1.4, 0, 0];
        };
        const push = seg => this.segments.push({kind: 'fly', ...seg});

        for (let i = 0; i + 1 < evs.length; i++) {
            const [a, b] = [evs[i], evs[i + 1]];
            const [t0, t1] = [a.t, b.t];
            const atMoon = ev => ev.at === 'moon';
            if (a.at === 'earth' && b.at === 'earth') {
                // Raising an Earth orbit, ahead of the push to the Moon.
                const next = evs[i + 2];
                const out = next ? this._outbound(t1, next.t, next) : null;
                push({phase: 'earth', t0, t1, from: a, to: b, geo: this._loops(t0, t1, b.loops ?? 4, out)});
            } else if (a.at === 'earth' && atMoon(b)) {
                const out = this._outbound(t0, t1, b);
                const v = nearAt(b, t1);
                const tb = Math.min(BLEND, (t1 - t0) * 0.3);
                // Days to spare before the push: a parking orbit, or loops
                // of Earth while the Moon comes round.
                const wait = out.wait > 1 || b.path === 'loops' ? this._loops(t0, t0 + out.wait, b.loops ?? 3, out) : out.parking;
                const geo = out.wait > 0 ? (t => t < t0 + out.wait ? wait(t) : out.geo(t)) : out.geo;
                push({phase: 'out', t0, t1, wait: out.wait, from: a, to: b, geo, near: t => ({w: smooth((t - (t1 - tb)) / tb), v})});
            } else if (atMoon(a) && b.at === 'earth') {
                const v = a.kind === 'flyby' ? this._swing(a, t0)(t0 + this._swingHalf(a)) : nearAt(a, t0);
                const ts = a.kind === 'flyby' ? t0 + this._swingHalf(a) : t0;
                const back = this._inbound(ts, t1, b);
                const tb = Math.min(BLEND, (t1 - ts) * 0.3);
                push({phase: 'back', t0: ts, t1, from: a, to: b, geo: back,
                    near: t => ({w: 1 - smooth((t - ts) / tb), v})});
            } else if (atMoon(a) && atMoon(b)) {
                const body = 'moon';
                const geo = t => Astro.moonPosition(t);
                const D = Math.min(0.05, (t1 - t0) * 0.4);
                if (a.kind === 'arrive' || a.kind === 'liftoff' || a.kind === 'depart' && orbit) {
                    if (a.kind === 'arrive') {
                        orbit = lunarOrbit(a.orbit, seed);
                        orbitT0 = t0;
                    }
                    const o = orbit, ot = orbitT0;
                    const into = b.kind === 'land' || b.kind === 'end' && b.site ? sitePoint(b.site, t1) : null;
                    const fromSite = a.kind === 'liftoff' ? sitePoint(site, t0) : null;
                    if (b.kind === 'land')
                        site = b.site;
                    if (a.kind === 'depart' || b.kind === 'flyby') {
                        // Out of orbit toward the next pass: from where it was
                        // to where the swing starts.
                        const vb = nearAt(b, t1 - this._swingHalf(b));
                        const va = orbitPoint(o, ot, t0);
                        const te = b.kind === 'flyby' ? t1 - this._swingHalf(b) : t1;
                        push({phase: 'near', t0, t1: te, from: a, to: b, body, geo,
                            near: t => ({w: 1, v: lerp(va, vb, smooth((t - t0) / (te - t0)))})});
                        if (b.kind === 'flyby')
                            push({phase: 'swing', t0: te, t1: t1 + this._swingHalf(b), from: b, to: evs[i + 2], body, geo, near: t => ({w: 1, v: this._swing(b, t1)(t)})});
                        continue;
                    }
                    push({phase: 'orbit', t0, t1, from: a, to: b, body, geo, orbit: o, near: t => {
                        let v = orbitPoint(o, ot, t);
                        if (fromSite && t < t0 + D)
                            v = lerp(fromSite, v, smooth((t - t0) / D));
                        if (into && t > t1 - D)
                            v = lerp(v, into, smooth((t - (t1 - D)) / D));
                        return {w: 1, v};
                    }});
                } else if (a.kind === 'land') {
                    site = a.site;
                    const s = a.site;
                    push({phase: 'surface', t0, t1, from: a, to: b, body, geo, site: s, near: t => ({w: 1, v: sitePoint(s, t)})});
                } else if (a.kind === 'flyby') {
                    // From a pass into an orbit (Artemis I into its DRO).
                    const ts = t0 + this._swingHalf(a);
                    const va = this._swing(a, t0)(ts);
                    const vb = nearAt(b, t1);
                    push({phase: 'near', t0: ts, t1, from: a, to: b, body, geo,
                        near: t => ({w: 1, v: lerp(va, vb, smooth((t - ts) / (t1 - ts)))})});
                }
            }
            // Passes get their swing segment here, between the legs either side.
            if (b.kind === 'flyby' && a.at === 'earth') {
                const h = this._swingHalf(b);
                const last = this.segments.at(-1);
                last.t1 = t1 - h;
                const tb = Math.min(BLEND, (last.t1 - t0) * 0.3);
                const v = this._swing(b, t1)(t1 - h), lt1 = last.t1;
                last.near = t => ({w: smooth((t - (lt1 - tb)) / tb), v});
                push({phase: 'swing', t0: t1 - h, t1: t1 + h, from: b, to: evs[i + 2], body: 'moon',
                    geo: t => Astro.moonPosition(t), near: t => ({w: 1, v: this._swing(b, t1)(t)})});
            }
        }
        // Still there: in orbit or on the surface for good (or until the end).
        const last = evs.at(-1);
        const endEv = this.events.find(ev => ev.kind === 'end');
        if (last.at === 'moon' && last.kind !== 'end') {
            const geo = t => Astro.moonPosition(t);
            if (last.kind === 'land') {
                const s = last.site;
                push({phase: 'surface', t0: last.t, t1: Infinity, from: last, body: 'moon', geo, site: s, near: t => ({w: 1, v: sitePoint(s, t)})});
            } else {
                if (last.kind === 'arrive') {
                    orbit = lunarOrbit(last.orbit, seed);
                    orbitT0 = last.t;
                }
                const o = orbit, ot = orbitT0;
                const fromSite = last.kind === 'liftoff' ? sitePoint(site, last.t) : null;
                push({phase: 'orbit', t0: last.t, t1: Infinity, from: last, body: 'moon', geo, orbit: o, near: t => {
                    let v = orbitPoint(o, ot, t);
                    if (fromSite && t < last.t + 0.05)
                        v = lerp(fromSite, v, smooth((t - last.t) / 0.05));
                    return {w: 1, v};
                }});
            }
        }
        if (endEv)
            this.end = endEv.t;
        for (const seg of this.segments)
            seg.pos = t => Astro.add(Astro.planetPosition('earth', t), Astro.scale(seg.geo(t), 1 / Astro.AU_KM));
    }

    _seed() {
        let h = 2166136261;
        for (const c of this.mission.id)
            h = Math.imul(h ^ c.charCodeAt(0), 16777619);
        return (h >>> 0) / 4294967296;
    }

    // From a parking orbit to the Moon, arriving at t1: the arc itself, how
    // long it waits in the parking orbit first, and that orbit.
    _outbound(t0, t1, ev) {
        const [u, , n] = moonPlane(t1);
        const target = Astro.moonPosition(t1);
        const r = Astro.norm(target);
        const days = t1 - t0;
        if (ev.path === 'far') {
            // Out to 1.3 million km, ahead of the Moon's line, then back
            // in to meet it.
            const ra = 1.3e6, phi = 110 * Math.PI / 180;
            const A = rotate(u, n, -phi);
            const tm = t0 + days * 0.45;
            const e1 = (ra - PARKING) / (ra + PARKING);
            const first = arc({rp: PARKING, e: e1, peri: Astro.scale(A, -1), n, nu0: 0, nu1: Math.PI, t0, t1: tm});
            const e2 = (ra - r) / (ra - r * Math.cos(phi));
            const second = arc({rp: ra * (1 - e2) / (1 + e2), e: e2, peri: Astro.scale(A, -1), n, nu0: Math.PI, nu1: Math.PI + phi, t0: tm, t1});
            return {geo: t => t < tm ? first(t) : second(t), wait: 0, peri: Astro.scale(A, -1), n};
        }
        if (ev.path === 'spiral') {
            // An ion engine's slow spiral: a few dozen laps drawn for the
            // hundreds it really took.
            const turns = 24;
            const end = Math.atan2(Astro.dot(target, Astro.cross(n, u)), Astro.dot(target, u));
            const geo = t => {
                const k = Math.max(0, Math.min(1, (t - t0) / days));
                const rr = 7000 * (r / 7000) ** (k ** 1.6);
                const ang = end - TAU * turns * (1 - k) ** 0.6;
                return Astro.scale(Astro.add(Astro.scale(u, Math.cos(ang)), Astro.scale(Astro.cross(n, u), Math.sin(ang))), rr);
            };
            return {geo, wait: 0, peri: u, n};
        }
        const ra = apogeeFor(PARKING, r, days);
        const e = (ra - PARKING) / (ra + PARKING);
        const nu = Math.acos(Math.max(-1, Math.min(1, ((ra + PARKING) / 2 * (1 - e * e) / r - 1) / e)));
        const flight = Math.min(days, timeTo(PARKING, ra, r));
        const peri = rotate(Astro.unit(target), n, -nu);
        const tli = t1 - flight;
        const geo = arc({rp: PARKING, e, peri, n, nu0: 0, nu1: nu, t0: tli, t1});
        const lap = Astro.satellitePeriodS(PARKING, GM.earth) / Astro.DAY_S;
        const q = Astro.cross(n, peri);
        const parking = t => {
            const ang = -TAU * (tli - t) / lap;
            return Astro.scale(Astro.add(Astro.scale(peri, Math.cos(ang)), Astro.scale(q, Math.sin(ang))), PARKING);
        };
        return {geo, wait: tli - t0, parking, peri, n};
    }

    // From the Moon at t0 down to Earth's air at t1: the outbound arc in
    // reverse.
    _inbound(t0, t1, _ev) {
        const [, , n] = moonPlane(t0);
        const start = Astro.moonPosition(t0);
        const r = Astro.norm(start);
        const days = t1 - t0;
        const ra = apogeeFor(ENTRY, r, days);
        const e = (ra - ENTRY) / (ra + ENTRY);
        const nu = Math.acos(Math.max(-1, Math.min(1, ((ra + ENTRY) / 2 * (1 - e * e) / r - 1) / e)));
        const peri = rotate(Astro.unit(start), n, nu);
        const flight = Math.min(days, timeTo(ENTRY, ra, r));
        return arc({rp: ENTRY, e, peri, n, nu0: TAU - nu, nu1: TAU, t0, t1: t0 + flight});
    }

    // Loops of a parking orbit raised a few times, its low point where the
    // push to the Moon starts.
    _loops(t0, t1, count, out) {
        const peri = out?.peri ?? [1, 0, 0], n = out?.n ?? [0, 0, 1];
        const apogees = Array.from({length: count}, (_, k) => 30000 * (150000 / 30000) ** (k / Math.max(1, count - 1)));
        const periods = apogees.map(ra => Math.sqrt(((PARKING + ra) / 2) ** 3));
        const total = periods.reduce((x, y) => x + y, 0);
        const arcs = [];
        let t = t0;
        for (const [k, ra] of apogees.entries()) {
            const dt = (t1 - t0) * periods[k] / total;
            arcs.push([t + dt, arc({rp: PARKING, e: (ra - PARKING) / (ra + PARKING), peri, n, nu0: 0, nu1: TAU, t0: t, t1: t + dt})]);
            t += dt;
        }
        return time => (arcs.find(([end]) => time < end) ?? arcs.at(-1))[1](time);
    }

    // Half the time spent swinging around the Moon on a pass, days.
    _swingHalf(ev) {
        return ev.alt && ev.alt > 3000 ? 0.3 : 0.18;
    }

    // Around the far side on a pass: in from the side facing Earth ahead of
    // the Moon, behind it and back out, clockwise seen from the north (the
    // figure eight of a free return).
    _swing(ev, tc) {
        const h = this._swingHalf(ev);
        const rr = Math.min(3, 1.25 + 0.2 * (ev.alt ?? 200) / 1000);
        const [u, w] = moonPlane(tc);
        return t => {
            const k = Math.max(0, Math.min(1, (t - (tc - h)) / (2 * h)));
            // From 70° off the Earth side, around the back, to 290°.
            const ang = (70 + 220 * k) * Math.PI / 180;
            return Astro.scale(Astro.add(Astro.scale(u, -Math.cos(ang)), Astro.scale(w, Math.sin(ang))), rr);
        };
    }

    segmentAt(t) {
        if (t < this.launch || t > this.end)
            return null;
        for (const s of this.segments) {
            if (t >= s.t0 && t < s.t1)
                return s;
        }
        return null;
    }

    position(t) {
        const s = this.segmentAt(t);
        return s ? s.pos(t) : null;
    }

    // km from Earth's center.
    geo(t) {
        const s = this.segmentAt(t);
        return s ? s.geo(t) : null;
    }

    // On screen, given how a view draws Earth's neighborhood: place(km
    // vector) -> [x, y, depth]; moon: [x, y, depth] and radius R (px) of
    // the Moon's sprite; view(v) the camera's turn. Returns [x, y, depth,
    // behind] (behind: hidden by the Moon), or null.
    screen(t, {place, moon, R, view}) {
        const s = this.segmentAt(t);
        if (!s)
            return null;
        const {w, v} = s.near?.(t) ?? {w: 0};
        let p = w < 1 ? place(s.geo(t)) : null;
        let behind = false;
        if (w > 0) {
            const d = view(v);
            const q = [moon[0] + d[0] * R, moon[1] - d[1] * R, moon[2] + d[2] * R];
            behind = w > 0.5 && d[2] < 0 && Math.hypot(d[0], d[1]) < 1;
            p = p ? [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w, p[2] + (q[2] - p[2]) * w] : q;
        }
        return [p[0], p[1], p[2], behind];
    }

    // Speed, km/s: around the Moon while in orbit, else from Earth.
    speedKmS(t) {
        const s = this.segmentAt(t);
        if (!s || s.phase === 'surface')
            return 0;
        if (s.phase === 'orbit' && s.orbit.alt !== null)
            return Math.sqrt(GM_MOON / (MOON_R + s.orbit.alt));
        if (s.phase === 'orbit' || s.phase === 'swing' || s.phase === 'near')
            return s.orbit?.kind === 'dro' ? 0.6 : 1.0;
        const dt = 0.002;
        return Astro.norm(Astro.sub(s.geo(Math.min(t + dt, s.t1 - 1e-6)), s.geo(Math.max(t - dt, s.t0)))) /
            ((Math.min(t + dt, s.t1 - 1e-6) - Math.max(t - dt, s.t0)) * Astro.DAY_S);
    }

    // Too close to Earth for a trail in the solar system.
    samples() {
        return [];
    }

    // Points of the legs between Earth and the Moon, for the Earth
    // close-up: [{t, p: km vector, w: how far it has joined the Moon}].
    path(from = this.launch, to = this.end) {
        const out = [];
        for (const s of this.segments) {
            if (s.phase !== 'out' && s.phase !== 'back' && s.phase !== 'earth')
                continue;
            // (Not the laps of a parking orbit, which hug the planet.)
            const t0 = Math.max(s.t0 + (s.wait && s.wait <= 1 ? s.wait : 0), from), t1 = Math.min(s.t1, to);
            if (t1 <= t0)
                continue;
            // Evenly in time, then finer wherever a step is long for how
            // close it is to Earth (fast and curving, near perigee).
            const at = t => ({t, p: s.geo(Math.min(t, s.t1 - 1e-6)), w: s.near?.(t).w ?? 0});
            const leg = [];
            const fill = (a, b, depth) => {
                const gap = Astro.norm(Astro.sub(a.p, b.p));
                if (depth < 10 && gap > 0.06 * Math.min(Astro.norm(a.p), Astro.norm(b.p)) + 200) {
                    const mid = at((a.t + b.t) / 2);
                    fill(a, mid, depth + 1);
                    fill(mid, b, depth + 1);
                } else {
                    leg.push(b);
                }
            };
            const n = 120;
            let prev = at(t0);
            leg.push(prev);
            for (let k = 1; k <= n; k++) {
                const next = at(t0 + (t1 - t0) * k / n);
                fill(prev, next, 0);
                prev = next;
            }
            out.push(leg);
        }
        return out;
    }

    nextTarget(t) {
        return this.events.find(ev => ev.t > t && ev.at && ev.kind !== 'end') ??
            this.events.find(ev => ev.t > t && ev.kind === 'end' && ev.at);
    }

    get milestones() {
        return this.events;
    }
}

// What a lunar mission is doing at time t, in a few words.
export function lunarPhase(tr, t) {
    const s = tr.segmentAt(t);
    if (!s)
        return null;
    if (s.phase === 'earth' || s.phase === 'out' && s.geo(t) && Astro.norm(s.geo(t)) < PARKING + 50)
        return {phase: 'earth', seg: s};
    return {phase: s.phase, seg: s};
}

export const LUNAR_ORBIT_KINDS = {nrho: 'a halo orbit', dro: 'a distant backward orbit'};
export {MOON_R};

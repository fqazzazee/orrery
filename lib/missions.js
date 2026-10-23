// Spacecraft that used gravity assists, with the real dates of each encounter,
// and the trajectories rebuilt from them.
//
// Each leg between two encounters is the conic (Lambert's problem) that joins
// the bodies' real positions on those dates. Engine burns between encounters
// are not modelled, so the path is right at every encounter and close in
// between.
//
// Event fields:
//   at       body the craft is at (positional event), or
//   point    [AU, ecliptic longitude, latitude] for a place in empty space
//   kind     launch | flyby | arrive | point | note | end
//   turns    rough number of laps around the Sun on the leg *into* this event
//            ('auto' picks the least eccentric conic); default is a direct arc
//   q / Q    perihelion / aphelion hint (AU) for picking among multi-lap conics
//   laps     with q: a resonant leg (the planet returns to the same spot), so
//            the orbit is built from the lap count instead of Lambert
//   impact   the mission ended by crashing into the body

import * as A from './astro.js';

export const MISSIONS = [
    {
        id: 'mariner10', name: 'Mariner 10', agency: 'NASA', color: '#ffd27a',
        events: [
            {date: '1973-11-03', at: 'earth', kind: 'launch', note: 'Bound for Venus and Mercury.'},
            {date: '1974-02-05', at: 'venus', kind: 'flyby', note: 'The first gravity assist ever flown: Venus bent its path toward Mercury.'},
            {date: '1974-03-29', at: 'mercury', kind: 'flyby', note: 'First close look at Mercury, which turned out to have a magnetic field.'},
            {date: '1974-09-21', at: 'mercury', kind: 'flyby', laps: 1, q: 0.46, note: 'Second pass: its orbit was tuned to meet Mercury every two Mercury years.'},
            {date: '1975-03-16', at: 'mercury', kind: 'flyby', laps: 1, q: 0.46, note: 'Third and closest pass, 327 km above the surface.'},
            {date: '1975-03-24', kind: 'end', note: 'Out of attitude-control gas; switched off in orbit around the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'pioneer10', name: 'Pioneer 10', agency: 'NASA', color: '#ffb38a',
        events: [
            {date: '1972-03-03', at: 'earth', kind: 'launch', note: 'Headed for the first trip through the asteroid belt.'},
            {date: '1973-12-04', at: 'jupiter', kind: 'flyby', note: 'First spacecraft to fly past Jupiter; the flyby flung it out of the solar system.'},
            {date: '2003-01-23', point: [81.6, 79, 3], kind: 'point', title: 'Last signal', note: 'Last faint signal received, from 12 billion km. It drifts on toward Aldebaran.'},
        ],
        after: {escape: 2.54},
        silentAfter: '2003-01-23',
    },
    {
        id: 'pioneer11', name: 'Pioneer 11', agency: 'NASA', color: '#f59a9a',
        events: [
            {date: '1973-04-06', at: 'earth', kind: 'launch', note: 'A backup to Pioneer 10, retargeted on the way.'},
            {date: '1974-12-03', at: 'jupiter', kind: 'flyby', note: 'Passed 43,000 km above the clouds; Jupiter swung it across the solar system to Saturn.'},
            {date: '1979-09-01', at: 'saturn', kind: 'flyby', note: 'First spacecraft to visit Saturn.'},
            {date: '1995-09-30', point: [43.4, 283, 14], kind: 'point', title: 'Last signal', note: 'Power ran too low to talk to Earth. It coasts toward the constellation Aquila.'},
        ],
        after: {escape: 2.4},
        silentAfter: '1995-09-30',
    },
    {
        id: 'voyager2', name: 'Voyager 2', agency: 'NASA', color: '#8fe3c0',
        events: [
            {date: '1977-08-20', at: 'earth', kind: 'launch', note: 'Launched 16 days before its twin to ride a once-in-176-years planetary alignment.'},
            {date: '1979-07-09', at: 'jupiter', kind: 'flyby', note: 'Jupiter’s pull sped it on toward Saturn.'},
            {date: '1981-08-26', at: 'saturn', kind: 'flyby', note: 'Saturn’s gravity aimed it at Uranus.'},
            {date: '1986-01-24', at: 'uranus', kind: 'flyby', note: 'The only visit ever to Uranus.'},
            {date: '1989-08-25', at: 'neptune', kind: 'flyby', note: 'The only visit to Neptune; it saw the Great Dark Spot and geysers on Triton.'},
            {date: '2018-11-05', point: [119, 288.3, -37.4], kind: 'point', title: 'Interstellar space', note: 'Crossed the heliopause at 119 AU, leaving the Sun’s bubble of solar wind.'},
        ],
        after: {escape: 3.25},
    },
    {
        id: 'voyager1', name: 'Voyager 1', agency: 'NASA', color: '#7fd0ff',
        events: [
            {date: '1977-09-05', at: 'earth', kind: 'launch', note: 'Launched second but on a faster path, so it reached Jupiter first.'},
            {date: '1979-03-05', at: 'jupiter', kind: 'flyby', note: 'Spotted erupting volcanoes on Io, the first seen beyond Earth.'},
            {date: '1980-11-12', at: 'saturn', kind: 'flyby', note: 'A close pass by Titan threw it up and out of the plane of the planets.'},
            {date: '1990-02-14', kind: 'note', title: 'Pale Blue Dot', note: 'Turned around and photographed Earth as a speck from about 6 billion km.'},
            {date: '2012-08-25', point: [121.6, 255.7, 34.8], kind: 'point', title: 'Interstellar space', note: 'First human-made object to cross into interstellar space, at about 122 AU.'},
            {date: '2026-11-15', kind: 'note', title: 'One light-day', note: 'Reaches one light-day from Earth: radio signals take 24 hours each way.'},
        ],
        after: {escape: 3.58},
    },
    {
        id: 'galileo', name: 'Galileo', agency: 'NASA', color: '#ffe08a',
        events: [
            {date: '1989-10-18', at: 'earth', kind: 'launch', note: 'Too heavy to fly straight to Jupiter, it looped Venus–Earth–Earth (VEEGA).'},
            {date: '1990-02-10', at: 'venus', kind: 'flyby', note: 'Venus gravity assist, the first of three.'},
            {date: '1990-12-08', at: 'earth', kind: 'flyby', note: 'First Earth flyby, onto a two-year loop through the asteroid belt.'},
            {date: '1991-10-29', kind: 'note', title: 'Asteroid Gaspra', note: 'The first close flyby of an asteroid.'},
            {date: '1992-12-08', at: 'earth', kind: 'flyby', laps: 1, q: 0.9, note: 'Second Earth flyby, the final push to Jupiter.'},
            {date: '1993-08-28', kind: 'note', title: 'Asteroid Ida', note: 'Found Dactyl, the first known moon of an asteroid.'},
            {date: '1994-07-16', kind: 'note', title: 'Comet Shoemaker–Levy 9', note: 'Had the only direct view of the comet’s pieces slamming into Jupiter.'},
            {date: '1995-12-07', at: 'jupiter', kind: 'arrive', note: 'First spacecraft to orbit Jupiter; its probe plunged into the atmosphere the same day.'},
            {date: '2003-09-21', at: 'jupiter', kind: 'end', impact: true, note: 'Steered into Jupiter so it could never contaminate Europa.'},
        ],
    },
    {
        id: 'cassini', name: 'Cassini–Huygens', short: 'Cassini', agency: 'NASA/ESA/ASI', color: '#c9a7ff',
        events: [
            {date: '1997-10-15', at: 'earth', kind: 'launch', note: 'Headed inward first, for a Venus–Venus–Earth–Jupiter tour.'},
            {date: '1998-04-26', at: 'venus', kind: 'flyby', note: 'First Venus gravity assist.'},
            {date: '1999-06-24', at: 'venus', kind: 'flyby', turns: 1, note: 'Second Venus flyby.'},
            {date: '1999-08-18', at: 'earth', kind: 'flyby', note: 'Earth flyby added about 5.5 km/s.'},
            {date: '2000-12-30', at: 'jupiter', kind: 'flyby', note: 'Jupiter flyby, studied together with the Galileo orbiter.'},
            {date: '2004-07-01', at: 'saturn', kind: 'arrive', note: 'Entered orbit around Saturn after a seven-year trip.'},
            {date: '2005-01-14', kind: 'note', title: 'Huygens lands on Titan', note: 'The farthest landing ever made, on Saturn’s moon Titan.'},
            {date: '2017-09-15', at: 'saturn', kind: 'end', impact: true, note: 'Grand Finale: dove into Saturn’s atmosphere after 13 years in orbit.'},
        ],
    },
    {
        id: 'rosetta', name: 'Rosetta', agency: 'ESA', color: '#9fd0ff',
        events: [
            {date: '2004-03-02', at: 'earth', kind: 'launch', note: 'A ten-year chase of comet 67P/Churyumov–Gerasimenko.'},
            {date: '2005-03-04', at: 'earth', kind: 'flyby', laps: 1, q: 0.9, note: 'First of three Earth gravity assists.'},
            {date: '2007-02-25', at: 'mars', kind: 'flyby', turns: 'auto', note: 'Skimmed 250 km above Mars, its riskiest flyby.'},
            {date: '2007-11-13', at: 'earth', kind: 'flyby', note: 'Second Earth flyby.'},
            {date: '2008-09-05', kind: 'note', title: 'Asteroid Šteins', note: 'Flew past the asteroid 2867 Šteins.'},
            {date: '2009-11-13', at: 'earth', kind: 'flyby', laps: 1, q: 0.91, note: 'Third Earth flyby, onto the comet’s path.'},
            {date: '2010-07-10', kind: 'note', title: 'Asteroid Lutetia', note: 'Flew past the 100 km asteroid 21 Lutetia.'},
            {date: '2014-08-06', at: '67p', kind: 'arrive', note: 'First spacecraft to orbit a comet, after 31 months asleep.'},
            {date: '2014-11-12', kind: 'note', title: 'Philae lands', note: 'Its lander Philae made the first landing on a comet.'},
            {date: '2016-09-30', at: '67p', kind: 'end', impact: true, note: 'Set down gently on the comet to end the mission.'},
        ],
    },
    {
        id: 'messenger', name: 'MESSENGER', agency: 'NASA', color: '#ffa86b',
        events: [
            {date: '2004-08-03', at: 'earth', kind: 'launch', note: 'Mercury is hard to reach: falling toward the Sun makes you too fast to stop.'},
            {date: '2005-08-02', at: 'earth', kind: 'flyby', laps: 1, q: 0.9, note: 'Earth flyby to start shedding speed.'},
            {date: '2006-10-24', at: 'venus', kind: 'flyby', turns: 'auto', note: 'First Venus flyby.'},
            {date: '2007-06-05', at: 'venus', kind: 'flyby', laps: 1, q: 0.55, note: 'Second Venus flyby.'},
            {date: '2008-01-14', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'First of three Mercury flybys.'},
            {date: '2008-10-06', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Second Mercury flyby.'},
            {date: '2009-09-29', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Third Mercury flyby; six planetary flybys in all.'},
            {date: '2011-03-18', at: 'mercury', kind: 'arrive', turns: 'auto', note: 'First spacecraft to orbit Mercury.'},
            {date: '2015-04-30', at: 'mercury', kind: 'end', impact: true, note: 'Out of fuel, it crashed into Mercury after four years in orbit.'},
        ],
    },
    {
        id: 'newhorizons', name: 'New Horizons', agency: 'NASA', color: '#a8f08a',
        events: [
            {date: '2006-01-19', at: 'earth', kind: 'launch', note: 'The fastest launch ever: it passed the Moon’s orbit in about nine hours.'},
            {date: '2007-02-28', at: 'jupiter', kind: 'flyby', note: 'Jupiter’s pull cut about three years off the trip to Pluto.'},
            {date: '2015-07-14', at: 'pluto', kind: 'flyby', note: 'First close look at Pluto and its bright, heart-shaped nitrogen plain.'},
            {date: '2019-01-01', kind: 'note', title: 'Arrokoth', note: 'The most distant object ever explored up close, 6.6 billion km from the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'juno', name: 'Juno', agency: 'NASA', color: '#ff9fd0',
        events: [
            {date: '2011-08-05', at: 'earth', kind: 'launch', note: 'A solar-powered Jupiter orbiter.'},
            {date: '2013-10-09', at: 'earth', kind: 'flyby', turns: 1, Q: 2.3, note: 'Looped back past Earth for a boost of about 7.3 km/s.'},
            {date: '2016-07-05', at: 'jupiter', kind: 'arrive', note: 'Entered a polar orbit to look beneath Jupiter’s clouds.'},
        ],
    },
    {
        id: 'parker', name: 'Parker Solar Probe', short: 'Parker', agency: 'NASA', color: '#ffe36b',
        events: [
            {date: '2018-08-12', at: 'earth', kind: 'launch', note: 'Built to fly through the Sun’s outer atmosphere.'},
            {date: '2018-10-03', at: 'venus', kind: 'flyby', note: 'First of seven Venus flybys, each one lowering its closest approach to the Sun.'},
            {date: '2019-12-26', at: 'venus', kind: 'flyby', laps: 3, q: 0.166, note: 'Venus flyby 2.'},
            {date: '2020-07-11', at: 'venus', kind: 'flyby', q: 0.129, note: 'Venus flyby 3.'},
            {date: '2021-02-20', at: 'venus', kind: 'flyby', laps: 2, q: 0.095, note: 'Venus flyby 4.'},
            {date: '2021-10-16', at: 'venus', kind: 'flyby', q: 0.074, note: 'Venus flyby 5.'},
            {date: '2023-08-21', at: 'venus', kind: 'flyby', laps: 7, q: 0.062, note: 'Venus flyby 6.'},
            {date: '2024-11-06', at: 'venus', kind: 'flyby', laps: 5, q: 0.053, note: 'Seventh and final Venus flyby.'},
            {date: '2024-12-24', kind: 'note', title: 'Closest approach', note: 'Passed 6.1 million km from the Sun’s surface at about 690,000 km/h, the fastest ever.'},
        ],
        after: {orbit: {q: 0.046, periodDays: 88, perihelion: '2024-12-24'}},
    },
    {
        id: 'bepicolombo', name: 'BepiColombo', agency: 'ESA/JAXA', color: '#8fb8ff',
        events: [
            {date: '2018-10-20', at: 'earth', kind: 'launch', note: 'Two orbiters stacked together, bound for Mercury.'},
            {date: '2020-04-10', at: 'earth', kind: 'flyby', turns: 'auto', note: 'Earth flyby.'},
            {date: '2020-10-15', at: 'venus', kind: 'flyby', note: 'First Venus flyby.'},
            {date: '2021-08-10', at: 'venus', kind: 'flyby', turns: 'auto', note: 'Second Venus flyby.'},
            {date: '2021-10-01', at: 'mercury', kind: 'flyby', note: 'First of six Mercury flybys.'},
            {date: '2022-06-23', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Mercury flyby 2.'},
            {date: '2023-06-19', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Mercury flyby 3.'},
            {date: '2024-09-04', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Mercury flyby 4.'},
            {date: '2024-12-01', at: 'mercury', kind: 'flyby', laps: 1, q: 0.29, note: 'Mercury flyby 5.'},
            {date: '2025-01-08', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Sixth and last Mercury flyby.'},
            {date: '2026-11-15', at: 'mercury', kind: 'arrive', turns: 'auto', planned: true, note: 'Due to slip into orbit around Mercury in late 2026.'},
        ],
    },
];

// ---- Trajectories ----

const TAU = 2 * Math.PI;
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

function eventPosition(ev, t) {
    if (ev.at)
        return A.bodyPosition(ev.at, t);
    const [r, lon, lat] = ev.point;
    return A.fromLonLat(lon, lat, r);
}

function prograde(r1, r2) {
    let d = Math.acos(Math.max(-1, Math.min(1, A.dot(r1, r2) / (A.norm(r1) * A.norm(r2)))));
    return A.cross(r1, r2)[2] < 0 ? TAU - d : d;
}

// The conic for one leg, chosen from Lambert's solutions per the leg's hints.
// With a q/Q hint the arrival is allowed to slip a few days (the craft is
// blended onto the target afterwards): real trajectories had small burns, and
// some legs sit right at the edge of feasibility.
function solveLeg(r1, r2, t1, t2, ev, sameBody) {
    const hinted = ev.q !== undefined || ev.Q !== undefined;
    const slips = hinted ? [0, 0.5, -0.5, 1, -1, 2, -2, 3, -3] : [0];
    let sols = [];
    for (const slip of slips) {
        sols.push(...A.lambert(r1, r2, t2 + slip - t1, {maxRevs: 8})
            .map(s => ({...s, slip, orbit: A.orbitFromState(r1, s.v1, t1)})));
    }
    // Between two passes of the same planet, one "solution" is just riding
    // along with the planet; drop it.
    if (!sols.length)
        return null;
    if (sameBody && ev.turns === 'auto') {
        const tm = (t1 + t2) / 2;
        const apart = sols.filter(s => A.norm(A.sub(A.orbitPosition(s.orbit, tm), A.bodyPosition(sameBody, tm))) > 0.03);
        if (apart.length)
            sols = apart;
    }

    let pool = sols;
    if (typeof ev.turns === 'number') {
        const n = Math.max(0, Math.round(ev.turns - prograde(r1, r2) / TAU));
        pool = sols.filter(s => s.revs === n);
    } else if (ev.turns !== 'auto' && !hinted) {
        pool = sols.filter(s => s.revs === 0);
    }
    if (!pool.length)
        pool = sols;

    const fit = ev.q !== undefined ? s => Math.abs(A.perihelion(s.orbit) - ev.q) / ev.q
        : ev.Q !== undefined ? s => Math.abs(A.aphelion(s.orbit) - ev.Q) / ev.Q
            : s => s.orbit.e;
    const score = s => fit(s) + Math.abs(s.slip) * 0.01;
    pool.sort((a, b) => score(a) - score(b));
    return pool[0].orbit;
}

// A resonant leg: the planet is back where it was after a whole number of its
// own years, so every orbit whose period divides the gap fits and Lambert
// cannot choose. Build the one with `laps` laps and perihelion `q` instead,
// crossing r1 inbound or outbound, whichever continues the previous leg.
function resonantLeg(r1, t1, t2, ev, prevOrbit) {
    const period = (t2 - t1) / ev.laps;
    const a = Math.cbrt(A.MU_SUN * (period / TAU) ** 2);
    const e = 1 - ev.q / a;
    const R = A.norm(r1);
    const nu = Math.acos(Math.max(-1, Math.min(1, (a * (1 - e * e) / R - 1) / e)));
    const w = prevOrbit ? A.unit(A.cross(prevOrbit.p, prevOrbit.q)) : [0, 0, 1];
    const u = A.unit(A.sub(r1, A.scale(w, A.dot(r1, w))));
    const v = A.cross(w, u);
    const build = f => {
        const p = A.add(A.scale(u, Math.cos(-f)), A.scale(v, Math.sin(-f)));
        return {p, q: A.cross(w, p), a, e, mu: A.MU_SUN, m0: A.meanFromTrue(f, e), t0: t1};
    };
    const velocity = (o, t) => A.sub(A.orbitPosition(o, t + 0.01), A.orbitPosition(o, t - 0.01));
    const options = [build(nu), build(-nu)];
    if (!prevOrbit)
        return options[1];
    const vin = velocity(prevOrbit, t1);
    return options.sort((x, y) => A.norm(A.sub(velocity(x, t1), vin)) - A.norm(A.sub(velocity(y, t1), vin)))[0];
}

// An orbit with perihelion q and the given period, in the plane `normal`,
// passing (close to) `anchor` at time ta and through perihelion at tp.
function anchoredOrbit(anchor, ta, normal, {q, periodDays, perihelion}) {
    const a = Math.cbrt(A.MU_SUN * (periodDays / TAU) ** 2);
    const e = 1 - q / a;
    const tp = A.jd(perihelion);
    let M = TAU * (ta - tp) / periodDays;
    M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
    let E = M;
    for (let i = 0; i < 50; i++)
        E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const w = A.unit(normal);
    const u = A.unit(A.sub(anchor, A.scale(w, A.dot(anchor, w))));
    const v = A.cross(w, u);
    const p = A.add(A.scale(u, Math.cos(-nu)), A.scale(v, Math.sin(-nu)));
    return {p, q: A.cross(w, p), a, e, mu: A.MU_SUN, m0: 0, t0: tp};
}

// Segment kinds: 'fly' (on a conic), 'stay' (with a body), 'escape' (straight
// out at a fixed speed). Each has [t0, t1) and pos(t).
export class Trajectory {
    constructor(mission) {
        this.mission = mission;
        this.events = mission.events.map(ev => ({...ev, t: A.jd(ev.date), mission}));
        this.launch = this.events[0].t;
        this.segments = [];
        this.end = Infinity;
        this._build();
    }

    _build() {
        const evs = this.events;
        const positional = evs.filter(ev => ev.at || ev.point);
        let prev = null;   // {t, r, ev}
        let lastOrbit = null;

        for (const ev of positional) {
            const r = eventPosition(ev, ev.t);
            if (prev) {
                if (prev.ev.kind === 'arrive') {
                    const body = prev.ev.at;
                    this.segments.push({kind: 'stay', t0: prev.t, t1: ev.t, body,
                        pos: t => A.bodyPosition(body, t)});
                } else {
                    const orbit = ev.laps
                        ? resonantLeg(prev.r, prev.t, ev.t, ev, lastOrbit)
                        : solveLeg(prev.r, r, prev.t, ev.t, ev, prev.ev.at === ev.at && ev.at);
                    if (orbit) {
                        lastOrbit = orbit;
                        // Blend away whatever the conic misses the target by.
                        const [t0, t1] = [prev.t, ev.t];
                        const miss = A.sub(r, A.orbitPosition(orbit, t1));
                        this.segments.push({kind: 'fly', t0, t1, orbit, from: prev.ev, to: ev,
                            pos: t => A.add(A.orbitPosition(orbit, t), A.scale(miss, smooth((t - t0) / (t1 - t0))))});
                    }
                }
            }
            prev = {t: ev.t, r, ev};
        }

        const endEv = evs.find(ev => ev.kind === 'end');
        const last = prev;
        const after = this.mission.after;
        if (endEv && endEv.at) {
            this.end = endEv.t;
            return;
        }
        if (last.ev.kind === 'arrive') {
            const body = last.ev.at;
            this.segments.push({kind: 'stay', t0: last.t, t1: Infinity, body,
                pos: t => A.bodyPosition(body, t)});
        } else if (after === 'coast' && lastOrbit) {
            this.segments.push({kind: 'fly', t0: last.t, t1: Infinity, orbit: lastOrbit,
                from: last.ev, pos: t => A.orbitPosition(lastOrbit, t)});
        } else if (after?.escape) {
            const dir = A.unit(last.r);
            const r0 = A.norm(last.r), speed = after.escape / 365.25;
            this.segments.push({kind: 'escape', t0: last.t, t1: Infinity,
                pos: t => A.scale(dir, r0 + speed * (t - last.t))});
        } else if (after?.orbit && lastOrbit) {
            const normal = A.cross(lastOrbit.p, lastOrbit.q);
            const orbit = anchoredOrbit(last.r, last.t, normal, after.orbit);
            const miss = A.sub(last.r, A.orbitPosition(orbit, last.t));
            this.segments.push({kind: 'fly', t0: last.t, t1: Infinity, orbit, from: last.ev,
                pos: t => A.add(A.orbitPosition(orbit, t), A.scale(miss, 1 - smooth((t - last.t) / 20)))});
        }
        if (endEv)
            this.end = endEv.t;
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

    // Speed relative to the Sun, km/s.
    speedKmS(t) {
        const s = this.segmentAt(t);
        if (!s)
            return 0;
        const d = A.sub(s.pos(t + 0.25), s.pos(t - 0.25));
        return A.norm(d) / 0.5 * A.AU_KM / A.DAY_S;
    }

    // Trail points [{t, p}] from `from` to `to`, a few per day of motion.
    samples(from, to) {
        const out = [];
        for (const s of this.segments) {
            if (s.kind === 'stay')
                continue;
            const t0 = Math.max(s.t0, from, this.launch), t1 = Math.min(s.t1, to, this.end);
            if (t1 <= t0)
                continue;
            const period = s.orbit ? A.orbitPeriod(s.orbit) : Infinity;
            const step = Math.min(isFinite(period) ? period / 160 : 60, s.kind === 'escape' ? 365 : 30);
            for (let t = t0; t < t1; t += step)
                out.push({t, p: s.pos(t)});
            out.push({t: t1, p: s.pos(Math.min(t1, s.t1 - 1e-6))});
        }
        return out;
    }

    // The positional event this craft is heading for at time t.
    nextTarget(t) {
        return this.events.find(ev => ev.t > t && (ev.at || ev.point) && ev.kind !== 'end');
    }
}

export const buildTrajectories = (missions = MISSIONS) => missions.map(m => new Trajectory(m));

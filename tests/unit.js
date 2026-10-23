// Unit tests for the pure modules. Run with `make test` (needs gjs only,
// no running GNOME Shell).
import System from 'system';

import * as A from '../lib/astro.js';
import {BODIES, LAGRANGE, MOONS, SMALL_BODIES} from '../lib/bodies.js';
import {bodyDetails, details, missionDetails, missionStatus} from '../lib/facts.js';
import {buildTrajectories} from '../lib/missions.js';
import {sunlightColor} from '../lib/render.js';

let failed = 0;
function check(ok, name) {
    print(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
    if (!ok)
        failed++;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Ephemeris: at the March equinox the Sun is at longitude 0, so Earth is at 180.
check(near(A.longitudeDeg(A.planetPosition('earth', A.jd('2026-03-20'))), 180, 1.5), 'Earth at 180 deg at the equinox');
check(near(A.norm(A.planetPosition('earth', A.jd('2026-01-03'))), 0.9833, 0.001), 'Earth near perihelion in early January');
check(near(A.norm(A.planetPosition('jupiter', A.jd('2000-01-01'))), 4.97, 0.05), 'Jupiter distance in 2000');
check(near(A.orbitPeriod(A.planetOrbit('mars', A.J2000)), 686.98, 0.5), 'Mars period');

// Kepler round trip: state -> orbit -> position.
const o = A.planetOrbit('mercury', A.J2000);
const r0 = A.orbitPosition(o, A.J2000 + 10);
const v0 = A.scale(A.sub(A.orbitPosition(o, A.J2000 + 10.0005), A.orbitPosition(o, A.J2000 + 9.9995)), 1 / 0.001);
const o2 = A.orbitFromState(r0, v0, A.J2000 + 10);
check(A.norm(A.sub(A.orbitPosition(o2, A.J2000 + 60), A.orbitPosition(o, A.J2000 + 60))) < 1e-5, 'orbitFromState reproduces the orbit');

// Lambert: each solution, propagated, must land on r2.
function lambertCase(name, r1, r2, tof, maxRevs, expectRevs) {
    const sols = A.lambert(r1, r2, tof, {maxRevs});
    check(sols.some(s => s.revs === expectRevs), `${name}: has a ${expectRevs}-rev solution`);
    for (const s of sols) {
        const orb = A.orbitFromState(r1, s.v1, 0);
        const miss = A.norm(A.sub(A.orbitPosition(orb, tof), r2));
        check(miss < 1e-6, `${name}: ${s.revs}-rev solution lands (miss ${miss.toExponential(1)} AU)`);
    }
}
const t1 = A.jd('1977-09-05'), t2 = A.jd('1979-03-05');
lambertCase('Voyager 1 Earth->Jupiter', A.planetPosition('earth', t1), A.planetPosition('jupiter', t2), t2 - t1, 0, 0);
const v1 = A.jd('2018-10-03'), v2 = A.jd('2019-12-26');
lambertCase('Parker Venus->Venus', A.planetPosition('venus', v1), A.planetPosition('venus', v2), v2 - v1, 4, 2);

// A Parker-like two-lap orbit (q 0.074 AU, 102-day period) must be recovered.
{
    const P = 102, a = Math.cbrt(A.MU_SUN * (P / 2 / Math.PI) ** 2), e = 1 - 0.074 / a;
    const orb = {p: [1, 0, 0], q: [0, 1, 0], a, e, mu: A.MU_SUN, m0: 0, t0: 0};
    const n = Math.sqrt(A.MU_SUN / a ** 3), nu = 169 * Math.PI / 180;
    const ta = A.meanFromTrue(nu, e) / n, tb = (A.meanFromTrue(-nu, e) + 6 * Math.PI) / n;
    const sols = A.lambert(A.orbitPosition(orb, ta), A.orbitPosition(orb, tb), tb - ta, {maxRevs: 3});
    check(sols.some(s => s.revs === 2 && near(A.perihelion(A.orbitFromState(A.orbitPosition(orb, ta), s.v1, 0)), 0.074, 1e-4)),
        'multi-rev Lambert recovers a known two-lap orbit');
}

// Hyperbolic leg out to the heliopause.
const s1 = A.jd('1980-11-12'), s2 = A.jd('2012-08-25');
lambertCase('Voyager 1 Saturn->heliopause', A.planetPosition('saturn', s1), A.fromLonLat(255.7, 34.8, 121.6), s2 - s1, 0, 0);

// Missions: every trajectory meets each body on the encounter date.
for (const tr of buildTrajectories()) {
    let worst = 0;
    for (const ev of tr.events.filter(e => e.at && e.kind !== 'launch' && e.kind !== 'end')) {
        const p = tr.position(ev.t - 1e-4) ?? tr.position(ev.t);
        worst = Math.max(worst, A.norm(A.sub(p, A.bodyPosition(ev.at, ev.t))));
    }
    check(worst < 2e-3, `${tr.mission.name} meets every flyby target (worst ${worst.toExponential(1)} AU)`);
    check(tr.segments.every(s => s.kind !== 'fly' || s.hop || Math.abs(s.orbit.e - 1) > 1e-3), `${tr.mission.name} has no degenerate legs`);
}
{
    const parker = buildTrajectories().find(t => t.mission.id === 'parker');
    const tp = A.jd('2024-12-24');
    let rmin = Infinity;
    for (let t = tp - 5; t < tp + 5; t += 0.05)
        rmin = Math.min(rmin, A.norm(parker.position(t)));
    check(near(rmin, 0.046, 0.003), `Parker reaches ~0.046 AU on 24 Dec 2024 (${rmin.toFixed(4)})`);
}

// Projection
const proj = new A.Projection({cx: 100, cy: 100, fitPx: 50, fitAU: 4, mode: 'sqrt', tilt: 0});
const [px, py] = proj.project([4, 0, 0]);
check(near(px, 150, 1e-9) && near(py, 100, 1e-9), 'projection fits fitAU to fitPx');
check(proj.project([0, 1, 0])[1] < 100, 'top-down: +y is up the screen');

check(A.formatDuration(500) === '8 min 20 s', 'formatDuration minutes');
check(A.formatDuration(4.1 * 3600) === '4 h 6 min', 'formatDuration hours');

// Sunlight: inverse square, and the view's flattening of the ecliptic.
check(A.irradiance(1) === A.SOLAR_CONSTANT, 'irradiance at 1 AU is the solar constant');
check(near(A.irradiance(30.07), 1.505, 0.01), 'about 1.5 W/m² at Neptune');
check(near(A.irradiance(A.irradianceRadius(100)), 100, 1e-9), 'irradianceRadius inverts irradiance');
check(A.formatIrradiance(1361) === '1,361 W/m²' && A.formatIrradiance(1.505) === '1.5 W/m²', 'formatIrradiance');
check(A.formatRatio(475) === '475×' && A.formatRatio(0.43) === '0.43×' && A.formatRatio(1 / 900) === '1/900', 'formatRatio');
check(near(new A.Projection({cx: 0, cy: 0, fitPx: 1, tilt: 60}).squash, 0.5, 1e-12), 'projection squash is cos(tilt)');
{
    let rising = true;
    for (let e = 1; e < 30000; e *= 1.5)
        rising &&= sunlightColor(e * 1.5)[3] >= sunlightColor(e)[3];
    check(rising, 'sunlight field grows brighter toward the Sun');
}
check(near(A.inclinationDeg(A.planetOrbit('mercury', A.J2000)), 7.0, 0.05), 'Mercury inclination');

// Card content.
{
    const t = A.jd('2024-12-24');
    const mars = bodyDetails('mars', t);
    check(mars.lines.length === 2 && mars.stats.length >= 6 && mars.sections.some(x => x.title === 'Did you know' && x.notes.length > 5),
        'Mars details have lines, stats and trivia');
    check(mars.sections.some(x => x.title.startsWith('Moons') && x.links.length === 2), 'Mars lists Phobos and Deimos');
    check(bodyDetails('earth', t).stats.every(([k]) => k !== 'From Earth'), 'Earth is not measured from itself');
    const sun = bodyDetails('sun', t);
    check(sun.title === 'The Sun' && sun.stats.length > 0, 'Sun details');
    const parker = buildTrajectories().find(x => x.mission.id === 'parker');
    const pd = missionDetails(parker, t);
    const sunlight = pd.stats.find(([k]) => k === 'Sunlight')?.[1] ?? '';
    check(/^\d{3},\d{3} W\/m²/.test(sunlight) && parseInt(sunlight.split('W/m², ')[1]) > 400,
        `Parker at perihelion gets hundreds of times Earth's sunlight (${sunlight})`);
    const mid = missionDetails(parker, A.jd('2021-06-01')).events;
    check(mid.length === 8 && mid.some(e => e.past) && mid.some(e => !e.past), 'mission events split past and future');
    check(pd.events.at(-1).ev === parker.milestones.filter(e => e.kind !== 'point' || e.title).at(-1), 'after the last event, the list ends with it');
    check(missionDetails(parker, A.jd('2010-01-01')).lines[0].startsWith('Launches'), 'before launch says when it launches');
}

// Every place has a card, on several dates, with no gaps in its text.
{
    const ids = [...BODIES, ...MOONS, ...SMALL_BODIES, ...LAGRANGE].map(x => x.id);
    let bad = [];
    for (const t of ['1980-01-01', '2026-10-23', '2034-06-01'].map(A.jd)) {
        for (const id of ids) {
            try {
                const d = details(id, t);
                const text = JSON.stringify(d);
                if (!d.title || !d.lines.length || /undefined|NaN|null,|\[object/.test(text))
                    bad.push(`${id}: ${text.match(/.{0,40}(undefined|NaN|null,|\[object).{0,20}/)?.[0]}`);
            } catch (e) {
                bad.push(`${id}: ${e.message}`);
            }
        }
    }
    check(!bad.length, `every place has a clean card${bad.length ? `: ${bad.slice(0, 4).join('; ')}` : ''}`);
    let badMissions = [];
    for (const tr of buildTrajectories()) {
        for (const t of [tr.launch - 10, tr.launch + 100, A.jd('2026-10-23')]) {
            const text = JSON.stringify(missionDetails(tr, t)) + (missionStatus(tr, t) ?? '');
            if (/undefined|NaN/.test(text))
                badMissions.push(`${tr.mission.id}: ${text.match(/.{0,40}(undefined|NaN).{0,20}/)[0]}`);
        }
    }
    check(!badMissions.length, `every mission card is clean${badMissions.length ? `: ${badMissions.slice(0, 3).join('; ')}` : ''}`);
}

// Lagrange points, sky geometry and small bodies.
{
    const t = A.jd('2026-06-01');
    const e = A.planetPosition('earth', t);
    const ang = (a, b) => Math.acos(A.dot(a, b) / (A.norm(a) * A.norm(b))) * 180 / Math.PI;
    const ahead = ((A.longitudeDeg(A.bodyPosition('l4', t)) - A.longitudeDeg(e)) % 360 + 360) % 360;
    check(near(ang(A.bodyPosition('l4', t), e), 60, 0.1) && near(ahead, 60, 0.5), 'L4 is 60 degrees ahead of Earth');
    check(near(A.norm(A.sub(A.bodyPosition('l2', t), e)) * A.AU_KM, 1.5e6, 2e4), 'L2 is 1.5 million km beyond Earth');
    const opp = A.nextAlignment('mars', A.jd('2026-10-01'));
    check(opp && Math.abs(opp - A.jd('2027-02-19')) < 3, `Mars opposition on 19 Feb 2027 (${opp && A.formatDate(opp)})`);
    check(A.moonPhase(A.jd('2024-01-25') + 0.25).lit > 0.98 && A.moonPhase(A.jd('2024-02-09') + 0.5).lit < 0.03, 'Moon phase: full on 25 Jan 2024, new on 9 Feb');
    const ap = A.norm(A.sub(A.bodyPosition('apophis', A.jd('2029-04-13') + 0.4), A.planetPosition('earth', A.jd('2029-04-13') + 0.4)));
    check(ap < 0.005, `Apophis passes close to Earth on 13 Apr 2029 (${ap.toFixed(4)} AU)`);
    const h = A.norm(A.bodyPosition('halley', A.jd('1986-02-09')));
    check(near(h, 0.586, 0.02), `Halley at perihelion in Feb 1986 (${h.toFixed(3)} AU)`);
    check(near(A.norm(A.bodyPosition('3i', A.jd('2025-10-29') + 0.44)), 1.357, 0.01), '3I/ATLAS at perihelion on 29 Oct 2025');
}

print(failed ? `\n${failed} failed` : '\nall passed');
System.exit(failed ? 1 : 0);

// Unit tests for the pure modules. Run with `make test` (needs gjs only,
// no running GNOME Shell).
import System from 'system';

import * as Astro from '../lib/astro.js';
import {BODIES, LAGRANGE, MOONS, SMALL_BODIES} from '../lib/bodies.js';
import {bodyDetails, details, missionDetails, missionStatus} from '../lib/facts.js';
import {buildTrajectories} from '../lib/missions.js';
import {sunlightColor} from '../lib/render.js';
import {GM} from '../lib/bodies.js';
import {SAT, SATELLITES, orbitOf} from '../lib/satellites.js';

let failed = 0;
function check(ok, name) {
    print(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
    if (!ok)
        failed++;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Ephemeris: at the March equinox the Sun is at longitude 0, so Earth is at 180.
check(near(Astro.longitudeDeg(Astro.planetPosition('earth', Astro.jd('2026-03-20'))), 180, 1.5), 'Earth at 180 deg at the equinox');
check(near(Astro.norm(Astro.planetPosition('earth', Astro.jd('2026-01-03'))), 0.9833, 0.001), 'Earth near perihelion in early January');
check(near(Astro.norm(Astro.planetPosition('jupiter', Astro.jd('2000-01-01'))), 4.97, 0.05), 'Jupiter distance in 2000');
check(near(Astro.orbitPeriod(Astro.planetOrbit('mars', Astro.J2000)), 686.98, 0.5), 'Mars period');

// Kepler round trip: state -> orbit -> position.
const o = Astro.planetOrbit('mercury', Astro.J2000);
const r0 = Astro.orbitPosition(o, Astro.J2000 + 10);
const v0 = Astro.scale(Astro.sub(Astro.orbitPosition(o, Astro.J2000 + 10.0005), Astro.orbitPosition(o, Astro.J2000 + 9.9995)), 1 / 0.001);
const o2 = Astro.orbitFromState(r0, v0, Astro.J2000 + 10);
check(Astro.norm(Astro.sub(Astro.orbitPosition(o2, Astro.J2000 + 60), Astro.orbitPosition(o, Astro.J2000 + 60))) < 1e-5, 'orbitFromState reproduces the orbit');

// Lambert: each solution, propagated, must land on r2.
function lambertCase(name, r1, r2, tof, maxRevs, expectRevs) {
    const sols = Astro.lambert(r1, r2, tof, {maxRevs});
    check(sols.some(s => s.revs === expectRevs), `${name}: has a ${expectRevs}-rev solution`);
    for (const s of sols) {
        const orb = Astro.orbitFromState(r1, s.v1, 0);
        const miss = Astro.norm(Astro.sub(Astro.orbitPosition(orb, tof), r2));
        check(miss < 1e-6, `${name}: ${s.revs}-rev solution lands (miss ${miss.toExponential(1)} AU)`);
    }
}
const t1 = Astro.jd('1977-09-05'), t2 = Astro.jd('1979-03-05');
lambertCase('Voyager 1 Earth->Jupiter', Astro.planetPosition('earth', t1), Astro.planetPosition('jupiter', t2), t2 - t1, 0, 0);
const v1 = Astro.jd('2018-10-03'), v2 = Astro.jd('2019-12-26');
lambertCase('Parker Venus->Venus', Astro.planetPosition('venus', v1), Astro.planetPosition('venus', v2), v2 - v1, 4, 2);

// A Parker-like two-lap orbit (q 0.074 AU, 102-day period) must be recovered.
{
    const P = 102, a = Math.cbrt(Astro.MU_SUN * (P / 2 / Math.PI) ** 2), e = 1 - 0.074 / a;
    const orb = {p: [1, 0, 0], q: [0, 1, 0], a, e, mu: Astro.MU_SUN, m0: 0, t0: 0};
    const n = Math.sqrt(Astro.MU_SUN / a ** 3), nu = 169 * Math.PI / 180;
    const ta = Astro.meanFromTrue(nu, e) / n, tb = (Astro.meanFromTrue(-nu, e) + 6 * Math.PI) / n;
    const sols = Astro.lambert(Astro.orbitPosition(orb, ta), Astro.orbitPosition(orb, tb), tb - ta, {maxRevs: 3});
    check(sols.some(s => s.revs === 2 && near(Astro.perihelion(Astro.orbitFromState(Astro.orbitPosition(orb, ta), s.v1, 0)), 0.074, 1e-4)),
        'multi-rev Lambert recovers a known two-lap orbit');
}

// Hyperbolic leg out to the heliopause.
const s1 = Astro.jd('1980-11-12'), s2 = Astro.jd('2012-08-25');
lambertCase('Voyager 1 Saturn->heliopause', Astro.planetPosition('saturn', s1), Astro.fromLonLat(255.7, 34.8, 121.6), s2 - s1, 0, 0);

// Missions: every trajectory meets each body on the encounter date.
for (const tr of buildTrajectories()) {
    let worst = 0;
    for (const ev of tr.events.filter(e => e.at && e.kind !== 'launch' && e.kind !== 'end')) {
        const p = tr.position(ev.t - 1e-4) ?? tr.position(ev.t);
        worst = Math.max(worst, Astro.norm(Astro.sub(p, Astro.bodyPosition(ev.at, ev.t))));
    }
    check(worst < 2e-3, `${tr.mission.name} meets every flyby target (worst ${worst.toExponential(1)} AU)`);
    check(tr.segments.every(s => s.kind !== 'fly' || s.hop || Math.abs(s.orbit.e - 1) > 1e-3), `${tr.mission.name} has no degenerate legs`);
}
{
    const parker = buildTrajectories().find(t => t.mission.id === 'parker');
    const tp = Astro.jd('2024-12-24');
    let rmin = Infinity;
    for (let t = tp - 5; t < tp + 5; t += 0.05)
        rmin = Math.min(rmin, Astro.norm(parker.position(t)));
    check(near(rmin, 0.046, 0.003), `Parker reaches ~0.046 AU on 24 Dec 2024 (${rmin.toFixed(4)})`);
}

// Projection
const proj = new Astro.Projection({cx: 100, cy: 100, fitPx: 50, fitAU: 4, mode: 'sqrt', tilt: 0});
const [px, py] = proj.project([4, 0, 0]);
check(near(px, 150, 1e-9) && near(py, 100, 1e-9), 'projection fits fitAU to fitPx');
check(proj.project([0, 1, 0])[1] < 100, 'top-down: +y is up the screen');

check(Astro.formatDuration(500) === '8 min 20 s', 'formatDuration minutes');
check(Astro.formatDuration(4.1 * 3600) === '4 h 6 min', 'formatDuration hours');

// Sunlight: inverse square, and the view's flattening of the ecliptic.
check(Astro.irradiance(1) === Astro.SOLAR_CONSTANT, 'irradiance at 1 AU is the solar constant');
check(near(Astro.irradiance(30.07), 1.505, 0.01), 'about 1.5 W/m² at Neptune');
check(near(Astro.irradiance(Astro.irradianceRadius(100)), 100, 1e-9), 'irradianceRadius inverts irradiance');
check(Astro.formatIrradiance(1361) === '1,361 W/m²' && Astro.formatIrradiance(1.505) === '1.5 W/m²', 'formatIrradiance');
check(Astro.formatRatio(475) === '475×' && Astro.formatRatio(0.43) === '0.43×' && Astro.formatRatio(1 / 900) === '1/900', 'formatRatio');
check(near(new Astro.Projection({cx: 0, cy: 0, fitPx: 1, tilt: 60}).squash, 0.5, 1e-12), 'projection squash is cos(tilt)');
{
    let rising = true;
    for (let e = 1; e < 30000; e *= 1.5)
        rising &&= sunlightColor(e * 1.5)[3] >= sunlightColor(e)[3];
    check(rising, 'sunlight field grows brighter toward the Sun');
}
check(near(Astro.inclinationDeg(Astro.planetOrbit('mercury', Astro.J2000)), 7.0, 0.05), 'Mercury inclination');

// Card content.
{
    const t = Astro.jd('2024-12-24');
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
    const mid = missionDetails(parker, Astro.jd('2021-06-01')).events;
    check(mid.length === 8 && mid.some(e => e.past) && mid.some(e => !e.past), 'mission events split past and future');
    check(pd.events.at(-1).ev === parker.milestones.filter(e => e.kind !== 'point' || e.title).at(-1), 'after the last event, the list ends with it');
    check(missionDetails(parker, Astro.jd('2010-01-01')).lines[0].startsWith('Launches'), 'before launch says when it launches');
}

// Every place has a card, on several dates, with no gaps in its text.
{
    const ids = [...BODIES, ...MOONS, ...SMALL_BODIES, ...LAGRANGE].map(x => x.id);
    let bad = [];
    for (const t of ['1980-01-01', '2026-10-23', '2034-06-01'].map(Astro.jd)) {
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
        for (const t of [tr.launch - 10, tr.launch + 100, Astro.jd('2026-10-23')]) {
            const text = JSON.stringify(missionDetails(tr, t)) + (missionStatus(tr, t) ?? '');
            if (/undefined|NaN/.test(text))
                badMissions.push(`${tr.mission.id}: ${text.match(/.{0,40}(undefined|NaN).{0,20}/)[0]}`);
        }
    }
    check(!badMissions.length, `every mission card is clean${badMissions.length ? `: ${badMissions.slice(0, 3).join('; ')}` : ''}`);
}

// Lagrange points, sky geometry and small bodies.
{
    const t = Astro.jd('2026-06-01');
    const e = Astro.planetPosition('earth', t);
    const ang = (a, b) => Math.acos(Astro.dot(a, b) / (Astro.norm(a) * Astro.norm(b))) * 180 / Math.PI;
    const ahead = ((Astro.longitudeDeg(Astro.bodyPosition('l4', t)) - Astro.longitudeDeg(e)) % 360 + 360) % 360;
    check(near(ang(Astro.bodyPosition('l4', t), e), 60, 0.1) && near(ahead, 60, 0.5), 'L4 is 60 degrees ahead of Earth');
    check(near(Astro.norm(Astro.sub(Astro.bodyPosition('l2', t), e)) * Astro.AU_KM, 1.5e6, 2e4), 'L2 is 1.5 million km beyond Earth');
    const opp = Astro.nextAlignment('mars', Astro.jd('2026-10-01'));
    check(opp && Math.abs(opp - Astro.jd('2027-02-19')) < 3, `Mars opposition on 19 Feb 2027 (${opp && Astro.formatDate(opp)})`);
    check(Astro.moonPhase(Astro.jd('2024-01-25') + 0.25).lit > 0.98 && Astro.moonPhase(Astro.jd('2024-02-09') + 0.5).lit < 0.03, 'Moon phase: full on 25 Jan 2024, new on 9 Feb');
    const ap = Astro.norm(Astro.sub(Astro.bodyPosition('apophis', Astro.jd('2029-04-13') + 0.4), Astro.planetPosition('earth', Astro.jd('2029-04-13') + 0.4)));
    check(ap < 0.005, `Apophis passes close to Earth on 13 Apr 2029 (${ap.toFixed(4)} AU)`);
    const h = Astro.norm(Astro.bodyPosition('halley', Astro.jd('1986-02-09')));
    check(near(h, 0.586, 0.02), `Halley at perihelion in Feb 1986 (${h.toFixed(3)} AU)`);
    check(near(Astro.norm(Astro.bodyPosition('3i', Astro.jd('2025-10-29') + 0.44)), 1.357, 0.01), '3I/ATLAS at perihelion on 29 Oct 2025');
}

// Close-ups: planets face the right way, satellites keep time.
{
    const lon = Astro.subsolarLongitudeDeg('earth', Astro.jdFromMs(Date.parse('2026-03-20T12:00:00Z')), [0, 90], [0, 0, 1]);
    check(Math.abs(lon) < 3, `the Sun is over Greenwich at noon UTC (${lon.toFixed(1)}°)`);
    const lon2 = Astro.subsolarLongitudeDeg('earth', Astro.jdFromMs(Date.parse('2026-06-21T18:00:00Z')), [0, 90], [0, 0, 1]);
    check(near(lon2, -90, 3), `and over 90°W at 18:00 UTC (${lon2.toFixed(1)}°)`);
    const period = id => Astro.satellitePeriodS(orbitOf(SATELLITES.find(x => x.id === id).orbit, 'earth').a, GM.earth) / 60;
    check(near(period('iss'), 92.8, 1), `the ISS laps Earth in about 93 minutes (${period('iss').toFixed(1)})`);
    check(near(period('geo'), 1436, 2), `a geostationary orbit takes a sidereal day (${period('geo').toFixed(0)} min)`);
    const o = {...orbitOf({alt: 420, i: 51.6}, 'earth')};
    const r = Astro.norm(Astro.satellitePosition(o, [0, 0, 1], GM.earth, Astro.J2000 + 1.234));
    check(near(r, 6371 + 420, 1), 'a circular orbit stays at its height');
    let bad = [];
    for (const id of Object.keys(SAT)) {
        const text = JSON.stringify(details(id, Astro.jd('2026-10-23')));
        if (/undefined|NaN/.test(text))
            bad.push(id);
    }
    check(!bad.length, `every satellite and landing site has a clean card${bad.length ? `: ${bad.join(', ')}` : ''}`);
}

// Zooming out keeps the order of distances, and leaves the planets alone at 0.
{
    let ok = true;
    for (const z of [0, 0.3, 0.7, 1]) {
        const p = new Astro.Projection({cx: 0, cy: 0, fitPx: 500, zoomOut: z});
        let last = -1;
        for (const r of [0.4, 1, 5, 30, 120, 1000, 1e4, 1e5, 3e5]) {
            ok &&= p.radiusPx(r) > last;
            last = p.radiusPx(r);
        }
    }
    check(ok, 'zoomed out, farther is always farther out on screen');
    const p0 = new Astro.Projection({cx: 0, cy: 0, fitPx: 500, zoomOut: 0});
    check(near(p0.radiusPx(30.1), 500, 1e-9), 'not zoomed out, Neptune still fits the screen');
    const p1 = new Astro.Projection({cx: 0, cy: 0, fitPx: 500, zoomOut: 1});
    check(near(p1.radiusPx(Astro.FAR_AU), 500, 1e-6) && p1.radiusPx(30) > 100, 'all the way out, the nearest stars fit and the planets still show');
}

print(failed ? `\n${failed} failed` : '\nall passed');
System.exit(failed ? 1 : 0);

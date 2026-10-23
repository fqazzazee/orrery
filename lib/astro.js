// Orbital mechanics for the orrery. Pure JS (no gi imports) so the unit tests
// run under plain gjs. Positions are heliocentric ecliptic J2000, in AU;
// times are Julian dates (days).

export const AU_KM = 149597870.7;
export const C_KM_S = 299792.458;
export const DAY_S = 86400;
export const J2000 = 2451545.0;
// Gaussian gravitational constant squared: GM of the Sun in AU^3 / day^2.
export const MU_SUN = 0.01720209895 ** 2;
// Total solar irradiance at 1 AU, W/m² (Kopp & Lean 2011).
export const SOLAR_CONSTANT = 1361;
// Conservative habitable zone for a Sun-like star, AU (Kopparapu et al. 2013).
export const HABITABLE_ZONE = [0.95, 1.67];
const OBLIQUITY = 23.43928 * Math.PI / 180;

const TAU = 2 * Math.PI;
const RAD = Math.PI / 180;

// ---- Vectors ----

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
export const norm = a => Math.hypot(a[0], a[1], a[2]);
export const unit = a => scale(a, 1 / norm(a));

// ---- Time ----

export const jdFromMs = ms => ms / 86400000 + 2440587.5;
export const msFromJd = jd => (jd - 2440587.5) * 86400000;
export const jdNow = () => jdFromMs(Date.now());

// "1977-09-05" -> JD at 12:00 UTC that day ("1977-09" -> the 15th).
export function jd(iso) {
    const [y, m = 7, d = 15] = iso.split('-').map(Number);
    return jdFromMs(Date.UTC(y, m - 1, d, 12));
}

export const yearOfJd = t => new Date(msFromJd(t)).getUTCFullYear();

// ---- Kepler orbits ----
// An orbit is {p, q, a, e, mu, m0, t0}: p points at periapsis, q is 90 degrees
// ahead in the direction of motion, m0 is the mean anomaly at t0. a < 0 for
// hyperbolas.

function solveElliptic(M, e) {
    M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
    let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
    for (let i = 0; i < 50; i++) {
        const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= d;
        if (Math.abs(d) < 1e-12)
            break;
    }
    return E;
}

function solveHyperbolic(M, e) {
    let H = Math.asinh(M / e);
    for (let i = 0; i < 80; i++) {
        const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
        H -= d;
        if (Math.abs(d) < 1e-12)
            break;
    }
    return H;
}

export function orbitPosition(o, t) {
    let x, y;
    if (o.e < 1) {
        const n = Math.sqrt(o.mu / o.a ** 3);
        const E = solveElliptic(o.m0 + n * (t - o.t0), o.e);
        x = o.a * (Math.cos(E) - o.e);
        y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
    } else {
        const A = -o.a;
        const n = Math.sqrt(o.mu / A ** 3);
        const H = solveHyperbolic(o.m0 + n * (t - o.t0), o.e);
        x = A * (o.e - Math.cosh(H));
        y = A * Math.sqrt(o.e * o.e - 1) * Math.sinh(H);
    }
    return add(scale(o.p, x), scale(o.q, y));
}

// Points along an orbit (AU): the whole ellipse, or the part of a hyperbola
// within rMax of the Sun.
export function orbitPoints(o, n = 240, rMax = 80) {
    const pts = [];
    if (o.e < 1) {
        for (let i = 0; i <= n; i++) {
            const E = i / n * TAU;
            const x = o.a * (Math.cos(E) - o.e), y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
            pts.push(add(scale(o.p, x), scale(o.q, y)));
        }
        return pts;
    }
    const p = -o.a * (o.e * o.e - 1);
    const nuMax = Math.min(Math.acos(-1 / o.e) - 1e-3, Math.acos(Math.max(-1, Math.min(1, (p / rMax - 1) / o.e))));
    for (let i = 0; i <= n; i++) {
        const nu = -nuMax + 2 * nuMax * i / n;
        const r = p / (1 + o.e * Math.cos(nu));
        pts.push(add(scale(o.p, r * Math.cos(nu)), scale(o.q, r * Math.sin(nu))));
    }
    return pts;
}

export const orbitPeriod = o => o.e < 1 ? TAU * Math.sqrt(o.a ** 3 / o.mu) : Infinity;
export const perihelion = o => o.a * (1 - o.e);
export const aphelion = o => o.e < 1 ? o.a * (1 + o.e) : Infinity;

// Mean anomaly for true anomaly nu.
export function meanFromTrue(nu, e) {
    if (e < 1) {
        const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
        return E - e * Math.sin(E);
    }
    const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
    return e * Math.sinh(H) - H;
}

export function orbitFromState(r, v, t, mu = MU_SUN) {
    const R = norm(r);
    const h = cross(r, v);
    const ev = scale(sub(scale(r, dot(v, v) - mu / R), scale(v, dot(r, v))), 1 / mu);
    const e = norm(ev);
    const a = 1 / (2 / R - dot(v, v) / mu);
    const w = unit(h);
    const p = e > 1e-9 ? scale(ev, 1 / e) : unit(r);
    const q = cross(w, p);
    const nu = Math.atan2(dot(r, q), dot(r, p));
    return {p, q, a, e, mu, m0: meanFromTrue(nu, e), t0: t};
}

// Classical elements (angles in degrees) -> orbit.
export function orbitFromElements(a, e, iDeg, nodeDeg, argPeriDeg, meanAnomDeg, t0, mu = MU_SUN) {
    const [i, O, w] = [iDeg, nodeDeg, argPeriDeg].map(x => x * RAD);
    const [cO, sO, ci, si, cw, sw] = [Math.cos(O), Math.sin(O), Math.cos(i), Math.sin(i), Math.cos(w), Math.sin(w)];
    const p = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
    const q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
    return {p, q, a, e, mu, m0: meanAnomDeg * RAD, t0};
}

// ---- Planets: JPL "Keplerian Elements for Approximate Positions of the Major
// Planets", table 1 (valid 1800-2050). [a, e, I, L, long.peri, long.node] and
// rates per Julian century.

const PLANET_ELEMENTS = {
    mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
        [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
        [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
    earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
        [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
        [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
        [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
        [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
        [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
        [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
    pluto: [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
        [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};

export const PLANET_IDS = Object.keys(PLANET_ELEMENTS);

// ---- Small bodies: JPL Small-Body Database osculating elements, fixed (no
// perturbations), so good for a few decades either side of the epoch.
// [a, e, i, node, arg. perihelion, mean anomaly at epoch, epoch JD]; comets
// use mean anomaly 0 at their perihelion date.

const SMALL_ELEMENTS = {
    ceres: [2.765552595034094, 0.07969229514816586, 10.58802780183462, 80.24862682043221, 73.29421453021587, 274.4193463761342, 2461200.5],
    vesta: [2.361365965127599, 0.09020374382834395, 7.143925545058711, 103.701293265032, 151.4686478221564, 81.19015607686903, 2461200.5],
    psyche: [2.925720466462538, 0.1349324738201893, 3.098749116151128, 149.9753859305033, 230.0326782748359, 79.76939505329617, 2461200.5],
    bennu: [1.126391025894812, 0.2037450762416414, 6.03494377024794, 2.06086619569642, 66.22306084084298, 101.703952002457, 2455562.5],
    ryugu: [1.190918932702464, 0.1910730046480051, 5.866442486408568, 251.2897123995624, 211.608993811871, 62.34067409463987, 2461200.5],
    apophis: [0.9223592206975018, 0.1911492279663492, 3.340996879880978, 203.8936514240762, 126.6795706895841, 175.3304026592739, 2461200.5],
    didymos: [1.642709608529702, 0.3831233242624545, 3.413876519313629, 72.9858236207145, 319.5807001349104, 260.8612886320632, 2461200.5],
    kamooalewa: [1.000810461656002, 0.1022388434937281, 7.802614368816799, 65.59324199512295, 304.3632127863176, 243.3871442328605, 2461200.5],
    eurybates: [5.217371617810976, 0.09059867172297777, 8.05147293527498, 43.5587275998936, 28.69968222483612, 125.7480299363769, 2461200.5],
    polymele: [5.191514133435046, 0.09592245810512318, 12.97735158439746, 50.33105662992578, 5.86529887136951, 143.4220008064438, 2461200.5],
    leucus: [5.312382832170665, 0.06495789797701287, 11.54341670108032, 251.0799335752079, 162.4048390063255, 139.1721755085774, 2461200.5],
    orus: [5.123374239403683, 0.03672540559818106, 8.468580378470353, 258.5504431073313, 182.7884930129634, 96.92267457127365, 2461200.5],
    patroclus: [5.205975173988769, 0.1391467916238868, 22.06359071054631, 44.34968792774898, 308.8377281363527, 58.67543160284279, 2461200.5],
    dinkinesh: [2.191768748791583, 0.1126817135846694, 2.093117265661373, 21.35270512523402, 66.91637126596935, 29.60751779009531, 2461200.5],
    donaldjohanson: [2.383835831129859, 0.1868593763038477, 4.425205239728406, 262.7765342454273, 212.8821499078564, 147.8525890028124, 2461200.5],
    torifune: [1.03218079466168, 0.2191666914570141, 4.808321173612089, 75.35576942440626, 179.4132967801467, 328.7043276576105, 2461200.5],
    ky26: [1.228859811859051, 0.2000498225862209, 1.491131387730072, 84.18217649998975, 210.0032740505378, 145.6930217309096, 2461200.5],
    arrokoth: [44.05257835991367, 0.03555717645015258, 2.450613924655929, 159.0377267890618, 188.8507463365642, 310.9839309924138, 2461200.5],
    // Comets
    '67p': [3.4645, 0.6410, 7.0405, 50.147, 12.780, 0, 2457248.0],
    halley: [17.92863504856923, 0.9679359956953211, 162.1905300439129, 59.09894720612437, 112.2414314637764, 0, 2446469.973616146677],
    '3i': [-0.2638835217034532, 6.123467394525528, 175.2403121571192, 323.0251782090054, 128.7969426041922, 0, 2460977.941795880909],
    '311p': [2.188584204499729, 0.1153701977575953, 4.96993346244621, 279.2272977691806, 144.5811762369472, 350.4329879503848, 2459098.5],
};

const SMALL_ORBITS = Object.fromEntries(Object.entries(SMALL_ELEMENTS).map(([id, el]) => [id, orbitFromElements(...el)]));
export const SMALL_IDS = Object.keys(SMALL_ELEMENTS);

// Apophis passes 38,000 km from Earth's center on 13 April 2029, which
// stretches its orbit from inside Earth's to outside it (JPL Horizons).
const APOPHIS_FLYBY = 2462240.407;
const APOPHIS_AFTER = orbitFromElements(1.103109130861100, 0.1890651091373433, 2.221094289819793, 203.5628886471436,
    71.43283238732849, 349.2397966583546, 2462288.5);

// Osculating orbit of a planet (or a small body) at time t.
export function planetOrbit(id, t) {
    if (id === 'apophis' && t > APOPHIS_FLYBY)
        return APOPHIS_AFTER;
    if (!PLANET_ELEMENTS[id])
        return SMALL_ORBITS[id];
    const [el, rate] = PLANET_ELEMENTS[id];
    const T = (t - J2000) / 36525;
    const [a, e, I, L, peri, node] = el.map((v, i) => v + rate[i] * T);
    return orbitFromElements(a, e, I, node, peri - node, L - peri, t);
}

export const planetPosition = (id, t) => orbitPosition(planetOrbit(id, t), t);

// ---- Lagrange points ----
// Sun-Earth L1 and L2 sit about 1.5 million km either side of Earth, L3
// opposite it, and L4/L5 60 degrees ahead and behind on its orbit. 'jl4' and
// 'jl5' are Jupiter's, where its Trojan asteroids gather.

const L1_AU = 0.009971, L2_AU = 0.010036;

// Turn p by `deg` degrees around the axis `n`.
export function rotateAbout(p, n, deg) {
    const a = deg * RAD, c = Math.cos(a), s = Math.sin(a);
    return add(add(scale(p, c), scale(cross(n, p), s)), scale(n, dot(n, p) * (1 - c)));
}

function lagrangePosition(id, t) {
    const host = id.startsWith('j') ? 'jupiter' : 'earth';
    const o = planetOrbit(host, t);
    const p = orbitPosition(o, t);
    const n = unit(cross(o.p, o.q));
    switch (id.slice(-2)) {
    case 'l1': return scale(p, 1 - L1_AU / norm(p));
    case 'l2': return scale(p, 1 + L2_AU / norm(p));
    case 'l3': return scale(p, -1);
    case 'l4': return rotateAbout(p, n, 60);
    default: return rotateAbout(p, n, -60);
    }
}

export const LAGRANGE_IDS = ['l1', 'l2', 'l3', 'l4', 'l5', 'jl4', 'jl5'];

export function bodyPosition(id, t) {
    if (id === 'sun')
        return [0, 0, 0];
    if (LAGRANGE_IDS.includes(id))
        return lagrangePosition(id, t);
    return planetPosition(id, t);
}

// ---- Seen from Earth ----

// Geocentric ecliptic longitude of a heliocentric position, degrees.
const geoLongitude = (p, earth) => longitudeDeg(sub(p, earth));

// Angle between a body and the Sun as seen from Earth, degrees; positive
// when it is east of the Sun (in the evening sky).
export function elongationDeg(p, earth) {
    const toBody = sub(p, earth), toSun = scale(earth, -1);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(toBody, toSun) / (norm(toBody) * norm(toSun))))) / RAD;
    const east = ((geoLongitude(p, earth) - longitudeDeg(toSun)) % 360 + 360) % 360 < 180;
    return east ? angle : -angle;
}

// Angular diameter, arcseconds, of a body of radius rKm at distance dAu.
export const angularDiameterArcsec = (rKm, dAu) => 2 * Math.atan(rKm / (dAu * AU_KM)) / RAD * 3600;

// The next time after t that a body lines up with the Sun as seen from Earth:
// opposition (opposite the Sun) for bodies beyond Earth, inferior
// conjunction (between us and the Sun) for Mercury and Venus. Steps a day
// at a time; null if none within `days`.
export function nextAlignment(id, t, days = 900) {
    const inner = norm(planetPosition(id, t)) < 1;
    const offset = tt => {
        const earth = planetPosition('earth', tt), p = planetPosition(id, tt);
        const d = geoLongitude(p, earth) - longitudeDeg(scale(earth, -1)) - (inner ? 0 : 180);
        return ((d + 540) % 360 + 360) % 360 - 180;
    };
    let prev = offset(t);
    for (let i = 1; i <= days; i++) {
        const cur = offset(t + i);
        if (prev < 0 && cur >= 0 || prev > 0 && cur <= 0) {
            if (Math.abs(cur - prev) < 90) {
                const k = prev / (prev - cur);
                return t + i - 1 + k;
            }
        }
        prev = cur;
    }
    return null;
}

// Where the Sun stands overhead on a body with north pole `pole` (ecliptic
// unit vector) at heliocentric position p: latitude in degrees.
export function subsolarLatitudeDeg(pole, p) {
    return Math.asin(Math.max(-1, Math.min(1, dot(pole, unit(scale(p, -1)))))) / RAD;
}

// The Moon's phase: age through the synodic month (0 new, 0.5 full) and the
// lit fraction. Mean lunation from the new moon of 6 Jan 2000.
export const SYNODIC_MONTH = 29.530588853;
export function moonPhase(t) {
    const age = (((t - 2451550.26) / SYNODIC_MONTH) % 1 + 1) % 1;
    return {age, lit: (1 - Math.cos(2 * Math.PI * age)) / 2};
}

// Sunlight at distance r (AU), W/m²: the inverse-square law.
export const irradiance = r => SOLAR_CONSTANT / (r * r);
// Distance (AU) where sunlight falls to e W/m².
export const irradianceRadius = e => Math.sqrt(SOLAR_CONSTANT / e);

// Orbital inclination to the ecliptic, degrees.
export const inclinationDeg = o => Math.acos(Math.max(-1, Math.min(1, cross(o.p, o.q)[2] / norm(cross(o.p, o.q))))) / RAD;

// Speed (km/s) on an orbit at distance r (AU), from vis-viva.
export function visVivaKmS(r, a, mu = MU_SUN) {
    return Math.sqrt(mu * (2 / r - 1 / a)) * AU_KM / DAY_S;
}

// Equatorial RA/Dec (degrees) -> ecliptic unit vector.
export function equatorialToEcliptic(raDeg, decDeg) {
    const [ra, dec] = [raDeg * RAD, decDeg * RAD];
    const x = Math.cos(dec) * Math.cos(ra);
    const y = Math.cos(dec) * Math.sin(ra);
    const z = Math.sin(dec);
    const [c, s] = [Math.cos(OBLIQUITY), Math.sin(OBLIQUITY)];
    return [x, c * y + s * z, -s * y + c * z];
}

// Ecliptic longitude/latitude (degrees) and distance -> vector.
export function fromLonLat(lonDeg, latDeg, r = 1) {
    const [l, b] = [lonDeg * RAD, latDeg * RAD];
    return [r * Math.cos(b) * Math.cos(l), r * Math.cos(b) * Math.sin(l), r * Math.sin(b)];
}

export const longitudeDeg = p => ((Math.atan2(p[1], p[0]) / RAD) % 360 + 360) % 360;

// ---- Lambert's problem (universal variables) ----
// Returns every prograde conic from r1 to r2 taking tof days, for up to maxRevs
// complete revolutions: [{v1, revs}]. Multi-revolution cases have two
// solutions each.

function stumpffC(z) {
    if (z > 1e-8)
        return (1 - Math.cos(Math.sqrt(z))) / z;
    if (z < -1e-8)
        return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
    return 0.5 - z / 24;
}

function stumpffS(z) {
    if (z > 1e-8) {
        const s = Math.sqrt(z);
        return (s - Math.sin(s)) / s ** 3;
    }
    if (z < -1e-8) {
        const s = Math.sqrt(-z);
        return (Math.sinh(s) - s) / s ** 3;
    }
    return 1 / 6 - z / 120;
}

export function lambert(r1, r2, tof, {mu = MU_SUN, maxRevs = 0} = {}) {
    const R1 = norm(r1), R2 = norm(r2);
    let dtheta = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (R1 * R2))));
    if (cross(r1, r2)[2] < 0)
        dtheta = TAU - dtheta;
    const A = Math.sin(dtheta) * Math.sqrt(R1 * R2 / (1 - Math.cos(dtheta)));
    if (!isFinite(A) || Math.abs(A) < 1e-9)
        return [];

    const y = z => R1 + R2 + A * (z * stumpffS(z) - 1) / Math.sqrt(stumpffC(z));
    const timeOf = z => {
        const yz = y(z);
        if (!(yz > 0))
            return NaN;
        return ((yz / stumpffC(z)) ** 1.5 * stumpffS(z) + A * Math.sqrt(yz)) / Math.sqrt(mu);
    };
    const target = tof;
    // lo: an end where the flight is too short; hi: an end where it is too long.
    const bisect = (lo, hi) => {
        for (let i = 0; i < 200; i++) {
            const mid = (lo + hi) / 2;
            const t = timeOf(mid);
            if (isNaN(t) || t < target)
                lo = mid;
            else
                hi = mid;
            if (Math.abs(hi - lo) < 1e-13 * Math.max(1, Math.abs(mid)))
                break;
        }
        return (lo + hi) / 2;
    };
    // Near the singular edges of each interval the root finder can return
    // junk (degenerate straight-line "orbits"), so keep only solutions that,
    // propagated, really arrive at r2.
    const out = [];
    const solution = (z, revs) => {
        const yz = y(z);
        const f = 1 - yz / R1;
        const g = A * Math.sqrt(yz / mu);
        const v1 = scale(sub(r2, scale(r1, f)), 1 / g);
        const orbit = orbitFromState(r1, v1, 0, mu);
        const miss = norm(sub(orbitPosition(orbit, tof), r2));
        if (Math.abs(orbit.e - 1) > 1e-3 && miss < 1e-6 * (1 + R2))
            out.push({v1, revs});
    };

    // Zero revolutions: time of flight rises monotonically with z up to 4 pi^2.
    // Very negative z is a fast hyperbola; step down until the flight is short enough.
    let lo = -1;
    while (timeOf(lo) >= target && lo > -1e7)
        lo *= 2;
    const hi0 = 4 * Math.PI ** 2 * (1 - 1e-9);
    if (!(timeOf(lo) >= target))
        solution(bisect(lo, hi0), 0);

    // N revolutions: z in ((2 pi N)^2, (2 pi (N+1))^2). The flight time dips to
    // a minimum inside the interval (and is undefined where y < 0), so scan it
    // and refine every crossing of the target.
    for (let n = 1; n <= maxRevs; n++) {
        const zl = (TAU * n) ** 2, zr = (TAU * (n + 1)) ** 2;
        const steps = 1500;
        let prevZ = null, prevT = NaN;
        for (let i = 1; i < steps; i++) {
            const z = zl + (zr - zl) * i / steps;
            const t = timeOf(z);
            if (!isNaN(t) && !isNaN(prevT) && (t < target) !== (prevT < target))
                solution(t < target ? bisect(z, prevZ) : bisect(prevZ, z), n);
            prevZ = z;
            prevT = t;
        }
    }
    return out;
}

// ---- Projection to the screen ----
// Distances are compressed radially (otherwise Mercury and Neptune cannot
// share a screen), then the scene is turned by `azimuth` and viewed from
// `tilt` degrees off the ecliptic pole.

const COMPRESS = {
    linear: r => r,
    sqrt: r => Math.sqrt(r),
    log: r => Math.log1p(r / 0.3),
};

export class Projection {
    constructor({cx, cy, fitPx, fitAU = 30.1, mode = 'sqrt', tilt = 58, azimuth = 0}) {
        this.cx = cx;
        this.cy = cy;
        this.compress = COMPRESS[mode] ?? COMPRESS.sqrt;
        this.k = fitPx / this.compress(fitAU);
        const [a, i] = [azimuth * RAD, tilt * RAD];
        this._ca = Math.cos(a);
        this._sa = Math.sin(a);
        this._ci = Math.cos(i);
        this._si = Math.sin(i);
    }

    // Direction in view space: [right, up, toward viewer].
    view(v) {
        const x = v[0] * this._ca + v[1] * this._sa;
        const y = -v[0] * this._sa + v[1] * this._ca;
        return [x, y * this._ci + v[2] * this._si, -y * this._si + v[2] * this._ci];
    }

    // How much the view flattens the ecliptic vertically: a circle around the
    // Sun shows as an ellipse this many times as tall as it is wide.
    get squash() {
        return this._ci;
    }

    // Screen pixels of the compressed distance r (AU).
    radiusPx(r) {
        return this.k * this.compress(r);
    }

    // Position (AU) -> [x, y, depth] in pixels; larger depth is nearer.
    project(p) {
        const r = norm(p);
        const s = r > 0 ? this.radiusPx(r) / r : 0;
        const [x, u, w] = this.view(p);
        return [this.cx + x * s, this.cy - u * s, w * s];
    }
}

// ---- Formatting ----

export function formatDuration(seconds) {
    const s = Math.abs(seconds);
    if (s < 90)
        return `${Math.round(s)} s`;
    if (s < 3600) {
        const m = Math.floor(s / 60), r = Math.round(s % 60);
        return r ? `${m} min ${r} s` : `${m} min`;
    }
    if (s < 86400 * 2) {
        const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
        return m ? `${h} h ${m} min` : `${h} h`;
    }
    const days = s / 86400;
    if (days < 400)
        return `${Math.round(days)} days`;
    const years = days / 365.25;
    if (years < 100)
        return `${years.toFixed(years < 10 ? 1 : 0)} years`;
    return `${formatCount(Math.round(years))} years`;
}

export function formatCount(n) {
    if (n >= 1e9)
        return `${+(n / 1e9).toPrecision(3)} billion`;
    if (n >= 1e6)
        return `${+(n / 1e6).toPrecision(3)} million`;
    return Math.round(n).toLocaleString('en-US');
}

export const formatKm = km => `${formatCount(km)} km`;

// Irradiance, W/m², to about three significant figures.
export function formatIrradiance(e) {
    const v = e >= 100 ? Math.round(e) : +e.toPrecision(e >= 10 ? 3 : 2);
    return `${v.toLocaleString('en-US')} W/m²`;
}

// A ratio to Earth's sunlight: "475×", "0.43×", "1/900".
export function formatRatio(x) {
    if (x >= 10)
        return `${Math.round(x).toLocaleString('en-US')}×`;
    if (x >= 0.1)
        return `${x.toFixed(2)}×`;
    return `1/${formatCount(Math.round(1 / x))}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(t) {
    const d = new Date(msFromJd(t));
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function formatMonth(t) {
    const d = new Date(msFromJd(t));
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

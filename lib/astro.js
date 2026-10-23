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

// Osculating orbit of a planet at time t.
export function planetOrbit(id, t) {
    const [el, rate] = PLANET_ELEMENTS[id];
    const T = (t - J2000) / 36525;
    const [a, e, I, L, peri, node] = el.map((v, i) => v + rate[i] * T);
    return orbitFromElements(a, e, I, node, peri - node, L - peri, t);
}

export const planetPosition = (id, t) => orbitPosition(planetOrbit(id, t), t);

// Comet 67P/Churyumov-Gerasimenko (JPL SBDB, 2015 apparition).
const COMET_67P = orbitFromElements(3.4645, 0.6410, 7.0405, 50.147, 12.780, 0, jd('2015-08-13'));

export function bodyPosition(id, t) {
    if (id === 'sun')
        return [0, 0, 0];
    if (id === '67p')
        return orbitPosition(COMET_67P, t);
    return planetPosition(id, t);
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

// Cairo drawing for the orrery: lit, spinning planet spheres, rings, the Sun,
// the static backdrop (stars, belts, orbits) and spacecraft trails.
//
// Everything fades to pure black (#000) rather than to a grey, so OLED pixels
// outside the lit shapes stay off.

import Cairo from 'cairo';

const RAD = Math.PI / 180;

// Deterministic random numbers, so the stars and craters stay put.
export function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}

// ---- Surfaces ----
// Layers in latitude/longitude degrees: bands [lat1, lat2, color], polygons
// [[lat, lon], ...] and spots {lat, lon, rLat, rLon}.

function spot(lat, lon, rLat, rLon = rLat) {
    const pts = [];
    for (let i = 0; i < 20; i++) {
        const a = i / 20 * 2 * Math.PI;
        pts.push([lat + rLat * Math.sin(a), lon + rLon * Math.cos(a) / Math.max(0.2, Math.cos(lat * RAD))]);
    }
    return pts;
}

function craters(seed, n, dark, light) {
    const rnd = seeded(seed);
    const out = [];
    for (let i = 0; i < n; i++) {
        const r = 3 + rnd() * 8;
        out.push({poly: spot(rnd() * 150 - 75, rnd() * 360, r), color: rnd() < 0.6 ? dark : light, alpha: 0.55});
    }
    return out;
}

const SURFACES = {
    mercury: {base: '#9a938b', layers: craters(11, 26, '#6f6962', '#c2bcb4')},
    venus: {
        base: '#e0c287',
        bands: [[-70, -35, '#d4b274'], [-20, -8, '#e9cf98'], [5, 22, '#d8b97c'], [35, 70, '#d2ae70']],
        layers: [{poly: spot(-10, 30, 14, 40), color: '#efd9a8', alpha: 0.5}, {poly: spot(15, 200, 10, 35), color: '#cfa868', alpha: 0.5}],
    },
    earth: {
        base: '#1f4f9a',
        layers: [
            {poly: [[70, -160], [72, -120], [70, -80], [60, -65], [50, -56], [45, -65], [30, -81], [25, -80], [30, -90], [20, -97], [15, -92], [8, -80], [18, -105], [30, -115], [40, -124], [50, -128], [60, -145], [60, -165]], color: '#4b7d3a'},
            {poly: [[82, -40], [76, -20], [70, -22], [60, -44], [66, -54], [78, -70]], color: '#e8eef2'},
            {poly: [[12, -72], [8, -60], [0, -50], [-8, -35], [-23, -42], [-35, -57], [-55, -68], [-45, -75], [-18, -71], [-5, -81], [5, -77]], color: '#3f7a35'},
            {poly: [[70, 10], [72, 60], [77, 105], [70, 140], [66, 180], [60, 165], [52, 142], [40, 130], [30, 122], [22, 110], [10, 106], [1, 104], [15, 95], [22, 90], [8, 77], [22, 68], [25, 57], [13, 45], [30, 33], [37, 27], [40, 20], [38, 0], [43, -9], [48, -4], [54, 8], [58, 5], [63, 10]], color: '#587f3e'},
            {poly: [[35, -6], [37, 10], [31, 32], [12, 44], [11, 51], [-5, 40], [-15, 41], [-26, 33], [-34, 26], [-34, 18], [-17, 12], [-5, 12], [4, 8], [5, -5], [10, -15], [21, -17], [28, -12]], color: '#6e8a40'},
            {poly: spot(22, 12, 10, 22), color: '#c2a467', alpha: 0.9},
            {poly: spot(24, 45, 8, 10), color: '#c9a86a', alpha: 0.8},
            {poly: [[-11, 132], [-12, 142], [-25, 153], [-37, 150], [-38, 140], [-32, 133], [-35, 118], [-22, 114], [-14, 127]], color: '#b79a5e'},
            {poly: spot(40, -150, 4, 30), color: '#ffffff', alpha: 0.45},
            {poly: spot(-40, 20, 4, 40), color: '#ffffff', alpha: 0.4},
            {poly: spot(5, 100, 5, 15), color: '#ffffff', alpha: 0.35},
            {poly: spot(55, -30, 6, 25), color: '#ffffff', alpha: 0.35},
        ],
        bands: [[-90, -68, '#eef3f6'], [80, 90, '#e8eef2']],
    },
    mars: {
        base: '#c0592f',
        layers: [
            {poly: spot(10, 70, 12, 10), color: '#7c3a22', alpha: 0.8},
            {poly: spot(45, -30, 10, 25), color: '#8a4227', alpha: 0.7},
            {poly: spot(-25, -40, 10, 30), color: '#82402a', alpha: 0.7},
            {poly: spot(-15, 160, 8, 20), color: '#8c4429', alpha: 0.6},
            {poly: spot(-42, 70, 9, 12), color: '#dca27a', alpha: 0.7},
            {poly: spot(-8, -70, 3, 25), color: '#6e3420', alpha: 0.7},   // Valles Marineris
            {poly: spot(18, -134, 5), color: '#d98f63', alpha: 0.8},      // Olympus Mons
        ],
        bands: [[78, 90, '#f2ece4'], [-90, -82, '#f4efe8']],
    },
    jupiter: {
        base: '#d9c6aa',
        bands: [[-90, -60, '#8f7f70'], [-60, -40, '#c4b096'], [-40, -28, '#a98a6b'], [-28, -18, '#e6d9c6'],
            [-18, -8, '#a5734e'], [-8, 8, '#eadcc8'], [8, 18, '#9c6c48'], [18, 28, '#e3d2ba'],
            [28, 38, '#ae8e72'], [38, 60, '#c9b69c'], [60, 90, '#8c7c6c']],
        layers: [
            {poly: spot(-22, 0, 5.5, 13), color: '#c1603a', alpha: 0.95},   // Great Red Spot
            {poly: spot(-33, 80, 2.5, 5), color: '#f4ece0', alpha: 0.8},
            {poly: spot(-33, 140, 2.5, 5), color: '#f4ece0', alpha: 0.7},
            {poly: spot(14, 200, 2, 8), color: '#6f4a34', alpha: 0.7},
            {poly: spot(-5, 250, 2.5, 14), color: '#d5c2a5', alpha: 0.6},
        ],
    },
    saturn: {
        base: '#e6d3a6',
        bands: [[-90, -55, '#b8a47c'], [-55, -30, '#d6c194'], [-30, -12, '#e4cf9f'], [-12, 10, '#efdfb2'],
            [10, 28, '#dcc493'], [28, 52, '#d0b887'], [52, 75, '#bca678'], [75, 90, '#a2a088']],
        layers: [{poly: spot(40, 60, 2.5, 10), color: '#f6ead0', alpha: 0.5}],
    },
    uranus: {
        base: '#a2dbe2',
        bands: [[-90, -45, '#93d0d9'], [-20, -5, '#a9e0e6'], [20, 40, '#b2e6ea'], [55, 90, '#c1eef0']],
        layers: [{poly: spot(30, 120, 3, 8), color: '#d8f6f7', alpha: 0.5}],
    },
    neptune: {
        base: '#4a6fe0',
        bands: [[-90, -55, '#3a5ac2'], [-35, -15, '#4064d2'], [10, 30, '#5579e6'], [55, 90, '#3d5cc8']],
        layers: [
            {poly: spot(-20, 40, 6, 12), color: '#263f92', alpha: 0.9},   // Great Dark Spot
            {poly: spot(-15, 55, 1.5, 8), color: '#e6eeff', alpha: 0.7},
            {poly: spot(-42, 200, 2, 10), color: '#e6eeff', alpha: 0.6},
            {poly: spot(25, 280, 1.5, 12), color: '#cfdcff', alpha: 0.5},
        ],
    },
    ceres: {
        base: '#8e8981',
        layers: [...craters(23, 18, '#6f6a63', '#a8a39a'), {poly: spot(20, 240, 2.5), color: '#f6f4ec'}, {poly: spot(18, 246, 1.5), color: '#ffffff'}],
    },
    vesta: {
        base: '#a59e92',
        bands: [[-90, -52, '#8e867a']],
        layers: [...craters(31, 14, '#857d72', '#c3bcb1'), {poly: spot(-75, 0, 4), color: '#b9b2a6'}],
    },
    pluto: {
        base: '#c4a688',
        layers: [
            {poly: [[35, 150], [30, 175], [15, 190], [-5, 185], [-10, 170], [0, 160], [20, 150]], color: '#efe4d3'},
            {poly: [[30, 175], [35, 195], [20, 205], [5, 195], [15, 185]], color: '#e3d6c2'},
            {poly: [[5, 40], [0, 90], [-10, 130], [-22, 120], [-20, 70], [-12, 40]], color: '#6a4532', alpha: 0.9},
        ],
    },
};

// Subdivide polygon edges so they curve over the sphere.
function densify(poly, step = 6) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step));
        for (let k = 0; k < n; k++)
            out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
}

function bandPolygon(lat1, lat2) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 6)
        pts.push([lat1, lon]);
    for (let lon = 180; lon >= -180; lon -= 6)
        pts.push([lat2, lon]);
    return pts;
}

// Pre-densified surfaces.
const PREPARED = Object.fromEntries(Object.entries(SURFACES).map(([id, s]) => [id, {
    base: hexToRgb(s.base),
    bands: (s.bands ?? []).map(([l1, l2, color]) => ({pts: bandPolygon(l1, l2), color: hexToRgb(color), alpha: 0.9})),
    features: (s.layers ?? []).map(l => ({pts: densify(l.poly), color: hexToRgb(l.color), alpha: l.alpha ?? 1})),
}]));

// ---- Planet sprite ----

// Project one lat/lon outline onto the disc (pole up, tipped toward the viewer
// by asin(sb)); points on the far side are pushed out to the limb.
function tracePolygon(cr, R, pts, sb, cb, phase) {
    let visible = false;
    cr.newPath();
    for (const [lat, lon] of pts) {
        const la = lat * RAD, lo = lon * RAD + phase;
        const xb = Math.cos(la) * Math.sin(lo), yb = Math.sin(la), zb = Math.cos(la) * Math.cos(lo);
        let x = xb, y = -(yb * cb - zb * sb);
        const z = yb * sb + zb * cb;
        if (z < 0) {
            const n = Math.hypot(x, y) || 1;
            x /= n;
            y /= n;
        } else {
            visible = true;
        }
        cr.lineTo(x * R, y * R);
    }
    cr.closePath();
    return visible;
}

const poleFrame = pole => ({
    beta: Math.hypot(pole[0], pole[1]) > 1e-6 ? Math.atan2(pole[0], pole[1]) : 0,
    sb: pole[2],
    cb: Math.sqrt(Math.max(0, 1 - pole[2] * pole[2])),
});

// The spin phase for drawSurface that puts longitude 0 under `pm`, the
// direction of the prime meridian in view space, so a planet faces the way
// it really does.
export function phaseFor(pole, pm) {
    const {beta, sb, cb} = poleFrame(pole);
    const [c, s] = [Math.cos(beta), Math.sin(beta)];
    const fu = pm[0] * s + pm[1] * c;
    return Math.atan2(pm[0] * c - pm[1] * s, -fu * sb + pm[2] * cb);
}

// Where a point on the surface (degrees, lon east) is, as drawn:
// [right, up, toward viewer] in planet radii.
export function surfacePoint(pole, phase, lat, lon) {
    const {beta, sb, cb} = poleFrame(pole);
    const la = lat * RAD, lo = lon * RAD + phase;
    const xb = Math.cos(la) * Math.sin(lo), yb = Math.sin(la), zb = Math.cos(la) * Math.cos(lo);
    const fu = yb * cb - zb * sb, fz = yb * sb + zb * cb;
    const [c, s] = [Math.cos(beta), Math.sin(beta)];
    return [xb * c + fu * s, -xb * s + fu * c, fz];
}

// Bands only depend on the pole, not the spin, so they are drawn once into
// an image (at `scale` device pixels per unit) and reused for every frame.
export function bandCache(id, size, R, pole, scale = 1) {
    const surface = PREPARED[id];
    const px = Math.ceil(size * scale);
    const img = new Cairo.ImageSurface(Cairo.Format.ARGB32, px, px);
    const cr = new Cairo.Context(img);
    cr.scale(scale, scale);
    cr.translate(size / 2, size / 2);
    const {beta, sb, cb} = poleFrame(pole);
    cr.rotate(beta);
    cr.arc(0, 0, R, 0, 2 * Math.PI);
    cr.clip();
    cr.setSourceRGB(...surface.base);
    cr.paint();
    for (const layer of surface.bands) {
        if (tracePolygon(cr, R, layer.pts, sb, cb, 0)) {
            cr.setSourceRGBA(...layer.color, layer.alpha);
            cr.fill();
        }
        cr.newPath();
    }
    cr.$dispose();
    return {img, scale};
}

// The spinning surface: cached bands plus the features that move.
export function drawSurface(cr, size, id, R, {pole, phase, cache}) {
    const surface = PREPARED[id];
    const {beta, sb, cb} = poleFrame(pole);
    cr.save();
    if (cache) {
        cr.save();
        cr.scale(1 / cache.scale, 1 / cache.scale);
        cr.setSourceSurface(cache.img, 0, 0);
        cr.paint();
        cr.restore();
    }
    cr.translate(size / 2, size / 2);
    cr.rotate(beta);
    cr.arc(0, 0, R, 0, 2 * Math.PI);
    cr.clip();
    if (!cache) {
        cr.setSourceRGB(...surface.base);
        cr.paint();
    }
    for (const layer of cache ? surface.features : [...surface.bands, ...surface.features]) {
        if (tracePolygon(cr, R, layer.pts, sb, cb, phase)) {
            cr.setSourceRGBA(...layer.color, layer.alpha);
            cr.fill();
        }
        cr.newPath();
    }
    cr.restore();
}

// Day/night shading. light = [right, up, toward viewer], unit.
export function drawShade(cr, size, R, light, atmosphere) {
    const m = Math.hypot(light[0], light[1]);
    const lw = light[2];
    cr.save();
    cr.translate(size / 2, size / 2);
    cr.arc(0, 0, R + 1, 0, 2 * Math.PI);
    cr.clip();
    cr.rotate(Math.atan2(-light[1], light[0]));   // light now comes from +x

    // Soft limb darkening with a highlight toward the Sun.
    const hx = R * 0.45 * m, g = new Cairo.RadialGradient(hx, 0, 0, hx * 0.4, 0, R * 1.25);
    g.addColorStopRGBA(0, 1, 1, 1, 0.16);
    g.addColorStopRGBA(0.55, 0, 0, 0, 0);
    g.addColorStopRGBA(1, 0, 0, 0, 0.55);
    cr.setSource(g);
    cr.arc(0, 0, R + 0.5, 0, 2 * Math.PI);
    cr.fill();

    // Night side: the far limb plus the terminator ellipse, in three soft steps.
    for (const d of [0.16, 0, -0.16]) {
        const k = Math.max(-1, Math.min(1, lw + d));
        cr.newPath();
        cr.arc(0, 0, R + 0.6, Math.PI / 2, 3 * Math.PI / 2);
        for (let i = 0; i <= 24; i++) {
            const t = i / 24 * Math.PI;
            cr.lineTo(-(R + 0.6) * k * Math.sin(t), -(R + 0.6) * Math.cos(t));
        }
        cr.closePath();
        cr.setSourceRGBA(0, 0, 0, 0.82);   // three passes: ~99.4% black at night
        cr.fill();
    }

    if (atmosphere) {
        cr.newPath();
        cr.arc(0, 0, R + 0.4, -Math.PI / 2 + 0.25, Math.PI / 2 - 0.25);
        cr.setSourceRGBA(...hexToRgb(atmosphere), 0.55 * Math.min(1, m + 0.2));
        cr.setLineWidth(Math.max(0.8, R * 0.09));
        cr.stroke();
    }
    cr.restore();
}

export const RINGS = {
    // [inner, outer] in planet radii, color, alpha (C, B, A rings; gap = Cassini Division)
    saturn: [[1.24, 1.52, '#8f8270', 0.35], [1.53, 1.94, '#e2d2ae', 0.85], [2.03, 2.27, '#cbbd9c', 0.7]],
    uranus: [[1.64, 1.66, '#9fb7bb', 0.18], [1.98, 2.01, '#bcd4d6', 0.3]],
};

// Rings in the planet's equatorial plane. half: -1 the half behind the
// planet, +1 the half in front.
export function drawRings(cr, size, id, R, pole, half) {
    const bands = RINGS[id];
    const {beta, sb} = poleFrame(pole);
    const flat = Math.max(0.025, Math.abs(sb));
    const outer = R * bands[bands.length - 1][1];
    cr.save();
    cr.translate(size / 2, size / 2);
    cr.rotate(beta);
    // The front half is the one on the same side as the tipped-in pole.
    const down = half > 0 ? sb >= 0 : sb < 0;
    cr.rectangle(-outer - 2, down ? 0 : -outer - 2, 2 * outer + 4, outer + 2);
    cr.clip();
    cr.scale(1, flat);
    for (const [r1, r2, color, alpha] of bands) {
        cr.newPath();
        cr.arc(0, 0, R * (r1 + r2) / 2, 0, 2 * Math.PI);
        cr.setLineWidth(R * (r2 - r1));
        cr.setSourceRGBA(...hexToRgb(color), alpha);
        cr.stroke();
    }
    cr.restore();
}

export function spriteExtent(id, R) {
    const rings = RINGS[id];
    return Math.ceil((rings ? rings[rings.length - 1][1] * R : R) + 3);
}

// Everything in one go (used by the tests and previews).
export function drawPlanet(cr, size, id, R, {pole, light, phase, atmosphere}) {
    if (RINGS[id])
        drawRings(cr, size, id, R, pole, -1);
    drawSurface(cr, size, id, R, {pole, phase});
    drawShade(cr, size, R, light, atmosphere);
    if (RINGS[id])
        drawRings(cr, size, id, R, pole, +1);
}

// ---- Sun ----

export function drawSun(cr, size, R, glow = 1) {
    const c = size / 2;
    const g = new Cairo.RadialGradient(c, c, R * 0.6, c, c, c);
    g.addColorStopRGBA(0, 1, 0.82, 0.5, 0.55 * glow);
    g.addColorStopRGBA(0.18, 1, 0.62, 0.25, 0.22 * glow);
    g.addColorStopRGBA(0.45, 0.8, 0.35, 0.1, 0.06 * glow);
    g.addColorStopRGBA(1, 0, 0, 0, 0);
    cr.setSource(g);
    cr.paint();

    const d = new Cairo.RadialGradient(c - R * 0.15, c - R * 0.15, 0, c, c, R);
    d.addColorStopRGBA(0, 1, 0.98, 0.9, 1);
    d.addColorStopRGBA(0.6, 1, 0.86, 0.52, 1);
    d.addColorStopRGBA(1, 1, 0.6, 0.22, 1);
    cr.setSource(d);
    cr.arc(c, c, R, 0, 2 * Math.PI);
    cr.fill();
}

// ---- Moons, small bodies and markers ----

// A moon: a small disc, lit from the side facing the Sun (light: unit
// vector in view space, [right, up, toward viewer]).
export function drawMoon(cr, size, rgb, light) {
    const c = size / 2, r = size / 2 - 0.5;
    const g = new Cairo.RadialGradient(c + light[0] * r * 0.6, c - light[1] * r * 0.6, 0, c, c, r);
    g.addColorStopRGBA(0, ...rgb.map(x => Math.min(1, x * 1.15)), 1);
    g.addColorStopRGBA(0.7, ...rgb, 0.95);
    g.addColorStopRGBA(1, ...rgb.map(x => x * 0.35), 0.9);
    cr.setSource(g);
    cr.arc(c, c, r, 0, 2 * Math.PI);
    cr.fill();
}

// An asteroid: a dim speck with a faint halo so it can be found.
export function drawSpeck(cr, size, rgb) {
    const c = size / 2;
    const g = new Cairo.RadialGradient(c, c, 0, c, c, c);
    g.addColorStopRGBA(0, ...rgb, 0.95);
    g.addColorStopRGBA(0.3, ...rgb, 0.6);
    g.addColorStopRGBA(1, ...rgb, 0);
    cr.setSource(g);
    cr.arc(c, c, c, 0, 2 * Math.PI);
    cr.fill();
}

// A Lagrange point: four short ticks around an empty center.
export function drawMarker(cr, size, rgb, alpha = 0.6) {
    const c = size / 2, a = size * 0.18, b = size / 2 - 0.5;
    cr.setSourceRGBA(...rgb, alpha);
    cr.setLineWidth(1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        cr.moveTo(c + dx * a, c + dy * a);
        cr.lineTo(c + dx * b, c + dy * b);
    }
    cr.stroke();
}

// Moon orbits around a planet: ellipses through `rings` ([[x, y], ...] each,
// already relative to the sprite center).
export function drawMoonOrbits(cr, size, rings, alpha) {
    cr.translate(size / 2, size / 2);
    cr.setLineWidth(0.8);
    for (const pts of rings) {
        cr.setSourceRGBA(0.8, 0.84, 0.92, alpha);
        cr.moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts.slice(1))
            cr.lineTo(x, y);
        cr.closePath();
        cr.stroke();
    }
}

// A star: a soft glow with four short spikes.
export function drawStar(cr, x, y, r) {
    const g = new Cairo.RadialGradient(x, y, 0, x, y, r * 2.5);
    g.addColorStopRGBA(0, 1, 0.97, 0.88, 0.95);
    g.addColorStopRGBA(0.25, 1, 0.9, 0.7, 0.45);
    g.addColorStopRGBA(1, 1, 0.85, 0.6, 0);
    cr.setSource(g);
    cr.arc(x, y, r * 2.5, 0, 2 * Math.PI);
    cr.fill();
    cr.setSourceRGBA(1, 0.95, 0.85, 0.5);
    cr.setLineWidth(0.8);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
        cr.moveTo(x - dx * r * 3, y - dy * r * 3);
        cr.lineTo(x + dx * r * 3, y + dy * r * 3);
    }
    cr.stroke();
}

// ---- Backdrop ----

export function drawStars(cr, w, h, density = 1) {
    const rnd = seeded(1977);
    const count = Math.round(w * h / 9000 * density);
    for (let i = 0; i < count; i++) {
        const x = rnd() * w, y = rnd() * h;
        const bright = rnd() ** 3;
        const tint = rnd();
        const [r, g, b] = tint < 0.15 ? [0.75, 0.82, 1] : tint > 0.9 ? [1, 0.88, 0.72] : [1, 1, 1];
        cr.setSourceRGBA(r, g, b, 0.12 + bright * 0.55);
        cr.arc(x, y, 0.35 + bright * 0.75, 0, 2 * Math.PI);
        cr.fill();
    }
}

// points: [[x, y], ...] already projected
export function drawDots(cr, points, alpha, radius = 0.6) {
    for (const [x, y, a = 1] of points) {
        cr.setSourceRGBA(0.85, 0.82, 0.78, alpha * a);
        cr.rectangle(x - radius, y - radius, radius * 2, radius * 2);
        cr.fill();
    }
}

export function strokePath(cr, pts, rgb, alpha, width = 1, dash = null) {
    if (pts.length < 2)
        return;
    cr.newPath();
    cr.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++)
        cr.lineTo(pts[i][0], pts[i][1]);
    cr.setSourceRGBA(...rgb, alpha);
    cr.setLineWidth(width);
    if (dash)
        cr.setDash(dash, 0);
    cr.stroke();
    if (dash)
        cr.setDash([], 0);
}

// A trail that fades with age: pts are [x, y, alpha].
export function strokeTrail(cr, pts, rgb, width = 1.2) {
    cr.setLineWidth(width);
    cr.setLineCap(Cairo.LineCap.ROUND);
    const chunk = 6;
    for (let i = 0; i + 1 < pts.length; i += chunk) {
        const end = Math.min(pts.length - 1, i + chunk);
        const alpha = pts[Math.min(end, i + chunk / 2)][2];
        if (alpha <= 0.01)
            continue;
        cr.newPath();
        cr.moveTo(pts[i][0], pts[i][1]);
        for (let k = i + 1; k <= end; k++)
            cr.lineTo(pts[k][0], pts[k][1]);
        cr.setSourceRGBA(...rgb, alpha);
        cr.stroke();
    }
}

// ---- Small sprites ----

export function drawCraft(cr, size, rgb) {
    const c = size / 2;
    const g = new Cairo.RadialGradient(c, c, 0, c, c, c);
    g.addColorStopRGBA(0, ...rgb, 0.55);
    g.addColorStopRGBA(1, ...rgb, 0);
    cr.setSource(g);
    cr.paint();
    cr.setSourceRGBA(1, 1, 1, 0.95);
    cr.moveTo(c, c - 2.2);
    cr.lineTo(c + 2.2, c);
    cr.lineTo(c, c + 2.2);
    cr.lineTo(c - 2.2, c);
    cr.closePath();
    cr.fill();
}

// Comet nucleus with a tail pointing away from the Sun (angle in radians,
// screen space), length in px.
export function drawComet(cr, size, angle, length, rgb = [0.75, 0.88, 1]) {
    const c = size / 2;
    cr.save();
    cr.translate(c, c);
    cr.rotate(angle);
    if (length > 1) {
        const g = new Cairo.LinearGradient(0, 0, length, 0);
        g.addColorStopRGBA(0, ...rgb, 0.5);
        g.addColorStopRGBA(1, ...rgb, 0);
        cr.setSource(g);
        cr.moveTo(0, -1.2);
        cr.lineTo(length, -length * 0.18);
        cr.lineTo(length, length * 0.18);
        cr.lineTo(0, 1.2);
        cr.closePath();
        cr.fill();
    }
    cr.setSourceRGBA(0.92, 0.96, 1, 0.95);
    cr.arc(0, 0, 1.4, 0, 2 * Math.PI);
    cr.fill();
    cr.restore();
}

// ---- Sunlight ----
// Irradiance falls with the square of distance, from about 9,000 W/m² at
// Mercury to 1.5 at Neptune; colors follow its logarithm, white-hot near the
// Sun through orange (Earth) and red to a dim violet that fades to black.

const SUN_RAMP = [
    // [log10 W/m², r, g, b, alpha]
    [-0.2, 0.10, 0.03, 0.30, 0],
    [0.3, 0.22, 0.07, 0.45, 0.04],
    [1, 0.42, 0.10, 0.50, 0.08],
    [2, 0.74, 0.14, 0.26, 0.15],
    [2.5, 0.92, 0.30, 0.14, 0.2],
    [3.13, 1.00, 0.56, 0.18, 0.27],
    [4, 1.00, 0.72, 0.26, 0.36],
    [4.6, 1.00, 0.84, 0.48, 0.46],
];

// [r, g, b, alpha] for an irradiance in W/m².
export function sunlightColor(e) {
    const x = Math.log10(Math.max(e, 1e-3));
    if (x <= SUN_RAMP[0][0])
        return SUN_RAMP[0].slice(1);
    for (let i = 1; i < SUN_RAMP.length; i++) {
        const [x1, ...c1] = SUN_RAMP[i];
        if (x <= x1) {
            const [x0, ...c0] = SUN_RAMP[i - 1];
            const k = (x - x0) / (x1 - x0);
            return c0.map((v, j) => v + (c1[j] - v) * k);
        }
    }
    return SUN_RAMP[SUN_RAMP.length - 1].slice(1);
}

// The irradiance field in the plane of the planets. `radiusPx(r)` maps AU to
// screen pixels (the same compression as the planets), `squash` flattens it
// to the camera tilt. levels: W/m² contours; zone: [inner, outer] AU band.
export function drawSunlightField(cr, {cx, cy, squash, radiusPx, levels, zone}) {
    const SOLAR = 1361;
    const rMax = Math.sqrt(SOLAR / 0.6);
    const outer = radiusPx(rMax);
    cr.save();
    cr.translate(cx, cy);
    cr.scale(1, Math.max(0.05, squash));
    const g = new Cairo.RadialGradient(0, 0, 0, 0, 0, outer);
    for (let i = 0; i <= 48; i++) {
        const r = 0.03 * (rMax / 0.03) ** (i / 48);
        g.addColorStopRGBA(radiusPx(r) / outer, ...sunlightColor(SOLAR / (r * r)));
    }
    cr.setSource(g);
    cr.arc(0, 0, outer, 0, 2 * Math.PI);
    cr.fill();

    cr.restore();

    // The habitable zone's edges.
    for (const r of zone ?? []) {
        cr.save();
        cr.translate(cx, cy);
        cr.scale(1, Math.max(0.05, squash));
        cr.arc(0, 0, radiusPx(r), 0, 2 * Math.PI);
        cr.restore();
        cr.setSourceRGBA(0.4, 0.95, 0.6, 0.3);
        cr.setLineWidth(1);
        cr.setDash([1, 3], 0);
        cr.stroke();
    }

    // Contours are stroked unscaled so the lines keep an even width.
    for (const e of levels) {
        const rho = radiusPx(Math.sqrt(SOLAR / e));
        const [r, gg, b] = sunlightColor(e);
        cr.save();
        cr.translate(cx, cy);
        cr.scale(1, Math.max(0.05, squash));
        cr.arc(0, 0, rho, 0, 2 * Math.PI);
        cr.restore();
        cr.setSourceRGBA(r, gg, b, e === SOLAR ? 0.55 : 0.32);
        cr.setLineWidth(1);
        cr.setDash(e === SOLAR ? [] : [2, 5], 0);
        cr.stroke();
    }
    cr.setDash([], 0);
}

// A horizontal color bar from 1 to 30,000 W/m² on a log scale, with a tick
// at each of `marks` (W/m²).
export function drawSunlightLegend(cr, w, h, marks) {
    const lo = 0, hi = Math.log10(30000);
    const g = new Cairo.LinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 16; i++) {
        const [r, gg, b, a] = sunlightColor(10 ** (lo + (hi - lo) * i / 16));
        g.addColorStopRGBA(i / 16, r, gg, b, Math.min(1, a * 2.6));
    }
    cr.setSource(g);
    cr.rectangle(0, h * 0.3, w, h * 0.4);
    cr.fill();
    for (const e of marks) {
        const x = Math.round(w * (Math.log10(e) - lo) / (hi - lo)) + 0.5;
        cr.setSourceRGBA(1, 1, 1, 0.55);
        cr.setLineWidth(1);
        cr.moveTo(x, 0);
        cr.lineTo(x, h);
        cr.stroke();
    }
}

// ---- Timeline ----

// The track: a line from t0 to t1 (solid up to `now`, dashed after), a tick
// each year, and a colored tick for each mission event.
// events: [{t, rgb, kind}]; x(t) maps a date to pixels.
export function drawTimeline(cr, w, h, {t0, t1, now, x, years, events}) {
    const base = Math.round(h * 0.68) + 0.5;
    cr.setLineWidth(1);
    cr.setSourceRGBA(1, 1, 1, 0.22);
    cr.moveTo(0, base);
    cr.lineTo(Math.min(w, x(now)), base);
    cr.stroke();
    if (x(now) < w) {
        cr.setSourceRGBA(1, 1, 1, 0.14);
        cr.setDash([2, 3], 0);
        cr.moveTo(x(now), base);
        cr.lineTo(w, base);
        cr.stroke();
        cr.setDash([], 0);
    }
    for (const [t, major] of years) {
        const xx = Math.round(x(t)) + 0.5;
        cr.setSourceRGBA(1, 1, 1, major ? 0.32 : 0.14);
        cr.moveTo(xx, base + 1);
        cr.lineTo(xx, base + (major ? 6 : 3));
        cr.stroke();
    }
    const lengths = {launch: 11, arrive: 8, flyby: 7, end: 5};
    for (const {t, rgb, kind} of events) {
        if (t < t0 || t > t1)
            continue;
        const xx = Math.round(x(t)) + 0.5;
        const len = lengths[kind] ?? 4;
        cr.setSourceRGBA(...rgb, t <= now ? 0.85 : 0.4);
        cr.moveTo(xx, base - 1);
        cr.lineTo(xx, base - len);
        cr.stroke();
        if (kind === 'launch') {
            cr.arc(xx, base - len, 1.6, 0, 2 * Math.PI);
            cr.fill();
        }
    }
    // Today.
    const xn = Math.round(x(now)) + 0.5;
    cr.setSourceRGBA(1, 1, 1, 0.5);
    cr.moveTo(xn, base - 12);
    cr.lineTo(xn, base + 6);
    cr.stroke();
}

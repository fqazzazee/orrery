// The solar system drawn with Cairo alone, for desktops other than GNOME
// Shell: the same astronomy, missions and drawing as the extension, laid out
// as one picture (planets turned the way they really face, moons, spacecraft
// and their trails, the date, the missions in flight and a fact).

import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

import * as Astro from '../lib/astro.js';
import {BODY, PLANETS, moonsOf} from '../lib/bodies.js';
import {FactDeck, missionStatus} from '../lib/facts.js';
import * as Render from '../lib/render.js';

const FONT = 'Outfit, Cantarell, Noto Sans, sans-serif';
const deck = new FactDeck();

function layoutFor(cr, str, {size = 9, weight = 'normal', width = -1}) {
    const layout = PangoCairo.create_layout(cr);
    layout.set_font_description(Pango.FontDescription.from_string(`${FONT} ${weight === 'normal' ? '' : weight} ${size}`));
    if (width > 0) {
        layout.set_width(width * Pango.SCALE);
        layout.set_wrap(Pango.WrapMode.WORD_CHAR);
    }
    layout.set_text(str, -1);
    return layout;
}

const textWidth = (cr, str, style) => layoutFor(cr, str, style).get_pixel_extents()[1].width;

// Draws text; returns its height.
function text(cr, str, {x, y, size = 9, weight = 'normal', rgba = [1, 1, 1, 0.8], width = -1, align = 'left'}) {
    const layout = layoutFor(cr, str, {size, weight, width});
    const [, logical] = layout.get_pixel_extents();
    const dx = align === 'center' ? -logical.width / 2 : align === 'right' ? -logical.width : 0;
    cr.setSourceRGBA(...rgba);
    cr.moveTo(x + dx, y);
    PangoCairo.show_layout(cr, layout);
    return logical.height;
}

// The layout for a screen: projection and sizes, shared by every frame.
export function makeView(W, H, {tilt = 58, azimuth = 0, scale = 'sqrt', zoom = 1, planetScale = 1, top = 0, bottom = H} = {}) {
    const availH = bottom - top;
    const fitPx = Math.min(W * 0.46, availH * 0.46 / Math.max(0.2, Math.cos(tilt * Math.PI / 180))) * zoom;
    const proj = new Astro.Projection({cx: W / 2, cy: top + availH / 2, fitPx, mode: scale, tilt, azimuth});
    return {W, H, proj, unit: W / 220 * planetScale, top, bottom};
}

export const bodyRadius = (view, id) => id === 'sun' ? view.unit * 3.1 : Math.max(2.2, view.unit * (BODY[id].radiusKm / 6371) ** 0.45);

// What does not move from frame to frame: stars, belts and orbits.
export function drawBackdrop(cr, view, jd, {stars = true, belts = true, orbits = true} = {}) {
    const {W, H, proj} = view;
    cr.setSourceRGB(0, 0, 0);
    cr.paint();
    if (stars)
        Render.drawStars(cr, W, H);
    if (belts) {
        const rnd = Render.seeded(4);
        const belt = (n, a0, a1, alpha) => {
            const pts = [];
            for (let i = 0; i < n; i++) {
                const a = a0 + (a1 - a0) * rnd() ** 0.8, th = rnd() * 2 * Math.PI;
                pts.push([...proj.project([a * Math.cos(th), a * Math.sin(th), (rnd() - 0.5) * 0.12 * a]).slice(0, 2), 0.4 + rnd() * 0.6]);
            }
            Render.drawDots(cr, pts, alpha, 0.5);
        };
        belt(1600, 2.15, 3.3, 0.32);
        belt(900, 30, 48, 0.16);
    }
    if (orbits) {
        for (const b of PLANETS) {
            const pts = Astro.orbitPoints(Astro.planetOrbit(b.id, jd)).map(p => proj.project(p));
            const minor = b.dwarf || b.asteroid;
            Render.strokePath(cr, pts, Render.hexToRgb(b.color), minor ? 0.12 : 0.2, 1, minor ? [3, 4] : null);
        }
    }
}

// Craft trails over the last `years`, fading with age.
export function drawTrails(cr, view, jd, trajectories, years = 8) {
    const window = years * 365.25;
    const width = Math.max(1, view.unit * 0.17);
    for (const tr of trajectories) {
        if (jd < tr.launch || jd - Math.min(jd, tr.end) > window)
            continue;
        const pts = tr.samples(Math.max(tr.launch, jd - window), Math.min(jd, tr.end))
            .map(({t, p}) => [...view.proj.project(p).slice(0, 2), 0.85 * (1 - (jd - t) / window) ** 1.4]);
        if (pts.length > 1)
            Render.strokeTrail(cr, pts, Render.hexToRgb(tr.mission.color), width);
    }
}

// The Sun, planets (turned and lit as they really are), moons and craft,
// farthest first, with their names.
export function drawBodies(cr, view, jd, trajectories, {labels = true, moons = true, spinPhase = null} = {}) {
    const {proj, unit} = view;
    const items = [];
    const sunR = bodyRadius(view, 'sun');
    items.push({depth: 0, draw: () => {
        const size = Math.ceil(sunR * 7);
        cr.save();
        cr.translate(proj.cx - size / 2, proj.cy - size / 2);
        Render.drawSun(cr, size, sunR);
        cr.restore();
    }});
    const names = [];
    const earth = Astro.planetPosition('earth', jd);
    for (const b of PLANETS) {
        const p = Astro.planetPosition(b.id, jd);
        const [x, y, depth] = proj.project(p);
        const r = bodyRadius(view, b.id);
        const size = 2 * Render.spriteExtent(b.id, r);
        const ecl = Astro.equatorialToEcliptic(...b.pole);
        const pole = Astro.unit(proj.view(ecl));
        const light = Astro.unit(proj.view(Astro.scale(p, -1)));
        const phase = spinPhase ? spinPhase(b) : Render.phaseFor(pole, Astro.unit(proj.view(Astro.primeMeridian(b.id, jd, b.pole))));
        items.push({depth, draw: () => {
            cr.save();
            cr.translate(x - size / 2, y - size / 2);
            Render.drawPlanet(cr, size, b.id, r, {pole, light, phase, atmosphere: b.atmosphere});
            cr.restore();
        }});
        if (moons) {
            // Squeezed around the planet, as in the extension.
            const list = moonsOf(b.id);
            const rings = Render.RINGS[b.id];
            const inner = (rings ? rings.at(-1)[1] * r : r) + 4;
            const span = Math.max(10, Math.min(34, r * 1.6));
            const logs = list.map(m => Math.log(m.a));
            const [lo, hi] = [Math.min(...logs), Math.max(...logs)];
            const [e1, e2] = Astro.planeBasis(ecl);
            for (const m of list) {
                const [b1, b2] = m.ecliptic ? Astro.planeBasis([0, 0, 1]) : [e1, e2];
                const rr = list.length === 1 ? inner + span * 0.45 : inner + span * (Math.log(m.a) - lo) / (hi - lo);
                const a = Astro.moonAngle(m, jd, earth);
                const v = proj.view(Astro.add(Astro.scale(b1, Math.cos(a)), Astro.scale(b2, Math.sin(a))));
                const dot = Math.max(1.2, Math.min(2.8, unit * (m.radiusKm / 6371) ** 0.45 * 0.42));
                const ms = Math.ceil(2 * dot + 1);
                items.push({depth: depth + v[2] * rr, draw: () => {
                    cr.save();
                    cr.translate(x + v[0] * rr - ms / 2, y - v[1] * rr - ms / 2);
                    Render.drawMoon(cr, ms, Render.hexToRgb(m.color), light);
                    cr.restore();
                }});
            }
        }
        if (labels)
            names.push([b.name.toUpperCase(), x, y + r + 3 + (b.id === 'saturn' ? r * 0.5 : 0), b.dwarf || b.asteroid]);
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items)
        it.draw();

    // Spacecraft.
    const size = Math.ceil(unit * 2.2) | 1;
    const craft = [];
    for (const tr of trajectories) {
        const seg = tr.segmentAt(jd);
        if (!seg || tr.mission.group === 'observatory')
            continue;
        let [x, y] = proj.project(seg.pos(jd));
        if (seg.kind === 'stay') {
            const host = BODY[seg.body] ? proj.project(Astro.planetPosition(seg.body, jd)) : [x, y];
            const ang = (tr.mission.id.length * 1.7) % (2 * Math.PI);
            [x, y] = [host[0] + 9 * Math.cos(ang), host[1] + 5 * Math.sin(ang)];
        }
        if (x < 0 || y < 0 || x > view.W || y > view.H)
            continue;
        cr.save();
        cr.translate(x - size / 2, y - size / 2);
        Render.drawCraft(cr, size, Render.hexToRgb(tr.mission.color));
        cr.restore();
        craft.push([tr, x, y]);
    }
    if (!labels)
        return;
    // Names: planets first, then craft where they do not overlap.
    const placed = [];
    const fits = (x, y, w, h) => !placed.some(q => x < q[2] && x + w > q[0] && y < q[3] && y + h > q[1]);
    for (const [name, x, y, minor] of names) {
        const w = name.length * 6;
        placed.push([x - w / 2, y, x + w / 2, y + 11]);
        text(cr, name, {x, y, size: minor ? 6.5 : 7.5, weight: 'Semi-Bold', rgba: [0.84, 0.87, 0.94, minor ? 0.38 : 0.5], align: 'center'});
    }
    for (const [tr, x, y] of craft) {
        const name = tr.mission.short ?? tr.mission.name;
        const w = name.length * 5.6;
        if (!fits(x + 7, y - 7, w, 11))
            continue;
        placed.push([x + 7, y - 7, x + 7 + w, y + 4]);
        text(cr, name, {x: x + 7, y: y - 8, size: 7.5, weight: 'Semi-Bold', rgba: [...Render.hexToRgb(tr.mission.color), 0.95]});
    }
}

// Date, caption, the missions in flight and a fact card.
export function drawHud(cr, view, jd, trajectories, {caption = 'Live · the solar system right now', fact = true, list = true} = {}) {
    const {W, H} = view;
    const m = Math.round(W * 0.018);
    const top = view.top + Math.round(m * 0.6);
    text(cr, Astro.formatDate(jd), {x: m, y: top, size: 28, weight: 'Light', rgba: [0.88, 0.9, 0.96, 0.78]});
    text(cr, caption, {x: m, y: top + 46, size: 9.5, rgba: [0.78, 0.81, 0.88, 0.5]});

    if (list) {
        const rows = trajectories.filter(tr => tr.mission.group !== 'observatory')
            .map(tr => [tr, missionStatus(tr, jd)]).filter(([, s]) => s);
        let y = view.bottom - m - rows.length * 20;
        // Statuses in a column after the longest name.
        const col = Math.max(0, ...rows.map(([tr]) => textWidth(cr, tr.mission.short ?? tr.mission.name, {size: 9, weight: 'Bold'})));
        for (const [tr, status] of rows) {
            const rgb = Render.hexToRgb(tr.mission.color);
            cr.setSourceRGBA(...rgb, 1);
            cr.arc(m + 3, y + 8, 3, 0, 2 * Math.PI);
            cr.fill();
            const name = tr.mission.short ?? tr.mission.name;
            text(cr, name, {x: m + 13, y, size: 9, weight: 'Bold', rgba: [...rgb, 1]});
            text(cr, status, {x: m + 13 + col + 10, y, size: 9, rgba: [0.8, 0.82, 0.9, 0.55]});
            y += 20;
        }
    }

    if (fact) {
        const ids = ['sun', ...PLANETS.map(b => b.id)];
        const id = typeof fact === 'string' ? fact : ids[Math.floor(Math.random() * ids.length)];
        const card = deck.card(id, jd);
        const w = Math.round(Math.min(380, Math.max(260, W * 0.19)));
        const x = W - m - w, y = view.top + m;
        // Measure, then draw the box and the text.
        const pad = 15;
        const lines = card.lines.filter(Boolean);
        let h = pad + 26 + 16;
        const layoutH = s => {
            const layout = PangoCairo.create_layout(cr);
            layout.set_font_description(Pango.FontDescription.from_string(`${FONT} 10`));
            layout.set_width((w - 2 * pad) * Pango.SCALE);
            layout.set_wrap(Pango.WrapMode.WORD_CHAR);
            layout.set_text(s, -1);
            return layout.get_pixel_extents()[1].height;
        };
        for (const l of lines)
            h += layoutH(l) + 5;
        h += pad - 5;
        roundRect(cr, x, y, w, h, 14);
        cr.setSourceRGB(0, 0, 0);
        cr.fillPreserve();
        cr.setSourceRGBA(1, 1, 1, 0.12);
        cr.setLineWidth(1);
        cr.stroke();
        let ty = y + pad - 2;
        ty += text(cr, card.title, {x: x + pad, y: ty, size: 13, weight: 'Bold', rgba: [...Render.hexToRgb(BODY[id].color), 1]});
        ty += text(cr, card.subtitle, {x: x + pad, y: ty, size: 8.5, rgba: [0.78, 0.81, 0.88, 0.55]}) + 4;
        for (const l of lines)
            ty += text(cr, l, {x: x + pad, y: ty, size: 10, rgba: [0.88, 0.9, 0.94, 0.82], width: w - 2 * pad}) + 5;
    }
}

function roundRect(cr, x, y, w, h, r) {
    cr.newPath();
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.closePath();
}

// Everything, in one go.
export function drawScene(cr, view, jd, trajectories, opts = {}) {
    drawBackdrop(cr, view, jd, opts);
    if (opts.trails !== false)
        drawTrails(cr, view, jd, trajectories, opts.trailYears);
    drawBodies(cr, view, jd, trajectories, opts);
    if (opts.hud !== false)
        drawHud(cr, view, jd, trajectories, opts);
}

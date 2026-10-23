// Text for the fact cards. Numbers are worked out live from the simulated
// positions, so they are right for the date on screen.

import * as A from './astro.js';
import {BODY, SPEEDS} from './bodies.js';

function lightTime(au) {
    return A.formatDuration(au * A.AU_KM / A.C_KM_S);
}

function distance(au) {
    return au < 0.1 ? `${A.formatKm(au * A.AU_KM)}` : `${au.toFixed(au < 10 ? 2 : 1)} AU (${A.formatKm(au * A.AU_KM)})`;
}

// "589 W/m², 0.43× Earth's"
function sunlight(r) {
    const e = A.irradiance(r);
    return `${A.formatIrradiance(e)}, ${A.formatRatio(e / A.SOLAR_CONSTANT)} Earth’s`;
}

function dayLength(hours) {
    const h = Math.abs(hours);
    return h < 48 ? A.formatDuration(h * 3600) : `${(h / 24).toFixed(h < 240 ? 1 : 0)} Earth days`;
}

// Live, numeric lines about a planet at time t. pick(n) chooses n of them.
function numericFacts(id, t) {
    const body = BODY[id];
    const orbit = A.planetOrbit(id, t);
    const p = A.orbitPosition(orbit, t);
    const r = A.norm(p);
    const v = A.visVivaKmS(r, orbit.a);
    const vPeri = A.visVivaKmS(A.perihelion(orbit), orbit.a);
    const vAph = A.visVivaKmS(A.aphelion(orbit), orbit.a);
    const out = [
        `Orbiting the Sun at ${v.toFixed(1)} km/s right now (${vAph.toFixed(1)}–${vPeri.toFixed(1)} over its year).`,
        `${distance(r)} from the Sun; sunlight takes ${lightTime(r)} to arrive.`,
    ];
    const [eLow, eHigh] = [A.irradiance(A.aphelion(orbit)), A.irradiance(A.perihelion(orbit))];
    out.push(`Sunlight here: ${sunlight(r)}${eHigh / eLow > 1.15 ? `, swinging ${Math.round((eHigh / eLow - 1) * 100)}% over its year` : ''}.`);
    const period = A.orbitPeriod(orbit);
    out.push(`A year lasts ${period < 1000 ? `${Math.round(period)} days` : `${(period / 365.25).toFixed(1)} Earth years`}; one spin takes ${dayLength(body.rotationHours)}${body.rotationHours < 0 ? ', backwards' : ''}.`);
    if (id !== 'earth') {
        const d = A.norm(A.sub(p, A.planetPosition('earth', t)));
        out.push(`${distance(d)} from Earth; a radio signal takes ${lightTime(d)} each way.`);
        const [label, kms] = SPEEDS[Math.floor(Math.random() * SPEEDS.length)];
        out.push(`Getting there ${label} would take ${A.formatDuration(d * A.AU_KM / kms)}.`);
    }
    return out;
}

const shuffle = arr => arr.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

export class FactDeck {
    constructor() {
        this._trivia = {};
    }

    // Next trivia line for a body, cycling through them in a shuffled order.
    _nextTrivia(id) {
        let deck = this._trivia[id];
        if (!deck?.length)
            deck = this._trivia[id] = shuffle(BODY[id].facts);
        return deck.pop();
    }

    // {title, subtitle, lines[]}
    card(id, t) {
        const body = BODY[id];
        if (id === 'sun') {
            const nep = A.norm(A.planetPosition('neptune', t));
            return {
                title: 'The Sun',
                subtitle: 'G-type star · 4.6 billion years old',
                lines: [`Its light reaches Earth in about 8 min 20 s and Neptune in ${lightTime(nep)}.`, this._nextTrivia(id)],
            };
        }
        const numeric = shuffle(numericFacts(id, t)).slice(0, 2);
        return {title: body.name, subtitle: subtitle(id), lines: [...numeric, this._nextTrivia(id)]};
    }
}

const ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

function subtitle(id) {
    if (id === 'sun')
        return 'G-type star · 4.6 billion years old';
    return BODY[id].dwarf ? 'Dwarf planet' : `Planet ${ORDER.indexOf(id) + 1} from the Sun`;
}

const fixed = (x, digits) => (+x.toFixed(digits)).toLocaleString('en-US', {maximumFractionDigits: digits});

// Everything about a body at time t, for a pinned card: two live lines for
// the compact view, and stats plus every trivia line when expanded.
// {title, subtitle, lines[], stats[[label, value]], notes[]}
export function bodyDetails(id, t, {sunlightView = false} = {}) {
    const body = BODY[id];
    const earth = A.planetPosition('earth', t);
    if (id === 'sun') {
        const nep = A.norm(A.planetPosition('neptune', t));
        return {
            title: 'The Sun', subtitle: subtitle(id),
            lines: [
                `Puts out 3.8 × 10²⁶ W. At Earth that is ${A.formatIrradiance(A.SOLAR_CONSTANT)}; at Neptune, ${A.formatIrradiance(A.irradiance(nep))}.`,
                `Its light reaches Earth in ${lightTime(A.norm(earth))} and Neptune in ${lightTime(nep)}.`,
            ],
            stats: [
                ['Size', `${A.formatKm(2 * body.radiusKm)} across · 109× Earth`],
                ['Mass', `${A.formatCount(body.massEarths)} Earths`],
                ['Surface', `${A.formatCount(body.tempC)} °C`],
                ['Spin', '25 days at the equator, 35 near the poles'],
                ['Sunlight at Earth', `${A.formatIrradiance(A.irradiance(A.norm(earth)))} today`],
                ['Light to Neptune', lightTime(nep)],
            ],
            notes: body.facts,
        };
    }

    const orbit = A.planetOrbit(id, t);
    const p = A.orbitPosition(orbit, t);
    const r = A.norm(p);
    const [q, Q] = [A.perihelion(orbit), A.aphelion(orbit)];
    const v = A.visVivaKmS(r, orbit.a);
    const period = A.orbitPeriod(orbit);
    const d = A.norm(A.sub(p, earth));
    const e = A.irradiance(r);
    const stats = [
        ['From the Sun', `${r.toFixed(r < 10 ? 3 : 2)} AU · light ${lightTime(r)}`],
    ];
    if (id !== 'earth')
        stats.push(['From Earth', `${d.toFixed(d < 10 ? 3 : 2)} AU · radio ${lightTime(d)}`]);
    stats.push(
        ['Sunlight', sunlight(r)],
        ['Over its year', `${A.formatIrradiance(A.irradiance(Q))} to ${A.formatIrradiance(A.irradiance(q))}`],
        ['Orbital speed', `${v.toFixed(1)} km/s (${A.visVivaKmS(Q, orbit.a).toFixed(1)}–${A.visVivaKmS(q, orbit.a).toFixed(1)})`],
        ['Year', period < 1000 ? `${Math.round(period)} days` : `${(period / 365.25).toFixed(1)} Earth years`],
        ['Day', `${dayLength(body.rotationHours)}${body.rotationHours < 0 ? ', backwards' : ''}`],
        ['Axial tilt', `${fixed(body.tilt, 2)}°`],
        ['Size', `${A.formatKm(2 * body.radiusKm)} across · ${fixed(body.radiusKm / 6371, 2)}× Earth`],
        ['Mass', id === 'earth' ? '5.97 × 10²⁴ kg' : `${fixed(body.massEarths, body.massEarths < 0.01 ? 4 : body.massEarths < 10 ? 3 : 1)}× Earth`],
        ['Moons', `${body.moons}`],
        ['Temperature', `${body.tempC < 0 ? '−' : ''}${Math.abs(body.tempC)} °C on average`],
        ['Orbit', `${q.toFixed(2)}–${Q.toFixed(2)} AU · e ${orbit.e.toFixed(3)} · i ${A.inclinationDeg(orbit).toFixed(1)}°`],
    );
    const lines = [
        `${distance(r)} from the Sun; sunlight takes ${lightTime(r)} to arrive.`,
        sunlightView ? `Sunlight here: ${sunlight(r)}.`
            : id === 'earth' ? `Orbiting the Sun at ${v.toFixed(1)} km/s right now.`
                : `${distance(d)} from Earth; a radio signal takes ${lightTime(d)} each way.`,
    ];
    return {title: body.name, subtitle: subtitle(id), lines, stats, notes: body.facts};
}

const EVENT_VERBS = {launch: 'Launch', flyby: 'Gravity assist', arrive: 'Arrival', end: 'Mission end', point: '', note: ''};

// "Gravity assist · Jupiter", "Arrival at Saturn", "Pale Blue Dot"
export function eventTitle(ev) {
    const where = ev.at ? (ev.at === '67p' ? 'comet 67P' : BODY[ev.at]?.name) : null;
    return ev.title ?? [EVENT_VERBS[ev.kind], where].filter(Boolean).join(ev.kind === 'flyby' ? ' · ' : ' at ');
}

// Card for a mission event.
export function eventCard(ev) {
    const m = ev.mission;
    const date = ev.planned ? `${A.formatMonth(ev.t)} (planned)` : A.formatDate(ev.t);
    return {title: m.short ?? m.name, subtitle: `${eventTitle(ev)} · ${date}`, lines: [ev.note]};
}

// A pinned mission card: live status, stats and its timeline of events (at
// most `maxEvents`, centered on the next one).
// {title, subtitle, lines[], stats[[label, value]], events[{ev, text, past}]}
export function missionDetails(tr, t, {maxEvents = 8} = {}) {
    const m = tr.mission;
    const p = tr.position(t);
    const stats = [['Agency', m.agency], ['Launched', A.formatDate(tr.launch)]];
    const lines = [];
    if (t < tr.launch) {
        lines.push(`Launches ${A.formatDate(tr.launch)}, ${A.formatDuration((tr.launch - t) * A.DAY_S)} from the date on screen.`);
    } else if (!p) {
        lines.push(`Mission ended ${A.formatDate(Math.min(t, tr.end))}.`);
        stats.push(['Ended', A.formatDate(tr.end)]);
    } else {
        const r = A.norm(p);
        const d = A.norm(A.sub(p, A.planetPosition('earth', t)));
        lines.push(missionStatus(tr, t));
        lines.push(`${distance(d)} from Earth; radio takes ${lightTime(d)} each way.`);
        stats.push(
            ['Mission time', A.formatDuration((t - tr.launch) * A.DAY_S)],
            ['From the Sun', `${r.toFixed(r < 10 ? 3 : 1)} AU`],
            ['From Earth', `${d.toFixed(d < 10 ? 3 : 1)} AU · radio ${lightTime(d)}`],
            ['Speed', `${tr.speedKmS(t).toFixed(1)} km/s from the Sun`],
            ['Sunlight', sunlight(r)],
        );
    }
    const all = tr.events.filter(ev => ev.kind !== 'point' || ev.title);
    let next = all.findIndex(ev => ev.t > t);
    if (next < 0)
        next = all.length;
    const from = Math.max(0, Math.min(all.length - maxEvents, next - Math.ceil(maxEvents / 2)));
    const events = all.slice(from, from + maxEvents).map(ev => ({
        ev, past: ev.t <= t, text: `${A.formatMonth(ev.t)}   ${eventTitle(ev)}`,
    }));
    return {title: m.name, subtitle: `${m.agency} · launched ${A.formatDate(tr.launch)}`, lines, stats, events};
}

// One-line status for the mission list.
export function missionStatus(tr, t) {
    const m = tr.mission;
    if (t < tr.launch)
        return null;
    const seg = tr.segmentAt(t);
    if (!seg)
        return null;
    const p = seg.pos(t);
    const r = A.norm(p);
    if (seg.kind === 'stay') {
        const where = seg.body === '67p' ? 'comet 67P' : BODY[seg.body].name;
        return `Orbiting ${where}`;
    }
    const speed = tr.speedKmS(t).toFixed(1);
    if (m.silentAfter && t > A.jd(m.silentAfter))
        return `Silent since ${m.silentAfter.slice(0, 4)} · ${r.toFixed(0)} AU`;
    if (seg.kind === 'escape')
        return `Interstellar · ${r.toFixed(r < 100 ? 1 : 0)} AU · ${speed} km/s`;
    const next = tr.nextTarget(t);
    if (next?.at) {
        const name = next.at === '67p' ? '67P' : BODY[next.at].name;
        return `→ ${name} ${A.formatMonth(next.t)} · ${r.toFixed(2)} AU · ${speed} km/s`;
    }
    return `${r.toFixed(r < 10 ? 2 : 1)} AU from the Sun · ${speed} km/s`;
}

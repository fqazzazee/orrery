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
        return {
            title: body.name,
            subtitle: body.dwarf ? 'Dwarf planet' : `Planet ${['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].indexOf(id) + 1} from the Sun`,
            lines: [...numeric, this._nextTrivia(id)],
        };
    }
}

const EVENT_VERBS = {launch: 'Launch', flyby: 'Gravity assist', arrive: 'Arrival', end: 'Mission end', point: '', note: ''};

// Card for a mission event.
export function eventCard(ev) {
    const m = ev.mission;
    const where = ev.at ? (ev.at === '67p' ? 'comet 67P' : BODY[ev.at]?.name) : null;
    const what = ev.title ?? [EVENT_VERBS[ev.kind], where].filter(Boolean).join(ev.kind === 'flyby' ? ' · ' : ' at ');
    const date = ev.planned ? `${A.formatMonth(ev.t)} (planned)` : A.formatDate(ev.t);
    return {title: m.short ?? m.name, subtitle: `${what} · ${date}`, lines: [ev.note]};
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

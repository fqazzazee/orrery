// Text for the cards. Numbers are worked out live from the simulated
// positions, so they are right for the date on screen.
//
// A card's content: {title, subtitle, lines[], stats[[label, value]],
// sections[{title, stats[], notes[], links[{text, subject, dim}]}],
// events[{ev, text, past}]}. `lines` is the short view; the rest shows when
// the card is expanded. A link's subject is {id} for a place or {mission}
// for a spacecraft.

import * as Astro from './astro.js';
import {BODY, GM, LPOINT, MOON, SMALL, SPEEDS, moonsOf, placeName} from './bodies.js';
import {MISSIONS} from './missions.js';
import {SAT, orbitOf} from './satellites.js';

function lightTime(au) {
    return Astro.formatDuration(au * Astro.AU_KM / Astro.C_KM_S);
}

function distance(au) {
    return au < 0.1 ? `${Astro.formatKm(au * Astro.AU_KM)}` : `${au.toFixed(au < 10 ? 2 : 1)} AU (${Astro.formatKm(au * Astro.AU_KM)})`;
}

// "589 W/m², 0.43× Earth's"
function sunlight(r) {
    const e = Astro.irradiance(r);
    return `${Astro.formatIrradiance(e)}, ${Astro.formatRatio(e / Astro.SOLAR_CONSTANT)} Earth’s`;
}

function dayLength(hours) {
    const h = Math.abs(hours);
    return h < 48 ? Astro.formatDuration(h * 3600) : `${(h / 24).toFixed(h < 240 ? 1 : 0)} Earth days`;
}

const fixed = (x, digits) => (+x.toFixed(digits)).toLocaleString('en-US', {maximumFractionDigits: digits});
const celsius = c => `${c < 0 ? '−' : ''}${Math.abs(c).toLocaleString('en-US')} °C`;
const yearText = days => days < 1000 ? `${Math.round(days)} days` : `${fixed(days / 365.25, days < 3650 ? 1 : 0)} Earth years`;
const shuffle = arr => arr.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

// "3 Nov 2027", or "Nov 2027" / "2027" when only that much is known.
export function eventDate(ev, short = false) {
    const len = ev.date?.length ?? 10;
    if (len === 4)
        return ev.date;
    return len === 7 || short ? Astro.formatMonth(ev.t) : Astro.formatDate(ev.t);
}

const planned = ev => ev.planned || ev.t > Astro.jdNow();

// Size next to Earth, or to the Moon for small worlds.
function sizeText(radiusKm) {
    const across = Astro.formatKm(2 * radiusKm);
    if (radiusKm >= 3000)
        return `${across} across · ${fixed(radiusKm / 6371, 2)}× Earth`;
    if (radiusKm >= 100)
        return `${across} across · ${fixed(radiusKm / 1737.4, 2)}× the Moon`;
    return radiusKm >= 0.5 ? `${across} across` : `About ${Math.round(2000 * radiusKm).toLocaleString('en-US')} m across`;
}

function massText(m) {
    if (m >= 1000)
        return `${Astro.formatCount(m)} Earths`;
    if (m >= 0.01)
        return `${fixed(m, m < 10 ? 3 : 1)}× Earth`;
    const kg = m * 5.972e24;
    const exp = Math.floor(Math.log10(kg));
    const sup = String(exp).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('');
    return `${(kg / 10 ** exp).toFixed(2)} × 10${sup} kg`;
}

// "Evening sky, 32° east of the Sun" and friends.
function skyText(p, earth) {
    const el = Astro.elongationDeg(p, earth);
    const a = Math.abs(el);
    if (a < 8)
        return `Lost in the Sun’s glare, ${Math.round(a)}° from it`;
    if (a > 172)
        return 'Opposite the Sun: up all night';
    return `${el > 0 ? 'Evening' : 'Morning'} sky, ${Math.round(a)}° ${el > 0 ? 'east' : 'west'} of the Sun`;
}

function angularSize(rKm, dAu) {
    const as = Astro.angularDiameterArcsec(rKm, dAu);
    return as >= 120 ? `${fixed(as / 60, 1)}′ wide` : `${fixed(as, as < 10 ? 1 : 0)}″ wide`;
}

// Opposition / conjunction dates move slowly; work them out once a day.
const alignCache = new Map();
function nextAlignment(id, t) {
    const key = `${id}:${Math.floor(t)}`;
    if (!alignCache.has(key)) {
        if (alignCache.size > 64)
            alignCache.clear();
        alignCache.set(key, Astro.nextAlignment(id, t));
    }
    return alignCache.get(key);
}

export function clearCache() {
    alignCache.clear();
}

// Where the Sun stands overhead, and the season that makes.
function seasonText(id, pole, t) {
    const lat = Astro.subsolarLatitudeDeg(pole, Astro.planetPosition(id, t));
    const later = Astro.subsolarLatitudeDeg(pole, Astro.planetPosition(id, t + Astro.orbitPeriod(Astro.planetOrbit(id, t)) / 40));
    const rising = later > lat;
    const hemi = lat >= 0 ? 'N' : 'S';
    let season;
    if (Math.abs(lat) < 1.5)
        season = rising ? 'northern spring equinox' : 'northern autumn equinox';
    else if (lat > 0)
        season = rising ? 'northern spring' : 'northern summer';
    else
        season = rising ? 'northern winter' : 'northern autumn';
    return `Sun overhead at ${fixed(Math.abs(lat), 1)}°${hemi}: ${season}`;
}

const MOON_PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
function moonPhaseText(t) {
    const {age, lit} = Astro.moonPhase(t);
    const name = MOON_PHASES[Math.round(age * 8) % 8];
    return `${name}, ${Math.round(lit * 100)}% lit`;
}

// Weight of a 70 kg person.
const weightText = g => `${fixed(g, g < 1 ? 2 : 1)} m/s² · 70 kg feels like ${fixed(70 * g / 9.81, g < 1 ? 1 : 0)} kg`;

// Missions that went to (or will go to) a place, as links.
function missionLinks(id) {
    return MISSIONS.filter(m => m.events.some(ev => ev.at === id && ev.kind !== 'launch'))
        .map(m => {
            const first = m.events.find(ev => ev.at === id && ev.kind !== 'launch');
            return {text: `${m.short ?? m.name} · ${first.date.slice(0, 4)}`, subject: {mission: m.id}};
        });
}

// "Car 1,234 years · Airliner 150 years · ..."
const TRIPS = [['Car', 100 / 3600], ['Airliner', 900 / 3600], ['Voyager 1', 17], ['Parker', 192]];
const gettingThere = dAu => TRIPS.map(([name, kms]) => `${name} ${Astro.formatDuration(dAu * Astro.AU_KM / kms)}`).join(' · ');

function subtitle(id) {
    if (id === 'sun')
        return 'G-type star · 4.6 billion years old';
    const body = BODY[id];
    if (body.asteroid)
        return 'Asteroid · a protoplanet';
    if (body.dwarf)
        return id === 'ceres' ? 'Dwarf planet · in the asteroid belt' : 'Dwarf planet · in the Kuiper belt';
    return `Planet ${ORDER.indexOf(id) + 1} from the Sun`;
}

const ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// ---- Rotating fact cards ----

export class FactDeck {
    constructor() {
        this._trivia = {};
    }

    // Next trivia line for anything with facts, cycling in a shuffled order.
    _nextTrivia(id, facts) {
        let deck = this._trivia[id];
        if (!deck?.length)
            deck = this._trivia[id] = shuffle(facts);
        return deck.pop();
    }

    // {title, subtitle, lines[]}
    card(id, t) {
        const d = details(id, t);
        const facts = (BODY[id] ?? MOON[id] ?? SMALL[id] ?? LPOINT[id])?.facts ?? [];
        // Two live lines (shuffled for planets), then a piece of trivia.
        const live = BODY[id] && id !== 'sun' ? shuffle(planetLines(id, t)).slice(0, 2) : d.lines.slice(0, 2);
        return {title: d.title, subtitle: d.subtitle, lines: [...live, facts.length ? this._nextTrivia(id, facts) : null]};
    }
}

// Live, numeric lines about a planet at time t.
function planetLines(id, t) {
    const body = BODY[id];
    const orbit = Astro.planetOrbit(id, t);
    const p = Astro.orbitPosition(orbit, t);
    const r = Astro.norm(p);
    const v = Astro.visVivaKmS(r, orbit.a);
    const vPeri = Astro.visVivaKmS(Astro.perihelion(orbit), orbit.a);
    const vAph = Astro.visVivaKmS(Astro.aphelion(orbit), orbit.a);
    const out = [
        `Orbiting the Sun at ${v.toFixed(1)} km/s right now (${vAph.toFixed(1)}–${vPeri.toFixed(1)} over its year).`,
        `${distance(r)} from the Sun; sunlight takes ${lightTime(r)} to arrive.`,
    ];
    const [eLow, eHigh] = [Astro.irradiance(Astro.aphelion(orbit)), Astro.irradiance(Astro.perihelion(orbit))];
    out.push(`Sunlight here: ${sunlight(r)}${eHigh / eLow > 1.15 ? `, swinging ${Math.round((eHigh / eLow - 1) * 100)}% over its year` : ''}.`);
    out.push(`A year lasts ${yearText(Astro.orbitPeriod(orbit))}; one spin takes ${dayLength(body.rotationHours)}${body.rotationHours < 0 ? ', backwards' : ''}.`);
    if (id === 'earth') {
        out.push(`The Moon tonight: ${moonPhaseText(t).toLowerCase()}.`);
    } else {
        const earth = Astro.planetPosition('earth', t);
        const d = Astro.norm(Astro.sub(p, earth));
        out.push(`${distance(d)} from Earth; a radio signal takes ${lightTime(d)} each way.`);
        const [label, kms] = SPEEDS[1 + Math.floor(Math.random() * (SPEEDS.length - 1))];
        out.push(`Getting there ${label} would take ${Astro.formatDuration(d * Astro.AU_KM / kms)}.`);
        if (id !== 'sun')
            out.push(`In Earth’s sky: ${skyText(p, earth).toLowerCase()}.`);
    }
    return out;
}

// ---- Full cards ----

// Card content for any place id.
export function details(id, t, opts = {}) {
    if (BODY[id])
        return bodyDetails(id, t, opts);
    if (MOON[id])
        return moonDetails(id, t);
    if (SMALL[id])
        return smallBodyDetails(id, t);
    if (SAT[id])
        return satelliteDetails(id, t);
    return lagrangeDetails(id, t, opts);
}

// A satellite, station or constellation around a planet, or a landing site.
export function satelliteDetails(id, t) {
    const s = SAT[id];
    const host = BODY[s.planet];
    const from = Astro.jd(s.from), to = s.to ? Astro.jd(s.to) : Infinity;
    const when = t < from ? `From ${Astro.formatDate(from)}` : t > to ? `${Astro.formatDate(from)} to ${Astro.formatDate(to)}` : `Since ${Astro.formatDate(from)}`;
    const sections = [{title: 'Its planet', links: [{text: host.name, subject: {id: s.planet}}]}, {title: 'Did you know', notes: s.facts}];
    if (s.lander) {
        const lat = `${fixed(Math.abs(s.lat), 1)}°${s.lat >= 0 ? 'N' : 'S'}`;
        const lon = `${fixed(s.lon, 1)}°E`;
        return {
            title: s.name, subtitle: `Landing site on ${host.name} · ${s.agency}`,
            lines: [`Landed ${Astro.formatDate(from)}, at ${lat} ${lon}.`, s.facts[0]],
            stats: [['Landed', Astro.formatDate(from)], ['Where', `${lat}, ${lon}`], ['Agency', s.agency]],
            sections,
        };
    }
    const o = orbitOf(s.orbit, s.planet);
    const period = Astro.satellitePeriodS(o.a, GM[s.planet]);
    const height = s.orbit.alt !== undefined ? `${Astro.formatKm(s.orbit.alt)} up` : `${Astro.formatKm(s.orbit.peri)} to ${Astro.formatKm(s.orbit.apo)} up`;
    const stats = [
        ['Orbit', height],
        ['One lap', Astro.formatDuration(period)],
        ['Speed', `${Math.sqrt(GM[s.planet] / o.a).toFixed(1)} km/s on average`],
        ['Tilt', `${fixed(o.i, 1)}° to ${host.name}’s equator${o.i > 80 && o.i < 100 ? ', over the poles' : ''}`],
        ['In orbit', s.to ? `${Astro.formatDate(from)} to ${Astro.formatDate(to)}` : `Since ${Astro.formatDate(from)}`],
        ['Agency', s.agency],
    ];
    if (s.planes)
        stats.push(['Shown', `${s.planes * s.perPlane} of them, ${s.planes > 1 ? `in ${s.planes} orbits` : 'around the ring'}`]);
    return {
        title: s.name, subtitle: `${s.kind} · ${host.name}`,
        lines: [`${height}; once around every ${Astro.formatDuration(period)}.`, `${when}.`],
        stats, sections,
    };
}

function sunDetails(t) {
    const body = BODY.sun;
    const earth = Astro.planetPosition('earth', t);
    const nep = Astro.norm(Astro.planetPosition('neptune', t));
    return {
        title: 'The Sun', subtitle: subtitle('sun'),
        lines: [
            `Puts out 3.8 × 10²⁶ W. At Earth that is ${Astro.formatIrradiance(Astro.SOLAR_CONSTANT)}; at Neptune, ${Astro.formatIrradiance(Astro.irradiance(nep))}.`,
            `Its light reaches Earth in ${lightTime(Astro.norm(earth))} and Neptune in ${lightTime(nep)}.`,
        ],
        stats: [
            ['From Earth', `${distance(Astro.norm(earth))} · light ${lightTime(Astro.norm(earth))}`],
            ['Sunlight at Earth', `${Astro.formatIrradiance(Astro.irradiance(Astro.norm(earth)))} today`],
            ['Light to Neptune', lightTime(nep)],
            ['Seen from Earth', angularSize(body.radiusKm, Astro.norm(earth))],
        ],
        sections: [
            {title: 'The star', stats: body.profile},
            {
                title: 'Size and strength', stats: [
                    ['Size', `${Astro.formatKm(2 * body.radiusKm)} across · 109× Earth`],
                    ['Mass', `${Astro.formatCount(body.massEarths)} Earths`],
                    ['Gravity', weightText(body.gravity)],
                    ['Escape speed', `${body.escape} km/s`],
                    ['Density', `${body.density} g/cm³`],
                    ['Surface', celsius(body.tempC)],
                    ['Spin', '25 days at the equator, 35 near the poles'],
                ],
            },
            {title: 'Explored by', notes: [body.visited], links: ['parker', 'solarorbiter', 'ulysses', 'soho', 'aditya'].map(mid => ({text: MISSIONS.find(m => m.id === mid).name, subject: {mission: mid}}))},
            {title: 'Did you know', notes: body.facts},
        ],
    };
}

// Everything about the Sun, a planet, Ceres or Vesta at time t.
export function bodyDetails(id, t, {sunlightView = false} = {}) {
    if (id === 'sun')
        return sunDetails(t);
    const body = BODY[id];
    const earth = Astro.planetPosition('earth', t);
    const orbit = Astro.planetOrbit(id, t);
    const p = Astro.orbitPosition(orbit, t);
    const r = Astro.norm(p);
    const [q, Q] = [Astro.perihelion(orbit), Astro.aphelion(orbit)];
    const v = Astro.visVivaKmS(r, orbit.a);
    const period = Astro.orbitPeriod(orbit);
    const d = Astro.norm(Astro.sub(p, earth));
    const pole = Astro.equatorialToEcliptic(...body.pole);

    const stats = [['From the Sun', `${r.toFixed(r < 10 ? 3 : 2)} AU · light ${lightTime(r)}`]];
    if (id !== 'earth') {
        stats.push(
            ['From Earth', `${d.toFixed(d < 10 ? 3 : 2)} AU · radio ${lightTime(d)}`],
            ['Getting there', gettingThere(d)],
            ['In our sky', skyText(p, earth)],
            ['Looks', `${angularSize(body.radiusKm, d)} through a telescope`],
        );
        const next = nextAlignment(id, t);
        if (next)
            stats.push([r < 1 ? 'Next passes the Sun' : 'Next opposition', `${Astro.formatDate(next)}, in ${Astro.formatDuration((next - t) * Astro.DAY_S)}`]);
    } else {
        stats.push(['The Moon', moonPhaseText(t)]);
        const toPeri = ((Astro.jd('2026-01-03') - t) % 365.2596 + 365.2596) % 365.2596;
        stats.push(['Perihelion', toPeri < 1 ? 'Today' : `In ${Math.round(toPeri)} days (early January)`]);
    }
    stats.push(['Sunlight', sunlight(r)]);
    if (body.tilt > 3 && body.tilt < 177)
        stats.push(['Season', seasonText(id, pole, t)]);
    if (id === 'saturn') {
        const b = Math.asin(Math.abs(Astro.dot(pole, Astro.unit(Astro.sub(earth, p))))) * 180 / Math.PI;
        stats.push(['Rings from Earth', b < 1.5 ? 'Edge-on: almost invisible' : `Tipped ${fixed(b, 1)}° toward us`]);
    }

    const world = [
        ['Size', sizeText(body.radiusKm)],
        ['Mass', id === 'earth' ? '5.97 × 10²⁴ kg' : massText(body.massEarths)],
        ['Density', `${body.density} g/cm³${body.density < 1 ? ', less than water' : ''}`],
        ['Gravity', weightText(body.gravity)],
        ['Escape speed', `${body.escape} km/s`],
        ['Day', `${dayLength(body.rotationHours)}${body.rotationHours < 0 ? ', spinning backwards' : ''}`],
        ['Axial tilt', `${fixed(body.tilt, 2)}°`],
        ['Temperature', body.tempRange ? `${celsius(body.tempC)} on average, ${celsius(body.tempRange[0])} to ${celsius(body.tempRange[1])}` : `${celsius(body.tempC)} at the cloud tops`],
    ];
    if (body.air)
        world.push(['Air', body.air]);
    if (body.pressure)
        world.push(['Pressure', body.pressure]);
    if (body.magnetic)
        world.push(['Magnetism', body.magnetic]);
    if (body.interior)
        world.push(['Inside', body.interior]);
    if (body.ringsText)
        world.push(['Rings', body.ringsText]);

    const moons = moonsOf(id);
    const sections = [
        {
            title: 'Orbit', stats: [
                ['Year', yearText(period)],
                ['Distance', `${q.toFixed(2)}–${Q.toFixed(2)} AU from the Sun`],
                ['Speed', `${v.toFixed(1)} km/s now · ${Astro.visVivaKmS(Q, orbit.a).toFixed(1)}–${Astro.visVivaKmS(q, orbit.a).toFixed(1)} over a year`],
                ['Sunlight', `${Astro.formatIrradiance(Astro.irradiance(Q))} to ${Astro.formatIrradiance(Astro.irradiance(q))}`],
                ['Shape', `Eccentricity ${orbit.e.toFixed(3)} · tilted ${Astro.inclinationDeg(orbit).toFixed(1)}° to Earth’s`],
            ],
        },
        {title: 'The world', stats: world},
    ];
    if (body.moons) {
        sections.push({
            title: `Moons · ${body.moons}`,
            notes: moons.length < body.moons ? [`The ${moons.length === 1 ? 'one' : `${moons.length} biggest`} on screen:`] : [],
            links: moons.map(m => ({text: `${m.name} · ${sizeText(m.radiusKm).split(' ·')[0]}`, subject: {id: m.id}})),
        });
    }
    sections.push({
        title: 'Story',
        stats: [['Named for', body.named], ['Found', body.discovered], ['Visited by', body.visited]],
        links: missionLinks(id),
    });
    sections.push({title: 'Did you know', notes: body.facts});

    const lines = [
        `${distance(r)} from the Sun; sunlight takes ${lightTime(r)} to arrive.`,
        sunlightView ? `Sunlight here: ${sunlight(r)}.`
            : id === 'earth' ? `Orbiting the Sun at ${v.toFixed(1)} km/s right now.`
                : `${distance(d)} from Earth; a radio signal takes ${lightTime(d)} each way.`,
    ];
    return {title: body.name, subtitle: subtitle(id), lines, stats, sections, zoomable: true};
}

// A moon, on the date shown.
export function moonDetails(id, t) {
    const m = MOON[id];
    const host = BODY[m.parent];
    const p = Astro.planetPosition(m.parent, t);
    const earth = Astro.planetPosition('earth', t);
    const d = Astro.norm(Astro.sub(p, earth));
    const days = Math.abs(m.period);
    const orbitText = `${Astro.formatKm(m.a)} from ${host.name} · ${days < 2 ? Astro.formatDuration(days * Astro.DAY_S) : `${fixed(days, 1)} days`} a lap${m.period < 0 ? ', backwards' : ''}`;
    const stats = [['Orbit', orbitText], ['Size', sizeText(m.radiusKm)]];
    if (id === 'moon') {
        stats.unshift(['Tonight', moonPhaseText(t)]);
        stats.push(['Gravity', weightText(m.gravity)], ['Temperature', `${celsius(m.tempRange[0])} to ${celsius(m.tempRange[1])}`],
            ['Light from Earth', '1.3 s']);
    } else {
        stats.push(['From Earth', `${distance(d)} · radio ${lightTime(d)}`], ['Sunlight', sunlight(Astro.norm(p))]);
    }
    const r = m.radiusKm;
    const lines = [
        id === 'moon' ? `${moonPhaseText(t)} tonight. It circles Earth every 27.3 days, 384,400 km away.` : `Circles ${host.name} every ${orbitText.split(' · ')[1].replace(' a lap', '')}, ${Astro.formatKm(m.a)} out.`,
        r >= 1000 ? `${Astro.formatKm(2 * r)} across: ${r > 2440 ? 'bigger than Mercury' : r > 1737 ? 'bigger than our Moon' : `${fixed(r / 1737.4, 2)}× our Moon`}.` : `${sizeText(r)}.`,
    ];
    return {
        title: m.name, subtitle: id === 'moon' ? 'Earth’s moon' : `Moon of ${host.name}`, lines, stats,
        sections: [
            {title: 'Its planet', links: [{text: host.name, subject: {id: m.parent}}]},
            {title: 'Did you know', notes: m.facts},
        ],
    };
}

// A comet or asteroid.
export function smallBodyDetails(id, t) {
    const s = SMALL[id];
    const orbit = Astro.planetOrbit(id, t);
    const p = Astro.orbitPosition(orbit, t);
    const earth = Astro.planetPosition('earth', t);
    const r = Astro.norm(p), d = Astro.norm(Astro.sub(p, earth));
    const v = Astro.visVivaKmS(r, orbit.a);
    const stats = [
        ['From the Sun', `${distance(r)} · light ${lightTime(r)}`],
        ['From Earth', `${distance(d)} · radio ${lightTime(d)}`],
        ['Speed', `${v.toFixed(1)} km/s around the Sun`],
        ['Size', sizeText(s.radiusKm)],
    ];
    const orbitStats = [];
    if (orbit.e < 1) {
        const P = Astro.orbitPeriod(orbit);
        orbitStats.push(['Year', yearText(P)], ['Distance', `${Astro.perihelion(orbit).toFixed(2)}–${Astro.aphelion(orbit).toFixed(2)} AU from the Sun`]);
        if (s.comet) {
            // Perihelion passages: the orbit's own, stepped by whole periods.
            const n = Math.sqrt(Astro.MU_SUN / orbit.a ** 3);
            const M = ((orbit.m0 + n * (t - orbit.t0)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            const last = t - M / n, next = last + P;
            orbitStats.push(['Last near the Sun', Astro.formatMonth(last)], ['Next near the Sun', Astro.formatMonth(next)]);
        }
    } else {
        orbitStats.push(['Path', `Hyperbolic: closest to the Sun at ${Astro.perihelion(orbit).toFixed(2)} AU, never to return`],
            ['Speed far away', `${(Math.sqrt(Astro.MU_SUN / -orbit.a) * Astro.AU_KM / Astro.DAY_S).toFixed(1)} km/s`]);
    }
    orbitStats.push(['Shape', `Eccentricity ${orbit.e.toFixed(3)} · tilted ${Astro.inclinationDeg(orbit).toFixed(1)}°${Astro.inclinationDeg(orbit) > 90 ? ', so it goes backwards' : ''}`]);
    const visits = missionLinks(id);
    const sections = [{title: 'Orbit', stats: orbitStats}];
    if (visits.length)
        sections.push({title: 'Visited by', links: visits});
    sections.push({title: 'Did you know', notes: s.facts});
    return {
        title: s.name, subtitle: s.kind,
        lines: [`${distance(r)} from the Sun, moving at ${v.toFixed(1)} km/s.`, `${distance(d)} from Earth; radio takes ${lightTime(d)} each way.`],
        stats, sections,
    };
}

// A Lagrange point; `residents` are the mission ids staying there now and
// before, from the scene.
export function lagrangeDetails(id, t, {residents = {now: [], past: []}} = {}) {
    const l = LPOINT[id];
    const p = Astro.bodyPosition(id, t);
    const earth = Astro.planetPosition('earth', t);
    const d = Astro.norm(Astro.sub(p, earth)), r = Astro.norm(p);
    const stats = [
        ['Where', l.where],
        ['From Earth', `${distance(d)} · radio ${lightTime(d)}`],
        ['From the Sun', distance(r)],
    ];
    const sections = [];
    const link = mid => {
        const m = MISSIONS.find(x => x.id === mid);
        return {text: `${m.short ?? m.name} · ${m.agency}`, subject: {mission: mid}};
    };
    if (residents.now.length)
        sections.push({title: 'There now', links: residents.now.map(link)});
    if (residents.past.length)
        sections.push({title: 'Been there', links: residents.past.map(link).map(x => ({...x, dim: true}))});
    if (id === 'jl4' || id === 'jl5') {
        const targets = id === 'jl4' ? ['eurybates', 'polymele', 'leucus', 'orus'] : ['patroclus'];
        sections.push({title: 'Lucy’s targets here', links: targets.map(x => ({text: SMALL[x].name, subject: {id: x}}))});
    }
    sections.push({title: 'Did you know', notes: l.facts});
    const lines = id.startsWith('j')
        ? [`${l.where}, ${distance(r)} from the Sun.`, 'Thousands of asteroids share Jupiter’s orbit here.']
        : [`${l.where}.`, residents.now.length ? `Here now: ${residents.now.map(x => MISSIONS.find(m => m.id === x).short ?? MISSIONS.find(m => m.id === x).name).join(', ')}.` : l.facts[0]];
    return {title: l.name, subtitle: id.startsWith('j') ? 'Lagrange point of the Sun and Jupiter' : 'Lagrange point of the Sun and Earth', lines, stats, sections};
}

const EVENT_VERBS = {launch: 'Launch', flyby: 'Gravity assist', arrive: 'Arrival', depart: 'Departure', end: 'Mission end', point: '', note: ''};

// "Gravity assist · Jupiter", "Arrival at Saturn", "Pale Blue Dot"
export function eventTitle(ev) {
    const where = ev.at ? placeName(ev.at, true) : null;
    const verb = ev.kind === 'flyby' && !BODY[ev.at] && ev.at ? 'Flyby' : EVENT_VERBS[ev.kind];
    if (ev.kind === 'depart')
        return ev.title ?? `Leaves ${where}`;
    return ev.title ?? [verb, where].filter(Boolean).join(ev.kind === 'flyby' ? ' · ' : ' at ');
}

// Card for a mission event.
export function eventCard(ev) {
    const m = ev.mission;
    const date = planned(ev) ? `${eventDate(ev, true)} (planned)` : eventDate(ev);
    return {title: m.short ?? m.name, subtitle: `${eventTitle(ev)} · ${date}`, lines: [ev.note]};
}

// A pinned mission card: live status, stats, its timeline of events (at
// most `maxEvents`, centered on the next one) and what it is about.
export function missionDetails(tr, t, {maxEvents = 8} = {}) {
    const m = tr.mission;
    const p = tr.position(t);
    const stats = [['Agency', m.agency], [t < tr.launch && planned(tr.events[0]) ? 'Launch' : 'Launched', eventDate(tr.events[0])]];
    const lines = [];
    if (t < tr.launch) {
        lines.push(`Launches ${eventDate(tr.events[0])}, ${Astro.formatDuration((tr.launch - t) * Astro.DAY_S)} from the date on screen.`);
        if (m.about)
            lines.push(m.about);
    } else if (!p) {
        lines.push(`Mission ended ${Astro.formatDate(Math.min(t, tr.end))}.`);
        stats.push(['Ended', Astro.formatDate(tr.end)]);
        if (m.about)
            lines.push(m.about);
    } else {
        const r = Astro.norm(p);
        const d = Astro.norm(Astro.sub(p, Astro.planetPosition('earth', t)));
        lines.push(missionStatus(tr, t));
        lines.push(`${distance(d)} from Earth; radio takes ${lightTime(d)} each way.`);
        stats.push(
            ['Mission time', Astro.formatDuration((t - tr.launch) * Astro.DAY_S)],
            ['From the Sun', `${r.toFixed(r < 10 ? 3 : 1)} AU`],
            ['From Earth', `${d.toFixed(d < 10 ? 3 : 1)} AU · radio ${lightTime(d)}`],
            ['Speed', `${tr.speedKmS(t).toFixed(1)} km/s from the Sun`],
            ['Sunlight', sunlight(r)],
        );
    }
    if (m.mass)
        stats.push(['Mass', m.mass]);
    if (m.power)
        stats.push(['Power', m.power]);
    const all = tr.milestones.filter(ev => ev.kind !== 'point' || ev.title);
    let next = all.findIndex(ev => ev.t > t);
    if (next < 0)
        next = all.length;
    const from = Math.max(0, Math.min(all.length - maxEvents, next - Math.ceil(maxEvents / 2)));
    const events = all.slice(from, from + maxEvents).map(ev => ({
        ev, past: ev.t <= t, text: `${eventDate(ev, true)}${planned(ev) ? '*' : ''}   ${eventTitle(ev)}`,
    }));
    const sections = [];
    const about = [m.about, ...m.facts ?? []].filter(Boolean);
    if (about.length)
        sections.push({title: 'About', notes: about});
    const places = [...new Set(tr.milestones.filter(ev => ev.at && ev.at !== 'earth' && (MOON[ev.at] || SMALL[ev.at] || LPOINT[ev.at] || BODY[ev.at])).map(ev => ev.at))];
    if (places.length)
        sections.push({title: 'Destinations', links: places.map(id => ({text: placeName(id), subject: {id}}))});
    if (events.some(e => planned(e.ev)))
        sections.push({notes: ['* planned']});
    return {title: m.name, subtitle: `${m.agency} · ${t < tr.launch ? 'launches' : 'launched'} ${eventDate(tr.events[0])}`, lines, stats, events, sections};
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
    const r = Astro.norm(p);
    if (seg.kind === 'stay') {
        const where = placeName(seg.body, true);
        return LPOINT[seg.body] ? `At ${where}` : `Orbiting ${where}`;
    }
    const speed = tr.speedKmS(t).toFixed(1);
    if (m.silentAfter && t > Astro.jd(m.silentAfter))
        return `Silent since ${m.silentAfter.slice(0, 4)} · ${r.toFixed(0)} AU`;
    if (seg.kind === 'escape')
        return `Interstellar · ${r.toFixed(r < 100 ? 1 : 0)} AU · ${speed} km/s`;
    if (seg.hop)
        return seg.to?.at === 'earth' ? 'Heading back to Earth' : `On the way to ${placeName(seg.to?.at, true)}`;
    const next = tr.nextTarget(t);
    if (next?.at) {
        return `→ ${placeName(next.at, true)} ${eventDate(next, true)} · ${r.toFixed(2)} AU · ${speed} km/s`;
    }
    return `${r.toFixed(r < 10 ? 2 : 1)} AU from the Sun · ${speed} km/s`;
}

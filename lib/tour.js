// Tours: the planets one after another, and mission stories that follow
// one spacecraft from launch to the end, flying in close at each planet it
// passes. A tour is a plan of steps the scene plays in turn.
//
// A step: {view, seconds, from, to, dps, zoom, pick, title}
//   view     'system', 'far' (zoomed out past the planets) or a planet id
//            for its close-up
//   from     jump to this date first
//   to       play up to this date in `seconds`; without it, the step lasts
//            `seconds` at the view's own pace (or `dps` days a second)
//   zoom     how far out, for 'system' and 'far'
//   pick     a subject to pin a card for
//   title    what the step is, for the caption

import {BODY, GM, LPOINT, placeName} from './bodies.js';
import {eventTitle} from './facts.js';

export const TOUR_PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Days either side of closest approach that a pass is worth watching up
// close: longer at the giants, whose moons spread wide.
const PASS_DAYS = {mercury: 0.35, venus: 0.4, earth: 0.35, mars: 0.4, jupiter: 2.5, saturn: 2, uranus: 1.2, neptune: 1, pluto: 0.5};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Seconds for a cruise of `days`: long ones go faster, but never blink past.
const cruiseSeconds = days => clamp(4 + Math.log10(1 + days) * 3, 5, 14);

export function planetTour() {
    const steps = [];
    TOUR_PLANETS.forEach((id, i) => {
        steps.push({view: 'system', zoom: 0, seconds: 2.5, title: `On to ${BODY[id].name}`});
        steps.push({view: id, seconds: 22, pick: {id}, title: `${BODY[id].name} · ${i + 1} of ${TOUR_PLANETS.length}`});
    });
    steps.push({view: 'system', zoom: 0, seconds: 4, title: 'The whole solar system'});
    return steps;
}

// Is this event worth a close-up: a planet passed, reached or landed on?
function closeUp(tr, ev) {
    if (!ev.at || !BODY[ev.at] || ev.at === 'sun' || !GM[ev.at] || ev.t < tr.launch + 5)
        return null;
    if (ev.kind === 'flyby')
        return 'pass';
    if (ev.kind === 'arrive')
        return 'arrive';
    if (ev.kind === 'end') {
        const before = tr.segmentAt(ev.t - 1e-3);
        return before?.kind === 'stay' ? 'finale' : 'landing';
    }
    return null;
}

export function storyPlan(tr) {
    const steps = tr.lunar ? lunarStory(tr) : planetStory(tr);
    // Every step starts where the one before it ends, so skipping ahead or
    // back lands on the right date.
    let t = steps[0].from;
    for (const s of steps) {
        s.from ??= t;
        t = s.to ?? s.from;
    }
    return steps;
}

function planetStory(tr) {
    const m = tr.mission;
    const steps = [];
    const pick = {tr};
    steps.push({view: 'system', zoom: 0, from: tr.launch - 4, to: tr.launch + 3, seconds: 5, pick, title: 'Launch'});
    let cur = tr.launch + 3;
    // A cruise from cur to `to`, slowing down for the smaller encounters on
    // the way (comets, asteroids, Lagrange points), each with its card.
    const cruise = (to, view = 'system', zoom = 0) => {
        const stops = tr.milestones.filter(ev => ev.t > cur + 6 && ev.t < to - 6 && ev.at && !closeUp(tr, ev) && ev.kind !== 'launch');
        for (const ev of stops) {
            steps.push({view, zoom, to: ev.t - 4, seconds: cruiseSeconds(ev.t - 4 - cur), title: `On the way to ${placeName(ev.at, true)}`});
            steps.push({view, zoom, to: ev.t + 4, seconds: 5, title: eventTitle(ev)});
            cur = ev.t + 4;
        }
        if (to > cur + 0.01) {
            const next = tr.milestones.find(ev => ev.t >= to - 1 && ev.at && ev.kind !== 'launch');
            const here = tr.segmentAt(cur + 0.5);
            let title = next ? `On the way to ${placeName(next.at, true)}` : 'Cruising';
            if (here?.kind === 'stay')
                title = LPOINT[here.body] ? `At ${placeName(here.body, true)}` : `Orbiting ${placeName(here.body, true)}`;
            else if (here?.kind === 'escape' || !next && tr.segments.some(sg => sg.kind === 'escape'))
                title = 'Heading out of the solar system';
            steps.push({view, zoom, to, seconds: cruiseSeconds(to - cur), title});
            cur = to;
        }
    };
    for (const ev of tr.milestones) {
        const kind = closeUp(tr, ev);
        if (!kind)
            continue;
        const w = PASS_DAYS[ev.at] ?? 1;
        const start = kind === 'finale' ? ev.t - 3 * w : ev.t - w;
        cruise(Math.max(cur, start));
        const to = kind === 'pass' ? ev.t + w : kind === 'arrive' ? ev.t + 2 * w : ev.t + 0.02;
        steps.push({view: ev.at, from: cur < start ? start : undefined, to, seconds: kind === 'finale' ? 10 : 16, title: eventTitle(ev)});
        cur = to;
    }
    // Then on to the end: out past the planets for those leaving the
    // Sun's family, or to the last event.
    const escape = tr.segments.find(s => s.kind === 'escape');
    const lastAt = [...tr.milestones].reverse().find(ev => ev.kind !== 'note' && ev.kind !== 'via');
    if (escape) {
        cruise(Math.max(cur + 1, Math.min(escape.t0, cur + 3 * 365)));
        const end = Math.max(cur + 365, (lastAt?.t ?? cur) + 365);
        steps.push({view: 'far', zoom: 0.62, to: end, seconds: 16, title: `${m.short ?? m.name} leaves the planets behind`});
        cur = end;
    } else if (isFinite(tr.end)) {
        cruise(tr.end - 0.01);
    } else if (lastAt && lastAt.t > cur) {
        cruise(lastAt.t + 30);
    } else {
        cruise(cur + 365);
    }
    steps.push({view: steps.at(-1).view, zoom: steps.at(-1).zoom, seconds: 5, dps: 0, title: 'The end of the story'});
    return steps;
}

// Moon missions play out in Earth's close-up, phase by phase.
function lunarStory(tr) {
    const steps = [];
    const pick = {tr};
    const titles = {earth: 'Raising its orbit around Earth', out: 'To the Moon', swing: 'Around the far side of the Moon',
        near: 'Near the Moon', orbit: 'Orbiting the Moon', surface: 'On the Moon', back: 'Home to Earth'};
    steps.push({view: 'earth', from: tr.launch - 0.04, to: tr.launch + 0.02, seconds: 3, pick, title: 'Launch'});
    for (const s of tr.segments) {
        const t0 = Math.max(s.t0, tr.launch + 0.02);
        const t1 = Math.min(s.t1, tr.end);
        const title = titles[s.phase];
        if (s.phase === 'out' && s.wait > 0.5) {
            steps.push({view: 'earth', to: s.t0 + s.wait, seconds: clamp(s.wait, 4, 10), title: titles.earth});
            steps.push({view: 'earth', to: t1, seconds: clamp((t1 - s.t0 - s.wait) * 4, 10, 18), title});
        } else if (s.phase === 'out' || s.phase === 'back' || s.phase === 'earth') {
            steps.push({view: 'earth', to: t1, seconds: clamp((t1 - t0) * 4, 8, 18), title});
        } else if (s.phase === 'swing' || s.phase === 'near') {
            steps.push({view: 'earth', to: t1, seconds: clamp((t1 - t0) * 6, 5, 9), title});
        } else if (isFinite(t1) && t1 - t0 <= 3) {
            steps.push({view: 'earth', to: t1, seconds: clamp((t1 - t0) * 4, 4, 10), title});
        } else {
            // Long stays: a day of it, then on to the next thing.
            steps.push({view: 'earth', to: t0 + 1, seconds: 7, title});
            if (isFinite(t1))
                steps.push({view: 'earth', from: t1 - 0.4, to: t1, seconds: 4, title});
        }
    }
    steps.push({view: 'earth', seconds: 5, title: 'The end of the story'});
    return steps;
}

// The first and last dates a plan touches, so the timeline can make room.
export function planSpan(steps, now) {
    let t = now, lo = now, hi = now;
    for (const s of steps) {
        if (s.from !== undefined)
            t = s.from;
        lo = Math.min(lo, t);
        if (s.to !== undefined)
            t = s.to;
        hi = Math.max(hi, t);
    }
    return [lo, hi];
}

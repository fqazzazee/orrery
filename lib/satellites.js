// What circles (or sits on) each planet in the close-up view: space
// stations, telescopes and constellations around Earth, and the landing
// sites of rovers and landers. Spacecraft from the mission list that stay at
// a planet (the Mars and Venus orbiters among them) get an orbit here too.
//
// Orbits: alt (circular) or peri/apo, km above the surface; i inclination to
// the planet's equator and node, degrees. Shapes are typical; where on its
// orbit each one is, is made up.

import {BODY} from './bodies.js';

export const SATELLITES = [
    // ---- Earth ----
    {
        id: 'skylab', name: 'Skylab', agency: 'NASA', planet: 'earth', kind: 'Space station', color: '#e8e0c8',
        from: '1973-05-14', to: '1979-07-11', orbit: {alt: 435, i: 50, node: 30},
        facts: [
            'America’s first space station, built inside a spare Saturn V rocket stage.',
            'Three crews lived aboard; the last stayed 84 days.',
            'It fell over Western Australia in 1979, and the local shire fined NASA $400 for littering.',
        ],
    },
    {
        id: 'mir', name: 'Mir', agency: 'Soviet Union / Russia', planet: 'earth', kind: 'Space station', color: '#e8d0c0',
        from: '1986-02-20', to: '2001-03-23', orbit: {alt: 390, i: 51.6, node: 200},
        facts: [
            'The first station built from modules, joined one by one in orbit over ten years.',
            'Valeri Polyakov stayed 437 days in a row, still the record for one trip.',
            'Brought down into the Pacific in 2001 after 15 years.',
        ],
    },
    {
        id: 'iss', name: 'International Space Station', short: 'ISS', agency: 'NASA, Roscosmos, ESA, JAXA, CSA', planet: 'earth', kind: 'Space station',
        color: '#ffffff', from: '1998-11-20', orbit: {alt: 420, i: 51.64, node: 120},
        facts: [
            'People have lived aboard without a break since 2 November 2000.',
            'About as big as a football field; it circles Earth every 93 minutes, so crews see 16 sunrises a day.',
            'Easy to see from the ground: a bright, steady light that crosses the sky in a few minutes.',
            'Due to be steered into the Pacific around 2030.',
        ],
    },
    {
        id: 'hubble', name: 'Hubble Space Telescope', short: 'Hubble', agency: 'NASA/ESA', planet: 'earth', kind: 'Space telescope', color: '#c8d8ff',
        from: '1990-04-24', orbit: {alt: 525, i: 28.5, node: 300},
        facts: [
            'Its mirror was ground slightly wrong; astronauts fitted corrective optics in 1993.',
            'Five Space Shuttle crews came to repair and upgrade it.',
            'It helped show that the universe’s expansion is speeding up.',
            'Its orbit is slowly sinking; without a boost it will fall back in the 2030s.',
        ],
    },
    {
        id: 'tiangong', name: 'Tiangong', agency: 'CMSA', planet: 'earth', kind: 'Space station', color: '#ffd0c0',
        from: '2021-04-29', orbit: {alt: 390, i: 41.5, node: 60},
        facts: [
            'China’s space station: three modules shaped like a T.',
            'Crews of three take turns living aboard, about six months at a time.',
            'Its name means “Heavenly Palace”.',
        ],
    },
    {
        id: 'gps', name: 'GPS', agency: 'US Space Force', planet: 'earth', kind: 'Navigation constellation', color: '#9fe0a8',
        from: '1978-02-22', orbit: {alt: 20180, i: 55}, planes: 6, perPlane: 4,
        facts: [
            'Each satellite carries atomic clocks; a receiver works out where it is from how long their signals take to arrive.',
            'Their clocks would gain 38 microseconds a day because of relativity, so they are tuned to run slow.',
            'About 31 are in service, in six orbits 20,200 km up, each lap taking 12 hours.',
            'Europe’s Galileo, Russia’s GLONASS and China’s BeiDou work the same way.',
        ],
    },
    {
        id: 'geo', name: 'Geostationary belt', agency: 'Many countries', planet: 'earth', kind: 'Ring of satellites', color: '#ffe0a0',
        from: '1964-08-19', orbit: {alt: 35786, i: 0}, planes: 1, perPlane: 40,
        facts: [
            'At 35,786 km up a satellite circles once a day, so it seems to hang still over one spot.',
            'Arthur C. Clarke described the idea in 1945.',
            'Weather, TV and communication satellites crowd the ring; the first was Syncom 3, in 1964.',
            'Old ones are pushed 300 km higher to a “graveyard orbit” to make room.',
        ],
    },
    {
        id: 'starlink', name: 'Starlink', agency: 'SpaceX', planet: 'earth', kind: 'Internet constellation', color: '#b8c4ff',
        from: '2019-05-24', orbit: {alt: 550, i: 53}, planes: 12, perPlane: 10,
        facts: [
            'Thousands of satellites, more than half of all working satellites in orbit.',
            'Each one laps Earth in about 95 minutes, 550 km up.',
            'Fresh launches are seen as a “train” of lights crossing the evening sky.',
            'Astronomers worry about the streaks they leave in telescope images.',
        ],
    },

    // ---- Mercury ----
    {
        id: 'mio', name: 'Mio', agency: 'JAXA', planet: 'mercury', kind: 'Orbiter', color: '#ffb8d8',
        from: '2026-12-10', orbit: {peri: 590, apo: 11640, i: 90, node: 30},
        facts: ['Japan’s half of BepiColombo, studying Mercury’s magnetic field and the space around it.', 'Separates from the European orbiter in December 2026.'],
    },
];

// Landing sites. lat and lon in degrees (lon east).
export const LANDERS = [
    {id: 'venera7', name: 'Venera 7', agency: 'Soviet Union', planet: 'venus', from: '1970-12-15', lat: -5, lon: 351,
        facts: ['The first spacecraft to send data from the surface of another planet: 23 minutes before the heat silenced it.']},
    {id: 'venera9', name: 'Venera 9', agency: 'Soviet Union', planet: 'venus', from: '1975-10-22', lat: 31, lon: 291.6,
        facts: ['Took the first pictures from the surface of another planet, of flat rocks under a dim orange sky.']},
    {id: 'venera13', name: 'Venera 13', agency: 'Soviet Union', planet: 'venus', from: '1982-03-01', lat: -7.5, lon: 303,
        facts: ['Took the first color pictures of Venus’s surface and lasted 127 minutes, at 457 °C and 89 times Earth’s air pressure.']},
    {id: 'viking1', name: 'Viking 1', agency: 'NASA', planet: 'mars', from: '1976-07-20', lat: 22.27, lon: 312.05,
        facts: ['NASA’s first Mars landing; it worked for over six years.', 'Its experiments looked for signs of life in the soil; the results are still argued over.']},
    {id: 'viking2', name: 'Viking 2', agency: 'NASA', planet: 'mars', from: '1976-09-03', lat: 47.64, lon: 134.29,
        facts: ['Photographed frost on the ground in the Martian winter.']},
    {id: 'pathfinder', name: 'Mars Pathfinder', agency: 'NASA', planet: 'mars', from: '1997-07-04', lat: 19.13, lon: 326.78,
        facts: ['Bounced down inside airbags and released Sojourner, the first rover on another planet.']},
    {id: 'spirit', name: 'Spirit', agency: 'NASA', planet: 'mars', from: '2004-01-04', lat: -14.57, lon: 175.47,
        facts: ['Planned for 90 days, it worked for six years until it got stuck in soft sand.']},
    {id: 'opportunity', name: 'Opportunity', agency: 'NASA', planet: 'mars', from: '2004-01-25', lat: -1.95, lon: 354.47,
        facts: ['Planned for 90 days, it drove for 14 years and 45 km before a dust storm ended it in 2018.']},
    {id: 'phoenix', name: 'Phoenix', agency: 'NASA', planet: 'mars', from: '2008-05-25', lat: 68.22, lon: 234.25,
        facts: ['Dug up water ice near the north pole and watched snow fall from the clouds.']},
    {id: 'curiosity', name: 'Curiosity', agency: 'NASA', planet: 'mars', from: '2012-08-06', lat: -4.59, lon: 137.44,
        facts: ['Lowered by a rocket “sky crane”, it found that Gale crater once held a lake fit for life.', 'Still climbing Mount Sharp.']},
    {id: 'insight', name: 'InSight', agency: 'NASA', planet: 'mars', from: '2018-11-26', lat: 4.5, lon: 135.62,
        facts: ['Its seismometer recorded over 1,300 marsquakes and measured the planet’s core.']},
    {id: 'perseverance', name: 'Perseverance', agency: 'NASA', planet: 'mars', from: '2021-02-18', lat: 18.44, lon: 77.45,
        facts: ['Collecting rock cores in Jezero crater, an old river delta, for a future trip to Earth.', 'It brought Ingenuity, the first helicopter to fly on another world.']},
    {id: 'zhurong', name: 'Zhurong', agency: 'CNSA', planet: 'mars', from: '2021-05-14', lat: 25.07, lon: 109.93,
        facts: ['China’s first Mars rover, named after a god of fire.']},
];

// Orbits for spacecraft from the mission list while they stay at a planet
// (keyed by mission id, or mission:planet). follow: circle that moon.
export const MISSION_ORBITS = {
    'mariner9': {peri: 1650, apo: 17900, i: 64.4, node: 40},
    'mgs': {peri: 370, apo: 440, i: 93, node: 160},
    'odyssey': {peri: 370, apo: 440, i: 93.2, node: 280},
    'mex': {peri: 330, apo: 10530, i: 86.3, node: 100},
    'mro': {peri: 255, apo: 320, i: 93, node: 220},
    'maven': {peri: 150, apo: 6200, i: 75, node: 20},
    'tgo': {alt: 400, i: 74, node: 320},
    'hope': {peri: 20000, apo: 43000, i: 25, node: 70},
    'tianwen1': {peri: 265, apo: 12000, i: 87, node: 190},
    'pvo': {peri: 150, apo: 66900, i: 105, node: 50},
    'magellan': {peri: 294, apo: 8450, i: 85.5, node: 150},
    'vex': {peri: 250, apo: 66000, i: 90, node: 250},
    'akatsuki': {peri: 1000, apo: 370000, i: 3, node: 0},
    'viking1': {peri: 1500, apo: 33000, i: 38, node: 130},
    'viking2': {peri: 1500, apo: 33000, i: 75, node: 310},
    'mom': {peri: 420, apo: 76000, i: 150, node: 240},
    'messenger': {peri: 200, apo: 15200, i: 82.5, node: 60},
    'bepicolombo': {peri: 480, apo: 1500, i: 90, node: 120},
    'galileo': {peri: 570000, apo: 7000000, i: 2, node: 40},
    'juno': {peri: 4200, apo: 5800000, i: 90, node: 300},
    'juice': {peri: 800000, apo: 6000000, i: 5, node: 200},
    'europaclipper': {peri: 600000, apo: 6500000, i: 6, node: 100},
    'cassini': {peri: 120000, apo: 3000000, i: 30, node: 80},
    'escapade': {peri: 160, apo: 7000, i: 70, node: 250},
    'mmx': {follow: 'phobos'},
    'dawn:vesta': {alt: 680, i: 90},
    'dawn:ceres': {alt: 4400, i: 90},
};

// {a, e, i, node} (km from the center) for an orbit given as heights above
// a planet's surface.
export function orbitOf(spec, planet) {
    const R = BODY[planet].radiusKm;
    const [peri, apo] = spec.alt !== undefined ? [spec.alt, spec.alt] : [spec.peri, spec.apo];
    const a = R + (peri + apo) / 2;
    return {a, e: (apo - peri) / (2 * R + peri + apo), i: spec.i ?? 0, node: spec.node ?? 0};
}

export const SAT = Object.fromEntries([...SATELLITES, ...LANDERS.map(l => ({...l, kind: 'Landing site', lander: true}))].map(x => [x.id, x]));

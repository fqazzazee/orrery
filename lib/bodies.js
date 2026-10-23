// Physical data (NASA planetary fact sheets, IAU WGCCRE 2015 pole directions)
// and the trivia shown in fact cards.

export const SUN_RADIUS_KM = 695700;

// rotationHours is sidereal; negative means retrograde. pole is the IAU north
// pole as [RA, Dec] in degrees.
export const BODIES = [
    {
        id: 'sun', name: 'Sun', radiusKm: SUN_RADIUS_KM, rotationHours: 609.12,
        pole: [286.13, 63.87], color: '#ffc46b',
        facts: [
            'Holds about 99.8% of all the mass in the solar system.',
            'About 109 Earths would fit across its face.',
            'Its core reaches about 15 million °C.',
            'Spins once every 25 days at its equator, more slowly near the poles.',
        ],
    },
    {
        id: 'mercury', name: 'Mercury', radiusKm: 2439.7, rotationHours: 1407.6,
        pole: [281.01, 61.42], color: '#a9a29a', tilt: 0.03, moons: 0,
        facts: [
            'Sunrise to sunrise takes 176 Earth days: two whole Mercury years.',
            'The surface swings from about 430 °C by day to −180 °C at night.',
            'It has no moons and almost no atmosphere.',
            'MESSENGER found water ice in polar craters that never see sunlight.',
            'Its iron core is cooling and shrinking, wrinkling the crust into cliffs hundreds of km long.',
        ],
    },
    {
        id: 'venus', name: 'Venus', radiusKm: 6051.8, rotationHours: -5832.5,
        pole: [272.76, 67.16], color: '#e3c27f', atmosphere: '#f3d9a0', tilt: 177.4,
        facts: [
            'It spins backwards, so the Sun rises in the west.',
            'Its day (243 Earth days) is longer than its year (225 days).',
            'The hottest planet: about 465 °C at the surface, hot enough to melt lead.',
            'Surface pressure is about 92 times Earth’s, like being 900 m under the sea.',
            'Its clouds are droplets of sulfuric acid.',
            'Venera 7 made the first soft landing on another planet here, in 1970.',
        ],
    },
    {
        id: 'earth', name: 'Earth', radiusKm: 6371.0, rotationHours: 23.9345,
        pole: [0, 90], color: '#4a86d8', atmosphere: '#7fb2ff', tilt: 23.44,
        facts: [
            'The only world known to have liquid water on its surface.',
            'The Moon drifts about 3.8 cm farther away every year.',
            'The densest planet in the solar system, at 5.5 times water.',
            'You are moving around the Sun at about 107,000 km/h.',
        ],
    },
    {
        id: 'mars', name: 'Mars', radiusKm: 3389.5, rotationHours: 24.6229,
        pole: [317.27, 54.43], color: '#d0683c', atmosphere: '#e8a07a', tilt: 25.19,
        facts: [
            'Olympus Mons rises about 22 km, roughly 2.5 times the height of Everest.',
            'Valles Marineris is about 4,000 km long, as wide as the United States.',
            'A Martian day, a sol, lasts 24 h 39 min.',
            'Its red color comes from iron oxide (rust) in the dust.',
            'Its moon Phobos is spiraling inward and will break apart in tens of millions of years.',
        ],
    },
    {
        id: 'jupiter', name: 'Jupiter', radiusKm: 69911, rotationHours: 9.925,
        pole: [268.06, 64.50], color: '#d9b48a', tilt: 3.13,
        facts: [
            'More than twice as massive as all the other planets combined.',
            'The Great Red Spot is a storm wider than Earth.',
            'The shortest day in the solar system: 9 h 56 min.',
            'Its moon Ganymede is bigger than the planet Mercury.',
            'Io, one of its moons, is the most volcanically active place known.',
            'Europa is thought to hide a salty ocean beneath its ice.',
        ],
    },
    {
        id: 'saturn', name: 'Saturn', radiusKm: 58232, rotationHours: 10.656,
        pole: [40.59, 83.54], color: '#e6cf98', tilt: 26.73, rings: true,
        facts: [
            'Its average density is lower than that of water.',
            'The main rings span about 280,000 km yet are often only about 10 m thick.',
            'Titan, its largest moon, has a thick atmosphere and lakes of liquid methane.',
            'Enceladus sprays geysers of water ice from an ocean under its south pole.',
            'A six-sided jet stream circles its north pole.',
        ],
    },
    {
        id: 'uranus', name: 'Uranus', radiusKm: 25362, rotationHours: -17.24,
        pole: [257.31, -15.18], color: '#9ad7df', atmosphere: '#bdeef2', tilt: 97.77, rings: true,
        facts: [
            'It is tipped on its side, with its axis tilted about 98°.',
            'Each pole gets about 42 years of sunlight, then 42 years of darkness.',
            'Voyager 2 is the only spacecraft to have visited, in January 1986.',
            'The coldest planetary atmosphere measured: about −224 °C.',
            'The first planet found with a telescope, by William Herschel in 1781.',
        ],
    },
    {
        id: 'neptune', name: 'Neptune', radiusKm: 24622, rotationHours: 16.11,
        pole: [299.36, 43.46], color: '#4f74e3', atmosphere: '#7f9dff', tilt: 28.32,
        facts: [
            'Found by mathematics: predicted from tugs on Uranus, then spotted in 1846.',
            'Its winds reach about 2,000 km/h, the fastest in the solar system.',
            'A year there lasts 165 Earth years; it finished its first orbit since discovery in 2011.',
            'Its moon Triton orbits backwards and erupts with nitrogen geysers.',
        ],
    },
    {
        id: 'pluto', name: 'Pluto', radiusKm: 1188.3, rotationHours: -153.29,
        pole: [132.99, -6.16], color: '#cdb59b', dwarf: true, tilt: 122.5,
        facts: [
            'Its bright “heart” is a vast plain of frozen nitrogen.',
            'Reclassified as a dwarf planet in 2006.',
            'Its moon Charon is half its width; the two circle a point in space between them.',
            'From 1979 to 1999 it was closer to the Sun than Neptune.',
        ],
    },
];

export const BODY = Object.fromEntries(BODIES.map(b => [b.id, b]));
export const PLANETS = BODIES.filter(b => b.id !== 'sun');

export const SPEEDS = [
    // [label, km/s] for "how long to get there" lines
    ['driving at 100 km/h', 100 / 3600],
    ['on an airliner at 900 km/h', 900 / 3600],
    ['at Voyager 1’s 17 km/s', 17],
    ['at Parker Solar Probe’s record 192 km/s', 192],
];

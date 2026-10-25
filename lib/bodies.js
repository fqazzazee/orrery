// Physical data (NASA planetary fact sheets, IAU WGCCRE 2015 pole directions)
// and the facts shown in cards: the Sun, planets, dwarf planets, moons,
// comets, the asteroids missions visit, and the Lagrange points.

export const SUN_RADIUS_KM = 695700;

// rotationHours is sidereal; negative means retrograde. pole is the IAU north
// pole as [RA, Dec] in degrees. moons are the confirmed count as of 2025;
// tempC is the mean surface (or 1-bar cloud-top) temperature, tempRange the
// coldest and hottest. gravity is at the surface (m/s²), escape in km/s,
// density in g/cm³.
export const BODIES = [
    {
        id: 'sun', name: 'Sun', radiusKm: SUN_RADIUS_KM, rotationHours: 609.12,
        pole: [286.13, 63.87], color: '#ffc46b', massEarths: 333000, tempC: 5500,
        gravity: 274, escape: 617.7, density: 1.41,
        facts: [
            'Holds about 99.8% of all the mass in the solar system.',
            'About 109 Earths would fit across its face, and 1.3 million inside it.',
            'Its core reaches about 15 million °C and turns 4 million tonnes of matter into energy every second.',
            'Spins once every 25 days at its equator, more slowly near the poles: it is not solid.',
            'Light made in the core takes from 10,000 to 170,000 years to stagger out to the surface, then 8 minutes to reach us.',
            'Its outer atmosphere, the corona, is over a million degrees, far hotter than the surface below. Why is still debated.',
            'Its magnetic field flips every 11 years or so, at the peak of each sunspot cycle.',
            'The solar wind streams out at about 400 km/s and blows a bubble, the heliosphere, far past Pluto.',
            'It circles the center of the Milky Way at about 230 km/s, once every 230 million years.',
            'In about 5 billion years it will swell into a red giant, then shrink to a white dwarf the size of Earth.',
        ],
        profile: [
            ['Kind', 'G2V yellow dwarf, a main-sequence star'],
            ['Made of', '73% hydrogen, 25% helium by mass, 2% everything else'],
            ['Power', '3.83 × 10²⁶ W'],
            ['Core', 'About 15 million °C, 150 times as dense as water'],
            ['Corona', '1 to 3 million °C'],
            ['Solar wind', 'About 400 km/s, gusting past 800'],
            ['Sunspot cycle', 'About 11 years; cycle 25 peaked around late 2024'],
            ['In the galaxy', '26,000 light-years from the center, 230 km/s around it'],
        ],
        visited: 'Helios 2 held the closest-approach record from 1976. Parker Solar Probe now dips to 6.1 million km from the surface. SOHO has watched it from L1 since 1996; Solar Orbiter climbs above its poles.',
    },
    {
        id: 'mercury', name: 'Mercury', radiusKm: 2439.7, rotationHours: 1407.6,
        pole: [281.01, 61.42], color: '#a9a29a', tilt: 0.03, moons: 0, massEarths: 0.0553, tempC: 167,
        tempRange: [-180, 430], gravity: 3.7, escape: 4.3, density: 5.43,
        air: 'Almost none: a wisp of oxygen, sodium, hydrogen, helium and potassium',
        magnetic: 'A weak global field, about 1% of Earth’s',
        interior: 'An iron core fills about 85% of its radius',
        named: 'The fleet-footed Roman messenger, for its quick trips around the Sun',
        discovered: 'Known since antiquity',
        visited: 'Mariner 10 (1974–75), MESSENGER (2008–15), BepiColombo (arriving November 2026)',
        facts: [
            'Sunrise to sunrise takes 176 Earth days: two whole Mercury years.',
            'The surface swings from about 430 °C by day to −180 °C at night.',
            'It has no moons and almost no atmosphere.',
            'MESSENGER found water ice in polar craters that never see sunlight.',
            'Its iron core is cooling and shrinking, wrinkling the crust into cliffs hundreds of km long.',
            'It spins exactly three times for every two laps around the Sun.',
            'On average it is the closest planet to Earth, and to every other planet too.',
            'Its orbit’s slow turn could not be explained by Newton; Einstein’s relativity got it exactly right in 1915.',
            'The Caloris basin, 1,550 km wide, was blasted by an impact so hard it jumbled the ground on the far side.',
        ],
    },
    {
        id: 'venus', name: 'Venus', radiusKm: 6051.8, rotationHours: -5832.5,
        pole: [272.76, 67.16], color: '#e3c27f', atmosphere: '#f3d9a0', tilt: 177.4, moons: 0, massEarths: 0.815, tempC: 464,
        tempRange: [462, 467], gravity: 8.87, escape: 10.36, density: 5.24, pressure: '92 bar',
        air: '96.5% carbon dioxide, 3.5% nitrogen, under clouds of sulfuric acid',
        magnetic: 'None of its own; the solar wind drapes an induced one around it',
        interior: 'Probably an iron core about Earth’s size in proportion, under a young volcanic crust',
        named: 'The Roman goddess of love and beauty: the brightest planet in our sky',
        discovered: 'Known since antiquity, as the morning and evening star',
        visited: 'Venera landers (1970–82), Pioneer Venus, Magellan (1990–94), Venus Express (2006–14), Akatsuki (2015–24); flybys by many more',
        facts: [
            'It spins backwards, so the Sun rises in the west.',
            'Its day (243 Earth days) is longer than its year (225 days).',
            'The hottest planet: about 465 °C at the surface, hot enough to melt lead.',
            'Surface pressure is about 92 times Earth’s, like being 900 m under the sea.',
            'Its clouds are droplets of sulfuric acid.',
            'Venera 7 made the first soft landing on another planet here, in 1970.',
            'Its winds race around the whole planet in four days, 60 times faster than it turns.',
            'Nearly the same size and mass as Earth, but a runaway greenhouse made it a furnace.',
            'Its surface is young: volcanoes repaved most of it within the last half-billion years.',
            'Brighter than any star, it can be seen in daylight if you know where to look.',
        ],
    },
    {
        id: 'earth', name: 'Earth', radiusKm: 6371.0, rotationHours: 23.9345,
        pole: [0, 90], color: '#4a86d8', atmosphere: '#7fb2ff', tilt: 23.44, moons: 1, massEarths: 1, tempC: 15,
        tempRange: [-89, 57], gravity: 9.81, escape: 11.19, density: 5.51, pressure: '1.013 bar',
        air: '78% nitrogen, 21% oxygen, 0.9% argon, 0.04% carbon dioxide',
        magnetic: 'Strong; its magnetosphere turns the solar wind aside',
        interior: 'A solid iron inner core, as hot as the Sun’s surface, inside a liquid outer core',
        named: 'Old English “eorþe”: the ground',
        discovered: 'Home',
        visited: 'Hubble has circled 540 km up since 1990; JWST, Euclid and Roman watch the sky from L2',
        facts: [
            'The only world known to have liquid water on its surface.',
            'The Moon drifts about 3.8 cm farther away every year.',
            'The densest planet in the solar system, at 5.5 times water.',
            'You are moving around the Sun at about 107,000 km/h.',
            'It is closest to the Sun in early January, during the northern winter: seasons come from its tilt, not its distance.',
            'Its spin is slowing: days were about 22 hours long when dinosaurs were alive.',
            'Oceans cover 71% of the surface but hold only 0.02% of its mass.',
            'The magnetic north pole wanders about 50 km a year.',
            'About 100 tonnes of meteor dust fall on it every day.',
        ],
    },
    {
        id: 'mars', name: 'Mars', radiusKm: 3389.5, rotationHours: 24.6229,
        pole: [317.27, 54.43], color: '#d0683c', atmosphere: '#e8a07a', tilt: 25.19, moons: 2, massEarths: 0.107, tempC: -65,
        tempRange: [-140, 20], gravity: 3.71, escape: 5.03, density: 3.93, pressure: '0.006 bar',
        air: '95% carbon dioxide, 2.8% nitrogen, 2% argon',
        magnetic: 'No global field, only magnetized patches of ancient crust in the south',
        interior: 'A large liquid iron core, measured by the InSight lander’s marsquakes',
        named: 'The Roman god of war, for its blood-red color',
        discovered: 'Known since antiquity',
        visited: 'Mariner 4 (1965) first; Viking landers (1976); rovers Sojourner, Spirit, Opportunity, Curiosity, Perseverance and Zhurong; the Ingenuity helicopter',
        facts: [
            'Olympus Mons rises about 22 km, roughly 2.5 times the height of Everest.',
            'Valles Marineris is about 4,000 km long, as wide as the United States.',
            'A Martian day, a sol, lasts 24 h 39 min.',
            'Its red color comes from iron oxide (rust) in the dust.',
            'Its moon Phobos is spiraling inward and will break apart in tens of millions of years.',
            'Dust storms can swallow the whole planet for months.',
            'Sunsets on Mars are blue.',
            'Old river valleys and lake beds show water once flowed there.',
            'Ingenuity made the first powered flight on another world, on 19 April 2021, and flew 72 times.',
            'With its 25° tilt it has seasons like ours, each about twice as long.',
        ],
    },
    {
        id: 'jupiter', name: 'Jupiter', radiusKm: 69911, rotationHours: 9.925,
        pole: [268.06, 64.50], color: '#d9b48a', tilt: 3.13, moons: 97, massEarths: 317.8, tempC: -110,
        gravity: 24.79, escape: 59.5, density: 1.33,
        air: 'About 90% hydrogen and 10% helium, with ammonia clouds',
        magnetic: 'The strongest of any planet, about 20,000 times Earth’s',
        interior: 'Hydrogen squeezed into a metal deep down, around a large, fuzzy core',
        ringsText: 'Faint rings of dust, found by Voyager 1 in 1979',
        named: 'The king of the Roman gods',
        discovered: 'Known since antiquity; Galileo found its four big moons in 1610',
        visited: 'Pioneer 10 and 11, Voyager 1 and 2, Ulysses, Galileo (orbited 1995–2003), Cassini, New Horizons, Juno (orbiting since 2016); Juice and Europa Clipper are on the way',
        facts: [
            'More than twice as massive as all the other planets combined.',
            'The Great Red Spot is a storm wider than Earth, raging for at least 190 years.',
            'The shortest day in the solar system: 9 h 56 min.',
            'Its moon Ganymede is bigger than the planet Mercury.',
            'Io, one of its moons, is the most volcanically active place known.',
            'Europa is thought to hide a salty ocean beneath its ice.',
            'It spins so fast it bulges: 7% wider at the equator than pole to pole.',
            'Its gravity flings comets and asteroids around; Shoemaker–Levy 9 hit it in 1994.',
            'Its auroras are hundreds of times more powerful than Earth’s.',
            'It gives off more heat than it gets from the Sun, still cooling from its birth.',
        ],
    },
    {
        id: 'saturn', name: 'Saturn', radiusKm: 58232, rotationHours: 10.656,
        pole: [40.59, 83.54], color: '#e6cf98', tilt: 26.73, rings: true, moons: 274, massEarths: 95.2, tempC: -140,
        gravity: 10.44, escape: 35.5, density: 0.687,
        air: 'About 96% hydrogen and 3% helium',
        magnetic: 'Nearly 600 times Earth’s, lined up almost exactly with its spin axis',
        interior: 'Like Jupiter: metallic hydrogen around a dilute rocky core',
        ringsText: 'Seven main rings of water ice, from dust to house-sized chunks, 280,000 km across',
        named: 'The Roman god of farming and time',
        discovered: 'Known since antiquity; Huygens explained the rings in 1659',
        visited: 'Pioneer 11 (1979), Voyager 1 and 2 (1980, 1981), Cassini (orbited 2004–17); Dragonfly heads to Titan in 2028',
        facts: [
            'Its average density is lower than that of water.',
            'The main rings span about 280,000 km yet are often only about 10 m thick.',
            'Titan, its largest moon, has a thick atmosphere and lakes of liquid methane.',
            'Enceladus sprays geysers of water ice from an ocean under its south pole.',
            'A six-sided jet stream circles its north pole.',
            'The rings may be young, perhaps only a few hundred million years old, and are slowly raining onto the planet.',
            'It has the most known moons of any planet: 274 as of 2025.',
            'Twice each orbit, about every 15 years, the rings turn edge-on to Earth and nearly vanish, as in 2025.',
            'Its winds blow up to 1,800 km/h at the equator.',
        ],
    },
    {
        id: 'uranus', name: 'Uranus', radiusKm: 25362, rotationHours: -17.24,
        pole: [257.31, -15.18], color: '#9ad7df', atmosphere: '#bdeef2', tilt: 97.77, rings: true, moons: 29, massEarths: 14.5, tempC: -195,
        gravity: 8.87, escape: 21.3, density: 1.27,
        air: '83% hydrogen, 15% helium, 2% methane, which makes it blue-green',
        magnetic: 'Tipped 59° from its spin axis and well off-center',
        interior: 'An ice giant: a hot, dense fluid of water, methane and ammonia over a rocky core',
        ringsText: '13 known narrow, dark rings',
        named: 'The Greek god of the sky, father of Kronos (Saturn)',
        discovered: 'William Herschel, 13 March 1781: the first planet found with a telescope',
        visited: 'Only Voyager 2, in January 1986',
        facts: [
            'It is tipped on its side, with its axis tilted about 98°.',
            'Each pole gets about 42 years of sunlight, then 42 years of darkness.',
            'Voyager 2 is the only spacecraft to have visited, in January 1986.',
            'The coldest planetary atmosphere measured: about −224 °C.',
            'The first planet found with a telescope, by William Herschel in 1781.',
            'Herschel wanted to name it “George’s Star” after King George III.',
            'Its moons are named for characters from Shakespeare and Alexander Pope.',
            'A giant collision may have knocked it over long ago.',
            'Deep inside, the pressure may squeeze carbon into diamond.',
        ],
    },
    {
        id: 'neptune', name: 'Neptune', radiusKm: 24622, rotationHours: 16.11,
        pole: [299.36, 43.46], color: '#4f74e3', atmosphere: '#7f9dff', tilt: 28.32, moons: 16, massEarths: 17.1, tempC: -200,
        gravity: 11.15, escape: 23.5, density: 1.64,
        air: '80% hydrogen, 19% helium, 1.5% methane',
        magnetic: 'Tipped 47° from its spin axis, about 27 times Earth’s',
        interior: 'An ice giant, like Uranus: a fluid mantle of water, ammonia and methane',
        ringsText: 'Five faint rings; the outer one has bright clumps called arcs',
        named: 'The Roman god of the sea, for its blue color',
        discovered: 'Johann Galle, 23 September 1846, where Urbain Le Verrier’s math said to look',
        visited: 'Only Voyager 2, in August 1989',
        facts: [
            'Found by mathematics: predicted from tugs on Uranus, then spotted in 1846.',
            'Its winds reach about 2,000 km/h, the fastest in the solar system.',
            'A year there lasts 165 Earth years; it finished its first orbit since discovery in 2011.',
            'Its moon Triton orbits backwards and erupts with nitrogen geysers.',
            'Galileo saw it in 1612 and 1613 but took it for a star.',
            'It gives off 2.6 times as much heat as it gets from the Sun.',
            'Sunlight there is 900 times dimmer than on Earth, still far brighter than a full moon.',
            'The Great Dark Spot Voyager saw in 1989 had vanished when Hubble looked in 1994.',
        ],
    },
    {
        id: 'pluto', name: 'Pluto', radiusKm: 1188.3, rotationHours: -153.29,
        pole: [132.99, -6.16], color: '#cdb59b', dwarf: true, tilt: 122.5, moons: 5, massEarths: 0.0022, tempC: -225,
        tempRange: [-240, -218], gravity: 0.62, escape: 1.21, density: 1.85, pressure: 'About 10 millionths of a bar',
        air: 'Thin nitrogen, methane and carbon monoxide that freezes onto the ground as it moves away from the Sun',
        interior: 'Probably a rocky core under a slushy ocean and a shell of water ice',
        named: 'The Roman god of the underworld; suggested by Venetia Burney, aged 11',
        discovered: 'Clyde Tombaugh, 18 February 1930, comparing photographic plates',
        visited: 'New Horizons flew past on 14 July 2015',
        facts: [
            'Its bright “heart” is a vast plain of frozen nitrogen.',
            'Reclassified as a dwarf planet in 2006.',
            'Its moon Charon is half its width; the two circle a point in space between them.',
            'From 1979 to 1999 it was closer to the Sun than Neptune.',
            'It has mountains of water ice as tall as the Rockies.',
            'Its sky is blue, from haze high in its atmosphere.',
            'It has not finished one orbit since its discovery: that takes 248 years, until 2178.',
            'Some of Clyde Tombaugh’s ashes flew past it aboard New Horizons.',
        ],
    },
    {
        id: 'ceres', name: 'Ceres', radiusKm: 469.7, rotationHours: 9.074,
        pole: [291.42, 66.76], color: '#a7a39b', dwarf: true, tilt: 4, moons: 0, massEarths: 0.000157, tempC: -105,
        gravity: 0.28, escape: 0.51, density: 2.16,
        air: 'None to speak of; Herschel saw puffs of water vapor in 2014',
        interior: 'Rock and ice, with pockets of salty brine that may still be liquid deep down',
        named: 'The Roman goddess of farming; “cereal” comes from her name',
        discovered: 'Giuseppe Piazzi, 1 January 1801',
        visited: 'Dawn orbited it from 2015 and is still there, silent since 2018',
        facts: [
            'The largest object in the asteroid belt, with about a third of the belt’s mass.',
            'The bright spots in Occator crater are salts, left as briny water boiled away.',
            'Ahuna Mons is an ice volcano about 4 km high.',
            'It was counted as a planet for about 50 years after its discovery.',
            'Dawn found ammonia-rich clay, hinting it formed farther out and drifted in.',
            'The only dwarf planet in the inner solar system.',
        ],
    },
    {
        id: 'vesta', name: 'Vesta', radiusKm: 262.7, rotationHours: 5.342,
        pole: [309.03, 42.23], color: '#b8b2a8', asteroid: true, tilt: 29, moons: 0, massEarths: 0.0000434, tempC: -100,
        gravity: 0.25, escape: 0.36, density: 3.46,
        air: 'None',
        interior: 'A crust, a mantle and an iron core: a small rocky planet that never finished growing',
        named: 'The Roman goddess of the hearth',
        discovered: 'Heinrich Olbers, 29 March 1807',
        visited: 'Dawn orbited it from July 2011 to September 2012',
        facts: [
            'Rheasilvia, an impact basin 505 km wide, covers most of its southern half; its central peak is about 22 km high.',
            'About one in twenty meteorites that fall on Earth came from Vesta.',
            'The brightest asteroid: on a dark night it can be seen without a telescope.',
            'A protoplanet, with layers like a small rocky planet.',
            'Dawn left it in 2012 for Ceres, the first craft to orbit two worlds beyond Earth.',
        ],
    },
];

export const BODY = Object.fromEntries(BODIES.map(b => [b.id, b]));

// Gravitational parameter GM, km³/s², for orbits around each world.
export const GM = {
    mercury: 22032, venus: 324859, earth: 398600.4, mars: 42828.37, jupiter: 126686534, saturn: 37931187,
    uranus: 5793939, neptune: 6836529, pluto: 869.6, ceres: 62.63, vesta: 17.29,
};
export const PLANETS = BODIES.filter(b => b.id !== 'sun');
// Ceres and Vesta go with the other small bodies on the Content page.
export const SMALL_PLANETS = ['ceres', 'vesta'];

// ---- Moons ----
// a: orbit radius, km; period: days (negative: backwards); angle0: where
// it was at J2000 (degrees in planeBasis of its planet's pole; period and
// angle fitted to JPL Horizons positions in 2000 and 2026).
export const MOONS = [
    {
        id: 'moon', name: 'The Moon', parent: 'earth', a: 384400, period: 27.3217, radiusKm: 1737.4, color: '#cfcac0',
        ecliptic: true, gravity: 1.62, tempRange: [-173, 127],
        facts: [
            'It always shows Earth the same face: it spins once per orbit.',
            'Twelve people walked on it, from Apollo 11 in 1969 to Apollo 17 in 1972.',
            'Probably formed from debris when a Mars-sized body hit the young Earth.',
            'Its gravity raises the tides; it is drifting away by 3.8 cm a year.',
            'The Sun is 400 times wider but 400 times farther away, so they look the same size: that is why total eclipses work.',
            'Chang’e 6 brought back the first samples from its far side in 2024.',
        ],
    },
    {
        id: 'phobos', name: 'Phobos', parent: 'mars', a: 9376, period: 0.3189101, angle0: 352.3, radiusKm: 11.3, color: '#8f8479',
        facts: [
            'Orbits faster than Mars turns, so it rises in the west and sets in the east, twice a day.',
            'Creeping 1.8 m closer to Mars each century; in 30–50 million years it will crash or break into a ring.',
            'Its largest crater, Stickney, is 9 km wide, almost half the moon.',
            'Japan’s MMX launched in October 2026 to bring back a sample of it.',
        ],
    },
    {
        id: 'deimos', name: 'Deimos', parent: 'mars', a: 23463, period: 1.2624407, angle0: 35.92, radiusKm: 6.2, color: '#9d9286',
        facts: [
            'One of the smallest moons known, about 12 km across.',
            'From Mars it would look like a bright star.',
            'Hera flew past it in March 2025 on the way to Didymos.',
        ],
    },
    {
        id: 'io', name: 'Io', parent: 'jupiter', a: 421700, period: 1.7691371, angle0: 287.96, radiusKm: 1821.6, color: '#e3d36a',
        facts: [
            'The most volcanic world known, with over 400 active volcanoes.',
            'Its volcanoes are heated by tides as Jupiter, Europa and Ganymede knead its interior.',
            'Plumes rise up to 400 km above the surface.',
            'Io, Europa and Ganymede are locked in a 1:2:4 rhythm of orbits.',
        ],
    },
    {
        id: 'europa', name: 'Europa', parent: 'jupiter', a: 671034, period: 3.5511827, angle0: 122.42, radiusKm: 1560.8, color: '#cbbd9f',
        facts: [
            'A salty ocean, perhaps twice as much water as all of Earth’s, under 15–25 km of ice.',
            'Europa Clipper arrives in 2030 to make about 50 close flybys.',
            'Crisscrossed by cracks and ridges, with few craters: its surface is young.',
            'Hubble has spotted what may be plumes of water.',
        ],
    },
    {
        id: 'ganymede', name: 'Ganymede', parent: 'jupiter', a: 1070412, period: 7.15455, angle0: 129.87, radiusKm: 2634.1, color: '#a89b8a',
        facts: [
            'The largest moon in the solar system, bigger than Mercury.',
            'The only moon with its own magnetic field, which lights auroras.',
            'Juice is due to become the first spacecraft to orbit a moon other than ours, in December 2034.',
            'Probably hides a salty ocean between layers of ice.',
        ],
    },
    {
        id: 'callisto', name: 'Callisto', parent: 'jupiter', a: 1882709, period: 16.6890218, angle0: 350.05, radiusKm: 2410.3, color: '#7d7266',
        facts: [
            'The most heavily cratered object in the solar system.',
            'Its ancient surface has barely changed in 4 billion years.',
            'Outside the worst of Jupiter’s radiation, it is the favorite site for future human bases.',
        ],
    },
    {
        id: 'mimas', name: 'Mimas', parent: 'saturn', a: 185539, period: 0.9424402, angle0: 329.9, radiusKm: 198.2, color: '#c9c6c0',
        facts: [
            'Herschel crater, a third of its width, makes it look like the Death Star.',
            'Its pull clears the Cassini Division in Saturn’s rings.',
            'A wobble in its spin hints at a young ocean under the ice.',
        ],
    },
    {
        id: 'enceladus', name: 'Enceladus', parent: 'saturn', a: 237948, period: 1.3702186, angle0: 322.5, radiusKm: 252.1, color: '#f2f3f2',
        facts: [
            'Over 100 geysers at its south pole feed Saturn’s E ring.',
            'Cassini flew through the plumes and found salt, silica and organic molecules.',
            'The most reflective body in the solar system: fresh ice bounces back about 99% of sunlight.',
        ],
    },
    {
        id: 'tethys', name: 'Tethys', parent: 'saturn', a: 294619, period: 1.887799, angle0: 327.07, radiusKm: 531.1, color: '#d9d6d0',
        facts: [
            'Almost pure water ice.',
            'Ithaca Chasma, a canyon 2,000 km long, wraps three-quarters of the way around it.',
            'Two tiny moons, Telesto and Calypso, share its orbit at its L4 and L5 points.',
        ],
    },
    {
        id: 'dione', name: 'Dione', parent: 'saturn', a: 377396, period: 2.736915, angle0: 316.78, radiusKm: 561.4, color: '#d2cec7',
        facts: [
            'Bright ice cliffs hundreds of meters high streak its trailing side.',
            'Helene and Polydeuces share its orbit, at its Lagrange points.',
            'Cassini caught a whiff of oxygen around it.',
        ],
    },
    {
        id: 'rhea', name: 'Rhea', parent: 'saturn', a: 527108, period: 4.517503, angle0: 192.16, radiusKm: 763.8, color: '#c7c2ba',
        facts: [
            'Saturn’s second-largest moon.',
            'Cassini found a thin atmosphere of oxygen and carbon dioxide.',
        ],
    },
    {
        id: 'titan', name: 'Titan', parent: 'saturn', a: 1221870, period: 15.9455484, angle0: 148.49, radiusKm: 2574.7, color: '#dcae52',
        facts: [
            'The only moon with a thick atmosphere: 1.5 times Earth’s surface pressure.',
            'It has rain, rivers and seas, of liquid methane and ethane.',
            'Huygens landed there in 2005; Dragonfly will fly across its dunes from 2034.',
            'Bigger than Mercury, but less than half as massive.',
            'With its low gravity and thick air, a person could fly there by flapping strapped-on wings.',
        ],
    },
    {
        id: 'iapetus', name: 'Iapetus', parent: 'saturn', a: 3560820, period: 79.3210378, angle0: 227.95, radiusKm: 734.5, color: '#9a8f80',
        facts: [
            'Two-toned: one side is as dark as coal, the other as bright as snow.',
            'A ridge up to 20 km high runs around its equator like the seam of a walnut.',
            'Its orbit is tilted 15°, giving it the best view of Saturn’s rings.',
        ],
    },
    {
        id: 'miranda', name: 'Miranda', parent: 'uranus', a: 129390, period: 1.4134913, angle0: 37.43, radiusKm: 235.8, color: '#bcbab4',
        facts: [
            'Verona Rupes, a cliff about 20 km high, may be the tallest in the solar system.',
            'A patchwork surface, as if pieced back together after a shattering impact.',
            'Voyager 2 saw it in 1986; nothing has been back since.',
        ],
    },
    {
        id: 'ariel', name: 'Ariel', parent: 'uranus', a: 191020, period: 2.5202255, angle0: 161.77, radiusKm: 578.9, color: '#c9c7c2',
        facts: [
            'The brightest of Uranus’s big moons, with the youngest surface.',
            'Valleys hundreds of kilometers long cut across it.',
        ],
    },
    {
        id: 'umbriel', name: 'Umbriel', parent: 'uranus', a: 266000, period: 4.1442836, angle0: 114.3, radiusKm: 584.7, color: '#8d8a85',
        facts: [
            'The darkest of Uranus’s large moons.',
            'A bright ring 140 km across, Wunda, sits on its equator.',
        ],
    },
    {
        id: 'titania', name: 'Titania', parent: 'uranus', a: 435910, period: 8.7029186, angle0: 83.19, radiusKm: 788.4, color: '#b9b4ac',
        facts: [
            'Uranus’s largest moon.',
            'Named for the queen of the fairies in Shakespeare’s A Midsummer Night’s Dream.',
            'Canyons up to 1,500 km long split its surface.',
        ],
    },
    {
        id: 'oberon', name: 'Oberon', parent: 'uranus', a: 583520, period: 13.4580853, angle0: 12.45, radiusKm: 761.4, color: '#a9a39a',
        facts: [
            'The outermost of Uranus’s five big moons.',
            'Named after Titania’s husband, the king of the fairies.',
        ],
    },
    {
        id: 'triton', name: 'Triton', parent: 'neptune', a: 354759, period: -5.8768565, angle0: 276.94, radiusKm: 1353.4, color: '#cdc3b8',
        facts: [
            'It orbits backwards, so it was probably a Kuiper belt object Neptune captured.',
            'Voyager 2 saw nitrogen geysers rising 8 km.',
            'Slowly spiraling inward; in billions of years Neptune’s tides will tear it apart.',
            'One of the coldest surfaces measured: about −235 °C.',
        ],
    },
    {
        id: 'charon', name: 'Charon', parent: 'pluto', a: 19591, period: 6.387222, angle0: 141.24, radiusKm: 606, color: '#a8a29a',
        facts: [
            'So big next to Pluto that the two orbit a point in the space between them.',
            'Pluto and Charon always show each other the same face.',
            'Its reddish north pole, Mordor Macula, is stained by gas escaping Pluto.',
        ],
    },
];

export const MOON = Object.fromEntries(MOONS.map(m => [m.id, m]));
export const moonsOf = id => MOONS.filter(m => m.parent === id);

// ---- Comets and asteroids ----
// Drawn as points (comets with a tail). show: 'always' (with the small-bodies
// option) or a [from, to] window; otherwise only while a mission is there.
export const SMALL_BODIES = [
    {
        id: 'halley', name: 'Halley’s Comet', short: 'Halley', kind: 'Comet', comet: true, radiusKm: 5.5, color: '#bfe3ff', show: 'always',
        facts: [
            'Comes back every 75–76 years: last seen in 1986, due again in July 2061.',
            'Edmond Halley predicted its return for 1758; he died before it came back.',
            'ESA’s Giotto flew within 596 km of its nucleus in March 1986.',
            'Its dust makes two meteor showers: the Eta Aquariids in May and the Orionids in October.',
            'It orbits backwards compared with the planets.',
            'Its nucleus is peanut-shaped, about 15 km long, and darker than coal.',
        ],
    },
    {
        id: '3i', name: '3I/ATLAS', kind: 'Interstellar comet', comet: true, radiusKm: 2, color: '#9effd6', show: ['2025-01-01', '2028-01-01'],
        facts: [
            'The third known visitor from another star, found on 1 July 2025.',
            'Too fast for the Sun to hold: it came in at about 58 km/s and will leave for good.',
            'Possibly older than the solar system, perhaps 7 billion years or more.',
            'Closest to the Sun on 29 October 2025, just inside the orbit of Mars.',
            'Its path is tilted 175°, so it moves backwards, close to the plane of the planets.',
        ],
    },
    {
        id: 'sedna', name: 'Sedna', kind: 'Detached object', radiusKm: 500, color: '#d8806a', show: 'far',
        facts: [
            'One of the farthest known worlds: it swings from 76 AU out to about 1,000 AU, and one lap takes some 12,700 years.',
            'Nearest the Sun in 2076, for the first time since the last ice age was ending.',
            'Even at its closest it is far beyond Neptune’s pull, so something else shaped its orbit: perhaps a star passing the young Sun.',
            'Named for the Inuit goddess of the sea, said to live at the bottom of the cold Arctic Ocean.',
            'One of the reddest objects in the solar system.',
        ],
    },
    {
        id: 'eris', name: 'Eris', kind: 'Dwarf planet', radiusKm: 1163, color: '#e6e1dc', show: 'far',
        facts: [
            'Almost exactly Pluto’s size but 27% more massive; finding it in 2005 led to Pluto’s reclassification.',
            'Its orbit is tilted 44°, and a year there lasts 559 Earth years.',
            'Now about 96 AU away, near its farthest point; light from the Sun takes 13 hours to reach it.',
            'Named for the Greek goddess of strife; its moon is Dysnomia, lawlessness.',
        ],
    },
    {
        id: '67p', name: 'Comet 67P/Churyumov–Gerasimenko', short: '67P', kind: 'Comet', comet: true, radiusKm: 2, color: '#d6d0c4',
        facts: [
            'Shaped like a rubber duck, about 4 km long.',
            'Rosetta orbited it for two years, and its lander Philae made the first landing on a comet.',
            'Its water has more heavy hydrogen than Earth’s oceans, so comets like it probably did not fill them.',
            'Rosetta found molecular oxygen and the amino acid glycine in its gas.',
        ],
    },
    {
        id: '311p', name: 'Comet 311P/PANSTARRS', short: '311P', kind: 'Main-belt comet', comet: true, radiusKm: 0.2, color: '#d0c8ff',
        facts: [
            'An asteroid that sheds dusty tails, like a comet.',
            'Tianwen-2 is due to arrive in January 2035.',
        ],
    },
    {
        id: 'psyche', name: 'Psyche', kind: 'Metal-rich asteroid', radiusKm: 111, color: '#b9c0c6',
        facts: [
            'Perhaps the exposed iron core of a shattered protoplanet.',
            'About 220 km across, rich in iron and nickel.',
            'NASA’s Psyche spacecraft is due in August 2029.',
        ],
    },
    {
        id: 'bennu', name: 'Bennu', kind: 'Near-Earth asteroid', radiusKm: 0.245, color: '#9b938a',
        facts: [
            'A rubble pile about 490 m wide, shaped like a spinning top.',
            'OSIRIS-REx brought 121.6 g of it to Earth in September 2023, the largest asteroid sample yet.',
            'The sample holds amino acids and salts left by ancient brines.',
            'It has about a 1 in 2,700 chance of hitting Earth in September 2182.',
        ],
    },
    {
        id: 'ryugu', name: 'Ryugu', kind: 'Near-Earth asteroid', radiusKm: 0.45, color: '#8a837c',
        facts: [
            'A spinning-top rubble pile about 900 m wide.',
            'Hayabusa2 fired a copper bullet into it to dig a fresh crater, then took a sample.',
            'Its 5.4 g sample, landed in 2020, is some of the most pristine material from the early solar system.',
        ],
    },
    {
        id: 'apophis', name: 'Apophis', kind: 'Near-Earth asteroid', radiusKm: 0.17, color: '#c2b49e',
        facts: [
            'About 340 m wide. On 13 April 2029 it passes 32,000 km above Earth, inside the ring of TV satellites.',
            'That night it will be visible without a telescope from Europe and Africa.',
            'Once feared, it is now ruled out as a threat for at least a century.',
            'OSIRIS-APEX will follow it after the flyby to see how Earth’s pull changed it.',
        ],
    },
    {
        id: 'didymos', name: 'Didymos and Dimorphos', short: 'Didymos', kind: 'Binary asteroid', radiusKm: 0.39, color: '#c7b9a6',
        facts: [
            'A 780 m asteroid with a 150 m moon, Dimorphos.',
            'DART crashed into Dimorphos in September 2022 and cut its 11 h 55 min orbit by 33 minutes: the first test of moving an asteroid.',
            'Hera reached the pair in October 2026 to measure what DART did.',
        ],
    },
    {
        id: 'kamooalewa', name: 'Kamoʻoalewa', kind: 'Quasi-moon of Earth', radiusKm: 0.03, color: '#c9a98a',
        facts: [
            'A quasi-satellite: it circles the Sun in step with Earth and seems to loop around us.',
            'Possibly a chip of our Moon, thrown off by an impact.',
            'Only tens of meters across; Tianwen-2 arrived in July 2026 to take a sample.',
            'The name is Hawaiian, roughly “the oscillating celestial fragment”.',
        ],
    },
    {
        id: 'torifune', name: 'Torifune (2001 CC21)', short: 'Torifune', kind: 'Near-Earth asteroid', radiusKm: 0.25, color: '#b5ab9f',
        facts: [
            'Named in 2025 for a ship of the gods from Japanese myth.',
            'Hayabusa2 flew past it in July 2026 on the way to 1998 KY26.',
        ],
    },
    {
        id: 'ky26', name: '1998 KY26', kind: 'Near-Earth asteroid', radiusKm: 0.0055, color: '#b0a596',
        facts: [
            'Only about 11 m wide, and it spins once every five minutes.',
            'Hayabusa2 is due to arrive in July 2031, its second asteroid rendezvous.',
        ],
    },
    {
        id: 'dinkinesh', name: 'Dinkinesh', kind: 'Main-belt asteroid', radiusKm: 0.36, color: '#a99f92',
        facts: [
            'Lucy found it has a moon, Selam, which turned out to be two lobes stuck together.',
            'Dinkinesh means “you are marvelous” in Amharic; it is also the Ethiopian name of the Lucy fossil.',
        ],
    },
    {
        id: 'donaldjohanson', name: 'Donaldjohanson', kind: 'Main-belt asteroid', radiusKm: 2, color: '#a99f92',
        facts: [
            'Named for the paleoanthropologist who found the Lucy fossil in 1974.',
            'Lucy flew past it in April 2025, a rehearsal for the Trojans.',
        ],
    },
    {
        id: 'eurybates', name: 'Eurybates', kind: 'Jupiter Trojan', radiusKm: 32, color: '#9a9389',
        facts: [
            'The largest piece of a family of Trojans made by one ancient collision.',
            'It has a tiny moon, Queta, found by Hubble in 2018.',
        ],
    },
    {
        id: 'polymele', name: 'Polymele', kind: 'Jupiter Trojan', radiusKm: 10.5, color: '#9a9389',
        facts: [
            'Lucy’s team found it has a moon, nicknamed Shaun, as both passed in front of a star in 2022.',
        ],
    },
    {
        id: 'leucus', name: 'Leucus', kind: 'Jupiter Trojan', radiusKm: 17, color: '#9a9389',
        facts: ['Turns very slowly: one spin takes about 445 hours.'],
    },
    {
        id: 'orus', name: 'Orus', kind: 'Jupiter Trojan', radiusKm: 25, color: '#9a9389',
        facts: ['About 50 km across, and darker than charcoal.'],
    },
    {
        id: 'patroclus', name: 'Patroclus and Menoetius', short: 'Patroclus', kind: 'Binary Jupiter Trojan', radiusKm: 56, color: '#a39a8e',
        facts: [
            'Two bodies about 110 km wide that circle each other every 4.3 days.',
            'Lucy’s grand finale, in March 2033.',
            'Patroclus is a Greek hero stranded in the Trojan camp, behind Jupiter.',
        ],
    },
    {
        id: 'gaspra', name: 'Gaspra', kind: 'Main-belt asteroid', radiusKm: 6, color: '#b0a898',
        facts: ['The first asteroid seen up close, by Galileo in 1991: a potato 18 km long.'],
    },
    {
        id: 'ida', name: 'Ida', kind: 'Main-belt asteroid', radiusKm: 16, color: '#aaa294',
        facts: ['Galileo found it has a moon, Dactyl, 1.4 km wide: the first moon of an asteroid known.'],
    },
    {
        id: 'mathilde', name: 'Mathilde', kind: 'Main-belt asteroid', radiusKm: 26, color: '#7d7870',
        facts: ['Darker than charcoal and so light for its size that it must be half empty space.', 'It turns once every 17.4 days, very slowly for an asteroid.'],
    },
    {
        id: 'eros', name: 'Eros', kind: 'Near-Earth asteroid', radiusKm: 8.4, color: '#c0a886',
        facts: ['Shaped like a peanut, 34 km long; the first near-Earth asteroid ever found, in 1898.', 'NEAR Shoemaker orbited it for a year, then landed.'],
    },
    {
        id: 'braille', name: 'Braille', kind: 'Mars-crossing asteroid', radiusKm: 1, color: '#b0a898',
        facts: ['Named for Louis Braille, who invented the writing system for the blind.'],
    },
    {
        id: 'annefrank', name: 'Annefrank', kind: 'Main-belt asteroid', radiusKm: 2.4, color: '#aaa294',
        facts: ['Named for the diarist Anne Frank; Stardust flew past it in 2002.'],
    },
    {
        id: 'itokawa', name: 'Itokawa', kind: 'Near-Earth asteroid', radiusKm: 0.17, color: '#b8ab98',
        facts: ['A rubble pile 535 m long, shaped like a sea otter.', 'Hayabusa brought back the first grains of an asteroid from it in 2010.'],
    },
    {
        id: 'tempel1', name: 'Comet Tempel 1', short: 'Tempel 1', kind: 'Comet', comet: true, radiusKm: 3, color: '#cfc8bc',
        facts: ['Deep Impact hit it with a copper impactor in 2005; Stardust came back in 2011 to see the crater.'],
    },
    {
        id: 'wild2', name: 'Comet Wild 2', short: 'Wild 2', kind: 'Comet', comet: true, radiusKm: 2, color: '#d0cabd',
        facts: ['Jupiter pulled it into the inner solar system in 1974.', 'Stardust brought its dust back to Earth.'],
    },
    {
        id: 'borrelly', name: 'Comet Borrelly', short: 'Borrelly', kind: 'Comet', comet: true, radiusKm: 2.4, color: '#cbc4b8',
        facts: ['Its nucleus, 8 km long, is shaped like a bowling pin and darker than toner.'],
    },
    {
        id: 'hartley2', name: 'Comet Hartley 2', short: 'Hartley 2', kind: 'Comet', comet: true, radiusKm: 0.6, color: '#d4cec2',
        facts: ['Small and hyperactive: jets of carbon dioxide blow chunks of ice off its ends.'],
    },
    {
        id: 'arrokoth', name: 'Arrokoth', kind: 'Kuiper belt object', radiusKm: 18, color: '#c8866a',
        facts: [
            'Two flattened lobes, 36 km long in all, that came together at walking speed.',
            'The most distant object ever explored up close.',
            'Its red color comes from organic molecules called tholins.',
            'Arrokoth means “sky” in the Powhatan language.',
        ],
    },
];

export const SMALL = Object.fromEntries(SMALL_BODIES.map(s => [s.id, s]));

// ---- Lagrange points ----
export const LAGRANGE = [
    {
        id: 'l1', name: 'Sun–Earth L1', short: 'L1', where: '1.5 million km toward the Sun',
        facts: [
            'Here the pulls of the Sun and Earth balance, so a spacecraft keeps pace with Earth.',
            'An unbroken view of the Sun: SOHO has watched from here since 1996.',
            'Space-weather monitors here see solar storms about an hour before they reach us.',
            'Orbits around it are unstable, so craft fire their thrusters every few weeks to stay.',
        ],
    },
    {
        id: 'l2', name: 'Sun–Earth L2', short: 'L2', where: '1.5 million km beyond Earth, away from the Sun',
        facts: [
            'The Sun, Earth and Moon all stay on one side, so one sunshield keeps a telescope cold and dark.',
            'JWST circles it on a looping halo orbit about as wide as the Moon’s orbit, once every six months.',
            'Orbits here are unstable too: telescopes nudge themselves back every few weeks.',
            'When a mission ends here it is pushed off into an orbit around the Sun.',
        ],
    },
    {
        id: 'l3', name: 'Sun–Earth L3', short: 'L3', where: 'Opposite Earth, behind the Sun',
        facts: [
            'Always hidden behind the Sun, so it cannot be seen from Earth.',
            'Unstable and empty: nothing has been sent there.',
            'A favorite hiding place for a “Counter-Earth” in science fiction.',
        ],
    },
    {
        id: 'l4', name: 'Sun–Earth L4', short: 'L4', where: '60° ahead of Earth on its orbit',
        facts: [
            'Stable: things that drift here can stay for a long time.',
            'Earth has two known Trojan asteroids here: 2010 TK7 and 2020 XL5.',
            'STEREO-A, one of a pair of Sun-watchers, drifted past it in 2009.',
        ],
    },
    {
        id: 'l5', name: 'Sun–Earth L5', short: 'L5', where: '60° behind Earth on its orbit',
        facts: [
            'Stable, like L4.',
            'ESA’s Vigil is planned to go here in the 2030s, to watch solar storms before they turn toward Earth.',
            'From here you can see the side of the Sun that will turn to face Earth days later.',
        ],
    },
    {
        id: 'jl4', name: 'Jupiter’s Greek camp (L4)', short: 'Greeks', where: '60° ahead of Jupiter',
        facts: [
            'More than 15,000 known Trojan asteroids share Jupiter’s orbit, gathered 60° ahead and 60° behind it.',
            'Those ahead are named for Greek heroes of the Trojan War; Hector is a spy among them.',
            'They may be leftovers from the outer solar system, captured as the giant planets shifted.',
            'Lucy visits Eurybates, Polymele, Leucus and Orus here in 2027 and 2028.',
        ],
    },
    {
        id: 'jl5', name: 'Jupiter’s Trojan camp (L5)', short: 'Trojans', where: '60° behind Jupiter',
        facts: [
            'Those behind Jupiter are named for the defenders of Troy, with Patroclus as the Greek spy.',
            'Lucy arrives here for the binary Patroclus and Menoetius in March 2033.',
        ],
    },
];

export const LPOINT = Object.fromEntries(LAGRANGE.map(l => [l.id, l]));

// Any named place: a body, moon, comet, asteroid or Lagrange point.
export function placeName(id, short = false) {
    const x = BODY[id] ?? MOON[id] ?? SMALL[id] ?? LPOINT[id];
    if (!x)
        return id;
    return short ? x.short ?? x.name : x.name;
}

export const SPEEDS = [
    // [label, km/s] for "how long to get there" lines
    ['walking at 5 km/h', 5 / 3600],
    ['driving at 100 km/h', 100 / 3600],
    ['on an airliner at 900 km/h', 900 / 3600],
    ['at Voyager 1’s 17 km/s', 17],
    ['at Parker Solar Probe’s record 192 km/s', 192],
];

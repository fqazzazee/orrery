// Missions to the Moon, from the first soft landing to Artemis II. Their
// paths are built by lunar.js; dates and times are UTC. The landing sites
// are [latitude, longitude east].

export const MOON_MISSIONS = [
    {
        id: 'luna9', name: 'Luna 9', agency: 'Soviet Union', color: '#ff8f7a', group: 'moon',
        about: 'The first spacecraft to land softly on another world and send pictures from its surface.',
        mass: '1,538 kg (99 kg on the surface)', power: 'Batteries',
        facts: [
            'The surface held: some had feared the Moon was covered in deep dust that would swallow a lander.',
            'British astronomers at Jodrell Bank decoded its pictures and published them before Moscow did.',
            'The lander was a ball that bounced, then opened four petals to stand up.',
        ],
        events: [
            {date: '1966-01-31 11:41', at: 'earth', kind: 'launch', note: 'Launched from Baikonur toward the Ocean of Storms.'},
            {date: '1966-02-03 18:45', at: 'moon', kind: 'land', site: [7.08, 295.63], note: 'Touched down in the Ocean of Storms; the first pictures from the surface of another world.'},
            {date: '1966-02-06 22:55', kind: 'end', note: 'Its batteries ran out after three days on the Moon.'},
        ],
    },
    {
        id: 'apollo8', name: 'Apollo 8', agency: 'NASA', color: '#ffd9a8', group: 'moon', crew: 'Frank Borman, Jim Lovell, Bill Anders',
        about: 'The first people to leave Earth’s orbit, circle the Moon and see its far side.',
        mass: '28,800 kg', power: 'Fuel cells',
        facts: [
            'Bill Anders took Earthrise, the photo of Earth coming up over the Moon’s horizon.',
            'They read from the book of Genesis on Christmas Eve to the largest TV audience yet.',
            'It was the first crewed flight of the Saturn V rocket.',
        ],
        events: [
            {date: '1968-12-21 12:51', at: 'earth', kind: 'launch', note: 'The first crew to ride a Saturn V, and the first to head for the Moon.'},
            {date: '1968-12-24 09:59', at: 'moon', kind: 'arrive', orbit: {alt: 112, i: 168}, note: 'Into orbit around the Moon, out of contact behind it.'},
            {date: '1968-12-24 16:40', kind: 'note', title: 'Earthrise', note: 'Bill Anders photographed Earth rising over the lunar horizon.'},
            {date: '1968-12-25 06:10', at: 'moon', kind: 'depart', note: 'Ten orbits done; the engine fired behind the Moon to head home. “Please be informed, there is a Santa Claus.”'},
            {date: '1968-12-27 15:51', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Splashed down in the Pacific, before dawn.'},
        ],
    },
    {
        id: 'apollo11', name: 'Apollo 11', agency: 'NASA', color: '#fff0a8', group: 'moon', crew: 'Neil Armstrong, Buzz Aldrin, Michael Collins',
        about: 'The first people to walk on the Moon.',
        mass: '45,700 kg', power: 'Fuel cells; batteries in the lander',
        facts: [
            'Armstrong flew the lander past a field of boulders by hand, with about 25 seconds of fuel to spare.',
            'Collins circled alone in Columbia, out of touch with anyone each time he passed behind the Moon.',
            'They brought back 21.5 kg of rock and soil.',
            'A laser reflector they left is still used to measure the Moon’s distance to a few millimeters.',
        ],
        events: [
            {date: '1969-07-16 13:32', at: 'earth', kind: 'launch', note: 'Launched from Kennedy Space Center, watched by about a million people nearby.'},
            {date: '1969-07-19 17:21', at: 'moon', kind: 'arrive', orbit: {alt: 110, i: 179}, note: 'Into orbit around the Moon.'},
            {date: '1969-07-20 20:17', at: 'moon', kind: 'land', site: [0.674, 23.473], note: '“The Eagle has landed.” Tranquility Base, in the Sea of Tranquility.'},
            {date: '1969-07-21 02:56', kind: 'note', title: 'First step', note: '“That’s one small step for man, one giant leap for mankind.”'},
            {date: '1969-07-21 17:54', at: 'moon', kind: 'liftoff', note: 'Eagle lifted off to rejoin Collins in Columbia.'},
            {date: '1969-07-22 04:55', at: 'moon', kind: 'depart', note: 'The engine fired behind the Moon to bring them home.'},
            {date: '1969-07-24 16:50', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Splashed down in the Pacific; President Nixon met them on the recovery ship.'},
        ],
    },
    {
        id: 'apollo12', name: 'Apollo 12', agency: 'NASA', color: '#ffe0c0', group: 'moon', crew: 'Pete Conrad, Alan Bean, Dick Gordon',
        about: 'A pinpoint landing next to an old robot lander, Surveyor 3.',
        mass: '45,600 kg', power: 'Fuel cells; batteries in the lander',
        facts: [
            'Lightning struck the rocket twice during launch; a young controller’s call of “SCE to Aux” saved the mission.',
            'They walked over to Surveyor 3, which had landed two and a half years earlier, and brought pieces of it home.',
        ],
        events: [
            {date: '1969-11-14 16:22', at: 'earth', kind: 'launch', note: 'Launched into rain clouds; lightning struck it twice on the way up.'},
            {date: '1969-11-18 03:47', at: 'moon', kind: 'arrive', orbit: {alt: 110, i: 165}, note: 'Into orbit around the Moon.'},
            {date: '1969-11-19 06:54', at: 'moon', kind: 'land', site: [-3.01, 336.58], note: 'Landed 180 m from Surveyor 3, in the Ocean of Storms.'},
            {date: '1969-11-20 14:25', at: 'moon', kind: 'liftoff', note: 'Lifted off after two moonwalks.'},
            {date: '1969-11-21 20:49', at: 'moon', kind: 'depart', note: 'Headed home.'},
            {date: '1969-11-24 20:58', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Splashed down near American Samoa.'},
        ],
    },
    {
        id: 'apollo13', name: 'Apollo 13', agency: 'NASA', color: '#ffb0a0', group: 'moon', crew: 'Jim Lovell, Jack Swigert, Fred Haise',
        about: 'A landing called off by an explosion; the crew swung around the Moon and made it home in their lander.',
        mass: '44,000 kg', power: 'Fuel cells, lost in the explosion; then the lander’s batteries',
        facts: [
            'They passed 254 km behind the Moon and set a record that stood for 56 years: 400,171 km from Earth.',
            'Engineers on the ground worked out how to fit a square air filter into a round hole with tape and cardboard.',
            '“Houston, we’ve had a problem.”',
        ],
        events: [
            {date: '1970-04-11 19:13', at: 'earth', kind: 'launch', note: 'Bound for the Fra Mauro highlands.'},
            {date: '1970-04-14 03:08', kind: 'note', title: 'Explosion', note: 'An oxygen tank blew up 330,000 km from Earth. The landing was off; the lander became a lifeboat.'},
            {date: '1970-04-15 00:21', at: 'moon', kind: 'flyby', alt: 254, note: 'Swung around the far side, 254 km up, and headed straight home: the farthest from Earth anyone had been.'},
            {date: '1970-04-17 18:07', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Home safe, near Samoa, cold and short of water.'},
        ],
    },
    {
        id: 'luna16', name: 'Luna 16', agency: 'Soviet Union', color: '#ffa0b8', group: 'moon',
        about: 'The first robot to bring lunar soil back to Earth.',
        mass: '5,725 kg',
        facts: [
            'A drill took a core 35 cm deep and sealed 101 g of soil in a capsule.',
            'The capsule flew straight home from the surface, without going into orbit first.',
        ],
        events: [
            {date: '1970-09-12 13:25', at: 'earth', kind: 'launch', note: 'Launched toward the Sea of Fertility.'},
            {date: '1970-09-17', at: 'moon', kind: 'arrive', note: 'Into orbit around the Moon.'},
            {date: '1970-09-20 05:18', at: 'moon', kind: 'land', site: [-0.51, 56.36], note: 'Landed in the Sea of Fertility and drilled into the soil.'},
            {date: '1970-09-21 07:43', at: 'moon', kind: 'liftoff', note: 'The return stage lifted off with its sample.'},
            {date: '1970-09-24 05:26', at: 'earth', kind: 'end', title: 'Sample home', note: 'The capsule parachuted down in Kazakhstan with 101 g of Moon.'},
        ],
    },
    {
        id: 'luna17', name: 'Luna 17 / Lunokhod 1', short: 'Lunokhod 1', agency: 'Soviet Union', color: '#d8b0ff', group: 'moon',
        about: 'Carried Lunokhod 1, the first rover on another world, driven by a crew in Crimea.',
        mass: '5,700 kg (rover 756 kg)', power: 'Solar panel in the lid; a nuclear heater for the lunar night',
        facts: [
            'Its drivers watched pictures that arrived seconds late and steered a step at a time.',
            'It drove 10.5 km over ten months, and its laser reflector is still in use.',
        ],
        events: [
            {date: '1970-11-10 14:44', at: 'earth', kind: 'launch', note: 'Launched with a rover aboard.'},
            {date: '1970-11-15', at: 'moon', kind: 'arrive', note: 'Into orbit around the Moon.'},
            {date: '1970-11-17 03:47', at: 'moon', kind: 'land', site: [38.28, 325.0], note: 'Landed in the Sea of Rains; Lunokhod 1 rolled down the ramp.'},
            {date: '1971-09-14', kind: 'end', note: 'Last contact with Lunokhod 1, after almost eleven lunar days.'},
        ],
    },
    {
        id: 'apollo15', name: 'Apollo 15', agency: 'NASA', color: '#a8e0ff', group: 'moon', crew: 'David Scott, James Irwin, Al Worden',
        about: 'The first long stay and the first car on the Moon, at the foot of the Apennine mountains.',
        mass: '46,800 kg', power: 'Fuel cells; batteries in the lander and the rover',
        facts: [
            'Scott dropped a hammer and a feather together; they hit the ground at the same moment.',
            'They found the Genesis Rock, a piece of the Moon’s early crust 4 billion years old.',
            'Worden made the first spacewalk in deep space on the way home.',
        ],
        events: [
            {date: '1971-07-26 13:34', at: 'earth', kind: 'launch', note: 'Launched with a rover folded up in the lander.'},
            {date: '1971-07-29 20:05', at: 'moon', kind: 'arrive', orbit: {alt: 110, i: 154}, note: 'Into orbit around the Moon.'},
            {date: '1971-07-30 22:16', at: 'moon', kind: 'land', site: [26.13, 3.63], note: 'Landed at Hadley Rille, beside mountains 4 km high.'},
            {date: '1971-08-02 17:11', at: 'moon', kind: 'liftoff', note: 'Lifted off after three days and 28 km of driving.'},
            {date: '1971-08-04 21:22', at: 'moon', kind: 'depart', note: 'Headed home, leaving a small satellite in lunar orbit.'},
            {date: '1971-08-07 20:45', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Splashed down north of Hawaii, one parachute short.'},
        ],
    },
    {
        id: 'apollo17', name: 'Apollo 17', agency: 'NASA', color: '#c8ffb0', group: 'moon', crew: 'Gene Cernan, Harrison Schmitt, Ron Evans',
        about: 'The last time people walked on the Moon, and the first scientist to do it.',
        mass: '46,700 kg', power: 'Fuel cells; batteries in the lander and the rover',
        facts: [
            'On the way out they took the Blue Marble, the photo of a full Earth.',
            'Schmitt, a geologist, found orange soil: glass beads from an ancient volcanic fountain.',
            'They spent 75 hours on the surface, the most of any crew.',
        ],
        events: [
            {date: '1972-12-07 05:33', at: 'earth', kind: 'launch', note: 'The only night launch of a Saturn V.'},
            {date: '1972-12-10 19:47', at: 'moon', kind: 'arrive', orbit: {alt: 110, i: 160}, note: 'Into orbit around the Moon.'},
            {date: '1972-12-11 19:54', at: 'moon', kind: 'land', site: [20.19, 30.77], note: 'Landed in the Taurus-Littrow valley.'},
            {date: '1972-12-14 22:54', at: 'moon', kind: 'liftoff', note: '“We leave as we came and, God willing, as we shall return.” The last liftoff from the Moon so far.'},
            {date: '1972-12-16 23:35', at: 'moon', kind: 'depart', note: 'Headed home.'},
            {date: '1972-12-19 19:24', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Splashed down in the Pacific. No one has been back since.'},
        ],
    },
    {
        id: 'lunarprospector', name: 'Lunar Prospector', short: 'Prospector', agency: 'NASA', color: '#9fe8d8', group: 'moon',
        about: 'A small, cheap orbiter that mapped the Moon’s makeup and hinted at ice at its poles.',
        mass: '296 kg', power: 'Solar cells',
        facts: [
            'It carried some of the ashes of Gene Shoemaker, the geologist who trained the Apollo crews, to the Moon.',
            'It was crashed into a shadowed crater on purpose, to look for a plume of water.',
        ],
        events: [
            {date: '1998-01-07 02:28', at: 'earth', kind: 'launch', note: 'Launched on an Athena II.'},
            {date: '1998-01-11 11:28', at: 'moon', kind: 'arrive', orbit: {alt: 100, i: 90}, note: 'Into a low polar orbit.'},
            {date: '1999-07-31 09:52', at: 'moon', kind: 'end', impact: true, site: [-87.7, 42.1], title: 'Impact', note: 'Crashed into a crater near the south pole on purpose; no water was seen in the plume.'},
        ],
    },
    {
        id: 'smart1', name: 'SMART-1', agency: 'ESA', color: '#b0c8ff', group: 'moon',
        about: 'Europe’s first Moon mission, pushed there by an ion engine on 82 kg of xenon.',
        mass: '367 kg', power: 'Solar panels driving an ion engine',
        facts: [
            'It spiraled out from Earth for more than a year, the slow way.',
            'Its engine gave about the push of a sheet of paper resting on your hand.',
        ],
        events: [
            {date: '2003-09-27 23:14', at: 'earth', kind: 'launch', note: 'Launched into an Earth orbit, to spiral outward on its ion engine.'},
            {date: '2004-11-15 17:47', at: 'moon', kind: 'arrive', path: 'spiral', orbit: {alt: 1000, i: 90}, note: 'Captured by the Moon’s gravity after 14 months.'},
            {date: '2006-09-03 05:42', at: 'moon', kind: 'end', impact: true, site: [-34.26, 313.78], title: 'Impact', note: 'Crashed on purpose; the flash was seen from a telescope in Hawaii.'},
        ],
    },
    {
        id: 'kaguya', name: 'Kaguya (SELENE)', short: 'Kaguya', agency: 'JAXA', color: '#ffc0e8', group: 'moon',
        about: 'Japan’s big lunar orbiter, with two small helpers, and an HD camera.',
        mass: '2,914 kg', power: 'Solar panels',
        facts: [
            'It filmed Earth rising over the Moon in high definition.',
            'It found a lava tube skylight in the Marius Hills, a possible shelter for future bases.',
        ],
        events: [
            {date: '2007-09-14 01:31', at: 'earth', kind: 'launch', note: 'Launched on an H-IIA.'},
            {date: '2007-10-04', at: 'moon', kind: 'arrive', path: 'loops', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon after two laps of Earth.'},
            {date: '2009-06-10 18:25', at: 'moon', kind: 'end', impact: true, site: [-65.5, 80.4], title: 'Impact', note: 'Crashed on purpose near Gill crater.'},
        ],
    },
    {
        id: 'chandrayaan1', name: 'Chandrayaan-1', agency: 'ISRO', color: '#ffb070', group: 'moon',
        about: 'India’s first Moon mission, which found water molecules spread across the surface.',
        mass: '1,380 kg', power: 'Solar panel',
        facts: [
            'A NASA instrument aboard, the Moon Mineralogy Mapper, saw the signature of water.',
            'Its impact probe hit near the south pole carrying India’s flag.',
        ],
        events: [
            {date: '2008-10-22 00:52', at: 'earth', kind: 'launch', note: 'Launched from Sriharikota.'},
            {date: '2008-11-04', at: 'earth', kind: 'depart', loops: 4, title: 'Off to the Moon', note: 'Its orbit raised step by step, it left Earth for the Moon.'},
            {date: '2008-11-08 11:21', at: 'moon', kind: 'arrive', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2008-11-14 15:01', kind: 'note', title: 'Impact probe', note: 'The Moon Impact Probe dropped onto the south pole region.'},
            {date: '2009-08-28 20:00', kind: 'end', note: 'Contact lost, after 10 months in orbit.'},
        ],
    },
    {
        id: 'lro', name: 'Lunar Reconnaissance Orbiter', short: 'LRO', agency: 'NASA', color: '#7fe0ff', group: 'moon',
        about: 'Mapping the Moon in detail since 2009, sharp enough to see the Apollo landers and their tracks.',
        mass: '1,916 kg', power: 'Solar panel',
        facts: [
            'It photographed every Apollo landing site, footpaths included.',
            'It measured the coldest place found in the solar system: −248 °C in craters near the poles.',
            'Its maps choose the landing sites for the Artemis missions.',
        ],
        events: [
            {date: '2009-06-18 21:32', at: 'earth', kind: 'launch', note: 'Launched with LCROSS, which later hit the Moon to look for water.'},
            {date: '2009-06-23 09:47', at: 'moon', kind: 'arrive', orbit: {alt: 50, i: 90}, note: 'Into a polar orbit around the Moon.'},
            {date: '2009-10-09 11:31', kind: 'note', title: 'LCROSS impact', note: 'Its launch partner LCROSS struck Cabeus crater and found water in the plume.'},
        ],
    },
    {
        id: 'grail', name: 'GRAIL', agency: 'NASA', color: '#e8a0ff', group: 'moon',
        about: 'Twin probes, Ebb and Flow, that mapped the Moon’s gravity by measuring the gap between them.',
        mass: '2 × 307 kg', power: 'Solar panels',
        facts: [
            'They took the slow way out, past the Sun-Earth L1 point, for three and a half months.',
            'The distance between them was measured to within a fraction of a micron.',
            'Schoolchildren chose their names and took pictures with cameras aboard.',
        ],
        events: [
            {date: '2011-09-10 13:08', at: 'earth', kind: 'launch', note: 'Launched on a Delta II.'},
            {date: '2011-12-31 22:00', at: 'moon', kind: 'arrive', path: 'far', orbit: {alt: 55, i: 90}, note: 'Ebb into orbit on New Year’s Eve; Flow followed on New Year’s Day.'},
            {date: '2012-12-17 22:28', at: 'moon', kind: 'end', impact: true, site: [75.6, 333.4], title: 'Impact', note: 'Both crashed on purpose into a mountain near the north pole, named after Sally Ride.'},
        ],
    },
    {
        id: 'change3', name: 'Chang’e 3', agency: 'CNSA', color: '#ff9f9f', group: 'moon',
        about: 'China’s first lander and rover, Yutu (Jade Rabbit), the first soft landing on the Moon in 37 years.',
        mass: '3,780 kg', power: 'Solar panels; a nuclear heater for the night',
        facts: [
            'Its rover Yutu got stuck after a month, but kept talking for years.',
            'The lander carried the first telescope on the Moon, looking out for ultraviolet light.',
        ],
        events: [
            {date: '2013-12-01 17:30', at: 'earth', kind: 'launch', note: 'Launched from Xichang.'},
            {date: '2013-12-06 09:53', at: 'moon', kind: 'arrive', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2013-12-14 13:11', at: 'moon', kind: 'land', site: [44.12, 340.49], note: 'Landed in the Sea of Rains; Yutu rolled off that night.'},
            {date: '2016-08-03', kind: 'end', note: 'Yutu was declared dead, after 31 months; the lander went on longer.'},
        ],
    },
    {
        id: 'change4', name: 'Chang’e 4', agency: 'CNSA', color: '#ffcf8f', group: 'moon',
        about: 'The first landing on the far side of the Moon, talking to Earth through a relay satellite.',
        mass: '3,640 kg', power: 'Solar panels; nuclear heaters',
        facts: [
            'The far side never faces Earth, so a relay, Queqiao, hangs beyond the Moon at Earth-Moon L2.',
            'Its rover Yutu-2 has driven over 1.5 km, the longest-lived rover on the Moon.',
            'A cotton seed sprouted in a sealed can aboard: the first plant to grow on the Moon.',
        ],
        events: [
            {date: '2018-12-07 18:23', at: 'earth', kind: 'launch', note: 'Launched from Xichang.'},
            {date: '2018-12-12 08:45', at: 'moon', kind: 'arrive', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2019-01-03 02:26', at: 'moon', kind: 'land', site: [-45.44, 177.6], note: 'The first landing on the far side, in Von Kármán crater.'},
        ],
    },
    {
        id: 'chandrayaan2', name: 'Chandrayaan-2', agency: 'ISRO', color: '#ffd070', group: 'moon',
        about: 'An orbiter still at work, and the lander Vikram, lost just above the surface.',
        mass: '3,850 kg', power: 'Solar panels',
        facts: [
            'Its orbiter carries the sharpest camera ever put around the Moon.',
            'Vikram was lost 2 km above the surface; amateur Shanmuga Subramanian spotted its debris in NASA photos.',
        ],
        events: [
            {date: '2019-07-22 09:13', at: 'earth', kind: 'launch', note: 'Launched on a GSLV Mk III.'},
            {date: '2019-08-13 20:51', at: 'earth', kind: 'depart', loops: 5, title: 'Off to the Moon', note: 'After five burns to raise its orbit, it left Earth for the Moon.'},
            {date: '2019-08-20 03:32', at: 'moon', kind: 'arrive', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2019-09-06 20:23', kind: 'note', title: 'Vikram lost', note: 'The lander Vikram lost contact during its descent, 2 km up, and crashed.'},
        ],
    },
    {
        id: 'change5', name: 'Chang’e 5', agency: 'CNSA', color: '#ff8fb8', group: 'moon',
        about: 'Brought back 1.7 kg of Moon rock, the first new samples since 1976.',
        mass: '8,200 kg', power: 'Solar panels',
        facts: [
            'Its rocks, 2 billion years old, are the youngest lunar lava found.',
            'It docked robotically in lunar orbit, a first, to hand over its samples.',
            'It raised a fabric flag of China on the Moon.',
        ],
        events: [
            {date: '2020-11-23 20:30', at: 'earth', kind: 'launch', note: 'Launched on a Long March 5.'},
            {date: '2020-11-28 12:58', at: 'moon', kind: 'arrive', orbit: {alt: 200, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2020-12-01 15:11', at: 'moon', kind: 'land', site: [43.06, 308.08], note: 'Landed near Mons Rümker and started drilling.'},
            {date: '2020-12-03 15:10', at: 'moon', kind: 'liftoff', note: 'The ascent stage lifted off with the samples.'},
            {date: '2020-12-12 01:54', at: 'moon', kind: 'depart', note: 'Samples aboard, it left lunar orbit for home.'},
            {date: '2020-12-16 17:59', at: 'earth', kind: 'end', title: 'Sample home', note: 'The capsule landed in Inner Mongolia with 1,731 g of Moon.'},
        ],
    },
    {
        id: 'capstone', name: 'CAPSTONE', agency: 'NASA', color: '#a0ffd0', group: 'moon',
        about: 'A microwave-oven-sized probe that tested the long, looping halo orbit chosen for the Gateway station.',
        mass: '25 kg', power: 'Solar panels',
        facts: [
            'It took four months to get there on very little fuel, the slow way, out past the Moon and back.',
            'Its near-rectilinear halo orbit passes 1,600 km over one pole and 70,000 km over the other.',
        ],
        events: [
            {date: '2022-06-28 09:55', at: 'earth', kind: 'launch', note: 'Launched from New Zealand on a Rocket Lab Electron.'},
            {date: '2022-11-14 00:18', at: 'moon', kind: 'arrive', path: 'far', orbit: 'nrho', note: 'Into its near-rectilinear halo orbit.'},
            {date: '2026-05', kind: 'end', note: 'Its extended mission was done, after more than three years in the orbit.'},
        ],
    },
    {
        id: 'danuri', name: 'Danuri (KPLO)', short: 'Danuri', agency: 'KARI', color: '#90b8ff', group: 'moon',
        about: 'South Korea’s first Moon mission, carrying a NASA camera that peers into shadowed polar craters.',
        mass: '678 kg', power: 'Solar panels',
        facts: [
            'It took a long loop out toward the Sun and back to save fuel.',
            'It played BTS’s “Dynamite” from space, as a test of its network link.',
        ],
        events: [
            {date: '2022-08-04 23:08', at: 'earth', kind: 'launch', note: 'Launched on a Falcon 9.'},
            {date: '2022-12-16 18:00', at: 'moon', kind: 'arrive', path: 'far', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon.'},
        ],
    },
    {
        id: 'artemis1', name: 'Artemis I', agency: 'NASA', color: '#ffc8a0', group: 'moon',
        about: 'The first flight of the Orion capsule and the SLS rocket, with no crew, out past the Moon and back.',
        mass: '26,500 kg', power: 'Solar arrays on its European service module',
        facts: [
            'Three mannequins rode along to measure radiation and the ride.',
            'It went farther than any capsule built for people: 432,000 km from Earth.',
            'Its heat shield came back more charred than expected, which shaped Artemis II.',
        ],
        events: [
            {date: '2022-11-16 06:47', at: 'earth', kind: 'launch', note: 'The first launch of the Space Launch System.'},
            {date: '2022-11-21 12:44', at: 'moon', kind: 'flyby', alt: 130, note: 'Swept 130 km over the far side.'},
            {date: '2022-11-25 21:52', at: 'moon', kind: 'arrive', orbit: 'dro', note: 'Into a distant retrograde orbit, high above the Moon.'},
            {date: '2022-12-01 21:53', at: 'moon', kind: 'depart', note: 'Out of the distant orbit, half a lap later.'},
            {date: '2022-12-05 16:43', at: 'moon', kind: 'flyby', alt: 127, note: 'Swept 127 km over the Moon again, for the push home.'},
            {date: '2022-12-11 17:40', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Splashed down off Baja California at 40,000 km/h on the way in.'},
        ],
    },
    {
        id: 'chandrayaan3', name: 'Chandrayaan-3', agency: 'ISRO', color: '#ffe080', group: 'moon',
        about: 'India’s lander and rover, the first to land in the far south, near the pole.',
        mass: '3,900 kg', power: 'Solar panels',
        facts: [
            'The rover Pragyan confirmed sulfur in the soil near the pole.',
            'The lander hopped 40 cm on its last day, a test for future sample return.',
            'India was the fourth country to land softly on the Moon.',
        ],
        events: [
            {date: '2023-07-14 09:05', at: 'earth', kind: 'launch', note: 'Launched on an LVM3.'},
            {date: '2023-08-01 00:00', at: 'earth', kind: 'depart', loops: 5, title: 'Off to the Moon', note: 'After five burns to raise its orbit, it left Earth for the Moon.'},
            {date: '2023-08-05 13:45', at: 'moon', kind: 'arrive', orbit: {alt: 150, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2023-08-23 12:33', at: 'moon', kind: 'land', site: [-69.37, 32.32], note: 'Vikram landed near the south pole; Pragyan rolled out.'},
            {date: '2023-09-03', kind: 'end', note: 'Vikram and Pragyan went to sleep for the lunar night, and did not wake.'},
        ],
    },
    {
        id: 'slim', name: 'SLIM', agency: 'JAXA', color: '#ffa0d0', group: 'moon',
        about: 'Japan’s “Moon sniper”, which landed within 100 m of its target, upside down.',
        mass: '700 kg', power: 'Solar cells',
        facts: [
            'An engine lost a nozzle just before landing, and it came to rest on its nose.',
            'Two tiny rovers hopped off before it touched down; one, the size of a ball, took its photo.',
            'It survived three lunar nights it was never built for.',
        ],
        events: [
            {date: '2023-09-06 23:42', at: 'earth', kind: 'launch', note: 'Launched with the XRISM X-ray telescope.'},
            {date: '2023-12-25 07:51', at: 'moon', kind: 'arrive', path: 'far', orbit: {alt: 600, i: 90}, note: 'Into orbit around the Moon, after a long loop to save fuel.'},
            {date: '2024-01-19 15:20', at: 'moon', kind: 'land', site: [-13.32, 25.25], note: 'Landed within 100 m of its target near Shioli crater, on its nose.'},
            {date: '2024-08-23', kind: 'end', note: 'The mission was ended after it stopped answering.'},
        ],
    },
    {
        id: 'odysseus', name: 'IM-1 Odysseus', short: 'Odysseus', agency: 'Intuitive Machines/NASA', color: '#c0ffa0', group: 'moon',
        about: 'The first private spacecraft to land on the Moon, and the first American landing since 1972.',
        mass: '1,900 kg', power: 'Solar panels',
        facts: [
            'Its laser rangefinders had been left switched off; it landed using a NASA experiment instead.',
            'It caught a leg on landing and tipped onto its side, but kept working for a week.',
        ],
        events: [
            {date: '2024-02-15 06:05', at: 'earth', kind: 'launch', note: 'Launched on a Falcon 9.'},
            {date: '2024-02-21 08:11', at: 'moon', kind: 'arrive', orbit: {alt: 92, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2024-02-22 23:23', at: 'moon', kind: 'land', site: [-80.13, 1.44], note: 'Landed near Malapert A, tipped over: the southernmost landing yet.'},
            {date: '2024-02-29', kind: 'end', note: 'Its last pictures sent, it went quiet as night fell.'},
        ],
    },
    {
        id: 'change6', name: 'Chang’e 6', agency: 'CNSA', color: '#ffb890', group: 'moon',
        about: 'The first rock brought back from the far side of the Moon.',
        mass: '8,350 kg', power: 'Solar panels',
        facts: [
            'It landed in the South Pole-Aitken basin, the largest and oldest crater on the Moon.',
            'It talked to Earth through Queqiao-2, a relay in a long orbit around the Moon.',
            'It brought back 1,935 g.',
        ],
        events: [
            {date: '2024-05-03 09:27', at: 'earth', kind: 'launch', note: 'Launched on a Long March 5.'},
            {date: '2024-05-08 02:12', at: 'moon', kind: 'arrive', orbit: {alt: 200, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2024-06-01 22:23', at: 'moon', kind: 'land', site: [-41.64, 206.0], note: 'Landed on the far side, in Apollo crater.'},
            {date: '2024-06-03 23:38', at: 'moon', kind: 'liftoff', note: 'The first liftoff from the far side.'},
            {date: '2024-06-20 06:57', at: 'moon', kind: 'depart', note: 'Samples aboard, it left lunar orbit for home.'},
            {date: '2024-06-25 06:07', at: 'earth', kind: 'end', title: 'Sample home', note: 'The capsule landed in Inner Mongolia.'},
        ],
    },
    {
        id: 'blueghost1', name: 'Blue Ghost 1', agency: 'Firefly/NASA', color: '#80d8ff', group: 'moon',
        about: 'The first fully successful private landing on the Moon.',
        mass: '1,500 kg', power: 'Solar panels',
        facts: [
            'It watched a total eclipse of the Sun by Earth from the Moon.',
            'It filmed the sunset on the Moon, and the glow of dust above the horizon that Apollo crews drew.',
        ],
        events: [
            {date: '2025-01-15 06:11', at: 'earth', kind: 'launch', note: 'Launched on a Falcon 9 with Japan’s Resilience lander.'},
            {date: '2025-02-09 00:00', at: 'earth', kind: 'depart', loops: 4, title: 'Off to the Moon', note: 'Done with its laps of Earth, it left for the Moon.'},
            {date: '2025-02-13 08:45', at: 'moon', kind: 'arrive', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2025-03-02 08:34', at: 'moon', kind: 'land', site: [18.56, 61.81], note: 'Landed upright in Mare Crisium.'},
            {date: '2025-03-16 23:15', kind: 'end', note: 'Lunar night fell, after 14 days on the surface.'},
        ],
    },
    {
        id: 'athena', name: 'IM-2 Athena', short: 'Athena', agency: 'Intuitive Machines/NASA', color: '#e0c8ff', group: 'moon',
        about: 'A lander aimed at the south pole that landed on its side in a crater.',
        mass: '1,900 kg', power: 'Solar panels',
        facts: [
            'It carried a drill to look for ice, and a hopper meant to jump into a dark crater.',
        ],
        events: [
            {date: '2025-02-27 00:16', at: 'earth', kind: 'launch', note: 'Launched on a Falcon 9.'},
            {date: '2025-03-03 11:00', at: 'moon', kind: 'arrive', orbit: {alt: 100, i: 90}, note: 'Into orbit around the Moon.'},
            {date: '2025-03-06 17:28', at: 'moon', kind: 'land', site: [-84.8, 29.2], note: 'Landed on Mons Mouton, 250 m off target and on its side.'},
            {date: '2025-03-07', kind: 'end', note: 'With its panels in shadow, its batteries ran out.'},
        ],
    },
    {
        id: 'artemis2', name: 'Artemis II', agency: 'NASA/CSA', color: '#ffe0f0', group: 'moon', crew: 'Reid Wiseman, Victor Glover, Christina Koch, Jeremy Hansen',
        about: 'The first crew to go to the Moon since 1972, on a free-return loop around its far side.',
        mass: '26,500 kg', power: 'Solar arrays on its European service module',
        facts: [
            'Christina Koch is the first woman, Victor Glover the first Black astronaut and Jeremy Hansen the first non-American to fly to the Moon.',
            'They went 406,771 km from Earth, beating Apollo 13’s record by 6,600 km.',
            'Their capsule, Integrity, was named by the crew.',
        ],
        events: [
            {date: '2026-04-01 22:35', at: 'earth', kind: 'launch', note: 'Launched from Kennedy Space Center: people bound for the Moon again, after 53 years.'},
            {date: '2026-04-06 23:05', at: 'moon', kind: 'flyby', alt: 6545, note: 'Swung 6,545 km over the far side, farther from Earth than anyone has been.'},
            {date: '2026-04-11 00:07', at: 'earth', kind: 'end', title: 'Splashdown', note: 'Splashed down off San Diego.'},
        ],
    },
];

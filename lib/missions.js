// Spacecraft of the space age, with the real dates of each encounter (and
// the planned dates of those still to come), and the trajectories rebuilt
// from them.
//
// Each leg between two encounters is the conic (Lambert's problem) that joins
// the bodies' real positions on those dates. Engine burns between encounters
// are not modelled, so the path is right at every encounter and close in
// between. Dates after today are plans, and are shown as such.
//
// Event fields:
//   date     'YYYY-MM-DD', or 'YYYY-MM' / 'YYYY' when only that much is known
//   at       body the craft is at (positional event), or
//   point    [AU, ecliptic longitude, latitude] for a place in empty space
//   kind     launch | flyby | arrive | depart | point | note | end
//   turns    rough number of laps around the Sun on the leg *into* this event
//            ('auto' picks the least eccentric conic); default is a direct arc
//   q / Q    perihelion / aphelion hint (AU) for picking among multi-lap conics
//   laps     with q: a resonant leg (the planet returns to the same spot), so
//            the orbit is built from the lap count instead of Lambert; inc
//            gives that orbit's tilt to the ecliptic in degrees
//   hop      a short trip near a planet (to a Lagrange point, say), drawn
//            relative to that planet rather than as an orbit of the Sun
//   impact   the mission ended by crashing into the body
//
// Mission fields: group 'observatory' for telescopes parked at L1 or L2
// (kept out of the mission list on screen), or 'moon' for missions to the
// Moon (moon-missions.js; lunar.js builds their paths); about, mass, power and facts for
// the full card; after: what happens past the last encounter ('coast', or
// {escape: AU a year, toward: [longitude, latitude] of the direction of
// travel} for craft leaving the solar system).

import * as Astro from './astro.js';
import {LunarTrajectory} from './lunar.js';
import {MOON_MISSIONS} from './moon-missions.js';
import {WAYPOINTS} from './waypoints.js';

export const MISSIONS = [
    {
        id: 'mariner10', name: 'Mariner 10', agency: 'NASA', color: '#ffd27a',
        about: 'The first spacecraft to visit two planets, and the first to use a gravity assist.',
        mass: '503 kg', power: 'Solar panels',
        facts: [
            'It mapped about 45% of Mercury; the rest waited 34 years for MESSENGER.',
            'Its engineers used sunlight pressure on the solar panels to steer when it ran short of gas.',
            'It took the first close-up pictures of Venus’s swirling clouds, in ultraviolet.',
        ],
        events: [
            {date: '1973-11-03', at: 'earth', kind: 'launch', note: 'Bound for Venus and Mercury.'},
            {date: '1974-02-05', at: 'venus', kind: 'flyby', note: 'The first gravity assist ever flown: Venus bent its path toward Mercury.'},
            {date: '1974-03-29', at: 'mercury', kind: 'flyby', note: 'First close look at Mercury, which turned out to have a magnetic field.'},
            {date: '1974-09-21', at: 'mercury', kind: 'flyby', laps: 1, q: 0.46, note: 'Second pass: its orbit was tuned to meet Mercury every two Mercury years.'},
            {date: '1975-03-16', at: 'mercury', kind: 'flyby', laps: 1, q: 0.46, note: 'Third and closest pass, 327 km above the surface.'},
            {date: '1975-03-24', kind: 'end', note: 'Out of attitude-control gas; switched off in orbit around the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'pioneer10', name: 'Pioneer 10', agency: 'NASA', color: '#ffb38a',
        about: 'The first spacecraft to cross the asteroid belt and to visit Jupiter.',
        mass: '258 kg', power: 'Four nuclear batteries (RTGs)',
        facts: [
            'It carries the Pioneer plaque, a drawing of two people and a map to the Sun, in case anyone finds it.',
            'It showed the asteroid belt was safe to cross: more empty space than rocks.',
            'Jupiter’s radiation nearly fried it, which shaped how later craft were built.',
            'It will take about 2 million years to reach the neighborhood of Aldebaran.',
        ],
        events: [
            {date: '1972-03-03', at: 'earth', kind: 'launch', note: 'Headed for the first trip through the asteroid belt.'},
            {date: '1973-12-04', at: 'jupiter', kind: 'flyby', note: 'First spacecraft to fly past Jupiter; the flyby flung it out of the solar system.'},
            {date: '2003-01-23', point: [82.1, 77.5, 3.0], kind: 'point', title: 'Last signal', note: 'Last faint signal received, from 12 billion km. It drifts on toward Aldebaran.'},
        ],
        after: {escape: 2.51, toward: [84.0, 2.9]},
        silentAfter: '2003-01-23',
    },
    {
        id: 'pioneer11', name: 'Pioneer 11', agency: 'NASA', color: '#f59a9a',
        about: 'The first spacecraft to visit Saturn, scouting the way for the Voyagers.',
        mass: '259 kg', power: 'Four nuclear batteries (RTGs)',
        facts: [
            'It flew through the gap between Saturn and its rings to check the path was safe for Voyager 2.',
            'It found Saturn’s F ring and a small moon it nearly hit.',
            'It carries a copy of the Pioneer plaque.',
        ],
        events: [
            {date: '1973-04-06', at: 'earth', kind: 'launch', note: 'A backup to Pioneer 10, retargeted on the way.'},
            {date: '1974-12-03', at: 'jupiter', kind: 'flyby', note: 'Passed 43,000 km above the clouds; Jupiter swung it across the solar system to Saturn.'},
            {date: '1979-09-01', at: 'saturn', kind: 'flyby', note: 'First spacecraft to visit Saturn.'},
            {date: '1995-09-30', point: [44.1, 272.9, 15.4], kind: 'point', title: 'Last signal', note: 'Power ran too low to talk to Earth. It coasts toward the constellation Aquila.'},
        ],
        after: {escape: 2.38, toward: [291.7, 12.6]},
        silentAfter: '1995-09-30',
    },
    {
        id: 'voyager2', name: 'Voyager 2', agency: 'NASA', color: '#8fe3c0',
        about: 'The only spacecraft to visit all four giant planets, and the only one to see Uranus and Neptune up close.',
        mass: '722 kg', power: 'Three nuclear batteries (RTGs), losing about 4 W a year',
        facts: [
            'It carries a Golden Record of sounds, music and greetings in 55 languages.',
            'Its computers have about 70 KB of memory, less than a single photo today.',
            'It found 11 moons of Uranus and the rings of Neptune.',
            'Its signal reaches Earth at about a billionth of a billionth of a watt.',
            'Instruments are switched off one by one to stretch its fading power.',
        ],
        events: [
            {date: '1977-08-20', at: 'earth', kind: 'launch', note: 'Launched 16 days before its twin to ride a once-in-176-years planetary alignment.'},
            {date: '1979-07-09', at: 'jupiter', kind: 'flyby', note: 'Jupiter’s pull sped it on toward Saturn.'},
            {date: '1981-08-26', at: 'saturn', kind: 'flyby', note: 'Saturn’s gravity aimed it at Uranus.'},
            {date: '1986-01-24', at: 'uranus', kind: 'flyby', note: 'The only visit ever to Uranus.'},
            {date: '1989-08-25', at: 'neptune', kind: 'flyby', note: 'The only visit to Neptune; it saw the Great Dark Spot and geysers on Triton.'},
            {date: '2018-11-05', point: [119, 290.1, -36.5], kind: 'point', title: 'Interstellar space', note: 'Crossed the heliopause at 119 AU, leaving the Sun’s bubble of solar wind.'},
        ],
        after: {escape: 3.21, toward: [294.3, -47.9]},
    },
    {
        id: 'voyager1', name: 'Voyager 1', agency: 'NASA', color: '#7fd0ff',
        about: 'The most distant human-made object, and the first to reach interstellar space.',
        mass: '722 kg', power: 'Three nuclear batteries (RTGs), losing about 4 W a year',
        facts: [
            'It carries a Golden Record, with a stylus and instructions for playing it.',
            'Its 1990 “Family Portrait” caught six planets from beyond Neptune.',
            'Each command from Earth takes almost a day to arrive.',
            'In 40,000 years it will pass within 1.6 light-years of the star Gliese 445.',
            'It gains about 3.6 AU every year.',
        ],
        events: [
            {date: '1977-09-05', at: 'earth', kind: 'launch', note: 'Launched second but on a faster path, so it reached Jupiter first.'},
            {date: '1979-03-05', at: 'jupiter', kind: 'flyby', note: 'Spotted erupting volcanoes on Io, the first seen beyond Earth.'},
            {date: '1980-11-12', at: 'saturn', kind: 'flyby', note: 'A close pass by Titan threw it up and out of the plane of the planets.'},
            {date: '1990-02-14', kind: 'note', title: 'Pale Blue Dot', note: 'Turned around and photographed Earth as a speck from about 6 billion km.'},
            {date: '2012-08-25', point: [121.6, 254.9, 34.9], kind: 'point', title: 'Interstellar space', note: 'First human-made object to cross into interstellar space, at about 122 AU.'},
            {date: '2026-11-18', kind: 'note', title: 'One light-day', note: 'Reaches one light-day from Earth: radio signals take 24 hours each way.'},
        ],
        after: {escape: 3.57, toward: [261.4, 35.5]},
    },
    {
        id: 'giotto', name: 'Giotto', agency: 'ESA', color: '#ffcf9e',
        about: 'Europe’s first deep-space mission, and the first to photograph a comet’s nucleus.',
        mass: '960 kg', power: 'Solar cells on its drum-shaped body',
        facts: [
            'Named after the painter Giotto di Bondone, who painted Halley’s Comet as the Star of Bethlehem in 1305.',
            'A dust shield on its front took hits at 68 km/s; one grain set it spinning off course for a while.',
            'The first spacecraft to swing past Earth for a gravity assist.',
        ],
        events: [
            {date: '1985-07-02', at: 'earth', kind: 'launch', note: 'Part of an international fleet sent to meet Halley’s Comet.'},
            {date: '1986-03-14', at: 'halley', kind: 'flyby', note: 'Passed 596 km from the nucleus and found it darker than coal.'},
            {date: '1990-07-02', at: 'earth', kind: 'flyby', turns: 'auto', note: 'The first Earth gravity assist, retargeting it to a second comet.'},
            {date: '1992-07-10', kind: 'note', title: 'Comet Grigg–Skjellerup', note: 'Flew within about 200 km of a second comet.'},
            {date: '1992-07-23', kind: 'end', note: 'Switched off; it still circles the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'galileo', name: 'Galileo', agency: 'NASA', color: '#ffe08a',
        about: 'The first spacecraft to orbit Jupiter, and to drop a probe into its atmosphere.',
        mass: '2,560 kg with its probe', power: 'Two nuclear batteries (RTGs)',
        facts: [
            'Its main antenna never fully opened, so it sent everything through a small backup at a trickle.',
            'It found strong evidence for an ocean under Europa’s ice.',
            'Its probe fell for 58 minutes into Jupiter before the heat and pressure crushed it.',
        ],
        events: [
            {date: '1989-10-18', at: 'earth', kind: 'launch', note: 'Too heavy to fly straight to Jupiter, it looped Venus–Earth–Earth (VEEGA).'},
            {date: '1990-02-10', at: 'venus', kind: 'flyby', note: 'Venus gravity assist, the first of three.'},
            {date: '1990-12-08', at: 'earth', kind: 'flyby', note: 'First Earth flyby, onto a two-year loop through the asteroid belt.'},
            {date: '1991-10-29', at: 'gaspra', kind: 'flyby', note: 'The first close flyby of an asteroid.'},
            {date: '1992-12-08', at: 'earth', kind: 'flyby', laps: 1, q: 0.9, note: 'Second Earth flyby, the final push to Jupiter.'},
            {date: '1993-08-28', at: 'ida', kind: 'flyby', note: 'Found Dactyl, the first known moon of an asteroid.'},
            {date: '1994-07-16', kind: 'note', title: 'Comet Shoemaker–Levy 9', note: 'Had the only direct view of the comet’s pieces slamming into Jupiter.'},
            {date: '1995-12-07', at: 'jupiter', kind: 'arrive', note: 'First spacecraft to orbit Jupiter; its probe plunged into the atmosphere the same day.'},
            {date: '2003-09-21', at: 'jupiter', kind: 'end', impact: true, note: 'Steered into Jupiter so it could never contaminate Europa.'},
        ],
    },
    {
        id: 'ulysses', name: 'Ulysses', agency: 'ESA/NASA', color: '#e9b8ff',
        about: 'The first spacecraft to fly over the Sun’s poles.',
        mass: '367 kg', power: 'One nuclear battery (RTG)',
        facts: [
            'No rocket could leave the plane of the planets so steeply, so it used Jupiter to throw it 80° out.',
            'It found the solar wind blows twice as fast over the poles as near the equator.',
            'It flew through the tails of three comets by chance, including Hyakutake’s 500 million km tail.',
            'Planned for 5 years, it worked for almost 19.',
        ],
        events: [
            {date: '1990-10-06', at: 'earth', kind: 'launch', note: 'Launched from the Space Shuttle Discovery toward Jupiter.'},
            {date: '1992-02-08', at: 'jupiter', kind: 'flyby', note: 'Jupiter flung it out of the plane of the planets, into an orbit over the Sun’s poles.'},
            {date: '1994-09-13', kind: 'note', title: 'Over the south pole', note: 'The first look at the Sun from above its south pole, 80° out of the ecliptic.'},
            {date: '1995-07-31', kind: 'note', title: 'Over the north pole', note: 'Over the north pole after a quick dash past the Sun.'},
            {date: '1996-05-01', kind: 'note', title: 'Comet Hyakutake', note: 'Flew through the comet’s tail, 500 million km from its head.'},
            {date: '2000-11-27', kind: 'note', title: 'Solar maximum', note: 'Over the south pole again, now with the Sun at its stormiest.'},
            {date: '2009-06-30', kind: 'end', note: 'Its fuel froze as its power faded; switched off after almost 19 years.'},
        ],
        after: {elements: {a: 3.372, e: 0.602, i: 79.189, node: 338.206, peri: 358.88, tp: 2449789.528}},
    },
    {
        id: 'cassini', name: 'Cassini–Huygens', short: 'Cassini', agency: 'NASA/ESA/ASI', color: '#c9a7ff',
        about: 'Thirteen years orbiting Saturn, and the first landing in the outer solar system.',
        mass: '5,712 kg with fuel and Huygens', power: 'Three nuclear batteries (RTGs)',
        facts: [
            'It discovered the geysers of Enceladus and the seas of Titan.',
            'It made 294 orbits of Saturn and 162 targeted moon flybys.',
            'Huygens landed on Titan on a plain of icy pebbles, rounded like river stones.',
            'Its last 22 orbits threaded the gap between Saturn and its rings.',
        ],
        events: [
            {date: '1997-10-15', at: 'earth', kind: 'launch', note: 'Headed inward first, for a Venus–Venus–Earth–Jupiter tour.'},
            {date: '1998-04-26', at: 'venus', kind: 'flyby', note: 'First Venus gravity assist.'},
            {date: '1999-06-24', at: 'venus', kind: 'flyby', turns: 1, note: 'Second Venus flyby.'},
            {date: '1999-08-18', at: 'earth', kind: 'flyby', note: 'Earth flyby added about 5.5 km/s.'},
            {date: '2000-12-30', at: 'jupiter', kind: 'flyby', note: 'Jupiter flyby, studied together with the Galileo orbiter.'},
            {date: '2004-07-01', at: 'saturn', kind: 'arrive', note: 'Entered orbit around Saturn after a seven-year trip.'},
            {date: '2005-01-14', kind: 'note', title: 'Huygens lands on Titan', note: 'The farthest landing ever made, on Saturn’s moon Titan.'},
            {date: '2017-09-15', at: 'saturn', kind: 'end', impact: true, note: 'Grand Finale: dove into Saturn’s atmosphere after 13 years in orbit.'},
        ],
    },
    {
        id: 'rosetta', name: 'Rosetta', agency: 'ESA', color: '#9fd0ff',
        about: 'The first spacecraft to orbit a comet and to land on one.',
        mass: '3,000 kg with fuel and Philae', power: 'Solar panels, 64 m² in all',
        facts: [
            'Named after the Rosetta Stone, which unlocked Egyptian hieroglyphs.',
            'It slept for 31 months in deep space to save power, then woke on schedule in 2014.',
            'Philae bounced twice and came to rest in a shadow, then woke briefly months later.',
        ],
        events: [
            {date: '2004-03-02', at: 'earth', kind: 'launch', note: 'A ten-year chase of comet 67P/Churyumov–Gerasimenko.'},
            {date: '2005-03-04', at: 'earth', kind: 'flyby', laps: 1, q: 0.9, note: 'First of three Earth gravity assists.'},
            {date: '2007-02-25', at: 'mars', kind: 'flyby', turns: 'auto', note: 'Skimmed 250 km above Mars, its riskiest flyby.'},
            {date: '2007-11-13', at: 'earth', kind: 'flyby', note: 'Second Earth flyby.'},
            {date: '2008-09-05', kind: 'note', title: 'Asteroid Šteins', note: 'Flew past the asteroid 2867 Šteins.'},
            {date: '2009-11-13', at: 'earth', kind: 'flyby', laps: 1, q: 0.91, note: 'Third Earth flyby, onto the comet’s path.'},
            {date: '2010-07-10', kind: 'note', title: 'Asteroid Lutetia', note: 'Flew past the 100 km asteroid 21 Lutetia.'},
            {date: '2014-08-06', at: '67p', kind: 'arrive', note: 'First spacecraft to orbit a comet, after 31 months asleep.'},
            {date: '2014-11-12', kind: 'note', title: 'Philae lands', note: 'Its lander Philae made the first landing on a comet.'},
            {date: '2016-09-30', at: '67p', kind: 'end', impact: true, note: 'Set down gently on the comet to end the mission.'},
        ],
    },
    {
        id: 'messenger', name: 'MESSENGER', agency: 'NASA', color: '#ffa86b',
        about: 'The first spacecraft to orbit Mercury.',
        mass: '1,107 kg with fuel', power: 'Solar panels, half of them mirrors to shed heat',
        facts: [
            'A ceramic-cloth sunshade kept it at room temperature where sunlight is 11 times Earth’s.',
            'It mapped all of Mercury and found its water ice and odd, off-center magnetic field.',
            'In its last weeks it used leftover helium as fuel to stay up a little longer.',
        ],
        events: [
            {date: '2004-08-03', at: 'earth', kind: 'launch', note: 'Mercury is hard to reach: falling toward the Sun makes you too fast to stop.'},
            {date: '2005-08-02', at: 'earth', kind: 'flyby', laps: 1, q: 0.9, note: 'Earth flyby to start shedding speed.'},
            {date: '2006-10-24', at: 'venus', kind: 'flyby', turns: 'auto', note: 'First Venus flyby.'},
            {date: '2007-06-05', at: 'venus', kind: 'flyby', laps: 1, q: 0.55, note: 'Second Venus flyby.'},
            {date: '2008-01-14', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'First of three Mercury flybys.'},
            {date: '2008-10-06', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Second Mercury flyby.'},
            {date: '2009-09-29', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Third Mercury flyby; six planetary flybys in all.'},
            {date: '2011-03-18', at: 'mercury', kind: 'arrive', turns: 'auto', note: 'First spacecraft to orbit Mercury.'},
            {date: '2015-04-30', at: 'mercury', kind: 'end', impact: true, note: 'Out of fuel, it crashed into Mercury after four years in orbit.'},
        ],
    },
    {
        id: 'newhorizons', name: 'New Horizons', agency: 'NASA', color: '#a8f08a',
        about: 'The first spacecraft to visit Pluto and a Kuiper belt object.',
        mass: '478 kg', power: 'One nuclear battery (RTG)',
        facts: [
            'It carries some of the ashes of Clyde Tombaugh, who discovered Pluto.',
            'Pluto was still a planet when it launched; it was reclassified seven months later.',
            'Its Pluto data took 15 months to trickle home at about 1 kilobit per second.',
            'About the size and weight of a grand piano.',
        ],
        events: [
            {date: '2006-01-19', at: 'earth', kind: 'launch', note: 'The fastest launch ever: it passed the Moon’s orbit in about nine hours.'},
            {date: '2007-02-28', at: 'jupiter', kind: 'flyby', note: 'Jupiter’s pull cut about three years off the trip to Pluto.'},
            {date: '2015-07-14', at: 'pluto', kind: 'flyby', note: 'First close look at Pluto and its bright, heart-shaped nitrogen plain.'},
            {date: '2019-01-01', at: 'arrokoth', kind: 'flyby', note: 'Arrokoth: the most distant object ever explored up close, 6.6 billion km from the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'dawn', name: 'Dawn', agency: 'NASA', color: '#7ff0e0',
        about: 'The only spacecraft to orbit two worlds beyond Earth: Vesta and Ceres.',
        mass: '1,218 kg with fuel', power: 'Solar panels feeding three ion engines',
        facts: [
            'Its ion engines pushed with the force of a sheet of paper resting on your hand, but for years on end.',
            'In all, its engines changed its speed by 11 km/s, a record for a spacecraft’s own propulsion.',
            'It found the salty bright spots of Ceres’s Occator crater.',
            'Out of fuel, it was left in a high orbit so it will not hit Ceres for decades.',
        ],
        events: [
            {date: '2007-09-27', at: 'earth', kind: 'launch', note: 'Bound for the two largest bodies of the asteroid belt.'},
            {date: '2009-02-17', at: 'mars', kind: 'flyby', note: 'A Mars gravity assist tilted its orbit toward Vesta’s.'},
            {date: '2011-07-16', at: 'vesta', kind: 'arrive', turns: 'auto', note: 'Entered orbit around Vesta.'},
            {date: '2012-09-05', at: 'vesta', kind: 'depart', note: 'Spiraled away from Vesta, bound for Ceres.'},
            {date: '2015-03-06', at: 'ceres', kind: 'arrive', turns: 'auto', note: 'First spacecraft to orbit a dwarf planet.'},
            {date: '2018-11-01', at: 'ceres', kind: 'end', note: 'Out of fuel; it stays silent in orbit around Ceres.'},
        ],
    },
    {
        id: 'juno', name: 'Juno', agency: 'NASA', color: '#ff9fd0',
        about: 'A solar-powered orbiter that loops over Jupiter’s poles.',
        mass: '3,625 kg with fuel', power: 'Solar panels, the farthest from the Sun ever used',
        facts: [
            'Its instruments sit in a titanium vault to shield them from Jupiter’s radiation.',
            'It carries three Lego figures: Galileo, Jupiter and his wife Juno.',
            'It found Jupiter’s core is fuzzy and spread out, not a tight ball.',
            'It photographed clusters of cyclones packed around both poles.',
        ],
        events: [
            {date: '2011-08-05', at: 'earth', kind: 'launch', note: 'A solar-powered Jupiter orbiter.'},
            {date: '2013-10-09', at: 'earth', kind: 'flyby', turns: 1, Q: 2.3, note: 'Looped back past Earth for a boost of about 7.3 km/s.'},
            {date: '2016-07-05', at: 'jupiter', kind: 'arrive', note: 'Entered a polar orbit to look beneath Jupiter’s clouds.'},
        ],
    },
    {
        id: 'hayabusa2', name: 'Hayabusa2', agency: 'JAXA', color: '#ff8fa8',
        about: 'Brought back a sample of asteroid Ryugu, and is now on its way to a second, tiny asteroid.',
        mass: '609 kg', power: 'Solar panels feeding ion engines',
        facts: [
            'It shot a 2 kg copper bullet into Ryugu to make a crater and sample fresh material from below.',
            'It dropped three little hopping rovers, the first to move on an asteroid.',
            'Its capsule landed in the Australian desert in December 2020 with 5.4 g of Ryugu.',
        ],
        events: [
            {date: '2014-12-03', at: 'earth', kind: 'launch', note: 'Off to the asteroid Ryugu.'},
            {date: '2015-12-03', at: 'earth', kind: 'flyby', laps: 1, q: 0.91, inc: 6.8, note: 'Earth swing-by, toward Ryugu.'},
            {date: '2018-06-27', at: 'ryugu', kind: 'arrive', turns: 'auto', note: 'Arrived at Ryugu, a spinning-top rubble pile.'},
            {date: '2019-02-22', kind: 'note', title: 'First touchdown', note: 'Touched down and fired a pellet to scoop up dust.'},
            {date: '2019-04-05', kind: 'note', title: 'Artificial crater', note: 'Fired a copper bullet into Ryugu to dig a fresh crater.'},
            {date: '2019-11-13', at: 'ryugu', kind: 'depart', note: 'Left Ryugu with its samples on board.'},
            {date: '2020-12-05', at: 'earth', kind: 'flyby', note: 'Dropped its sample capsule into the Australian desert, then flew on.'},
            {date: '2026-07-05', at: 'torifune', kind: 'flyby', turns: 'auto', note: 'Swept past the asteroid Torifune (2001 CC21).'},
            {date: '2027-12', kind: 'note', title: 'Earth swing-by', note: 'First of two Earth swing-bys on the way to 1998 KY26.'},
            {date: '2028-06', at: 'earth', kind: 'flyby', turns: 'auto', note: 'Second Earth swing-by, aiming at 1998 KY26.'},
            {date: '2031-07', at: 'ky26', kind: 'arrive', turns: 'auto', note: 'Due at 1998 KY26, an 11 m asteroid that spins every five minutes.'},
        ],
    },
    {
        id: 'osirisrex', name: 'OSIRIS-REx / OSIRIS-APEX', short: 'OSIRIS', agency: 'NASA', color: '#b6ff7a',
        about: 'Brought back the largest asteroid sample, from Bennu, and is now chasing Apophis.',
        mass: '2,110 kg with fuel', power: 'Solar panels',
        facts: [
            'It grabbed so much of Bennu that rocks jammed its sample head open, and the team rushed to stow it.',
            'Bennu’s surface acted like a ball pit: the sampler sank in as if into liquid.',
            'Its 121.6 g sample landed in Utah on 24 September 2023.',
            'Renamed OSIRIS-APEX, it is due at Apophis just after the asteroid’s close pass by Earth in 2029.',
        ],
        events: [
            {date: '2016-09-08', at: 'earth', kind: 'launch', note: 'Off to sample the asteroid Bennu.'},
            {date: '2017-09-22', at: 'earth', kind: 'flyby', laps: 1, q: 0.78, note: 'Earth gravity assist, tilting its orbit to match Bennu’s.'},
            {date: '2018-12-03', at: 'bennu', kind: 'arrive', note: 'Arrived at Bennu.'},
            {date: '2020-10-20', kind: 'note', title: 'Touch-and-go', note: 'Touched Bennu for six seconds and came away with a sample.'},
            {date: '2021-05-10', at: 'bennu', kind: 'depart', note: 'Left Bennu for home.'},
            {date: '2023-09-24', at: 'earth', kind: 'flyby', turns: 'auto', note: 'Dropped the sample capsule into Utah, then flew on as OSIRIS-APEX.'},
            {date: '2025-09-23', at: 'earth', kind: 'flyby', laps: 3, q: 0.5, note: 'Earth flyby, 3,400 km up, after three dives to half Earth’s distance from the Sun.'},
            {date: '2027-03-16', at: 'earth', kind: 'flyby', q: 0.82, note: 'Another Earth flyby on the way to Apophis.'},
            {date: '2029-04-13', at: 'earth', kind: 'flyby', q: 0.51, note: 'Passes Earth an hour after Apophis does.'},
            {date: '2029-04-23', at: 'apophis', kind: 'arrive', hop: 'earth', note: 'Catches up with Apophis to study what Earth’s pull did to it.'},
        ],
    },
    {
        id: 'parker', name: 'Parker Solar Probe', short: 'Parker', agency: 'NASA', color: '#ffe36b',
        about: 'The fastest object ever built, flying through the Sun’s outer atmosphere.',
        mass: '685 kg', power: 'Solar panels that pull back into the shade, cooled by water',
        facts: [
            'Its heat shield, 11.4 cm of carbon foam, faces about 1,400 °C while the instruments behind it stay near room temperature.',
            'It was the first spacecraft named for a living person, the astrophysicist Eugene Parker.',
            'In 2021 it became the first to “touch” the Sun, crossing into the corona.',
            'At its fastest it could fly from New York to Tokyo in under a minute.',
        ],
        events: [
            {date: '2018-08-12', at: 'earth', kind: 'launch', note: 'Built to fly through the Sun’s outer atmosphere.'},
            {date: '2018-10-03', at: 'venus', kind: 'flyby', note: 'First of seven Venus flybys, each one lowering its closest approach to the Sun.'},
            {date: '2019-12-26', at: 'venus', kind: 'flyby', laps: 3, q: 0.166, note: 'Venus flyby 2.'},
            {date: '2020-07-11', at: 'venus', kind: 'flyby', q: 0.129, note: 'Venus flyby 3.'},
            {date: '2021-02-20', at: 'venus', kind: 'flyby', laps: 2, q: 0.095, note: 'Venus flyby 4.'},
            {date: '2021-10-16', at: 'venus', kind: 'flyby', q: 0.074, note: 'Venus flyby 5.'},
            {date: '2023-08-21', at: 'venus', kind: 'flyby', laps: 7, q: 0.062, note: 'Venus flyby 6.'},
            {date: '2024-11-06', at: 'venus', kind: 'flyby', laps: 5, q: 0.053, note: 'Seventh and final Venus flyby.'},
            {date: '2024-12-24', kind: 'note', title: 'Closest approach', note: 'Passed 6.1 million km from the Sun’s surface at about 690,000 km/h, the fastest ever.'},
        ],
        after: {orbit: {q: 0.046, periodDays: 88, perihelion: '2024-12-24'}},
    },
    {
        id: 'bepicolombo', name: 'BepiColombo', agency: 'ESA/JAXA', color: '#8fb8ff',
        about: 'Two orbiters stacked together, Europe’s MPO and Japan’s Mio, bound for Mercury.',
        mass: '4,100 kg at launch', power: 'Solar panels feeding ion engines',
        facts: [
            'Named after Giuseppe “Bepi” Colombo, who worked out how Mariner 10 could return to Mercury.',
            'Its cameras could only peek past the stack, so it shot Mercury in black and white “selfie” views.',
            'A power fault in 2024 weakened its thrusters and pushed arrival back by about a year.',
        ],
        events: [
            {date: '2018-10-20', at: 'earth', kind: 'launch', note: 'Two orbiters stacked together, bound for Mercury.'},
            {date: '2020-04-10', at: 'earth', kind: 'flyby', turns: 'auto', note: 'Earth flyby.'},
            {date: '2020-10-15', at: 'venus', kind: 'flyby', note: 'First Venus flyby.'},
            {date: '2021-08-10', at: 'venus', kind: 'flyby', turns: 'auto', note: 'Second Venus flyby.'},
            {date: '2021-10-01', at: 'mercury', kind: 'flyby', note: 'First of six Mercury flybys.'},
            {date: '2022-06-23', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Mercury flyby 2.'},
            {date: '2023-06-19', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Mercury flyby 3.'},
            {date: '2024-09-04', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Mercury flyby 4.'},
            {date: '2024-12-01', at: 'mercury', kind: 'flyby', laps: 1, q: 0.29, note: 'Mercury flyby 5.'},
            {date: '2025-01-08', at: 'mercury', kind: 'flyby', turns: 'auto', note: 'Sixth and last Mercury flyby.'},
            {date: '2026-11-21', at: 'mercury', kind: 'arrive', turns: 'auto', note: 'Slips into orbit around Mercury; the two orbiters separate in December.'},
        ],
    },
    {
        id: 'solarorbiter', name: 'Solar Orbiter', agency: 'ESA/NASA', color: '#ffe9a8',
        about: 'Uses Venus to climb ever higher out of the plane of the planets, for the first pictures of the Sun’s poles.',
        mass: '1,800 kg', power: 'Solar panels behind a titanium heat shield',
        facts: [
            'Its heat shield faces sunlight 13 times as strong as at Earth, about 500 °C.',
            'It found “campfires”, tiny flares all over the Sun, in its first pictures.',
            'In 2025 it took the first images of the Sun’s south pole.',
        ],
        events: [
            {date: '2020-02-10', at: 'earth', kind: 'launch', note: 'Off to study the Sun from close up and, later, from above its poles.'},
            {date: '2020-12-27', at: 'venus', kind: 'flyby', q: 0.52, note: 'First Venus flyby.'},
            {date: '2021-08-09', at: 'venus', kind: 'flyby', laps: 1, q: 0.495, inc: 6, note: 'Second Venus flyby.'},
            {date: '2021-11-27', at: 'earth', kind: 'flyby', q: 0.59, note: 'Its only Earth flyby, passing 460 km up.'},
            {date: '2022-09-04', at: 'venus', kind: 'flyby', q: 0.32, note: 'Venus flyby, the start of the main mission.'},
            {date: '2025-02-18', at: 'venus', kind: 'flyby', laps: 5, q: 0.293, inc: 4.2, note: 'Venus tilted its orbit to 17°, for the first views of the Sun’s poles.'},
            {date: '2026-12-24', at: 'venus', kind: 'flyby', laps: 4, q: 0.294, inc: 12.6, note: 'Venus tilts it to 24°: the start of the high-latitude mission.'},
            {date: '2028-03-18', at: 'venus', kind: 'flyby', laps: 3, q: 0.281, inc: 19.3, note: 'Venus flyby in the proposed extended mission.'},
            {date: '2029-06-10', at: 'venus', kind: 'flyby', laps: 3, q: 0.328, inc: 25.3, note: 'Venus flyby in the proposed extended mission.'},
            {date: '2030-09-02', at: 'venus', kind: 'flyby', laps: 3, q: 0.371, inc: 28.7, note: 'Last planned Venus flyby, tilting it to 33°.'},
        ],
        after: 'coast',
    },
    {
        id: 'dart', name: 'DART', agency: 'NASA', color: '#ff6b6b',
        about: 'The first test of planetary defense: it crashed into an asteroid’s moon to nudge it.',
        mass: '610 kg', power: 'Roll-out solar arrays',
        facts: [
            'It hit Dimorphos at 6.1 km/s and shortened its orbit around Didymos by 33 minutes.',
            'The impact threw off a tail of debris over 10,000 km long.',
            'An Italian cubesat, LICIACube, rode along to photograph the crash.',
        ],
        events: [
            {date: '2021-11-24', at: 'earth', kind: 'launch', note: 'The Double Asteroid Redirection Test.'},
            {date: '2022-09-26', at: 'didymos', kind: 'end', impact: true, note: 'Crashed into Dimorphos, moving an asteroid on purpose for the first time.'},
        ],
    },
    {
        id: 'lucy', name: 'Lucy', agency: 'NASA', color: '#ffd1f0',
        about: 'A tour of the Trojan asteroids, which share Jupiter’s orbit: eight asteroids in twelve years, a record.',
        mass: '1,550 kg with fuel', power: 'Two round solar arrays, each 7.3 m across',
        facts: [
            'Named after the Lucy fossil, itself named after the Beatles’ “Lucy in the Sky with Diamonds”.',
            'It carries a plaque of messages for the future from people including Carl Sagan and the Beatles.',
            'One of its solar arrays failed to latch, and engineers spent months pulling it nearly closed.',
            'It will be the first craft to return to Earth’s neighborhood from the outer solar system.',
        ],
        events: [
            {date: '2021-10-16', at: 'earth', kind: 'launch', note: 'Off on a twelve-year tour of the Trojan asteroids.'},
            {date: '2022-10-16', at: 'earth', kind: 'flyby', laps: 1, q: 0.838, note: 'First Earth gravity assist, a year to the day after launch.'},
            {date: '2023-11-01', at: 'dinkinesh', kind: 'flyby', note: 'Dinkinesh turned out to have a moon, itself two lobes stuck together.'},
            {date: '2024-12-12', at: 'earth', kind: 'flyby', note: 'Second Earth flyby, onto the long loop to Jupiter’s orbit.'},
            {date: '2025-04-20', at: 'donaldjohanson', kind: 'flyby', note: 'Flew past Donaldjohanson in the main belt.'},
            {date: '2027-08-12', at: 'eurybates', kind: 'flyby', note: 'First Trojan: Eurybates and its little moon Queta.'},
            {date: '2027-09-15', at: 'polymele', kind: 'flyby', note: 'Polymele and its moon.'},
            {date: '2028-04-18', at: 'leucus', kind: 'flyby', note: 'Leucus, a slow tumbler.'},
            {date: '2028-11-11', at: 'orus', kind: 'flyby', note: 'Orus, last of the Greek camp.'},
            {date: '2030-12-26', at: 'earth', kind: 'flyby', turns: 'auto', note: 'Back to Earth for a swing to the other Trojan camp.'},
            {date: '2033-03-02', at: 'patroclus', kind: 'flyby', note: 'Grand finale: the binary Patroclus and Menoetius.'},
        ],
        after: 'coast',
    },
    {
        id: 'psyche', name: 'Psyche', agency: 'NASA', color: '#9ad8ff',
        about: 'Heading for a metal-rich asteroid that may be the core of a shattered planet.',
        mass: '2,750 kg with fuel', power: 'Solar panels feeding Hall-effect thrusters, which glow blue',
        facts: [
            'It tested laser communication from deep space, sending video of a cat named Taters from 31 million km.',
            'Its thrusters push with about the force of three coins in your hand.',
            'Its Mars flyby in May 2026 tilted its orbit toward the asteroid’s.',
        ],
        events: [
            {date: '2023-10-13', at: 'earth', kind: 'launch', note: 'Off to the metal-rich asteroid Psyche.'},
            {date: '2026-05-15', at: 'mars', kind: 'flyby', turns: 'auto', note: 'Mars flyby, 4,500 km up, to tilt its orbit.'},
            {date: '2029-08', at: 'psyche', kind: 'arrive', turns: 'auto', note: 'Due to arrive and start orbiting the asteroid Psyche.'},
        ],
    },
    {
        id: 'juice', name: 'Juice', agency: 'ESA', color: '#7affc8',
        about: 'The Jupiter Icy Moons Explorer, bound to become the first spacecraft to orbit another planet’s moon.',
        mass: '6,000 kg at launch', power: 'Solar panels, 85 m², the biggest ever flown to Jupiter',
        facts: [
            'It made the first double flyby: the Moon, then Earth a day later, in August 2024.',
            'Its 16 m radar antenna got stuck after launch and was shaken free by firing a thruster.',
            'At Jupiter it will make 35 moon flybys before settling around Ganymede.',
        ],
        events: [
            {date: '2023-04-14', at: 'earth', kind: 'launch', note: 'Bound for Jupiter’s icy moons by way of Venus and Earth.'},
            {date: '2024-08-20', at: 'earth', kind: 'flyby', turns: 1, q: 0.86, note: 'A Moon flyby, then an Earth flyby the next day: the first double gravity assist.'},
            {date: '2025-08-31', at: 'venus', kind: 'flyby', q: 0.64, note: 'Venus flyby.'},
            {date: '2026-09-28', at: 'earth', kind: 'flyby', q: 0.71, note: 'Earth flyby, adding 3.5 km/s.'},
            {date: '2029-01-18', at: 'earth', kind: 'flyby', Q: 2.41, note: 'Last Earth flyby, the final push to Jupiter.'},
            {date: '2031-07', at: 'jupiter', kind: 'arrive', Q: 5.4, note: 'Due to enter orbit around Jupiter, after a Ganymede flyby.'},
            {date: '2034-12', kind: 'note', title: 'Orbit around Ganymede', note: 'The first spacecraft to orbit a moon other than our own.'},
        ],
    },
    {
        id: 'europaclipper', name: 'Europa Clipper', short: 'Clipper', agency: 'NASA', color: '#89a8ff',
        about: 'The largest planetary spacecraft NASA has built, to find out whether Europa could support life.',
        mass: '6,065 kg at launch', power: 'Solar arrays spanning 30.5 m',
        facts: [
            'Its solar arrays are wider than a basketball court is long.',
            'It carries a poem by U.S. Poet Laureate Ada Limón, engraved on a plate.',
            'It will orbit Jupiter, not Europa, dipping close about 50 times to dodge the worst radiation.',
        ],
        events: [
            {date: '2024-10-14', at: 'earth', kind: 'launch', note: 'Launched on a Falcon Heavy toward Jupiter.'},
            {date: '2025-03-01', at: 'mars', kind: 'flyby', note: 'Mars flyby.'},
            {date: '2026-12-03', at: 'earth', kind: 'flyby', Q: 2.36, note: 'Earth flyby, 3,200 km up, the final push to Jupiter.'},
            {date: '2030-04-11', at: 'jupiter', kind: 'arrive', Q: 5.53, note: 'Due to enter orbit around Jupiter.'},
        ],
    },
    {
        id: 'hera', name: 'Hera', agency: 'ESA', color: '#ffc38f',
        about: 'The follow-up to DART, surveying the asteroid it hit.',
        mass: '1,128 kg', power: 'Solar panels',
        facts: [
            'It carries two cubesats, Milani and Juventas, that will land on the asteroids.',
            'Its Mars flyby gave rare close-ups of the little moon Deimos.',
            'It will weigh Dimorphos and measure the crater DART left.',
        ],
        events: [
            {date: '2024-10-07', at: 'earth', kind: 'launch', note: 'Off to see what DART did to Dimorphos.'},
            {date: '2025-03-12', at: 'mars', kind: 'flyby', note: 'Mars flyby, passing 1,000 km from Deimos.'},
            {date: '2026-10', at: 'didymos', kind: 'arrive', note: 'Rendezvous with Didymos and Dimorphos, a month earlier than first planned.'},
        ],
    },
    {
        id: 'tianwen2', name: 'Tianwen-2', agency: 'CNSA', color: '#ff7f6b',
        about: 'China’s first asteroid mission: a sample from Earth’s quasi-moon Kamoʻoalewa, then a comet.',
        mass: 'About 2,000 kg', power: 'Solar panels',
        facts: [
            'Its target, Kamoʻoalewa, may be a fragment of our Moon.',
            'It may anchor itself to the asteroid to drill, something no mission has tried.',
            'After dropping its sample at Earth it heads for the main-belt comet 311P.',
        ],
        events: [
            {date: '2025-05-29', at: 'earth', kind: 'launch', note: 'Bound for the quasi-moon Kamoʻoalewa.'},
            {date: '2026-07-04', at: 'kamooalewa', kind: 'arrive', turns: 1, note: 'Arrived at Kamoʻoalewa to map it and take a sample.'},
            {date: '2027-04', at: 'kamooalewa', kind: 'depart', note: 'Due to leave with its sample.'},
            {date: '2027-11', at: 'earth', kind: 'flyby', note: 'Due to drop its sample capsule to Earth, then swing on.'},
            {date: '2035-01-24', at: '311p', kind: 'arrive', turns: 'auto', note: 'Due at the main-belt comet 311P/PANSTARRS.'},
        ],
    },
    {
        id: 'escapade', name: 'ESCAPADE', agency: 'NASA', color: '#c2ffa0',
        about: 'Twin small orbiters, Blue and Gold, to study how the solar wind strips Mars’s air.',
        mass: '2 × 535 kg', power: 'Solar panels',
        facts: [
            'The first launch of Blue Origin’s New Glenn rocket beyond Earth orbit.',
            'Instead of waiting two years for a Mars window, it waits near L2 and then uses Earth to slingshot.',
            'The pair will fly in formation to measure the same storm from two places.',
        ],
        events: [
            {date: '2025-11-13', at: 'earth', kind: 'launch', note: 'Launched on New Glenn into a holding loop near L2.'},
            {date: '2025-12', at: 'l2', kind: 'arrive', hop: 'earth', note: 'Looping near L2, studying space weather while it waits for Mars.'},
            {date: '2026-10', at: 'l2', kind: 'depart', note: 'Heads back toward Earth for a gravity assist.'},
            {date: '2026-11', at: 'earth', kind: 'flyby', hop: 'earth', note: 'Dives within 600 km of Earth and burns for Mars.'},
            {date: '2027-09', at: 'mars', kind: 'arrive', note: 'Due to enter orbit around Mars.'},
        ],
    },
    {
        id: 'mmx', name: 'Martian Moons eXploration', short: 'MMX', agency: 'JAXA', color: '#ffb0e0',
        about: 'To orbit Phobos, land on it, and bring a sample back to Earth.',
        mass: 'About 4,000 kg', power: 'Solar panels',
        facts: [
            'It carries Idefix, a small rover from France and Germany, to drive on Phobos.',
            'The sample should tell whether Phobos is a captured asteroid or a chip off Mars.',
            'Its return capsule is due back in 2031.',
        ],
        events: [
            {date: '2026-10-19', at: 'earth', kind: 'launch', note: 'Launched on Japan’s H3 rocket toward Mars.'},
            {date: '2027-08', at: 'mars', kind: 'arrive', note: 'Due to arrive at Mars and close in on Phobos.'},
            {date: '2031', kind: 'note', title: 'Sample home', note: 'Due to return a sample of Phobos to Earth.'},
        ],
    },
    {
        id: 'dragonfly', name: 'Dragonfly', agency: 'NASA', color: '#ffcc66',
        about: 'A nuclear-powered drone to fly across the dunes of Saturn’s moon Titan.',
        mass: 'About 875 kg on landing', power: 'One nuclear battery (MMRTG)',
        facts: [
            'Titan’s thick air and low gravity make flying easier there than on Earth.',
            'It will hop up to 16 km at a time, covering more ground than every Mars rover put together.',
            'It will look for the chemistry that comes before life.',
        ],
        events: [
            {date: '2028-07', at: 'earth', kind: 'launch', note: 'Due to launch on a Falcon Heavy, then swing past Earth once.'},
            {date: '2034', at: 'saturn', kind: 'arrive', note: 'Due to land on Titan, among the dunes near Selk crater.'},
        ],
    },

    // ---- Orbiters, landers and comet chasers ----
    {
        id: 'mariner2', name: 'Mariner 2', agency: 'NASA', color: '#f0c890',
        about: 'The first spacecraft to visit another planet.',
        mass: '204 kg', power: 'Solar panels',
        facts: [
            'It found Venus’s surface hot enough to melt lead, ending hopes of a tropical twin of Earth.',
            'It measured the solar wind for the first time, a steady stream of particles from the Sun.',
        ],
        events: [
            {date: '1962-08-27', at: 'earth', kind: 'launch', note: 'Launched a month after its twin, Mariner 1, was destroyed by a fault in its guidance.'},
            {date: '1962-12-14', at: 'venus', kind: 'flyby', note: 'Passed 34,800 km from Venus: the first visit to another planet.'},
            {date: '1963-01-03', kind: 'end', note: 'Last contact; it still circles the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'mariner4', name: 'Mariner 4', agency: 'NASA', color: '#ffb890',
        about: 'The first close look at Mars: 22 pictures of an old, cratered land.',
        mass: '261 kg', power: 'Solar panels',
        facts: [
            'Its pictures showed craters and no canals, ending the idea of a Mars with cities and farms.',
            'Engineers colored in the first picture by hand from the numbers, before the computer printout was ready.',
        ],
        events: [
            {date: '1964-11-28', at: 'earth', kind: 'launch', note: 'Launched three weeks after its twin Mariner 3 failed.'},
            {date: '1965-07-15', at: 'mars', kind: 'flyby', note: 'Passed 9,846 km from Mars and sent back 22 pictures over the following days.'},
            {date: '1967-12-21', kind: 'end', note: 'Contact ended; it still circles the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'venera7', name: 'Venera 7', agency: 'Soviet Union', color: '#ffa878',
        about: 'The first spacecraft to land on another planet and send data from its surface.',
        mass: '1,180 kg (lander 500 kg)',
        facts: ['Its parachute tore on the way down; it hit hard, tipped over, and still sent 23 minutes of faint signals.'],
        events: [
            {date: '1970-08-17', at: 'earth', kind: 'launch', note: 'Launched from Baikonur, its lander built to survive 180 times Earth’s air pressure.'},
            {date: '1970-12-15', at: 'venus', kind: 'end', title: 'Landing on Venus', note: 'Landed on Venus: 475 °C and 90 times Earth’s air pressure.'},
        ],
    },
    {
        id: 'mariner9', name: 'Mariner 9', agency: 'NASA', color: '#ffd27a',
        about: 'The first spacecraft to orbit another planet.',
        mass: '998 kg', power: 'Solar panels',
        facts: [
            'It arrived in a planet-wide dust storm and waited for it to clear before mapping 85% of Mars.',
            'It revealed Olympus Mons and Valles Marineris, named after it.',
            'It took the first close-ups of Mars’s moons Phobos and Deimos.',
        ],
        events: [
            {date: '1971-05-30', at: 'earth', kind: 'launch', note: 'Launched three weeks after its twin, Mariner 8, fell into the Atlantic.'},
            {date: '1971-11-14', at: 'mars', kind: 'arrive', note: 'The first spacecraft to orbit another planet, beating two Soviet orbiters by two weeks.'},
            {date: '1972-10-27', at: 'mars', kind: 'end', note: 'Out of gas for steering; switched off, still in orbit.'},
        ],
    },
    {
        id: 'venera9', name: 'Venera 9', agency: 'Soviet Union', color: '#ff9878',
        about: 'An orbiter, and a lander that took the first pictures from the surface of another planet.',
        mass: '4,936 kg', power: 'Solar panels; batteries in the lander',
        facts: ['The lander worked for 53 minutes at 485 °C, showing flat rocks under a dim orange sky.'],
        events: [
            {date: '1975-06-08', at: 'earth', kind: 'launch', note: 'Launched with its twin, Venera 10, six days behind.'},
            {date: '1975-10-22', at: 'venus', kind: 'end', title: 'Landing on Venus', note: 'The lander touched down and sent the first pictures from another planet’s surface; the orbiter relayed them.'},
        ],
    },
    {
        id: 'viking1', name: 'Viking 1', agency: 'NASA', color: '#ffc0a0',
        about: 'An orbiter and NASA’s first Mars lander, which looked for life in the soil.',
        mass: '3,527 kg with the lander', power: 'Solar panels; nuclear batteries on the lander',
        facts: [
            'Its lander worked for over six years; its life-detection results are still argued over.',
            'The orbiter photographed the “Face on Mars”, a hill that looked like a face in the light of the day.',
        ],
        events: [
            {date: '1975-08-20', at: 'earth', kind: 'launch', note: 'Launched on a Titan III-Centaur.'},
            {date: '1976-06-19', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars; the planned landing site turned out too rough, and the search for a new one began.'},
            {date: '1976-07-20', kind: 'note', title: 'Landing', note: 'The lander set down in Chryse Planitia, seven years to the day after Apollo 11.'},
            {date: '1980-08-17', at: 'mars', kind: 'end', note: 'The orbiter ran out of gas; the lander worked on until 1982.'},
        ],
    },
    {
        id: 'viking2', name: 'Viking 2', agency: 'NASA', color: '#f0b8b0',
        about: 'The second Viking orbiter and lander, farther north on Mars.',
        mass: '3,527 kg with the lander', power: 'Solar panels; nuclear batteries on the lander',
        facts: ['Its lander photographed frost on the ground in the Martian winter.'],
        events: [
            {date: '1975-09-09', at: 'earth', kind: 'launch', note: 'Launched three weeks after Viking 1.'},
            {date: '1976-08-07', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars.'},
            {date: '1976-09-03', kind: 'note', title: 'Landing', note: 'The lander set down in Utopia Planitia.'},
            {date: '1978-07-25', at: 'mars', kind: 'end', note: 'The orbiter, leaking gas, was switched off.'},
        ],
    },
    {
        id: 'pvo', name: 'Pioneer Venus Orbiter', short: 'Pioneer Venus', agency: 'NASA', color: '#ffc8a0',
        about: 'Fourteen years in orbit around Venus, mapping it by radar through the clouds.',
        mass: '582 kg', power: 'Solar cells',
        facts: ['It made the first radar map of Venus’s surface.', 'It watched Halley’s Comet in 1986, when Earth was on the wrong side of the Sun.'],
        events: [
            {date: '1978-05-20', at: 'earth', kind: 'launch', note: 'Launched with a sister craft that dropped four probes into Venus.'},
            {date: '1978-12-04', at: 'venus', kind: 'arrive', note: 'Into orbit around Venus.'},
            {date: '1992-10-08', at: 'venus', kind: 'end', impact: true, note: 'Out of fuel, it burned up in the atmosphere.'},
        ],
    },
    {
        id: 'venera13', name: 'Venera 13', agency: 'Soviet Union', color: '#ffb088',
        about: 'The first color pictures and sounds from the surface of Venus.',
        mass: '4,363 kg (lander 760 kg)',
        facts: ['Built to last 32 minutes, it lasted 127 at 457 °C and 89 times Earth’s air pressure.', 'A microphone aboard recorded the wind on Venus.'],
        events: [
            {date: '1981-10-30', at: 'earth', kind: 'launch', note: 'Launched five days before its twin, Venera 14.'},
            {date: '1982-03-01', at: 'venus', kind: 'end', title: 'Landing on Venus', note: 'Landed and drilled a sample of the soil to study it inside.'},
        ],
    },
    {
        id: 'vega1', name: 'Vega 1', agency: 'Soviet Union', color: '#d0a0ff',
        about: 'Dropped a lander and a balloon into Venus, then flew on to Halley’s Comet.',
        mass: '4,920 kg',
        facts: ['Its balloon floated 54 km up in Venus’s clouds for two days, tracked by radio telescopes on Earth.', 'Its pictures of Halley helped steer Giotto in close.'],
        events: [
            {date: '1984-12-15', at: 'earth', kind: 'launch', note: 'Vega: Venera and Gallei, Russian for Venus and Halley.'},
            {date: '1985-06-11', at: 'venus', kind: 'flyby', note: 'Released a lander and the first balloon flown on another planet.'},
            {date: '1986-03-06', at: 'halley', kind: 'flyby', note: 'Passed 8,890 km from Halley’s nucleus.'},
            {date: '1987-01-30', kind: 'end', note: 'Out of gas; it still circles the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'vega2', name: 'Vega 2', agency: 'Soviet Union', color: '#c0a8ff',
        about: 'The twin of Vega 1: Venus, then Halley’s Comet.',
        mass: '4,920 kg',
        facts: ['It came 8,030 km from Halley, closer than its twin.'],
        events: [
            {date: '1984-12-21', at: 'earth', kind: 'launch', note: 'Six days behind Vega 1.'},
            {date: '1985-06-15', at: 'venus', kind: 'flyby', note: 'Released its lander and balloon.'},
            {date: '1986-03-09', at: 'halley', kind: 'flyby', note: 'Passed 8,030 km from Halley’s nucleus.'},
            {date: '1987-03-24', kind: 'end', note: 'Out of gas; it still circles the Sun.'},
        ],
        after: 'coast',
    },
    {
        id: 'magellan', name: 'Magellan', agency: 'NASA', color: '#ffe8b0',
        about: 'Mapped 98% of Venus by radar, seeing through the clouds.',
        mass: '3,449 kg', power: 'Solar panels',
        facts: ['It was launched from a Space Shuttle.', 'It ended by diving into the atmosphere, testing aerobraking on the way.'],
        events: [
            {date: '1989-05-04', at: 'earth', kind: 'launch', note: 'Launched from the Space Shuttle Atlantis, on a slow route one and a half times around the Sun.'},
            {date: '1990-08-10', at: 'venus', kind: 'arrive', turns: 1, note: 'Into orbit around Venus.'},
            {date: '1994-10-13', at: 'venus', kind: 'end', impact: true, note: 'Sent into the atmosphere, where it broke up.'},
        ],
    },
    {
        id: 'near', name: 'NEAR Shoemaker', short: 'NEAR', agency: 'NASA', color: '#d8f0a0',
        about: 'The first spacecraft to orbit an asteroid, and the first to land on one.',
        mass: '805 kg', power: 'Solar panels',
        facts: [
            'It was never built to land, but touched down gently on Eros and kept working for two weeks.',
            'Named after Gene Shoemaker, who taught the Apollo astronauts geology.',
        ],
        events: [
            {date: '1996-02-17', at: 'earth', kind: 'launch', note: 'The first of NASA’s low-cost Discovery missions.'},
            {date: '1997-06-27', at: 'mathilde', kind: 'flyby', note: 'Flew 1,200 km past Mathilde, a dark asteroid as light as a rubble pile.'},
            {date: '1998-01-23', at: 'earth', kind: 'flyby', note: 'Earth gravity assist toward Eros.'},
            {date: '1998-12-23', kind: 'note', title: 'Missed Eros', note: 'An engine burn aborted; it flew past Eros and had to circle the Sun once more.'},
            {date: '2000-02-14', at: 'eros', kind: 'arrive', note: 'Into orbit around Eros, on Valentine’s Day.'},
            {date: '2001-02-12', kind: 'note', title: 'Landing on Eros', note: 'Touched down at walking pace, the first landing on an asteroid.'},
            {date: '2001-02-28', at: 'eros', kind: 'end', note: 'Its last signal from the surface.'},
        ],
    },
    {
        id: 'mgs', name: 'Mars Global Surveyor', short: 'MGS', agency: 'NASA', color: '#d0b8ff',
        about: 'Nine years mapping Mars from orbit.',
        mass: '1,030 kg', power: 'Solar panels',
        facts: ['Its laser altimeter made the first precise height map of Mars.', 'It found gullies that looked freshly carved by water.'],
        events: [
            {date: '1996-11-07', at: 'earth', kind: 'launch', note: 'NASA’s return to Mars, 20 years after Viking.'},
            {date: '1997-09-12', at: 'mars', kind: 'arrive', note: 'Into orbit, then a year and a half dipping into the air to shrink its orbit.'},
            {date: '2006-11-02', at: 'mars', kind: 'end', note: 'Lost after a software error pointed a battery at the Sun.'},
        ],
    },
    {
        id: 'pathfinder', name: 'Mars Pathfinder', short: 'Pathfinder', agency: 'NASA', color: '#ffd0a0',
        about: 'Bounced down inside airbags and released Sojourner, the first rover on another planet.',
        mass: '890 kg (rover 10.6 kg)', power: 'Solar panels',
        facts: ['Sojourner, the size of a microwave oven, drove about 100 m in all.', 'Its landing pictures drew more web traffic than anything before.'],
        events: [
            {date: '1996-12-04', at: 'earth', kind: 'launch', note: 'A cheap, fast test of a new way to land.'},
            {date: '1997-07-04', at: 'mars', kind: 'end', title: 'Landing on Mars', note: 'Bounced in on airbags into Ares Vallis, on Independence Day.'},
        ],
    },
    {
        id: 'ds1', name: 'Deep Space 1', short: 'DS1', agency: 'NASA', color: '#a8f0f0',
        about: 'A test flight for an ion engine, which then flew past an asteroid and a comet.',
        mass: '486 kg', power: 'Solar panels driving an ion engine',
        facts: ['Its ion engine ran for 678 days, a record at the time.', 'When its star tracker failed, engineers taught its science camera to steer instead.'],
        events: [
            {date: '1998-10-24', at: 'earth', kind: 'launch', note: 'The first of NASA’s New Millennium technology tests.'},
            {date: '1999-07-29', at: 'braille', kind: 'flyby', note: 'Flew 26 km from the asteroid Braille, though its camera mostly missed.'},
            {date: '2001-09-22', at: 'borrelly', kind: 'flyby', note: 'Flew 2,200 km from Comet Borrelly’s nucleus, shaped like a bowling pin.'},
            {date: '2001-12-18', kind: 'end', note: 'Switched off, its engine still able to run.'},
        ],
        after: 'coast',
    },
    {
        id: 'stardust', name: 'Stardust', agency: 'NASA', color: '#e8e0ff',
        about: 'Brought dust from a comet back to Earth, then went to see what Deep Impact left behind.',
        mass: '385 kg', power: 'Solar panels',
        facts: [
            'It caught the dust in aerogel, a glassy foam so light it is mostly air.',
            'The dust held glycine, an amino acid, and grains made near the Sun before the planets formed.',
        ],
        events: [
            {date: '1999-02-07', at: 'earth', kind: 'launch', note: 'Launched on a Delta II.'},
            {date: '2001-01-15', at: 'earth', kind: 'flyby', turns: 1, note: 'Earth gravity assist, onto a wider orbit.'},
            {date: '2002-11-02', at: 'annefrank', kind: 'flyby', note: 'A test run past the asteroid Annefrank.'},
            {date: '2004-01-02', at: 'wild2', kind: 'flyby', note: 'Flew through the coma of Comet Wild 2, 237 km from the nucleus, catching its dust.'},
            {date: '2006-01-15', at: 'earth', kind: 'flyby', turns: 1, note: 'Dropped its capsule into Utah, the fastest return to Earth yet: 12.9 km/s.'},
            {date: '2011-02-15', at: 'tempel1', kind: 'flyby', turns: 'auto', note: 'Revisited Comet Tempel 1 and found the crater Deep Impact made.'},
            {date: '2011-03-24', kind: 'end', note: 'Out of fuel, switched off.'},
        ],
        after: 'coast',
    },
    {
        id: 'odyssey', name: '2001 Mars Odyssey', short: 'Odyssey', agency: 'NASA', color: '#a0d8ff',
        about: 'The longest-working spacecraft at Mars.',
        mass: '725 kg', power: 'Solar panels',
        facts: ['It found water ice just under the surface near the poles.', 'Named in honor of Arthur C. Clarke’s 2001: A Space Odyssey.', 'It has relayed data from every rover since Spirit.'],
        events: [
            {date: '2001-04-07', at: 'earth', kind: 'launch', note: 'Launched on a Delta II.'},
            {date: '2001-10-24', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars.'},
        ],
    },
    {
        id: 'hayabusa', name: 'Hayabusa', agency: 'JAXA', color: '#ffa0a0',
        about: 'The first spacecraft to bring back a piece of an asteroid.',
        mass: '510 kg', power: 'Solar panels driving ion engines',
        facts: [
            'Lost, leaking and with failing engines, it limped home three years late.',
            'Its capsule held about 1,500 grains of Itokawa, too small to see without a microscope.',
            'Its homecoming was so loved in Japan that three films were made about it.',
        ],
        events: [
            {date: '2003-05-09', at: 'earth', kind: 'launch', note: 'Launched on an M-V rocket.'},
            {date: '2004-05-19', at: 'earth', kind: 'flyby', turns: 1, note: 'Earth gravity assist toward Itokawa.'},
            {date: '2005-09-12', at: 'itokawa', kind: 'arrive', note: 'Arrived at Itokawa, a 535 m rubble pile shaped like a sea otter.'},
            {date: '2005-11-25', kind: 'note', title: 'Touchdown', note: 'Touched down twice; enough dust stuck to come home.'},
            {date: '2007-04-25', at: 'itokawa', kind: 'depart', note: 'Left for home, after more than a year of repairs from afar.'},
            {date: '2010-06-13', at: 'earth', kind: 'end', turns: 'auto', note: 'Its capsule landed in Australia; the spacecraft burned up above it.'},
        ],
    },
    {
        id: 'mex', name: 'Mars Express', agency: 'ESA', color: '#9fd0ff',
        about: 'Europe’s first planetary mission, at Mars since 2003.',
        mass: '1,123 kg', power: 'Solar panels',
        facts: [
            'Its radar found signs of liquid water buried under the south pole.',
            'Its stereo camera has made some of the best 3D views of Mars.',
            'Its lander, Beagle 2, was lost; it was found on the ground, half unfolded, 11 years later.',
        ],
        events: [
            {date: '2003-06-02', at: 'earth', kind: 'launch', note: 'Launched from Baikonur on a Soyuz.'},
            {date: '2003-12-25', at: 'mars', kind: 'arrive', note: 'Into orbit on Christmas Day; Beagle 2 went silent on landing.'},
        ],
    },
    {
        id: 'spirit', name: 'Spirit', agency: 'NASA', color: '#ffd8b0',
        about: 'A rover planned for 90 days that worked for six years.',
        mass: '1,063 kg (rover 185 kg)', power: 'Solar panels',
        facts: ['It found signs of hot springs in Gusev crater.', 'It drove its last years backward, dragging a broken wheel, until it stuck in soft sand.'],
        events: [
            {date: '2003-06-10', at: 'earth', kind: 'launch', note: 'The first of the two Mars Exploration Rovers.'},
            {date: '2004-01-04', at: 'mars', kind: 'end', title: 'Landing on Mars', note: 'Bounced in on airbags into Gusev crater.'},
        ],
    },
    {
        id: 'opportunity', name: 'Opportunity', agency: 'NASA', color: '#ffe8b8',
        about: 'A rover planned for 90 days that drove for 14 years.',
        mass: '1,063 kg (rover 185 kg)', power: 'Solar panels',
        facts: ['It found rocks that formed in water.', 'It drove 45 km, a marathon, before a dust storm ended it in 2018.'],
        events: [
            {date: '2003-07-07', at: 'earth', kind: 'launch', note: 'Spirit’s twin.'},
            {date: '2004-01-25', at: 'mars', kind: 'end', title: 'Landing on Mars', note: 'Rolled to a stop inside a small crater on Meridiani Planum: a hole in one.'},
        ],
    },
    {
        id: 'deepimpact', name: 'Deep Impact', agency: 'NASA', color: '#ffb0d8',
        about: 'Fired a copper impactor into a comet to see what was inside, then flew on to another.',
        mass: '973 kg with the impactor', power: 'Solar panel',
        facts: [
            'The 370 kg impactor hit Tempel 1 at 10 km/s; the dust it threw up hid the crater from view.',
            'As EPOXI it then visited Comet Hartley 2, which was firing jets of dry ice.',
        ],
        events: [
            {date: '2005-01-12', at: 'earth', kind: 'launch', note: 'Launched on a Delta II.'},
            {date: '2005-07-04', at: 'tempel1', kind: 'flyby', note: 'Its impactor hit Comet Tempel 1 on Independence Day while it watched from 500 km.'},
            {date: '2007-12-31', at: 'earth', kind: 'flyby', note: 'Earth gravity assist, renamed EPOXI for a second mission.'},
            {date: '2008-12-29', at: 'earth', kind: 'flyby', laps: 1, q: 0.9, note: 'Earth again, a year later.'},
            {date: '2010-06-27', at: 'earth', kind: 'flyby', turns: 'auto', note: 'The last push, toward Hartley 2.'},
            {date: '2010-11-04', at: 'hartley2', kind: 'flyby', note: 'Flew 700 km from Comet Hartley 2.'},
            {date: '2013-08-08', kind: 'end', note: 'Lost when its clock overflowed, like a Y2K bug.'},
        ],
        after: 'coast',
    },
    {
        id: 'mro', name: 'Mars Reconnaissance Orbiter', short: 'MRO', agency: 'NASA', color: '#ffb0a0',
        about: 'The sharpest camera ever sent to another planet.',
        mass: '2,180 kg', power: 'Solar panels',
        facts: [
            'Its HiRISE camera can make out something the size of a kitchen table.',
            'It photographed Curiosity hanging under its parachute in 2012.',
            'It relays much of the data the rovers send home.',
        ],
        events: [
            {date: '2005-08-12', at: 'earth', kind: 'launch', note: 'Launched on an Atlas V.'},
            {date: '2006-03-10', at: 'mars', kind: 'arrive', note: 'Into orbit, then six months of skimming the air to lower it.'},
        ],
    },
    {
        id: 'vex', name: 'Venus Express', agency: 'ESA', color: '#a8d0ff',
        about: 'Eight years watching the clouds and winds of Venus.',
        mass: '1,270 kg', power: 'Solar panels',
        facts: ['Found signs of lava flows only a few hundred thousand years old.', 'Spotted a huge double vortex swirling over the south pole.'],
        events: [
            {date: '2005-11-09', at: 'earth', kind: 'launch', note: 'Built from spare parts of Mars Express.'},
            {date: '2006-04-11', at: 'venus', kind: 'arrive', note: 'Into a long polar orbit around Venus.'},
            {date: '2014-12-16', at: 'venus', kind: 'end', note: 'Out of fuel after dipping into the air; the mission was ended.'},
        ],
    },
    {
        id: 'phoenix', name: 'Phoenix', agency: 'NASA', color: '#ffc890',
        about: 'A lander that dug up ice near Mars’s north pole.',
        mass: '670 kg', power: 'Solar panels',
        facts: ['It watched snow fall from Martian clouds, vaporizing before it reached the ground.', 'Frozen into the polar winter, it never woke up.'],
        events: [
            {date: '2007-08-04', at: 'earth', kind: 'launch', note: 'Built partly from a lander canceled after a failure in 1999.'},
            {date: '2008-05-25', at: 'mars', kind: 'end', title: 'Landing on Mars', note: 'Landed on the arctic plains of Vastitas Borealis.'},
        ],
    },
    {
        id: 'akatsuki', name: 'Akatsuki', agency: 'JAXA', color: '#ffb0b0',
        about: 'A Venus climate orbiter that missed its first try and came back five years later.',
        mass: '518 kg', power: 'Solar panels',
        facts: [
            'Its main engine broke during its first try at orbit; it circled the Sun for five years and tried again with small thrusters.',
            'It tracked the winds that race around Venus 60 times faster than the planet turns.',
        ],
        events: [
            {date: '2010-05-20', at: 'earth', kind: 'launch', note: 'Launched with IKAROS, the first solar sail.'},
            {date: '2010-12-07', at: 'venus', kind: 'flyby', note: 'Its engine failed during the burn to enter orbit; it sailed past.'},
            {date: '2015-12-07', at: 'venus', kind: 'arrive', turns: 'auto', note: 'Second try, with its small thrusters: into orbit at last.'},
            {date: '2024-09-18', at: 'venus', kind: 'end', note: 'Contact lost in 2024; the mission was ended.'},
        ],
    },
    {
        id: 'curiosity', name: 'Curiosity', agency: 'NASA', color: '#ffd8a0',
        about: 'A car-sized rover climbing Mount Sharp, lowered onto Mars by a rocket “sky crane”.',
        mass: '3,893 kg (rover 899 kg)', power: 'A nuclear battery (RTG)',
        facts: ['It found that Gale crater once held a lake fit for life.', 'It sings “Happy Birthday” to itself, quietly, through its drill.'],
        events: [
            {date: '2011-11-26', at: 'earth', kind: 'launch', note: 'Mars Science Laboratory, launched on an Atlas V.'},
            {date: '2012-08-06', at: 'mars', kind: 'end', title: 'Landing on Mars', note: 'Seven minutes of terror: lowered on cables into Gale crater.'},
        ],
    },
    {
        id: 'mom', name: 'Mangalyaan (Mars Orbiter Mission)', short: 'Mangalyaan', agency: 'ISRO', color: '#ffc070',
        about: 'India’s first Mars mission, and the first to get there on the first try.',
        mass: '1,337 kg', power: 'Solar panel',
        facts: ['It cost less than the film Gravity.', 'Planned for six months, it worked for eight years.'],
        events: [
            {date: '2013-11-05', at: 'earth', kind: 'launch', note: 'Launched into an Earth orbit, raised six times before leaving for Mars on 1 December.'},
            {date: '2014-09-24', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars.'},
            {date: '2022-10-02', at: 'mars', kind: 'end', note: 'Out of fuel and power; the mission was declared over.'},
        ],
    },
    {
        id: 'maven', name: 'MAVEN', agency: 'NASA', color: '#ffa0d0',
        about: 'Studied how the Sun stripped away most of Mars’s air.',
        mass: '2,454 kg', power: 'Solar panels',
        facts: ['It found the solar wind strips about 100 g of air from Mars every second.', 'It saw auroras over the whole planet.'],
        events: [
            {date: '2013-11-18', at: 'earth', kind: 'launch', note: 'Launched on an Atlas V.'},
            {date: '2014-09-22', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars.'},
            {date: '2025-12-06', at: 'mars', kind: 'end', note: 'NASA lost contact with it on 6 December 2025.'},
        ],
    },
    {
        id: 'tgo', name: 'ExoMars Trace Gas Orbiter', short: 'TGO', agency: 'ESA/Roscosmos', color: '#b8ffc8',
        about: 'Sniffs Mars’s air for methane and other trace gases.',
        mass: '3,755 kg', power: 'Solar panels',
        facts: ['Its test lander, Schiaparelli, crashed when it thought it had already landed.', 'It relays data from NASA’s rovers to Earth.'],
        events: [
            {date: '2016-03-14', at: 'earth', kind: 'launch', note: 'Launched on a Proton with the Schiaparelli lander.'},
            {date: '2016-10-19', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars; Schiaparelli crashed the same day.'},
        ],
    },
    {
        id: 'insight', name: 'InSight', agency: 'NASA', color: '#ffe0c8',
        about: 'A lander that listened for marsquakes to see inside Mars.',
        mass: '694 kg', power: 'Solar panels',
        facts: ['Its seismometer recorded over 1,300 marsquakes and measured the planet’s core.', 'Two briefcase-sized satellites flew alongside it to relay its landing live.'],
        events: [
            {date: '2018-05-05', at: 'earth', kind: 'launch', note: 'The first interplanetary launch from the US west coast.'},
            {date: '2018-11-26', at: 'mars', kind: 'end', title: 'Landing on Mars', note: 'Landed on the flat plain of Elysium Planitia.'},
        ],
    },
    {
        id: 'hope', name: 'Hope', agency: 'UAE Space Agency', color: '#ffe0a0',
        about: 'The Arab world’s first interplanetary mission.',
        mass: '1,350 kg', power: 'Solar panels',
        facts: ['Its high, wide orbit lets it watch weather over the whole planet at every time of day.'],
        events: [
            {date: '2020-07-19', at: 'earth', kind: 'launch', note: 'Launched from Japan on an H-IIA.'},
            {date: '2021-02-09', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars.'},
        ],
    },
    {
        id: 'tianwen1', name: 'Tianwen-1', agency: 'CNSA', color: '#ff9f8a',
        about: 'China’s first Mars mission: orbiter, lander and rover in one.',
        mass: '5,000 kg', power: 'Solar panels',
        facts: ['It set the Zhurong rover down in Utopia Planitia, making China the second country to drive on Mars.'],
        events: [
            {date: '2020-07-23', at: 'earth', kind: 'launch', note: 'Launched on a Long March 5.'},
            {date: '2021-02-10', at: 'mars', kind: 'arrive', note: 'Into orbit around Mars.'},
            {date: '2021-05-14', kind: 'note', title: 'Zhurong lands', note: 'The lander set the rover Zhurong down in Utopia Planitia.'},
        ],
    },
    {
        id: 'perseverance', name: 'Perseverance', agency: 'NASA', color: '#ffc8a8',
        about: 'A rover collecting rock cores in Jezero crater, an old river delta, for a future trip to Earth.',
        mass: '3,839 kg (rover 1,025 kg)', power: 'A nuclear battery (RTG)',
        facts: ['It brought Ingenuity, the first helicopter to fly on another world: 72 flights.', 'It carries a microphone; you can hear the Martian wind.'],
        events: [
            {date: '2020-07-30', at: 'earth', kind: 'launch', note: 'Mars 2020, launched on an Atlas V.'},
            {date: '2021-02-18', at: 'mars', kind: 'end', title: 'Landing on Mars', note: 'Landed in Jezero crater with the sky crane.'},
        ],
    },

    // ---- Observatories at the Sun–Earth Lagrange points ----
    {
        id: 'soho', name: 'SOHO', agency: 'ESA/NASA', color: '#ffd36b', group: 'observatory',
        about: 'The Solar and Heliospheric Observatory, watching the Sun from L1 since 1996.',
        mass: '1,850 kg', power: 'Solar panels',
        facts: [
            'Planned for two years, it has run for three decades.',
            'Amateurs scanning its pictures have found more than 5,000 comets, more than anyone in history.',
            'Lost for months in 1998, it was found with the Arecibo radio telescope and brought back.',
        ],
        events: [
            {date: '1995-12-02', at: 'earth', kind: 'launch', note: 'Bound for L1, between Earth and the Sun.'},
            {date: '1996-02-14', at: 'l1', kind: 'arrive', hop: 'earth', note: 'Settled into a halo orbit around L1.'},
        ],
    },
    {
        id: 'wmap', name: 'WMAP', agency: 'NASA', color: '#a0c4ff', group: 'observatory',
        about: 'Mapped the afterglow of the Big Bang and pinned the age of the universe at 13.77 billion years.',
        mass: '840 kg', power: 'Solar panels',
        facts: [
            'It measured that ordinary matter makes up under 5% of the universe.',
            'The first spacecraft to use L2 as a permanent base.',
        ],
        events: [
            {date: '2001-06-30', at: 'earth', kind: 'launch', note: 'Off to map the cosmic microwave background.'},
            {date: '2001-10-01', at: 'l2', kind: 'arrive', hop: 'earth', note: 'Arrived at L2, the first observatory to work there.'},
            {date: '2010-08-20', at: 'l2', kind: 'end', note: 'Its work done, it was moved into an orbit around the Sun.'},
        ],
    },
    {
        id: 'herschel', name: 'Herschel', agency: 'ESA', color: '#ff9f7a', group: 'observatory',
        about: 'The largest infrared telescope flown until JWST, with a 3.5 m mirror.',
        mass: '3,400 kg', power: 'Solar panels',
        facts: [
            'It saw stars forming along long filaments of dust.',
            'It ended when its liquid helium coolant boiled away.',
        ],
        events: [
            {date: '2009-05-14', at: 'earth', kind: 'launch', note: 'Launched on one rocket with Planck.'},
            {date: '2009-07-14', at: 'l2', kind: 'arrive', hop: 'earth', note: 'In orbit around L2.'},
            {date: '2013-06-17', at: 'l2', kind: 'end', note: 'Out of coolant; parked in an orbit around the Sun.'},
        ],
    },
    {
        id: 'planck', name: 'Planck', agency: 'ESA', color: '#b8a8ff', group: 'observatory',
        about: 'The sharpest map of the Big Bang’s afterglow.',
        mass: '1,950 kg', power: 'Solar panels',
        facts: [
            'Its detectors ran at 0.1 degrees above absolute zero.',
            'It found the universe is 13.8 billion years old and made of about 5% ordinary matter.',
        ],
        events: [
            {date: '2009-05-14', at: 'earth', kind: 'launch', note: 'Launched on one rocket with Herschel.'},
            {date: '2009-07-03', at: 'l2', kind: 'arrive', hop: 'earth', note: 'In orbit around L2.'},
            {date: '2013-10-23', at: 'l2', kind: 'end', note: 'Switched off after its last map.'},
        ],
    },
    {
        id: 'gaia', name: 'Gaia', agency: 'ESA', color: '#c8f0ff', group: 'observatory',
        about: 'Charted nearly two billion stars: the most detailed 3D map of the Milky Way.',
        mass: '2,030 kg', power: 'Solar panels on a 10 m sunshield',
        facts: [
            'It measured stars’ positions to a precision like seeing a coin on the Moon.',
            'It found that the Milky Way swallowed another galaxy, Gaia–Enceladus, about 10 billion years ago.',
            'Its data will keep astronomers busy into the 2030s.',
        ],
        events: [
            {date: '2013-12-19', at: 'earth', kind: 'launch', note: 'Off to map a billion stars.'},
            {date: '2014-01-08', at: 'l2', kind: 'arrive', hop: 'earth', note: 'In orbit around L2.'},
            {date: '2025-03-27', at: 'l2', kind: 'end', note: 'Switched off after more than ten years and three trillion observations.'},
        ],
    },
    {
        id: 'jwst', name: 'James Webb Space Telescope', short: 'JWST', agency: 'NASA/ESA/CSA', color: '#ffd9a0', group: 'observatory',
        about: 'The largest space telescope ever: a 6.5 m gold mirror seeing in infrared.',
        mass: '6,200 kg', power: 'Solar panels',
        facts: [
            'Its sunshield, the size of a tennis court, keeps the mirror below −230 °C.',
            'It unfolded itself in space in about 340 steps, any of which could have ended the mission.',
            'It has seen galaxies from less than 300 million years after the Big Bang.',
            'A precise launch left it fuel for more than 20 years.',
        ],
        events: [
            {date: '2021-12-25', at: 'earth', kind: 'launch', note: 'Launched on Christmas Day on an Ariane 5.'},
            {date: '2022-01-24', at: 'l2', kind: 'arrive', hop: 'earth', note: 'Arrived in its halo orbit around L2.'},
            {date: '2022-07-12', kind: 'note', title: 'First images', note: 'Its first full-color pictures, including the Carina Nebula’s Cosmic Cliffs.'},
        ],
    },
    {
        id: 'euclid', name: 'Euclid', agency: 'ESA', color: '#9fe0ff', group: 'observatory',
        about: 'Mapping a third of the sky to chart dark matter and dark energy.',
        mass: '2,000 kg', power: 'Solar panels',
        facts: [
            'It will catalog the shapes of more than a billion galaxies.',
            'Ice building up on its optics was melted away by gently warming them in 2024.',
        ],
        events: [
            {date: '2023-07-01', at: 'earth', kind: 'launch', note: 'Launched on a Falcon 9.'},
            {date: '2023-07-28', at: 'l2', kind: 'arrive', hop: 'earth', note: 'In orbit around L2.'},
        ],
    },
    {
        id: 'aditya', name: 'Aditya-L1', agency: 'ISRO', color: '#ffa860', group: 'observatory',
        about: 'India’s first solar observatory.',
        mass: '1,475 kg', power: 'Solar panels',
        facts: ['Aditya is Sanskrit for the Sun.', 'It watches the corona with its own built-in eclipse, a coronagraph.'],
        events: [
            {date: '2023-09-02', at: 'earth', kind: 'launch', note: 'Launched from Sriharikota on a PSLV.'},
            {date: '2024-01-06', at: 'l1', kind: 'arrive', hop: 'earth', note: 'In a halo orbit around L1.'},
        ],
    },
    {
        id: 'imap', name: 'IMAP', agency: 'NASA', color: '#a8ffd9', group: 'observatory',
        about: 'The Interstellar Mapping and Acceleration Probe, charting the edge of the heliosphere from L1.',
        mass: '900 kg', power: 'Solar panels',
        facts: ['It maps the boundary where the solar wind meets interstellar space by catching atoms that fly back from there.'],
        events: [
            {date: '2025-09-24', at: 'earth', kind: 'launch', note: 'Launched on a Falcon 9.'},
            {date: '2026-01', at: 'l1', kind: 'arrive', hop: 'earth', note: 'In orbit around L1.'},
        ],
    },
    {
        id: 'roman', name: 'Nancy Grace Roman Space Telescope', short: 'Roman', agency: 'NASA', color: '#d0b8ff', group: 'observatory',
        about: 'A wide-field telescope with Hubble’s sharpness and 100 times its view.',
        mass: '4,200 kg', power: 'Solar panels',
        facts: [
            'Named for Nancy Grace Roman, NASA’s first chief of astronomy, known as the “mother of Hubble”.',
            'It is expected to find thousands of planets around other stars.',
        ],
        events: [
            {date: '2026-08-30', at: 'earth', kind: 'launch', note: 'Launched on a Falcon Heavy, eight months early.'},
            {date: '2026-12', at: 'l2', kind: 'arrive', hop: 'earth', note: 'Due to settle into its orbit around L2, then start about 90 days of commissioning.'},
        ],
    },
    {
        id: 'plato', name: 'PLATO', agency: 'ESA', color: '#f0c8ff', group: 'observatory',
        about: 'Twenty-six cameras on one spacecraft, hunting Earth-like planets around Sun-like stars.',
        mass: '2,100 kg', power: 'Solar panels',
        facts: ['It will also listen to starquakes, to tell the ages of the stars.'],
        events: [
            {date: '2027-04', at: 'earth', kind: 'launch', note: 'Due to launch on an Ariane 6.'},
            {date: '2027-05', at: 'l2', kind: 'arrive', hop: 'earth', note: 'Due in orbit around L2 about a month later.'},
        ],
    },
    ...MOON_MISSIONS,
];

// ---- Trajectories ----

const TAU = 2 * Math.PI;
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

function eventPosition(ev, t) {
    if (ev.via)
        return ev.via;
    if (ev.at)
        return Astro.bodyPosition(ev.at, t);
    const [r, lon, lat] = ev.point;
    return Astro.fromLonLat(lon, lat, r);
}

function prograde(r1, r2) {
    let d = Math.acos(Math.max(-1, Math.min(1, Astro.dot(r1, r2) / (Astro.norm(r1) * Astro.norm(r2)))));
    return Astro.cross(r1, r2)[2] < 0 ? TAU - d : d;
}

// The conic for one leg, chosen from Lambert's solutions per the leg's hints.
// With a q/Q hint the arrival is allowed to slip a few days (the craft is
// blended onto the target afterwards): real trajectories had small burns, and
// some legs sit right at the edge of feasibility.
function solveLeg(r1, r2, t1, t2, ev, sameBody) {
    const hinted = ev.q !== undefined || ev.Q !== undefined;
    const slips = hinted ? [0, 0.5, -0.5, 1, -1, 2, -2, 3, -3] : [0];
    // No conic joining r1 and r2 is shorter than the one with the smallest
    // possible semi-major axis, which bounds how many laps can fit.
    const aMin = (Astro.norm(r1) + Astro.norm(r2) + Astro.norm(Astro.sub(r2, r1))) / 4;
    const maxRevs = Math.min(8, Math.floor((t2 + 3 - t1) / (TAU * Math.sqrt(aMin ** 3 / Astro.MU_SUN))));
    let sols = [];
    for (const slip of slips) {
        sols.push(...Astro.lambert(r1, r2, t2 + slip - t1, {maxRevs})
            .map(s => ({...s, slip, orbit: Astro.orbitFromState(r1, s.v1, t1)})));
    }
    // Between two passes of the same planet, one "solution" is just riding
    // along with the planet; drop it.
    if (!sols.length)
        return null;
    if (sameBody && ev.turns === 'auto') {
        const tm = (t1 + t2) / 2;
        const apart = sols.filter(s => Astro.norm(Astro.sub(Astro.orbitPosition(s.orbit, tm), Astro.bodyPosition(sameBody, tm))) > 0.03);
        if (apart.length)
            sols = apart;
    }

    let pool = sols;
    if (typeof ev.turns === 'number') {
        const n = Math.max(0, Math.round(ev.turns - prograde(r1, r2) / TAU));
        pool = sols.filter(s => s.revs === n);
    } else if (ev.turns !== 'auto' && !hinted) {
        pool = sols.filter(s => s.revs === 0);
    }
    if (!pool.length)
        pool = sols;

    const fit = ev.q !== undefined ? s => Math.abs(Astro.perihelion(s.orbit) - ev.q) / ev.q
        : ev.Q !== undefined ? s => Math.abs(Astro.aphelion(s.orbit) - ev.Q) / ev.Q
            : s => s.orbit.e;
    const score = s => fit(s) + Math.abs(s.slip) * 0.01;
    pool.sort((a, b) => score(a) - score(b));
    return pool[0].orbit;
}

// A resonant leg: the planet is back where it was after a whole number of its
// own years, so every orbit whose period divides the gap fits and Lambert
// cannot choose. Build the one with `laps` laps and perihelion `q` instead,
// crossing r1 inbound or outbound, whichever continues the previous leg.
// With an `inc` hint the orbit is tilted that far from the ecliptic about r1
// (Venus flybys pumping up Solar Orbiter's inclination), else it keeps the
// previous leg's plane.
function resonantLeg(r1, t1, t2, ev, prevOrbit) {
    const period = (t2 - t1) / ev.laps;
    const a = Math.cbrt(Astro.MU_SUN * (period / TAU) ** 2);
    const e = 1 - ev.q / a;
    const R = Astro.norm(r1);
    const nu = Math.acos(Math.max(-1, Math.min(1, (a * (1 - e * e) / R - 1) / e)));
    let planes = [prevOrbit ? Astro.unit(Astro.cross(prevOrbit.p, prevOrbit.q)) : [0, 0, 1]];
    if (ev.inc !== undefined) {
        const rh = Astro.unit(r1);
        const ea = Astro.unit(Astro.sub([0, 0, 1], Astro.scale(rh, rh[2])));
        const eb = Astro.cross(rh, ea);
        const [c, s] = [Math.cos(ev.inc * Math.PI / 180), Math.sin(ev.inc * Math.PI / 180)];
        planes = [Astro.add(Astro.scale(ea, c), Astro.scale(eb, s)), Astro.sub(Astro.scale(ea, c), Astro.scale(eb, s))];
    }
    const build = (w, f) => {
        const u = Astro.unit(Astro.sub(r1, Astro.scale(w, Astro.dot(r1, w))));
        const v = Astro.cross(w, u);
        const p = Astro.add(Astro.scale(u, Math.cos(-f)), Astro.scale(v, Math.sin(-f)));
        return {p, q: Astro.cross(w, p), a, e, mu: Astro.MU_SUN, m0: Astro.meanFromTrue(f, e), t0: t1};
    };
    const velocity = (o, t) => Astro.sub(Astro.orbitPosition(o, t + 0.01), Astro.orbitPosition(o, t - 0.01));
    const options = planes.flatMap(w => [build(w, nu), build(w, -nu)]);
    if (!prevOrbit)
        return options[1];
    const vin = velocity(prevOrbit, t1);
    return options.sort((x, y) => Astro.norm(Astro.sub(velocity(x, t1), vin)) - Astro.norm(Astro.sub(velocity(y, t1), vin)))[0];
}

// An orbit with perihelion q and the given period, in the plane `normal`,
// passing (close to) `anchor` at time ta and through perihelion at tp.
function anchoredOrbit(anchor, ta, normal, {q, periodDays, perihelion}) {
    const a = Math.cbrt(Astro.MU_SUN * (periodDays / TAU) ** 2);
    const e = 1 - q / a;
    const tp = Astro.jd(perihelion);
    let M = TAU * (ta - tp) / periodDays;
    M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
    let E = M;
    for (let i = 0; i < 50; i++)
        E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const w = Astro.unit(normal);
    const u = Astro.unit(Astro.sub(anchor, Astro.scale(w, Astro.dot(anchor, w))));
    const v = Astro.cross(w, u);
    const p = Astro.add(Astro.scale(u, Math.cos(-nu)), Astro.scale(v, Math.sin(-nu)));
    return {p, q: Astro.cross(w, p), a, e, mu: Astro.MU_SUN, m0: 0, t0: tp};
}

// Segment kinds: 'fly' (on a conic), 'stay' (with a body), 'escape' (straight
// out at a fixed speed). Each has [t0, t1) and pos(t).
export class Trajectory {
    constructor(mission) {
        this.mission = mission;
        // Waypoints from JPL Horizons keep the long legs on the real path.
        const via = (WAYPOINTS[mission.id] ?? []).map(([t, x, y, z]) => ({kind: 'via', t, via: [x, y, z]}));
        this.events = [...mission.events.map(ev => ({...ev, t: Astro.jd(ev.date)})), ...via]
            .sort((a, b) => a.t - b.t).map(ev => ({...ev, mission}));
        this.launch = this.events[0].t;
        this.segments = [];
        this.end = Infinity;
        this._build();
    }

    _build() {
        const evs = this.events;
        const positional = evs.filter(ev => ev.at || ev.point || ev.via);
        let prev = null;   // {t, r, ev}
        let lastOrbit = null;

        for (const ev of positional) {
            const r = eventPosition(ev, ev.t);
            if (prev) {
                if (prev.ev.kind === 'arrive') {
                    const body = prev.ev.at;
                    this.segments.push({kind: 'stay', t0: prev.t, t1: ev.t, body,
                        pos: t => Astro.bodyPosition(body, t)});
                } else if (ev.hop) {
                    // Near a planet: slide from one offset to the other
                    // while riding along with it.
                    const host = ev.hop, [t0, t1] = [prev.t, ev.t];
                    const d0 = Astro.sub(prev.r, Astro.bodyPosition(host, t0)), d1 = Astro.sub(r, Astro.bodyPosition(host, t1));
                    this.segments.push({kind: 'fly', hop: host, t0, t1, from: prev.ev, to: ev,
                        pos: t => {
                            const k = smooth((t - t0) / (t1 - t0));
                            return Astro.add(Astro.bodyPosition(host, t), Astro.add(Astro.scale(d0, 1 - k), Astro.scale(d1, k)));
                        }});
                } else {
                    // Next to a waypoint, legs are short direct arcs; the
                    // hints are for the whole leg between encounters.
                    const near = prev.ev.via || ev.via;
                    const orbit = ev.laps && !near
                        ? resonantLeg(prev.r, prev.t, ev.t, ev, lastOrbit)
                        : solveLeg(prev.r, r, prev.t, ev.t, near ? {} : ev, !near && prev.ev.at === ev.at && ev.at);
                    if (orbit) {
                        lastOrbit = orbit;
                        // Blend away whatever the conic misses the target by.
                        const [t0, t1] = [prev.t, ev.t];
                        const miss = Astro.sub(r, Astro.orbitPosition(orbit, t1));
                        this.segments.push({kind: 'fly', t0, t1, orbit, from: prev.ev, to: ev,
                            pos: t => Astro.add(Astro.orbitPosition(orbit, t), Astro.scale(miss, smooth((t - t0) / (t1 - t0))))});
                    }
                }
            }
            prev = {t: ev.t, r, ev};
        }

        const endEv = evs.find(ev => ev.kind === 'end');
        const last = prev;
        const after = this.mission.after;
        if (endEv && endEv.at) {
            this.end = endEv.t;
            return;
        }
        if (last.ev.kind === 'arrive') {
            const body = last.ev.at;
            this.segments.push({kind: 'stay', t0: last.t, t1: Infinity, body,
                pos: t => Astro.bodyPosition(body, t)});
        } else if (after === 'coast' && lastOrbit) {
            this.segments.push({kind: 'fly', t0: last.t, t1: Infinity, orbit: lastOrbit,
                from: last.ev, pos: t => Astro.orbitPosition(lastOrbit, t)});
        } else if (after?.escape) {
            // Along the real direction of travel (JPL Horizons), or
            // straight out from the Sun.
            const dir = after.toward ? Astro.fromLonLat(...after.toward, 1) : Astro.unit(last.r);
            const speed = after.escape / 365.25;
            this.segments.push({kind: 'escape', t0: last.t, t1: Infinity,
                pos: t => Astro.add(last.r, Astro.scale(dir, speed * (t - last.t)))});
        } else if (after?.elements) {
            // A known orbit (from JPL Horizons), eased onto from the last
            // encounter over a couple of months.
            const {a, e, i, node, peri, tp} = after.elements;
            const orbit = Astro.orbitFromElements(a, e, i, node, peri, 0, tp);
            const miss = Astro.sub(last.r, Astro.orbitPosition(orbit, last.t));
            lastOrbit = orbit;
            this.segments.push({kind: 'fly', t0: last.t, t1: Infinity, orbit, from: last.ev,
                pos: t => Astro.add(Astro.orbitPosition(orbit, t), Astro.scale(miss, 1 - smooth((t - last.t) / 60)))});
        } else if (after?.orbit && lastOrbit) {
            const normal = Astro.cross(lastOrbit.p, lastOrbit.q);
            const orbit = anchoredOrbit(last.r, last.t, normal, after.orbit);
            const miss = Astro.sub(last.r, Astro.orbitPosition(orbit, last.t));
            this.segments.push({kind: 'fly', t0: last.t, t1: Infinity, orbit, from: last.ev,
                pos: t => Astro.add(Astro.orbitPosition(orbit, t), Astro.scale(miss, 1 - smooth((t - last.t) / 20)))});
        }
        if (endEv)
            this.end = endEv.t;
    }

    segmentAt(t) {
        if (t < this.launch || t > this.end)
            return null;
        for (const s of this.segments) {
            if (t >= s.t0 && t < s.t1)
                return s;
        }
        return null;
    }

    position(t) {
        const s = this.segmentAt(t);
        return s ? s.pos(t) : null;
    }

    // Speed relative to the Sun, km/s.
    speedKmS(t) {
        const s = this.segmentAt(t);
        if (!s)
            return 0;
        const d = Astro.sub(s.pos(t + 0.25), s.pos(t - 0.25));
        return Astro.norm(d) / 0.5 * Astro.AU_KM / Astro.DAY_S;
    }

    // Trail points [{t, p}] from `from` to `to`, a few per day of motion.
    samples(from, to) {
        const out = [];
        for (const s of this.segments) {
            if (s.kind === 'stay')
                continue;
            const t0 = Math.max(s.t0, from, this.launch), t1 = Math.min(s.t1, to, this.end);
            if (t1 <= t0)
                continue;
            const period = s.orbit ? Astro.orbitPeriod(s.orbit) : Infinity;
            const step = Math.min(isFinite(period) ? period / 160 : 60, s.kind === 'escape' ? 365 : 30);
            for (let t = t0; t < t1; t += step)
                out.push({t, p: s.pos(t)});
            out.push({t: t1, p: s.pos(Math.min(t1, s.t1 - 1e-6))});
        }
        return out;
    }

    // The positional event this craft is heading for at time t.
    nextTarget(t) {
        return this.events.find(ev => ev.t > t && (ev.at || ev.point) && ev.kind !== 'end');
    }

    // The mission's own events, without the waypoints.
    get milestones() {
        return this.events.filter(ev => ev.kind !== 'via');
    }
}

export const buildTrajectories = (missions = MISSIONS) => missions.map(m => m.group === 'moon' ? new LunarTrajectory(m) : new Trajectory(m));

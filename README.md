# Orrery

A live solar system as your GNOME wallpaper, drawn on pure black for OLED screens.

- **Real positions.** Planets sit where they really were (or are) on the date shown, from NASA JPL's orbital elements (good from 1800 to 2050).
- **3D look.** You see the system from an angle. Each planet is a lit sphere with a sharp day/night line, turning on its real axis: Uranus rolls on its side, and Saturn's rings tilt the way they really do.
- **Relative speeds.** Planets orbit at their true relative speeds. They also spin at their true speeds relative to each other, on a slower clock so Jupiter's 10-hour day does not blur.
- **The space age, replayed.** Thirteen missions fly the gravity assists they really flew, on the real dates: Mariner 10, Pioneer 10 and 11, both Voyagers, Galileo, Cassini, Rosetta, MESSENGER, New Horizons, Juno, Parker Solar Probe and BepiColombo. A card pops up at each launch, flyby and arrival.
- **Fact cards.** Live numbers for the date on screen: distance from the Sun and from Earth, light and radio delay, orbital speed right now, and how long the trip would take by car, airliner or spacecraft. They rotate with trivia about each world.
- **Live mode.** Shows the solar system right now. Voyager 1 is about 172 AU out and nearing one light-day from Earth.
- **Interactive.** Point at a planet, an orbit, a spacecraft or its trail to trace it; click to pin a card that follows it with live numbers. Expand the card for the full sheet: distances, light delay, sunlight, orbit, size, moons and every bit of trivia. A spacecraft's card lists its encounters, and clicking one jumps there. The mission list and the fact cards can be clicked too. Right-click still opens the usual desktop menu.
- **Timeline.** A scrubber along the bottom with a tick for every launch, flyby and arrival. Drag or scroll it to move through time, click a tick to jump to that event, and use play/pause, slower/faster and **Now**. It appears when the pointer is on the desktop and fades away after a few seconds.
- **Sunlight view.** The ☀ button colors the plane of the planets by how much sunlight falls there, from white-hot near the Sun through Earth's 1,361 W/m² to Neptune's 1.5, with labeled contours and the habitable zone. Planets show their sunlight in W/m² and spacecraft as a multiple of Earth's: Parker Solar Probe takes 473 times Earth's sunlight at its closest.

## How the paths are built

Each leg between two encounters is the orbit that joins the two planets' real positions on those dates (Lambert's problem). The path is exact at every encounter and close in between. Engine burns between encounters are not modeled. Some legs leave from and return to a planet after a whole number of its years (Parker's Venus loops, Galileo's two-year loop). For those, any orbit with a matching period fits, so they use the craft's known number of laps and perihelion instead.

After leaving the planets, the Pioneers and Voyagers head out in their real directions at their real speeds. Distances are compressed (square root by default) so that Mercury and Neptune fit on one screen.

## Install

```sh
make link     # symlink this checkout into ~/.local/share/gnome-shell/extensions
```

Log out and back in, then turn on **Orrery** in Extensions (or run `gnome-extensions enable orrery@fqazzazee.github.io`). Settings are in the extension's preferences.

The scene covers the primary monitor. The overview still shows your normal wallpaper, so a plain black wallpaper makes the switch seamless.

Clicks reach the scene wherever no window covers the desktop. A desktop-icons extension draws a window over the whole desktop, which takes those clicks instead.

## Power and OLED care

- Animation stops whenever the desktop is hidden: maximized or fullscreen windows, the overview, the lock screen.
- Planets move by translation, not relayout, and each layer only redraws when it changes by most of a pixel. The bands on Jupiter and Saturn are drawn once and reused.
- Night sides, glows and cards all fade to `#000000`, and **Pixel shift** slowly drifts the whole scene by a few pixels to spread wear.
- **Pause once windows cover** a set share of the desktop, not only when one is maximized.
- **Battery saver**: on battery or in Power Saver mode, the frame rate drops and the planets stop spinning.
- **Slow down when still**: with time paused and nothing spinning, it runs at 5 frames per second until the pointer moves.
- **Dim after** a few idle minutes: the scene fades to a lower brightness and 10 frames per second, and comes back the moment you move the mouse.
- The timeline only lights up while you use it.
- Lower **Frames per second** and **Brightness** to save more.

## Develop

```sh
make test     # unit tests for the orbital math and every mission path (gjs only)
```

GNOME Shell 50. License: GPL-2.0-or-later.

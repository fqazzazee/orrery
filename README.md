# Orrery

A live solar system as your GNOME wallpaper, drawn on pure black for OLED screens.

- **Real positions.** Planets sit where they really were (or are) on the date shown, from NASA JPL's orbital elements (good from 1800 to 2050).
- **3D look.** You see the system from an angle. Each planet is a lit sphere with a sharp day/night line, turning on its real axis: Uranus rolls on its side, and Saturn's rings tilt the way they really do.
- **Relative speeds.** Planets orbit at their true relative speeds. They also spin at their true speeds relative to each other, on a slower clock so Jupiter's 10-hour day does not blur.
- **The space age, replayed.** Thirteen missions fly the gravity assists they really flew, on the real dates: Mariner 10, Pioneer 10 and 11, both Voyagers, Galileo, Cassini, Rosetta, MESSENGER, New Horizons, Juno, Parker Solar Probe and BepiColombo. A card pops up at each launch, flyby and arrival.
- **Fact cards.** Live numbers for the date on screen: distance from the Sun and from Earth, light and radio delay, orbital speed right now, and how long the trip would take by car, airliner or spacecraft. They rotate with trivia about each world.
- **Live mode.** Shows the solar system right now. Voyager 1 is about 172 AU out and nearing one light-day from Earth.

## How the paths are built

Each leg between two encounters is the orbit that joins the two planets' real positions on those dates (Lambert's problem). The path is exact at every encounter and close in between. Engine burns between encounters are not modeled. Some legs leave from and return to a planet after a whole number of its years (Parker's Venus loops, Galileo's two-year loop). For those, any orbit with a matching period fits, so they use the craft's known number of laps and perihelion instead.

After leaving the planets, the Pioneers and Voyagers head out in their real directions at their real speeds. Distances are compressed (square root by default) so that Mercury and Neptune fit on one screen.

## Install

```sh
make link     # symlink this checkout into ~/.local/share/gnome-shell/extensions
```

Log out and back in, then turn on **Orrery** in Extensions (or run `gnome-extensions enable orrery@fqazzazee.github.io`). Settings are in the extension's preferences.

The scene covers the primary monitor. The overview still shows your normal wallpaper, so a plain black wallpaper makes the switch seamless.

## Power and OLED care

- Animation stops whenever the desktop is hidden: maximized or fullscreen windows, the overview, the lock screen.
- Planets move by translation, not relayout, and each layer only redraws when it changes by most of a pixel. The bands on Jupiter and Saturn are drawn once and reused.
- Night sides, glows and cards all fade to `#000000`, and **Pixel shift** slowly drifts the whole scene by a few pixels to spread wear.
- Lower **Frames per second** and **Brightness** to save more.

## Develop

```sh
make test     # unit tests for the orbital math and every mission path (gjs only)
```

GNOME Shell 50. License: GPL-2.0-or-later.

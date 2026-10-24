# Orrery

A live solar system as your GNOME wallpaper, drawn on pure black for OLED screens.

- **Real positions.** Planets sit where they really were (or are) on the date shown, from NASA JPL's orbital elements (good from 1800 to 2050).
- **3D look.** You see the system from an angle. Each planet is a lit sphere with a sharp day/night line, turning on its real axis: Uranus rolls on its side, and Saturn's rings tilt the way they really do.
- **Relative speeds.** Planets orbit at their true relative speeds. They also spin at their true speeds relative to each other, on a slower clock so Jupiter's 10-hour day does not blur.
- **The space age, replayed, and what is coming.** 37 spacecraft fly the gravity assists they really flew, on the real dates: Mariner 10, Pioneer 10 and 11, both Voyagers, Giotto, Galileo, Ulysses, Cassini, Rosetta, MESSENGER, New Horizons, Dawn, Juno, Hayabusa2, OSIRIS-REx/APEX, Parker Solar Probe, BepiColombo, Solar Orbiter, DART and Lucy. Missions on their way fly their planned routes into the 2030s: Psyche, Juice, Europa Clipper, Hera, Tianwen-2, ESCAPADE, MMX and Dragonfly. Telescopes and Sun-watchers sit at L1 and L2: SOHO, WMAP, Herschel, Planck, Gaia, JWST, Euclid, Aditya-L1, IMAP, Roman and PLATO. A card pops up at each launch, flyby and arrival.
- **Moons, asteroids, comets and Lagrange points.** The 22 biggest moons circle their planets on a squeezed scale (our Moon at its real phase). Ceres and Vesta have their own orbits; Halley's Comet and the interstellar comet 3I/ATLAS grow tails near the Sun; the asteroids missions visit (Bennu, Ryugu, Apophis, Didymos, the Lucy Trojans, Arrokoth and more) appear while they are there. Markers show the Sun–Earth Lagrange points, and a swarm of dots shows Jupiter's Trojans.
- **Fact cards.** Live numbers for the date on screen: distance from the Sun and from Earth, light and radio delay, orbital speed right now, and how long the trip would take by car, airliner or spacecraft. They rotate with trivia about each world.
- **Live mode.** Shows the solar system right now. Voyager 1 is about 172 AU out and nearing one light-day from Earth.
- **Up close.** Double-click a planet, scroll the wheel over it, or press the zoom button on its card to fly in. The planet fills the middle, turned the way it really faces (Earth's day side is the right one for the time shown), with its moons where they really are (from JPL Horizons), the satellites and spacecraft circling it, and the landing sites on its surface: the ISS, Hubble, Tiangong, the GPS and Starlink constellations and the geostationary belt around Earth, with the Moon, L1 and L2 farther out; Mars's orbiters and rovers; Venus's orbiters and Venera landers; Juno at Jupiter, Cassini at Saturn, BepiColombo at Mercury. Near the planet the scale is true; farther out it turns logarithmic. Time runs at the planet's own pace, a thousand or so times real speed, with the clock in UTC. Pause it and the date holds while the moons and satellites keep circling (as long as the spin is on).
- **From afar.** Scroll the wheel down on the desktop, or use the zoom-out button, to pull back past the planets: the termination shock and heliopause, rings of one light-day, -week, -month and -year, the Kuiper belt, Sedna and Eris, the inner and outer Oort cloud, and the nearest stars. The Voyagers, Pioneers and New Horizons fly out along dashed paths marked with the years they get there, out to 40,000 AD. The scale eases to logarithmic and the camera rises as it pulls back; the timeline reaches to 2500 and runs in years per second.
- **Interactive.** Point at anything to trace it; click to pin a card that follows it with live numbers. Expand the card for the full, scrolling sheet. A planet's has where it is in Earth's sky, its next opposition, its season, how long the trip takes, its orbit, gravity, air, magnetism, insides, moons, how it was found and named, who visited, and every bit of trivia. Moons, comets, asteroids and Lagrange points have their own; L1 and L2 list the telescopes there. A spacecraft's card lists its encounters (clicking one jumps there), its mass and power, what it is known for and where it went. Links in a card open the moon, planet or spacecraft they name. Right-click still opens the usual desktop menu.
- **Timeline.** A scrubber with a tick for every launch, flyby and arrival, out to the planned ones in the 2030s. Drag or scroll it to move through time, click a tick to jump to that event, and use play/pause, slower/faster and **Now**. Click the playhead (or middle-click anywhere on the bar) to pause or play. Buttons at the end turn the planets' spin, the music and the sunlight view on and off. Put it at the top or bottom, centered or in a corner; whatever shares its corner moves aside. It appears when the pointer is on the desktop and fades away after a few seconds.
- **Show and hide from the desktop.** The list button on the timeline opens a panel of chips: orbits, names, stars, belts, moons, comets, Lagrange points, trails, fact cards and the sunlight view, then every spacecraft and telescope, with **All** and **None** for each group and a switch to hide or show all missions at once. The gear button (or **Settings…** in the panel) opens the preferences.
- **Music.** The speaker on the timeline plays a slow ambient piece made up as it plays (drifting chords, a low drone, soft bells in long echoes), or your own music from a folder, shuffled. It fades out while windows cover the desktop and stops when the screen locks.
- **In the overview too.** The Activities overview shows the solar system in its workspace cards and, dimmed, behind the app grid; workspaces slide by with it when you switch.
- **Sunlight view.** The ☀ button colors the plane of the planets by how much sunlight falls there, from white-hot near the Sun through Earth's 1,361 W/m² to Neptune's 1.5, with labeled contours and the habitable zone. Planets show their sunlight in W/m² and spacecraft as a multiple of Earth's: Parker Solar Probe takes 473 times Earth's sunlight at its closest. It can also switch itself on while the charger is connected, or while on battery.

## How the paths are built

Each leg between two encounters is the orbit that joins the two bodies' real positions on those dates (Lambert's problem). The path is exact at every encounter. Where a craft fired its engines between encounters (the ion-driven Dawn, Psyche and BepiColombo, or long loops like Ulysses's), waypoints from NASA JPL's Horizons trajectories keep it on the path it really flew: `tools/fit-waypoints.py` compares every mission with Horizons and adds waypoints until the model stays within 4% of the distance from the Sun. Some legs leave from and return to a planet after a whole number of its years (Parker's Venus loops, Galileo's two-year loop). For those, any orbit with a matching period fits, so they use the craft's known number of laps and perihelion instead.

After leaving the planets, the Pioneers and Voyagers head out in their real directions at their real speeds. Distances are compressed (square root by default) so that Mercury and Neptune fit on one screen.

## Install

Download from the [releases](https://github.com/fqazzazee/orrery/releases). Orrery runs on **GNOME 48, 49, 50 and 51**.

| Distribution | Package | Install |
|---|---|---|
| Fedora, RHEL, openSUSE | `gnome-shell-extension-orrery-VERSION-1.noarch.rpm` | `sudo dnf install ./gnome-shell-extension-orrery-*.rpm` |
| Debian 13+, Ubuntu 25.04+, Pop!_OS, Mint | `gnome-shell-extension-orrery_VERSION-1_all.deb` | `sudo apt install ./gnome-shell-extension-orrery_*.deb` |
| Arch, Manjaro, EndeavourOS | `gnome-shell-extension-orrery-VERSION-1-any.pkg.tar.zst` | `sudo pacman -U gnome-shell-extension-orrery-*.pkg.tar.zst` |
| Any, for your user only | `orrery@fqazzazee.github.io.shell-extension.zip` | `gnome-extensions install orrery@fqazzazee.github.io.shell-extension.zip` |

Log out and back in, then turn on **Orrery** in Extensions (or `gnome-extensions enable orrery@fqazzazee.github.io`). Settings are in the extension's preferences, or the gear on the timeline.

From a checkout: `make link` symlinks it into `~/.local/share/gnome-shell/extensions`.

The scene covers the primary monitor. The overview and workspace switches show live copies of it (turn that off under Content › Interaction if you prefer your wallpaper there).

Clicks reach the scene wherever no window covers the desktop. A desktop-icons extension draws a window over the whole desktop, which takes those clicks instead.

### Other desktops

GNOME Shell extensions only run in GNOME Shell. For **KDE Plasma, XFCE, Cinnamon, MATE, Budgie, LXQt, Sway, Hyprland** and the rest there is `orrery-wallpaper`, in the same three package formats. It draws the same solar system, without the clicking:

- `systemctl --user enable --now orrery-wallpaper` keeps the wallpaper showing the solar system as it is right now, redrawn every 10 minutes, set with your desktop's own tool (`plasma-apply-wallpaperimage`, `xfconf-query`, `gsettings`, `swaymsg`, `hyprpaper`, `swaybg` or `feh`). On desktops that do not start systemd's graphical session (XFCE, MATE, LXQt), copy `/usr/share/orrery-wallpaper/autostart/orrery-wallpaper.desktop` to `~/.config/autostart/` instead.
- `systemctl --user enable --now orrery-wallpaper-live` runs an animated background on Wayland compositors with layer-shell (Sway, Hyprland, niri, labwc, river, Wayfire, COSMIC). It needs `gtk4-layer-shell`.
- `orrery-wallpaper render picture.png [--date 1989-08-25] [--size 3840x2160]` draws one picture. `orrery-wallpaper --help` lists the rest.

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
make test                    # unit tests for the orbital math, every mission path and every card (gjs only)
make test-shell RELEASE=45   # run it in a real GNOME Shell 51 in a container (44: GNOME 50, 43: 49;
                             #   DISTRO=debian RELEASE=trixie: 48), and report any JavaScript error
make dist                    # build the zip and the rpm, deb and Arch packages into dist/ (podman or docker)
tools/fit-waypoints.py [id]  # refit mission waypoints against JPL Horizons (needs network)
```

Pushing a tag like `v1.3.0` (matching `version-name` in `metadata.json`) builds every package on GitHub Actions and publishes them as a release.

Asteroid and comet orbits are from JPL's Small-Body Database. Mission dates after today are plans and may change.

GNOME Shell 48 to 51. License: GPL-2.0-or-later.

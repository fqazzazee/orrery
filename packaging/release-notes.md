Orrery, a live, OLED-black solar system as your wallpaper, ready for extensions.gnome.org.

## What's new in 1.4.0

- **Mission stories.** Press ▶ Story on a mission's card and Orrery shows only that spacecraft, from launch to the end: it cruises between encounters, flies in to each planet it passes to watch the swing-by up close, and heads out past the planets with the Voyagers. A bar at the top steps back and forward or exits, and touching the timeline hands the controls back.
- **Tours.** The panel can fly past every planet in turn, or play every mission's story one after another. An automatic tour (planet flybys, every story, or one mission's story, say Voyager 1's) can start after the desktop has sat untouched for a while, and stops the moment you're back.
- **To the Moon.** 29 Moon missions, from Luna 9 and Apollo 8 through Apollo 11, 13 and 17, Chang'e, Chandrayaan, SLIM, Odysseus and Blue Ghost, to Artemis I and Artemis II. They fly their real routes in Earth's close-up: free returns around the far side, lunar orbits, landings, CAPSTONE's halo orbit and the slow, looping routes of GRAIL, Danuri and SLIM.
- **35 more missions.** Mariners, Veneras, Vegas, the Vikings, Magellan, Pioneer Venus, Mars Pathfinder and the rovers, Mars Express, MRO, MAVEN, Hope, Tianwen-1, Perseverance, Akatsuki, NEAR, Hayabusa, Stardust, Deep Impact and more, on paths fitted to NASA JPL's trajectories. 11 more asteroids and comets they visited, from Gaspra and Ida to Tempel 1 and Hartley 2.
- **Flybys up close.** In a planet's close-up, spacecraft swing past on the curve that really bent their course: Voyager 1 skims Jupiter at about 5 of its radii, New Horizons stays 32 out.
- **Spin and sunlight are back on the timeline**, next to the music.
- **The Moon in its true place.** It used to be drawn a quarter of an orbit off; it now follows a proper lunar ephemeris, and its phase comes from where it really is.
- **Replays reach back to 1957**, and start in 1966 by default.

## Install

**GNOME (48, 49, 50, 51)** — pick the package for your distribution, install it, then log out and back in and turn on Orrery in Extensions:

| Distribution | File | Command |
|---|---|---|
| Fedora, RHEL, openSUSE | `gnome-shell-extension-orrery-1.4.0-1.noarch.rpm` | `sudo dnf install ./gnome-shell-extension-orrery-1.4.0-1.noarch.rpm` (openSUSE: `sudo zypper install ./…`) |
| Debian 13+, Ubuntu 25.04+, Pop!_OS, Mint | `gnome-shell-extension-orrery_1.4.0-1_all.deb` | `sudo apt install ./gnome-shell-extension-orrery_1.4.0-1_all.deb` |
| Arch, Manjaro, EndeavourOS | `gnome-shell-extension-orrery-1.4.0-1-any.pkg.tar.zst` | `sudo pacman -U gnome-shell-extension-orrery-1.4.0-1-any.pkg.tar.zst` |
| Any distribution, just for you | `orrery@fqazzazee.github.io.shell-extension.zip` | `gnome-extensions install orrery@fqazzazee.github.io.shell-extension.zip` |

**KDE Plasma, XFCE, Cinnamon, MATE, Budgie, LXQt, Sway, Hyprland and others** — install `orrery-wallpaper` (same three formats), then:

- `systemctl --user enable --now orrery-wallpaper` keeps your wallpaper showing the solar system as it is right now, redrawn every 10 minutes.
- `systemctl --user enable --now orrery-wallpaper-live` instead runs an animated background on Wayland compositors with layer-shell (Sway, Hyprland, niri, labwc, river, Wayfire, COSMIC).
- Or run `orrery-wallpaper render picture.png` for a single picture. `orrery-wallpaper --help` lists the options.

`orrery-1.4.0.tar.gz` is the source, `PKGBUILD` and the `.spec` files build the packages, and `SHA256SUMS` checks the downloads.

## What it does

- Planets in their real positions, turned the way they really face, spinning at their relative speeds; the 22 biggest moons; Ceres, Vesta, Halley's Comet and 3I/ATLAS; the Lagrange points and Jupiter's Trojans.
- 64 spacecraft on paths fitted to NASA JPL's real trajectories, from Mariner 2 and the Voyagers to Psyche, Juice, Europa Clipper and Dragonfly flying their planned routes into the 2030s, 29 missions to the Moon, and the telescopes at L1 and L2.
- Click anything for a card of live facts; double-click a planet to fly in to its moons, satellites and landers; scroll out to the heliopause, the Oort cloud and the nearest stars, with the Voyagers' paths marked to 40,000 AD.
- Stories that follow one mission from launch to the end, tours past every planet, a timeline to scrub through history, a panel to show and hide things and missions, a sunlight view that can follow your charger, generated ambient music, and the solar system in the Activities overview too.
- OLED care throughout: pure black, pixel shift, dimming when idle, pausing behind windows and on battery.

The first packaged release of Orrery: a live, OLED-black solar system as your wallpaper.

## Install

**GNOME (48, 49, 50, 51)** — pick the package for your distribution, install it, then log out and back in and turn on Orrery in Extensions:

| Distribution | File | Command |
|---|---|---|
| Fedora, RHEL, openSUSE | `gnome-shell-extension-orrery-1.3.0-1.noarch.rpm` | `sudo dnf install ./gnome-shell-extension-orrery-1.3.0-1.noarch.rpm` (openSUSE: `sudo zypper install ./…`) |
| Debian 13+, Ubuntu 25.04+, Pop!_OS, Mint | `gnome-shell-extension-orrery_1.3.0-1_all.deb` | `sudo apt install ./gnome-shell-extension-orrery_1.3.0-1_all.deb` |
| Arch, Manjaro, EndeavourOS | `gnome-shell-extension-orrery-1.3.0-1-any.pkg.tar.zst` | `sudo pacman -U gnome-shell-extension-orrery-1.3.0-1-any.pkg.tar.zst` |
| Any distribution, just for you | `orrery@fqazzazee.github.io.shell-extension.zip` | `gnome-extensions install orrery@fqazzazee.github.io.shell-extension.zip` |

**KDE Plasma, XFCE, Cinnamon, MATE, Budgie, LXQt, Sway, Hyprland and others** — install `orrery-wallpaper` (same three formats), then:

- `systemctl --user enable --now orrery-wallpaper` keeps your wallpaper showing the solar system as it is right now, redrawn every 10 minutes.
- `systemctl --user enable --now orrery-wallpaper-live` instead runs an animated background on Wayland compositors with layer-shell (Sway, Hyprland, niri, labwc, river, Wayfire, COSMIC).
- Or run `orrery-wallpaper render picture.png` for a single picture. `orrery-wallpaper --help` lists the options.

`orrery-1.3.0.tar.gz` is the source, `PKGBUILD` and the `.spec` files build the packages, and `SHA256SUMS` checks the downloads.

## What it does

- Planets in their real positions, turned the way they really face, spinning at their relative speeds; the 22 biggest moons; Ceres, Vesta, Halley's Comet and 3I/ATLAS; the Lagrange points and Jupiter's Trojans.
- 40 spacecraft on paths fitted to NASA JPL's real trajectories, from Mariner 10 and the Voyagers to Psyche, Juice, Europa Clipper and Dragonfly flying their planned routes into the 2030s, and the telescopes at L1 and L2.
- Click anything for a card of live facts; double-click a planet to fly in to its moons, satellites and landers; scroll out to the heliopause, the Oort cloud and the nearest stars, with the Voyagers' paths marked to 40,000 AD.
- A timeline to scrub through history, a panel to show and hide things and missions, a sunlight view that can follow your charger, generated ambient music, and the solar system in the Activities overview too.
- OLED care throughout: pure black, pixel shift, dimming when idle, pausing behind windows and on battery.

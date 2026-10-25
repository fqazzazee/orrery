Orrery, a live, OLED-black solar system as your wallpaper, ready for extensions.gnome.org.

## What's new in 1.3.3

- **Every monitor.** Other monitors get a solar system of their own (starting at the same date, and explored separately), a copy of the main one, or the plain wallpaper. Orrery only pauses once every monitor showing it is hidden.
- **Modes for the music and the animation.** Music is Muted, Background only (it fades out behind windows) or Continuous; the speaker on the timeline steps through them. The animation is Paused (a still picture that moves while you use it), Background only or Continuous.
- **See-through apps.** Pick apps, like a transparent terminal, and choose what carries on behind their windows: the animation, the music, or both.
- **A tidier timeline.** Spin, sunlight and the modes live in the panel behind the list button, which also opens the settings.
- **Calmer zooming out.** Time speeds up gently as you pull back, from the planets' own pace to about 30 times that at the nearest stars, instead of jumping to ten years a second.
- **Truer paths for the Voyagers and Pioneers.** Past their last encounter they now fly along their real direction of travel, within 0.3 AU of NASA JPL's trajectories out to 2049 (Voyager 1 was drifting 9 AU off). Pioneer 11's last signal moved 10° to where it really was, and Voyager 1 reaches one light-day from Earth on 18 November 2026.

Settings from 1.3.2 carry over: music on or off and pausing behind windows become the matching modes.

## Install

**GNOME (48, 49, 50, 51)** — pick the package for your distribution, install it, then log out and back in and turn on Orrery in Extensions:

| Distribution | File | Command |
|---|---|---|
| Fedora, RHEL, openSUSE | `gnome-shell-extension-orrery-1.3.3-1.noarch.rpm` | `sudo dnf install ./gnome-shell-extension-orrery-1.3.3-1.noarch.rpm` (openSUSE: `sudo zypper install ./…`) |
| Debian 13+, Ubuntu 25.04+, Pop!_OS, Mint | `gnome-shell-extension-orrery_1.3.3-1_all.deb` | `sudo apt install ./gnome-shell-extension-orrery_1.3.3-1_all.deb` |
| Arch, Manjaro, EndeavourOS | `gnome-shell-extension-orrery-1.3.3-1-any.pkg.tar.zst` | `sudo pacman -U gnome-shell-extension-orrery-1.3.3-1-any.pkg.tar.zst` |
| Any distribution, just for you | `orrery@fqazzazee.github.io.shell-extension.zip` | `gnome-extensions install orrery@fqazzazee.github.io.shell-extension.zip` |

**KDE Plasma, XFCE, Cinnamon, MATE, Budgie, LXQt, Sway, Hyprland and others** — install `orrery-wallpaper` (same three formats), then:

- `systemctl --user enable --now orrery-wallpaper` keeps your wallpaper showing the solar system as it is right now, redrawn every 10 minutes.
- `systemctl --user enable --now orrery-wallpaper-live` instead runs an animated background on Wayland compositors with layer-shell (Sway, Hyprland, niri, labwc, river, Wayfire, COSMIC).
- Or run `orrery-wallpaper render picture.png` for a single picture. `orrery-wallpaper --help` lists the options.

`orrery-1.3.3.tar.gz` is the source, `PKGBUILD` and the `.spec` files build the packages, and `SHA256SUMS` checks the downloads.

## What it does

- Planets in their real positions, turned the way they really face, spinning at their relative speeds; the 22 biggest moons; Ceres, Vesta, Halley's Comet and 3I/ATLAS; the Lagrange points and Jupiter's Trojans.
- 40 spacecraft on paths fitted to NASA JPL's real trajectories, from Mariner 10 and the Voyagers to Psyche, Juice, Europa Clipper and Dragonfly flying their planned routes into the 2030s, and the telescopes at L1 and L2.
- Click anything for a card of live facts; double-click a planet to fly in to its moons, satellites and landers; scroll out to the heliopause, the Oort cloud and the nearest stars, with the Voyagers' paths marked to 40,000 AD.
- A timeline to scrub through history, a panel to show and hide things and missions, a sunlight view that can follow your charger, generated ambient music, and the solar system in the Activities overview too.
- OLED care throughout: pure black, pixel shift, dimming when idle, pausing behind windows and on battery.

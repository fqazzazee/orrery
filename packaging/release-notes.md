Orrery, a live, OLED-black solar system as your wallpaper, ready for extensions.gnome.org.

## What's new in 1.5.0

- **Orrery for Windows.** Windows 10 and 11 get the whole orrery, in three ways:
  - **An app**, with the timeline, the panel, the cards and the settings. F11 makes it full screen.
  - **A screensaver** on every screen, playing the mission stories. Its preview and its settings work in Windows' Screen Saver Settings.
  - **A live wallpaper** behind your desktop icons, with a tray icon. It pauses when a window covers the screen, when the PC is locked and when the display is off.
- **One installer, no admin rights.** It can make Orrery your screensaver and start the live wallpaper with Windows. The settings page can do the same later.
- **For Lively Wallpaper too**, as a package to drag into Lively.
- The GNOME extension and `orrery-wallpaper` are unchanged from 1.4.0.

## Install

**GNOME (48, 49, 50, 51)** — pick the package for your distribution, install it, then log out and back in and turn on Orrery in Extensions:

| Distribution | File | Command |
|---|---|---|
| Fedora, RHEL, openSUSE | `gnome-shell-extension-orrery-1.5.0-1.noarch.rpm` | `sudo dnf install ./gnome-shell-extension-orrery-1.5.0-1.noarch.rpm` (openSUSE: `sudo zypper install ./…`) |
| Debian 13+, Ubuntu 25.04+, Pop!_OS, Mint | `gnome-shell-extension-orrery_1.5.0-1_all.deb` | `sudo apt install ./gnome-shell-extension-orrery_1.5.0-1_all.deb` |
| Arch, Manjaro, EndeavourOS | `gnome-shell-extension-orrery-1.5.0-1-any.pkg.tar.zst` | `sudo pacman -U gnome-shell-extension-orrery-1.5.0-1-any.pkg.tar.zst` |
| Any distribution, just for you | `orrery@fqazzazee.github.io.shell-extension.zip` | `gnome-extensions install orrery@fqazzazee.github.io.shell-extension.zip` |

**KDE Plasma, XFCE, Cinnamon, MATE, Budgie, LXQt, Sway, Hyprland and others** — install `orrery-wallpaper` (same three formats), then:

- `systemctl --user enable --now orrery-wallpaper` keeps your wallpaper showing the solar system as it is right now, redrawn every 10 minutes.
- `systemctl --user enable --now orrery-wallpaper-live` instead runs an animated background on Wayland compositors with layer-shell (Sway, Hyprland, niri, labwc, river, Wayfire, COSMIC).
- Or run `orrery-wallpaper render picture.png` for a single picture. `orrery-wallpaper --help` lists the options.

**Windows 10 and 11** — the app, a screensaver and a live wallpaper in one.

| File | What it is |
|---|---|
| `Orrery-1.5.0-win-x64-setup.exe` | The installer, just for you, no admin rights. It can make Orrery your screensaver and start the live wallpaper with Windows. |
| `Orrery-1.5.0-win-x64.zip` | The same, to unzip anywhere and run `Orrery.exe`. |
| `Orrery-1.5.0-lively.zip` | The live wallpaper for [Lively Wallpaper](https://www.rocksdanister.com/lively/): drag it into Lively. |

The `-arm64` files are for Arm PCs, and `SHA256SUMS-windows` checks them. They are not signed yet, so SmartScreen may stop the installer: click **More info**, then **Run anyway**.

`orrery-1.5.0.tar.gz` is the source, `PKGBUILD` and the `.spec` files build the packages, and `SHA256SUMS` checks the downloads.

## What it does

- Planets in their real positions, turned the way they really face, spinning at their relative speeds; the 22 biggest moons; Ceres, Vesta, Halley's Comet and 3I/ATLAS; the Lagrange points and Jupiter's Trojans.
- 64 spacecraft on paths fitted to NASA JPL's real trajectories, from Mariner 2 and the Voyagers to Psyche, Juice, Europa Clipper and Dragonfly flying their planned routes into the 2030s, 29 missions to the Moon, and the telescopes at L1 and L2.
- Click anything for a card of live facts; double-click a planet to fly in to its moons, satellites and landers; scroll out to the heliopause, the Oort cloud and the nearest stars, with the Voyagers' paths marked to 40,000 AD.
- Stories that follow one mission from launch to the end, tours past every planet, a timeline to scrub through history, a panel to show and hide things and missions, a sunlight view that can follow your charger, generated ambient music, and the solar system in the Activities overview too.
- OLED care throughout: pure black, pixel shift, dimming when idle, pausing behind windows and on battery.

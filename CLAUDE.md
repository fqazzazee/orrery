# Orrery

A GNOME Shell extension (GJS, ES modules) that draws a live solar system as
the wallpaper, plus `orrery-wallpaper` for other desktops (`standalone/`) and
Orrery for Windows (`windows/`, .NET).

## Layout

- `extension.js`: the extension entry point and the desktop actors
- `prefs.js`: the preferences window (GTK4/Adwaita, runs outside the Shell)
- `lib/`: astronomy, bodies, missions, rendering, UI cards, tours, screensaver.
  Most of `lib/` is plain JavaScript that runs under `gjs` without a Shell,
  which is what `tests/unit.js` relies on
- `schemas/`: the GSettings schema
- `standalone/`: `orrery-wallpaper` for non-GNOME desktops
- `packaging/`: rpm, deb and Arch packages, built by `packaging/build.sh`
- `windows/`: the Windows app, screensaver and Lively wallpaper

## Testing

- `make test`: unit tests under `gjs` (fast, run on every change)
- `make test-shell DISTRO=fedora RELEASE=45`: loads the extension in a real
  headless GNOME Shell in a container and fails on any `JS ERROR`. Releases
  44 and 43 are GNOME 50 and 49; `DISTRO=debian RELEASE=trixie` is GNOME 48.
  Needs podman or docker.

## Releasing

Bump the version in `metadata.json` (`version-name`), `README.md`,
`docs/index.html`, `packaging/release-notes.md`, `windows/Orrery/Orrery.csproj`,
`windows/installer/orrery.iss` and the example tag in
`.github/workflows/release.yml`. Commit as `Release X.Y.Z: <summary>`, then push
the `vX.Y.Z` tag: `.github/workflows/release.yml` builds every package and
publishes the release, with `packaging/release-notes.md` as its notes.

## Agent skills

`.claude/skills/` vendors three skills from
[mattpocock/skills](https://github.com/mattpocock/skills) (MIT, see
`.claude/skills/LICENSE-mattpocock-skills`):

- `tdd`: red-green loops against `tests/unit.js`
- `diagnosing-bugs`: build a failing loop before theorising, for render,
  animation and Shell-lifecycle bugs
- `codebase-design`: the deep-module vocabulary `tdd` uses when an interface
  is in question

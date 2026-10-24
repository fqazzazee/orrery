#!/bin/bash
# Run Orrery in a real GNOME Shell of another version, headless, in a
# container: load it, go through the desktop, a close-up, the view from
# afar, the panel, the overview, music, and disabling and enabling again,
# and report any JavaScript error.
#
#   tests/shell/run.sh fedora 45     GNOME 51
#   tests/shell/run.sh fedora 44     GNOME 50
#   tests/shell/run.sh fedora 43     GNOME 49
#   tests/shell/run.sh debian trixie GNOME 48
#
# With PACKAGES=dist the built packages are installed first and tested
# from where they install. Needs podman (or CONTAINER=docker).
set -euo pipefail
distro=${1:-fedora} release=${2:-45}
here=$(cd "$(dirname "$0")" && pwd) root=$(cd "$here/../.." && pwd)
CONTAINER=${CONTAINER:-$(command -v podman || command -v docker)}
image=orrery-shell-$distro-$release
arg=$([ "$distro" = fedora ] && echo FEDORA || echo DEBIAN)
"$CONTAINER" build -q -t "$image" --build-arg "$arg=$release" -f "$here/Containerfile.$distro" "$here" >/dev/null 2>&1 || { echo "could not build the $distro $release image" >&2; exit 1; }
out=$(mktemp -d)
gpu=()
[ -e /dev/dri ] && gpu=(--device /dev/dri --group-add keep-groups)
pkgs=()
[ -n "${PACKAGES:-}" ] && pkgs=(-v "$(cd "$PACKAGES" && pwd)":/dist:ro,z -e INSTALL=1)
"$CONTAINER" run --rm "${gpu[@]}" "${pkgs[@]}" -v "$root":/src:ro,z -v "$here/tester":/tester:ro,z -v "$out":/out:z \
    -v "$here/run-in-container.sh":/run.sh:ro,z "$image" /run.sh 2>/dev/null | grep -E "ORRERY-TEST|JS ERROR|Extension orrery|Orrery:" -A3
echo "Log and screenshots: $out"
grep -q "ORRERY-TEST re-enabled state 1" "$out/log.txt" && ! grep -q "JS ERROR" "$out/log.txt"

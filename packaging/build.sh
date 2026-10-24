#!/bin/bash
# Build the release artifacts into dist/:
#   orrery@fqazzazee.github.io.shell-extension.zip   any distro, and extensions.gnome.org
#   gnome-shell-extension-orrery-VERSION-1.noarch.rpm   Fedora, RHEL, openSUSE
#   gnome-shell-extension-orrery_VERSION-1_all.deb      Debian, Ubuntu, Pop!_OS, Mint
#   gnome-shell-extension-orrery-VERSION-1-any.pkg.tar.zst   Arch, Manjaro, EndeavourOS
#   orrery-wallpaper-...   the same three, for other desktops (KDE, XFCE, Sway...)
#   orrery-VERSION.tar.gz, PKGBUILD, the specs, SHA256SUMS
#
# Each package is built with its own distro's tools in a container (podman,
# or docker: CONTAINER=docker). Usage: packaging/build.sh [zip|rpm|deb|arch ...]

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIST=$ROOT/dist
VERSION=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version-name"])' "$ROOT/metadata.json")
UUID=orrery@fqazzazee.github.io
NAME=gnome-shell-extension-orrery
CONTAINER=${CONTAINER:-$(command -v podman || command -v docker)}
TARGETS=${*:-zip rpm deb arch}
DATE=$(LC_ALL=C date -u '+%a %b %d %Y')

mkdir -p "$DIST"
cd "$ROOT"

fill() {  # copy a template, filling in the version and date
    sed -e "s/@VERSION@/$VERSION/g" -e "s/@DATE@/$DATE/g" "$1" > "$2"
}

run() {  # run a shell script in a container image, with dist/ mounted at /dist
    local image=$1 script=$2
    "$CONTAINER" run --rm -v "$DIST":/dist:z "$image" bash -euo pipefail -c "$script"
}

# The source: every tracked file, as it is in the working tree.
echo "== source orrery-$VERSION.tar.gz"
git ls-files -z --cached --others --exclude-standard | tar --null -T - --transform "s,^,orrery-$VERSION/," -czf "$DIST/orrery-$VERSION.tar.gz"

for target in $TARGETS; do
    case $target in
    zip)
        # What extensions.gnome.org and `gnome-extensions install` take. Shell
        # 44 and later compile the schema themselves, so only the XML goes in.
        echo "== zip"
        rm -f "$DIST/$UUID.shell-extension.zip"
        python3 - "$ROOT" "$DIST/$UUID.shell-extension.zip" <<'EOF'
import sys, zipfile, pathlib
root, out = pathlib.Path(sys.argv[1]), sys.argv[2]
files = ['metadata.json', 'extension.js', 'prefs.js', 'stylesheet.css', 'LICENSE',
         *sorted(str(p.relative_to(root)) for p in (root / 'lib').glob('*.js')),
         *sorted(str(p.relative_to(root)) for p in (root / 'schemas').glob('*.gschema.xml'))]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(root / f, f)
EOF
        ;;
    rpm)
        echo "== rpm (Fedora)"
        for spec in $NAME orrery-wallpaper; do
            fill packaging/rpm/$spec.spec "$DIST/$spec.spec"
        done
        run registry.fedoraproject.org/fedora:latest "
            dnf -y -q install rpm-build glib2 systemd-rpm-macros >/dev/null
            mkdir -p ~/rpmbuild/SOURCES && cp /dist/orrery-$VERSION.tar.gz ~/rpmbuild/SOURCES/
            for spec in $NAME orrery-wallpaper; do
                rpmbuild -bb --quiet --define '_rpmfilename %%{NAME}-%%{VERSION}-%%{RELEASE}.%%{ARCH}.rpm' --define 'dist %{nil}' /dist/\$spec.spec
            done
            cp ~/rpmbuild/RPMS/*.rpm /dist/ && chmod 0644 /dist/*.rpm"
        ;;
    deb)
        echo "== deb (Debian)"
        fill packaging/deb/control "$DIST/control-$NAME"
        fill packaging/deb/control-wallpaper "$DIST/control-orrery-wallpaper"
        run docker.io/library/debian:stable "
            apt-get update -qq && apt-get install -y -qq --no-install-recommends libglib2.0-bin >/dev/null
            mkdir -p /build && cd /build && tar -xzf /dist/orrery-$VERSION.tar.gz
            for name in $NAME orrery-wallpaper; do
                pkg=/build/\$name
                install -d \$pkg/DEBIAN \$pkg/usr/share/doc/\$name
                if [ \$name = $NAME ]; then
                    sh orrery-$VERSION/packaging/install-extension.sh \$pkg /usr
                else
                    sh orrery-$VERSION/packaging/install-wallpaper.sh \$pkg /usr
                fi
                install -m 0644 orrery-$VERSION/README.md \$pkg/usr/share/doc/\$name/
                install -m 0644 orrery-$VERSION/LICENSE \$pkg/usr/share/doc/\$name/copyright
                cp /dist/control-\$name \$pkg/DEBIAN/control
                echo \"Installed-Size: \$(du -sk \$pkg/usr | cut -f1)\" >> \$pkg/DEBIAN/control
                dpkg-deb --root-owner-group -Zxz --build \$pkg /dist/\${name}_$VERSION-1_all.deb >/dev/null
            done
            chmod 0644 /dist/*.deb"
        rm -f "$DIST"/control-*
        ;;
    arch)
        echo "== arch"
        fill packaging/arch/PKGBUILD "$DIST/PKGBUILD"
        run docker.io/library/archlinux:latest "
            pacman -Syu --noconfirm --needed -q base-devel glib2 >/dev/null 2>&1
            useradd -m builder
            install -d -o builder /build
            cp /dist/PKGBUILD /dist/orrery-$VERSION.tar.gz /build/ && chown builder /build/*
            cd /build && su builder -c 'PKGEXT=.pkg.tar.zst makepkg --nodeps --noconfirm >/dev/null'
            cp /build/*.pkg.tar.zst /dist/ && chmod 0644 /dist/*.pkg.tar.zst"
        ;;
    *)
        echo "unknown target: $target" >&2
        exit 1
        ;;
    esac
done

cd "$DIST"
sha256sum -- *.zip *.rpm *.deb *.pkg.tar.zst *.tar.gz 2>/dev/null > SHA256SUMS || true
ls -l "$DIST"

#!/bin/sh
# Install orrery-wallpaper (Orrery for other desktops) under DESTDIR.
# Usage: packaging/install-wallpaper.sh DESTDIR [PREFIX=/usr]
set -eu
destdir=$1 prefix=${2:-/usr}
cd "$(dirname "$0")/.."
share=$destdir$prefix/share/orrery-wallpaper
install -d "$share/lib" "$share/standalone" "$destdir$prefix/bin" "$destdir$prefix/lib/systemd/user"
install -m 0644 lib/*.js "$share/lib/"
install -m 0644 standalone/*.js "$share/standalone/"
sed "s#@SHARE@#$prefix/share/orrery-wallpaper#" packaging/wallpaper/orrery-wallpaper > "$destdir$prefix/bin/orrery-wallpaper"
chmod 0755 "$destdir$prefix/bin/orrery-wallpaper"
for unit in packaging/wallpaper/*.service; do
    sed "s#@BIN@#$prefix/bin/orrery-wallpaper#" "$unit" > "$destdir$prefix/lib/systemd/user/$(basename "$unit")"
done
install -Dm 0644 packaging/wallpaper/orrery-wallpaper.desktop "$share/autostart/orrery-wallpaper.desktop"

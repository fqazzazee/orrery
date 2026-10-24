#!/bin/sh
# Install the GNOME Shell extension under DESTDIR (for packages).
# Usage: packaging/install-extension.sh DESTDIR [PREFIX=/usr]
set -eu
destdir=$1 prefix=${2:-/usr}
cd "$(dirname "$0")/.."
dest=$destdir$prefix/share/gnome-shell/extensions/orrery@fqazzazee.github.io
install -d "$dest/lib" "$dest/schemas"
install -m 0644 metadata.json extension.js prefs.js stylesheet.css "$dest/"
install -m 0644 lib/*.js "$dest/lib/"
install -m 0644 schemas/*.gschema.xml "$dest/schemas/"
glib-compile-schemas "$dest/schemas"

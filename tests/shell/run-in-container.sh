#!/bin/bash
# Inside the container (see run.sh): boot GNOME Shell headless with Orrery
# and the tester extension, which drives it and logs what happens. Two
# monitors of different shapes, so the second one gets a scene too.
set -u
if [ -n "${INSTALL:-}" ]; then
    if command -v dnf >/dev/null; then dnf -y -q install /dist/*.noarch.rpm >/dev/null 2>&1
    else apt-get update -qq >/dev/null 2>&1; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq /dist/*_all.deb >/dev/null 2>&1; fi
fi
step() { echo "$(date +%T) $*" >> /tmp/progress; }
step start
mkdir -p /run/dbus && (dbus-daemon --system --fork 2>/dev/null || true)
(python3 -m dbusmock --system --template logind >/tmp/logind.log 2>&1 &)
sleep 1
step buses
export XDG_RUNTIME_DIR=/tmp/run XDG_DATA_HOME=/tmp/data XDG_CONFIG_HOME=/tmp/config
mkdir -p $XDG_RUNTIME_DIR $XDG_DATA_HOME/gnome-shell/extensions && chmod 700 $XDG_RUNTIME_DIR
# From the installed package if there is one, else from the source tree.
if [ -d /usr/share/gnome-shell/extensions/orrery@fqazzazee.github.io ]; then
    step "using the installed package"
else
    cp -r /src $XDG_DATA_HOME/gnome-shell/extensions/orrery@fqazzazee.github.io
    glib-compile-schemas $XDG_DATA_HOME/gnome-shell/extensions/orrery@fqazzazee.github.io/schemas
fi
cp -r /tester $XDG_DATA_HOME/gnome-shell/extensions/orrery-tester@local
# Screenshots go through glycin, which sandboxes its image loaders with
# bubblewrap; that cannot work in here, so run them as they are.
cat > /usr/local/bin/bwrap <<'SHIM'
#!/bin/bash
while [ $# -gt 0 ]; do
    case "$1" in
    --unshare-all|--die-with-parent|--clearenv|--new-session) shift ;;
    --chdir|--dev|--tmpfs|--seccomp|--proc|--dir|--unsetenv) shift 2 ;;
    --ro-bind|--ro-bind-try|--bind|--bind-try|--dev-bind|--setenv|--symlink) shift 3 ;;
    --) shift; break ;;
    --*) shift ;;
    *) break ;;
    esac
done
exec "$@"
SHIM
chmod +x /usr/local/bin/bwrap
rm -f /out/*
step gst-scan; (timeout 180 gst-inspect-1.0 >/dev/null 2>&1; echo "gst scan exit $?" >> /tmp/progress)
step shell-starting; cp /tmp/progress /out/progress
dbus-run-session -- bash -c '
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell disable-extension-version-validation true
gsettings set org.gnome.shell enabled-extensions "[\"orrery@fqazzazee.github.io\", \"orrery-tester@local\"]"
gnome-shell --headless --wayland --no-x11 --virtual-monitor 1920x1080 --virtual-monitor 1280x1024 > /out/log.txt 2>&1 &
PID=$!
for i in $(seq 1 260); do [ -f /out/done ] && break; sleep 1; done
kill $PID; wait $PID 2>/dev/null' >/dev/null 2>&1
cat /tmp/progress
grep -E "ORRERY-TEST|JS ERROR|JS WARNING|TypeError|ReferenceError|SyntaxError|Orrery:" -A3 /out/log.txt | grep -v "^--$" | head -40

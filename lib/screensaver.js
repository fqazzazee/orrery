// The solar system as a screensaver: live clones of what each monitor's
// desktop shows, above the windows and the panel. Any input ends it, and the
// input that does is swallowed so it cannot land in the app underneath.
//
// It never stands in for the lock screen. GNOME's own idle timer still locks
// the session: its fade is raised above this, and this is gone the moment the
// shield comes up.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const FADE_IN_MS = 1500;
const FADE_OUT_MS = 250;
const RETRY_US = 5 * 1000000;     // look again this long after being held off
const INHIBIT_IDLE = 8;           // the session manager's flag for "keep the screen on"

export class Screensaver {
    // sourceFor(monitorIndex): the actor on that monitor's desktop, or null
    // onChange(): it started or ended
    constructor(sourceFor, onChange) {
        this._sourceFor = sourceFor;
        this._onChange = onChange;
        this._root = null;
        this._want = false;
        this._asking = false;
        this._retryAt = 0;
        this._cancellable = new Gio.Cancellable();

        const shielded = () => {
            if (Main.screenShield?.active || Main.screenShield?.locked)
                this.stop({fade: false});
        };
        Main.screenShield?.connectObject('active-changed', shielded, 'locked-changed', shielded, this);
        Main.layoutManager.connectObject('monitors-changed', () => this.stop({fade: false}), this);
    }

    get active() {
        return !!this._root && !this._stopping;
    }

    // Called about once a second with whether it should be showing.
    sync(want) {
        this._want = want;
        if (!want) {
            this.stop();
            return;
        }
        if (this._root || this._asking || GLib.get_monotonic_time() < this._retryAt || !this._canCover())
            return;

        // Video players, Caffeine and the like ask the session to keep the
        // screen on: then whatever is on it is meant to stay in view.
        this._asking = true;
        Gio.DBus.session.call('org.gnome.SessionManager', '/org/gnome/SessionManager', 'org.gnome.SessionManager',
            'IsInhibited', new GLib.Variant('(u)', [INHIBIT_IDLE]), new GLib.VariantType('(b)'),
            Gio.DBusCallFlags.NO_AUTO_START, 1000, this._cancellable, (bus, res) => {
                let inhibited = false;
                try {
                    [inhibited] = bus.call_finish(res).deepUnpack();
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        return;
                    console.warn(`Orrery: no session manager to ask about inhibitors: ${e.message}`);
                }
                this._asking = false;
                if (inhibited)
                    this._retryAt = GLib.get_monotonic_time() + RETRY_US;
                else if (this._want && !this._root && this._canCover())
                    this._start();
            });
    }

    // Not over a dialog, the overview, the lock screen or a fullscreen app.
    _canCover() {
        return Main.modalCount === 0 && !Main.overview.visible &&
            !Main.screenShield?.active && !Main.screenShield?.locked &&
            !Main.layoutManager.monitors.some(m => m.inFullscreen);
    }

    _start() {
        const lm = Main.layoutManager;
        const root = new St.Widget({
            name: 'orrery-screensaver',
            style: 'background-color: black;',
            reactive: true,
            can_focus: true,
            opacity: 0,
            constraints: new Clutter.BindConstraint({source: Main.uiGroup, coordinate: Clutter.BindCoordinate.ALL}),
        });
        for (const m of lm.monitors) {
            const source = this._sourceFor(m.index) ?? this._sourceFor(lm.primaryIndex);
            if (!source)
                continue;
            // Fitted whole and centered; the rest stays black.
            const k = Math.min(m.width / source.width, m.height / source.height);
            const box = new St.Widget({x: m.x, y: m.y, width: m.width, height: m.height, clip_to_allocation: true});
            box.add_child(new Clutter.Clone({
                source, width: source.width, height: source.height, scale_x: k, scale_y: k,
                x: Math.round((m.width - source.width * k) / 2), y: Math.round((m.height - source.height * k) / 2),
            }));
            root.add_child(box);
        }
        Main.uiGroup.add_child(root);

        const grab = Main.pushModal(root, {actionMode: Shell.ActionMode.NONE});
        // GNOME 50 replaced the grab's seat state with is_revoked().
        const refused = grab.get_seat_state ? grab.get_seat_state() !== Clutter.GrabState.ALL : grab.is_revoked?.();
        if (refused) {
            Main.popModal(grab);
            root.destroy();
            this._retryAt = GLib.get_monotonic_time() + RETRY_US;
            return;
        }
        this._root = root;
        this._grab = grab;
        this._stopping = false;
        root.grab_key_focus();

        this._cursor = global.backend.get_cursor_tracker?.() ?? Meta.CursorTracker.get_for_display(global.display);
        this._cursor.inhibit_cursor_visibility?.();

        this._idleMonitor = global.backend.get_core_idle_monitor();
        this._activeWatch = this._idleMonitor.add_user_active_watch(() => {
            this._activeWatch = 0;
            this.stop();
        });

        root.ease({opacity: 255, duration: FADE_IN_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        this._onChange();
    }

    // The grab stays through the fade, so the input that woke it goes nowhere.
    stop({fade = true} = {}) {
        if (!this._root)
            return;
        if (!fade) {
            this._finish();
            return;
        }
        if (this._stopping)
            return;
        this._stopping = true;
        this._root.remove_all_transitions();
        this._root.ease({
            opacity: 0,
            duration: FADE_OUT_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => this._finish(),
        });
        this._onChange();
    }

    _finish() {
        const root = this._root;
        if (!root)
            return;
        this._root = null;
        this._stopping = false;
        if (this._activeWatch)
            this._idleMonitor.remove_watch(this._activeWatch);
        this._activeWatch = 0;
        this._cursor?.uninhibit_cursor_visibility?.();
        this._cursor = null;
        Main.popModal(this._grab);
        this._grab = null;
        root.remove_all_transitions();
        root.destroy();
        this._onChange();
    }

    destroy() {
        this._onChange = () => {};
        this._want = false;
        this._cancellable.cancel();
        Main.screenShield?.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        this.stop({fade: false});
    }
}

// Whether the machine is running on battery or in the power-saver profile,
// so the scene can slow down to match.

import Gio from 'gi://Gio';

export class PowerMonitor {
    constructor(onChange) {
        this._onChange = onChange;
        this.onBattery = false;
        this._cancellable = new Gio.Cancellable();

        // UPower has no GIO wrapper; read its OnBattery property directly.
        Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
            'org.freedesktop.UPower', '/org/freedesktop/UPower', 'org.freedesktop.UPower',
            this._cancellable, (_o, res) => {
                try {
                    this._upower = Gio.DBusProxy.new_for_bus_finish(res);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        console.warn(`Orrery: no UPower, battery saving is off: ${e.message}`);
                    return;
                }
                this._upowerId = this._upower.connect('g-properties-changed', () => this._sync());
                this._sync();
            });

        this._profiles = Gio.PowerProfileMonitor.dup_default();
        this._profilesId = this._profiles.connect('notify::power-saver-enabled', () => this._sync());
    }

    get powerSaver() {
        return !!this._profiles?.power_saver_enabled;
    }

    _sync() {
        const onBattery = !!this._upower?.get_cached_property('OnBattery')?.unpack();
        this.onBattery = onBattery;
        this._onChange();
    }

    destroy() {
        this._cancellable.cancel();
        if (this._upowerId)
            this._upower.disconnect(this._upowerId);
        if (this._profilesId)
            this._profiles.disconnect(this._profilesId);
        this._upower = this._profiles = null;
    }
}

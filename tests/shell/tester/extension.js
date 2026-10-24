import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

Gio._promisify(Shell.Screenshot.prototype, 'screenshot', 'screenshot_finish');
const OUT = '/out';
const wait = ms => new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { r(); return GLib.SOURCE_REMOVE; }));
const log = m => console.log('ORRERY-TEST ' + m);
async function shot(name) {
    const stream = Gio.File.new_for_path(`${OUT}/${name}.png`).replace(null, false, Gio.FileCreateFlags.NONE, null);
    await new Shell.Screenshot().screenshot(false, stream);
    stream.close(null);
}

export default class Tester extends Extension {
    enable() {
        this._run().catch(e => log('FAILED ' + e + '\n' + e.stack)).finally(() => GLib.file_set_contents(OUT + '/done', 'done'));
    }

    async _run() {
        await wait(3000);
        Main.overview.hide();
        await wait(1500);
        const o = Main.extensionManager.lookup('orrery@fqazzazee.github.io');
        log(`shell ${Config.PACKAGE_VERSION} orrery state ${o?.state} error ${o?.error ?? ''}`);
        if (!o?.stateObj?._scene)
            return;
        const scene = o.stateObj._scene, s = o.stateObj._settings;
        s.set_string('timeline', 'always');
        await wait(1500);
        await shot('desktop');
        scene._select({id: 'saturn'}, {expand: true});
        await wait(800);
        scene._focusOn('earth');
        await wait(1500);
        await shot('earth');
        scene._zoom(-1);
        await wait(1200);
        scene._zoomTarget = 1;
        await wait(2000);
        await shot('far');
        scene._zoomTarget = 0;
        scene._togglePanel(true);
        await wait(1200);
        Main.overview.show();
        await wait(2000);
        await shot('overview');
        Main.overview.hide();
        await wait(1000);
        s.set_boolean('music-muted', false);
        await wait(2500);
        log('music ' + o.stateObj._music.playing);
        s.set_boolean('music-muted', true);
        Main.extensionManager.disableExtension('orrery@fqazzazee.github.io');
        await wait(1000);
        Main.extensionManager.enableExtension('orrery@fqazzazee.github.io');
        await wait(1500);
        log('re-enabled state ' + Main.extensionManager.lookup('orrery@fqazzazee.github.io').state);
    }
}

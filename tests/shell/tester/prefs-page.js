// Opens the real preferences on the Screensaver page, without the extensions
// app (which has no way to ask for a page): a copy of prefs.js whose base
// class is swapped for a stand-in.
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import System from 'system';

const root = System.programArgs[0];
const dir = '/tmp/orrery-prefs-page';
GLib.mkdir_with_parents(dir, 0o755);
Gio.File.new_for_path(`${dir}/lib`).make_symbolic_link(`${root}/lib`, null);
const source = new TextDecoder().decode(GLib.file_get_contents(`${root}/prefs.js`)[1]);
GLib.file_set_contents(`${dir}/prefs.js`, source.replace(
    /import \{ExtensionPreferences\} from '[^']+';/, 'const ExtensionPreferences = globalThis.OrreryPrefsBase;'));

globalThis.OrreryPrefsBase = class {
    getSettings() {
        const schemas = Gio.SettingsSchemaSource.new_from_directory(`${root}/schemas`, Gio.SettingsSchemaSource.get_default(), false);
        return new Gio.Settings({settings_schema: schemas.lookup('org.gnome.shell.extensions.orrery', false)});
    }
};
const {default: Preferences} = await import(`file://${dir}/prefs.js`);

Adw.init();
const window = new Adw.PreferencesWindow({title: 'Orrery page check', default_width: 760, default_height: 1000});
const pages = [], add = window.add.bind(window);
window.add = page => {
    pages.push(page);
    add(page);
};
new Preferences().fillPreferencesWindow(window);
window.set_visible_page(pages.find(page => page.title === 'Screensaver'));
window.present();
await new GLib.MainLoop(null, false).runAsync();

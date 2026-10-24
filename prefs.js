import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {MISSIONS} from './lib/missions.js';
import {placeName} from './lib/bodies.js';

export default class OrreryPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._settingsIds = [];
        window.connect('close-request', () => {
            for (const id of this._settingsIds)
                this._settings.disconnect(id);
            this._settingsIds = null;
            this._settings = null;
            return false;
        });
        window.set_default_size(640, 760);
        window.add(this._timePage());
        window.add(this._viewPage());
        window.add(this._contentPage());
        window.add(this._missionsPage());
        window.add(this._musicPage());
        window.add(this._powerPage());
    }

    // ---- Row helpers ----

    // Follow a setting until the window closes.
    _watch(signal, callback) {
        this._settingsIds.push(this._settings.connect(signal, callback));
    }

    _switch(title, key, subtitle = '') {
        const row = new Adw.SwitchRow({title, subtitle});
        this._settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _spin(title, key, min, max, step, subtitle = '', digits = 0) {
        const row = Adw.SpinRow.new_with_range(min, max, step);
        row.set({title, subtitle, digits});
        this._settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _combo(title, key, choices, subtitle = '') {
        const row = new Adw.ComboRow({
            title, subtitle,
            model: Gtk.StringList.new(choices.map(([, label]) => label)),
        });
        const sync = () => {
            const i = choices.findIndex(([value]) => value === this._settings.get_string(key));
            row.selected = Math.max(0, i);
        };
        sync();
        this._watch(`changed::${key}`, sync);
        row.connect('notify::selected', () => {
            const value = choices[row.selected]?.[0];
            if (value && value !== this._settings.get_string(key))
                this._settings.set_string(key, value);
        });
        return row;
    }

    // Grey a row out unless a switch is on.
    _dependsOn(row, key) {
        this._settings.bind(key, row, 'sensitive', Gio.SettingsBindFlags.GET);
        return row;
    }

    _group(title, rows, description = '') {
        const group = new Adw.PreferencesGroup({title, description});
        for (const row of rows)
            group.add(row);
        return group;
    }

    // ---- Pages ----

    _timePage() {
        const page = new Adw.PreferencesPage({title: 'Time', icon_name: 'preferences-system-time-symbolic'});

        const restart = new Adw.ActionRow({title: 'Restart the replay', subtitle: 'Jump back to the start year'});
        const button = new Gtk.Button({label: 'Restart', valign: Gtk.Align.CENTER});
        button.connect('clicked', () => this._settings.set_double('replay-jd', 0));
        restart.add_suffix(button);

        page.add(this._group('Clock', [
            this._combo('Mode', 'mode', [
                ['replay', 'Replay history'],
                ['live', 'Live'],
            ], 'Replay runs the space age forward from the start year and loops; Live shows the solar system right now'),
            this._spin('Replay starts in', 'replay-start-year', 1970, 2025, 1),
            this._spin('Replay speed', 'days-per-second', 0.5, 400, 0.5,
                'Simulated days per second. 12 makes a year pass in about 30 seconds', 1),
            this._switch('Carry on into the future', 'replay-into-future',
                'Replay past today, through the planned flybys and arrivals up to the 2030s, before starting over'),
            restart,
        ]));
        page.add(this._group('Spin', [
            this._switch('Spin the planets', 'spin-planets'),
            this._dependsOn(this._spin('One Earth day lasts', 'seconds-per-earth-day', 2, 600, 1,
                'Seconds per turn of the Earth. Jupiter turns 2.4 times as fast; Venus takes 243 times as long, backwards'),
            'spin-planets'),
        ], 'Planets spin at their true speeds relative to each other, on their own slower clock so the fast ones do not blur.'));
        return page;
    }

    _viewPage() {
        const page = new Adw.PreferencesPage({title: 'View', icon_name: 'video-display-symbolic'});
        page.add(this._group('Camera', [
            this._combo('Distance scale', 'distance-scale', [
                ['sqrt', 'Square root (balanced)'],
                ['log', 'Logarithmic (roomy inner planets)'],
                ['linear', 'True to scale (inner planets hug the Sun)'],
            ], 'Real distances span 0.4 to 30 AU, so they are compressed to fit one screen'),
            this._spin('Tilt', 'tilt', 0, 80, 1, '0° looks straight down on the Sun'),
            this._spin('Rotation', 'azimuth', 0, 359, 5, 'Turns the whole system around the Sun'),
            this._spin('Zoom', 'zoom', 40, 250, 5, 'Percent; 100 fits Neptune’s orbit on screen'),
        ]));
        page.add(this._group('Look', [
            this._spin('Planet size', 'planet-scale', 40, 300, 5, 'Percent'),
            this._spin('Brightness', 'brightness', 20, 100, 5, 'Percent; lower spares OLED pixels'),
        ]));
        return page;
    }

    _contentPage() {
        const page = new Adw.PreferencesPage({title: 'Content', icon_name: 'view-list-symbolic'});
        page.add(this._group('Scene', [
            this._switch('Orbits', 'show-orbits'),
            this._switch('Names', 'show-labels'),
            this._switch('Stars', 'show-stars'),
            this._switch('Asteroid and Kuiper belts', 'show-belts', 'With Jupiter’s Trojan asteroids, 60° ahead and behind it'),
            this._switch('Pluto', 'show-pluto'),
            this._switch('Moons', 'show-moons',
                'The 22 biggest moons, on a squeezed scale around their planets. Our Moon shows its real phase'),
            this._switch('Ceres, Vesta and comets', 'show-small-bodies',
                'The two biggest asteroids, Halley’s Comet and interstellar visitors like 3I/ATLAS. Asteroids that missions visit appear while they are there'),
            this._switch('Lagrange points', 'show-lagrange',
                'Where telescopes like JWST park (L1 and L2 are drawn a little way out from Earth, as they are too close to see)'),
        ]));
        page.add(this._group('Text', [
            this._switch('Fact cards', 'show-facts', 'Distances, speeds and trivia, plus a card at each mission event'),
            this._spin('Each fact stays up for', 'fact-interval', 5, 120, 1, 'Seconds'),
            this._switch('Date and mission list', 'show-hud'),
        ]));
        page.add(this._group('Interaction', [
            this._switch('Interactive desktop', 'interactive',
                'Hover over planets, orbits and spacecraft to trace them; click to pin a card with live numbers. Right-click still opens the desktop menu'),
            this._dependsOn(this._combo('Timeline', 'timeline', [
                ['auto', 'When the pointer is on the desktop'],
                ['always', 'Always'],
                ['never', 'Never'],
            ], 'Scrub through time, change speed and jump to mission events'), 'interactive'),
            this._dependsOn(this._combo('Timeline position', 'timeline-position', [
                ['bottom', 'Bottom'],
                ['bottom-left', 'Bottom left'],
                ['bottom-right', 'Bottom right'],
                ['top', 'Top'],
                ['top-left', 'Top left'],
                ['top-right', 'Top right'],
            ], 'Anything in the same corner moves out of its way'), 'interactive'),
            this._switch('Show in the overview', 'show-in-overview',
                'The solar system in the Activities overview, behind the app grid and while switching workspaces, instead of the plain wallpaper'),
            this._switch('Sunlight view', 'sunlight-view',
                'Color the plane of the planets by how much sunlight falls there, from 9,000 W/m² at Mercury to 1.5 at Neptune'),
            this._combo('Sunlight view by itself', 'sunlight-auto', [
                ['manual', 'Never: only when I turn it on'],
                ['charging', 'On while the charger is connected'],
                ['battery', 'On while on battery'],
            ], 'Switches when the charger is plugged in or out; the ☀ button still works in between'),
        ]));
        page.add(this._group('Spacecraft', [
            this._switch('Spacecraft', 'show-missions'),
            this._switch('Trails', 'show-trails'),
            this._spin('Trail length', 'trail-years', 0.5, 60, 0.5, 'Years of path kept on screen', 1),
        ]));
        return page;
    }

    _powerPage() {
        const page = new Adw.PreferencesPage({title: 'Power', icon_name: 'battery-good-symbolic'});
        page.add(this._group('Frame rate', [
            this._spin('Frames per second', 'fps', 10, 60, 5),
            this._switch('Slow down when still', 'adaptive-fps',
                'Drop to 5 frames per second while time is paused, the planets are not spinning and the pointer is away'),
        ]));
        page.add(this._group('Hidden desktop', [
            this._switch('Pause when hidden', 'pause-when-covered',
                'Stop animating behind windows, the overview and the lock screen'),
            this._dependsOn(this._spin('Pause once windows cover', 'pause-coverage', 30, 100, 5,
                'Percent of the desktop. Maximized and fullscreen windows always count as all of it'), 'pause-when-covered'),
        ]));
        page.add(this._group('Battery', [
            this._switch('Battery saver', 'battery-saver',
                'On battery or in Power Saver mode, lower the frame rate and stop the planets spinning'),
            this._dependsOn(this._spin('Frames per second on battery', 'battery-fps', 5, 60, 5), 'battery-saver'),
        ]));
        const idleBrightness = this._spin('Dimmed brightness', 'idle-brightness', 5, 100, 5, 'Percent of normal');
        const syncIdle = () => {
            idleBrightness.sensitive = this._settings.get_int('idle-dim-minutes') > 0;
        };
        syncIdle();
        this._watch('changed::idle-dim-minutes', syncIdle);
        page.add(this._group('When you step away', [
            this._spin('Dim after', 'idle-dim-minutes', 0, 60, 1, 'Minutes without keyboard or mouse input; 0 never dims'),
            idleBrightness,
        ], 'Dimming also drops the frame rate to 10. Moving the pointer brings everything back at once.'));
        page.add(this._group('OLED care', [
            this._switch('Pixel shift', 'pixel-shift', 'Drift the whole scene by a few pixels over time to spread OLED wear'),
        ]));
        return page;
    }

    _missionsPage() {
        const page = new Adw.PreferencesPage({title: 'Missions', icon_name: 'starred-symbolic'});
        const groups = {
            craft: new Adw.PreferencesGroup({
                title: 'Spacecraft',
                description: 'Each path is rebuilt from the real dates of its encounters (and the planned dates of those to come), checked against NASA JPL’s trajectories.',
            }),
            observatory: new Adw.PreferencesGroup({
                title: 'Observatories',
                description: 'Telescopes and Sun-watchers parked at the Lagrange points L1 and L2.',
            }),
        };
        // Everything at once.
        const allRow = new Adw.ActionRow({title: 'All missions', subtitle: 'Turn every spacecraft and telescope on or off'});
        for (const [text, on] of [['All on', true], ['All off', false]]) {
            const button = new Gtk.Button({label: text, valign: Gtk.Align.CENTER});
            button.connect('clicked', () => {
                this._settings.set_strv('disabled-missions', on ? [] : MISSIONS.map(m => m.id));
                if (on)
                    this._settings.set_boolean('show-missions', true);
            });
            allRow.add_suffix(button);
        }
        page.add(this._group('', [
            this._switch('Show missions', 'show-missions', 'Hide them all without losing the picks below'),
            allRow,
        ]));
        for (const m of MISSIONS) {
            const stops = m.events.filter(ev => (ev.kind === 'flyby' || ev.kind === 'arrive') && ev.at).map(ev => placeName(ev.at, true));
            const route = stops.filter((n, i) => n !== stops[i - 1]).join(', ');
            const row = new Adw.SwitchRow({
                title: m.name,
                subtitle: `${m.agency} · ${m.events[0].date.slice(0, 4)}${route ? ` · ${route}` : ''}`,
            });
            const sync = () => {
                row.active = !this._settings.get_strv('disabled-missions').includes(m.id);
            };
            sync();
            this._watch('changed::disabled-missions', sync);
            row.connect('notify::active', () => {
                const list = this._settings.get_strv('disabled-missions').filter(id => id !== m.id);
                if (!row.active)
                    list.push(m.id);
                if (list.join() !== this._settings.get_strv('disabled-missions').join())
                    this._settings.set_strv('disabled-missions', list);
            });
            groups[m.group === 'observatory' ? 'observatory' : 'craft'].add(row);
        }
        page.add(groups.craft);
        page.add(groups.observatory);
        return page;
    }

    _musicPage() {
        const page = new Adw.PreferencesPage({title: 'Music', icon_name: 'audio-x-generic-symbolic'});

        const folderRow = new Adw.ActionRow({title: 'Music folder'});
        const syncFolder = () => {
            folderRow.subtitle = this._settings.get_string('music-folder') || 'None chosen';
        };
        syncFolder();
        this._watch('changed::music-folder', syncFolder);
        const choose = new Gtk.Button({label: 'Choose…', valign: Gtk.Align.CENTER});
        choose.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({title: 'Music folder', modal: true});
            const current = this._settings.get_string('music-folder');
            if (current)
                dialog.initial_folder = Gio.File.new_for_path(current);
            dialog.select_folder(choose.get_root(), null, (_d, res) => {
                try {
                    const folder = dialog.select_folder_finish(res);
                    if (folder) {
                        this._settings.set_string('music-folder', folder.get_path());
                        this._settings.set_string('music-source', 'folder');
                    }
                } catch {
                    // Cancelled.
                }
            });
        });
        folderRow.add_suffix(choose);
        const syncSource = () => {
            folderRow.sensitive = this._settings.get_string('music-source') === 'folder';
        };
        syncSource();
        this._watch('changed::music-source', syncSource);

        const playing = new Adw.SwitchRow({title: 'Play music'});
        this._settings.bind('music-muted', playing, 'active', Gio.SettingsBindFlags.INVERT_BOOLEAN);

        page.add(this._group('Background music', [
            playing,
            this._switch('Speaker button on the timeline', 'music-button', 'Turn the music on and off from the desktop'),
            this._combo('Music', 'music-source', [
                ['ambient', 'Built-in ambient'],
                ['folder', 'My own music'],
            ], 'The built-in music is made up as it plays: slow chords, a low drone and soft bells, never quite the same twice'),
            folderRow,
            this._spin('Volume', 'music-volume', 0, 100, 5, 'Percent'),
            this._switch('Keep playing behind windows', 'music-when-hidden',
                'Otherwise the music fades out while windows cover the desktop, and comes back with it'),
        ], 'Music stops while the screen is locked. To hear the Solar System Scope soundtrack, or anything else, put your copies of the tracks in a folder and choose it here: MP3, Ogg, Opus, FLAC, WAV and M4A all play.'));
        return page;
    }
}

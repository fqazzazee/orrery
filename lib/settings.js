// Settings helpers shared by the extension and the preferences.

// The music's modes, in the order the timeline's speaker steps through them.
export const MUSIC_MODES = ['muted', 'background', 'continuous'];
export const nextMode = (list, value) => list[(list.indexOf(value) + 1) % list.length];

// Up to 1.3, music and pausing behind windows were on/off switches. Carry
// them over once, from whichever of the extension and the preferences opens
// first.
export function migrateSettings(s) {
    const set = key => s.get_user_value(key) !== null;
    if (set('music-muted') || set('music-when-hidden')) {
        if (!set('music-mode')) {
            s.set_string('music-mode', s.get_boolean('music-muted') ? 'muted'
                : s.get_boolean('music-when-hidden') ? 'continuous' : 'background');
        }
        s.reset('music-muted');
        s.reset('music-when-hidden');
    }
    if (set('pause-when-covered')) {
        if (!set('animation'))
            s.set_string('animation', s.get_boolean('pause-when-covered') ? 'background' : 'continuous');
        s.reset('pause-when-covered');
    }
}

// What the screensaver can draw when it has its own choice of content.
export const SCREENSAVER_CONTENT = [
    ['show-orbits', 'Orbits'],
    ['show-labels', 'Names'],
    ['show-stars', 'Stars'],
    ['show-belts', 'Asteroid and Kuiper belts'],
    ['show-pluto', 'Pluto'],
    ['show-moons', 'Moons'],
    ['show-small-bodies', 'Ceres, Vesta and comets'],
    ['show-lagrange', 'Lagrange points'],
    ['show-missions', 'Spacecraft'],
    ['show-trails', 'Trails'],
    ['show-facts', 'Fact cards'],
    ['show-hud', 'Date and mission list'],
];

// The settings as a screensaver scene sees them: the wallpaper's, but for
// its own choices. Read-only, so nothing it does can change the wallpaper.
export class ScreensaverSettings {
    constructor(settings) {
        this._settings = settings;
        const o = new Map([['interactive', false], ['timeline', 'never'], ['music-button', false], ['tour', 'off']]);
        if (settings.get_string('screensaver-content') === 'custom') {
            const shown = settings.get_strv('screensaver-show');
            for (const [key] of SCREENSAVER_CONTENT)
                o.set(key, shown.includes(key));
            o.set('disabled-missions', []);
        }
        // A story is about its spacecraft, whatever the wallpaper leaves out.
        if (['stories', 'mission'].includes(settings.get_string('screensaver-scene'))) {
            o.set('show-missions', true);
            o.set('disabled-missions', []);
        }
        this._overrides = o;
    }

    _get(method, key) {
        return this._overrides.has(key) ? this._overrides.get(key) : this._settings[method](key);
    }

    get_boolean(key) {
        return this._get('get_boolean', key);
    }

    get_string(key) {
        return this._get('get_string', key);
    }

    get_int(key) {
        return this._get('get_int', key);
    }

    get_double(key) {
        return this._get('get_double', key);
    }

    get_strv(key) {
        return this._get('get_strv', key);
    }

    get_value(key) {
        return this._settings.get_value(key);
    }

    set_boolean() {}

    set_string() {}

    set_int() {}

    set_double() {}

    set_strv() {}

    connectObject() {}

    disconnectObject() {}
}


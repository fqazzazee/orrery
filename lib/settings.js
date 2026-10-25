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


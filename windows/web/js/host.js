// What the page asks of whatever runs it: on Android, the app's WebView
// bridge (window.OrreryHost, see android/.../Bridge.kt); on Windows, the
// WebView2 host object (windows/Orrery/Bridge.cs), which also sets
// window.OrreryPlatform; in a plain browser, local storage and the URL.
//
// The host calls back into the page through window.orrery.fromHost(type,
// data), with type one of: setting, surface, visible, power, insets,
// offset, tap, back.

import {localBackend} from './store.js';

// DEV ONLY: index.html?platform=windows in a plain browser fakes the
// Windows host, to see the settings page's Windows rows. Its settings and
// status live in local storage. The real host sets window.OrreryHost first.
if (!window.OrreryHost && new URLSearchParams(location.search).get('platform') === 'windows') {
    const read = key => JSON.parse(localStorage.getItem(key) ?? '{}');
    const status = read('orrery-dev-status');
    const done = {wallpaper: ['wallpaper', true], stopWallpaper: ['wallpaper', false], setScreensaver: ['dream', true], screensaver: []};
    window.OrreryPlatform = 'windows';
    window.OrreryHost = {
        settings: () => localStorage.getItem('orrery-dev-settings') ?? '{}',
        save(key, json) {
            const all = read('orrery-dev-settings');
            all[key] = JSON.parse(json);
            localStorage.setItem('orrery-dev-settings', JSON.stringify(all));
        },
        surface: () => new URLSearchParams(location.search).get('surface') ?? 'app',
        status: () => JSON.stringify({version: 'dev', platform: 'windows', ...status}),
        call(action) {
            const [key, value] = done[action] ?? [];
            if (key) {
                status[key] = value;
                localStorage.setItem('orrery-dev-status', JSON.stringify(status));
            }
            return action in done ? 'ok' : 'no';
        },
        ready() {},
    };
}

const bridge = window.OrreryHost ?? null;

// 'android', 'windows' or 'browser'. Windows plays music and reads the
// battery as a browser does, so only Android takes the Android paths.
export const platform = bridge ? (window.OrreryPlatform ?? 'android') : 'browser';
export const onAndroid = platform === 'android';
export const onWindows = platform === 'windows';

export function backend() {
    if (!bridge)
        return localBackend();
    return {
        load() {
            try {
                return JSON.parse(bridge.settings());
            } catch {
                return {};
            }
        },
        save(key, value) {
            bridge.save(key, value === undefined ? 'null' : JSON.stringify(value));
        },
    };
}

// app, wallpaper (which turns into the lock screen) or dream.
export function surface() {
    if (bridge)
        return bridge.surface();
    const s = new URLSearchParams(location.search).get('surface');
    return ['app', 'wallpaper', 'lock', 'dream'].includes(s) ? s : 'app';
}

// Ask the host to do something: set the wallpaper, open the screensaver
// settings, leave the app. Returns false if it cannot.
export function call(action, arg = '') {
    if (!bridge)
        return false;
    try {
        return bridge.call(action, String(arg)) !== 'no';
    } catch (e) {
        console.warn(`Orrery: ${action}: ${e.message}`);
        return false;
    }
}

// Ask the host something: its answer, or null if it cannot say.
export function ask(action, arg = '') {
    if (!bridge)
        return null;
    try {
        const answer = bridge.call(action, String(arg));
        return answer === 'no' ? null : answer;
    } catch (e) {
        console.warn(`Orrery: ${action}: ${e.message}`);
        return null;
    }
}

// What the host knows: whether Orrery is the wallpaper, the lock screen,
// the screensaver; the app's version.
export function status() {
    if (!bridge)
        return {browser: true};
    try {
        return JSON.parse(bridge.status());
    } catch {
        return {};
    }
}

export function ready() {
    bridge?.ready();
}

// The battery, where the browser says (on Android the host tells instead).
export async function watchPower(onChange) {
    if (onAndroid || onWindows || !navigator.getBattery)
        return;
    try {
        const battery = await navigator.getBattery();
        const send = () => onChange({onBattery: !battery.charging, charging: battery.charging, saver: false});
        battery.addEventListener('chargingchange', send);
        send();
    } catch {}
}

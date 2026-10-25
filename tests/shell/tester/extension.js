import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

Gio._promisify(Shell.Screenshot.prototype, 'screenshot', 'screenshot_finish');
Gio._promisify(Shell.Screenshot.prototype, 'screenshot_stage_to_content', 'screenshot_stage_to_content_finish');
Gio._promisify(Shell.Screenshot, 'composite_to_stream', 'composite_to_stream_finish');
const OUT = '/out';
const wait = ms => new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { r(); return GLib.SOURCE_REMOVE; }));
const log = m => console.log('ORRERY-TEST ' + m);
// The whole stage, as the screenshot tool takes it (the plain screenshot
// call comes out empty without a GPU).
async function shot(name) {
    const stream = Gio.File.new_for_path(`${OUT}/${name}.png`).replace(null, false, Gio.FileCreateFlags.NONE, null);
    try {
        const [content] = await new Shell.Screenshot().screenshot_stage_to_content();
        await Shell.Screenshot.composite_to_stream(content.get_texture(), 0, 0, -1, -1, 1, null, 0, 0, 1, stream);
    } catch (e) {
        log(`no screenshot ${name}: ${e}`);
    }
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
        s.set_string('music-mode', 'background');
        await wait(2500);
        log('music ' + o.stateObj._music.playing);
        s.set_string('music-mode', 'muted');
        // The speaker steps through the music's modes; paused, the scene
        // stops until someone uses it.
        for (let i = 0; i < 4; i++)
            scene._timeline._handlers.music();
        log('music mode after four clicks ' + s.get_string('music-mode'));
        s.set_string('music-mode', 'muted');
        scene._togglePanel(true);
        await wait(500);
        log('panel chips ' + scene._panel._chips.length);
        // Every section open: nothing may overlap, and it scrolls.
        const panel = scene._panel, sheet = panel._scroll.child;
        const folds = [];
        const walk = a => a.get_children().forEach(c => (c.has_style_class_name?.('orrery-panel-fold') ? folds.push(c) : walk(c)));
        walk(sheet);
        const closed = folds.filter(f => f.reactive && f.child.text.includes('▸')).length;
        folds.filter(f => f.child.text.includes('▸')).forEach(f => f.emit('clicked', 0));
        await wait(600);
        await shot('panel');
        const box = a => { const [x, y] = a.get_transformed_position(); const [w, h] = a.get_transformed_size(); return [x, y, x + w, y + h]; };
        let overlaps = 0, bottom = -Infinity;
        for (const row of sheet.get_children().filter(c => c.visible)) {
            const [, y1, , y2] = box(row);
            if (y1 < bottom - 0.5)
                overlaps++;
            bottom = y2;
        }
        const chips = panel._chips.map(([c]) => box(c));
        for (let i = 0; i < chips.length; i++) {
            for (let j = i + 1; j < chips.length; j++) {
                const [a, b] = [chips[i], chips[j]];
                if (a[0] < b[2] - 0.5 && b[0] < a[2] - 0.5 && a[1] < b[3] - 0.5 && b[1] < a[3] - 0.5)
                    overlaps++;
            }
        }
        const adj = panel._scroll.vadjustment;
        log(`panel: ${closed} sections started closed, ${overlaps} overlaps, scrolls ${Math.round(adj.upper - adj.page_size)} px, scrollbar ${panel._scroll.vscrollbar_visible}`);
        adj.value = adj.upper;
        await wait(300);
        await shot('panel-bottom');
        adj.value = 0;
        scene._togglePanel(false);

        // Spin and sunlight are back on the bar.
        log(`bar spin ${!!scene._timeline._spin?.visible} sunlight ${!!scene._timeline._sun?.visible}`);
        scene._timeline._handlers.sunlight();
        await wait(300);
        log('sunlight after a click ' + s.get_boolean('sunlight-view'));
        scene._timeline._handlers.sunlight();
        // Apollo 11 on its way to the Moon, in Earth's close-up.
        const jd = iso => Date.parse(iso) / 86400000 + 2440587.5;
        scene._seek(jd('1969-07-18T00:00Z'));
        scene._focusOn('earth');
        await wait(1500);
        const lunar = scene._focus.items.filter(i => i.lunar && i.on);
        log('moon missions up close ' + lunar.map(i => `${i.name}@${Math.round(i.x)},${Math.round(i.y)}`).join(' '));
        const moon = scene._focus.items.find(i => i.id === 'moon');
        scene._seek(jd('1969-07-20T21:00Z'));
        await wait(500);
        const eagle = scene._focus.items.find(i => i.lunar && i.name === 'Apollo 11');
        log(`Apollo 11 on the Moon: ${Math.round(Math.hypot(eagle.x - moon.x, eagle.y - moon.y))} px from the Moon's center, R ${Math.round(moon.R)}`);
        scene._leaveFocus();
        await wait(1000);
        // Voyager 1 swinging past Jupiter.
        scene._seek(jd('1979-03-05T12:00Z'));
        scene._focusOn('jupiter');
        await wait(1500);
        const pass = scene._focus.items.filter(i => i.pass && i.on);
        log('passing Jupiter ' + pass.map(i => `${i.name}@${Math.round(i.x)},${Math.round(i.y)}`).join(' '));
        await shot('voyager-at-jupiter');
        scene._leaveFocus();
        await wait(1000);
        // A story: one mission, flying in at each planet.
        scene.startTour('story', 'voyager1');
        await wait(2500);
        log(`story ${scene._tour?.name} step ${scene._tour?.index} of ${scene._tour?.steps.length} missions ${scene._trajectories.length}`);
        scene._nextTourStep();
        scene._nextTourStep();
        await wait(2500);
        log(`story step ${scene._tour?.index} view ${scene._focus?.id ?? 'system'} caption "${scene._caption.text}"`);
        await shot('story');
        scene._prevTourStep();
        await wait(500);
        log(`story back to step ${scene._tour?.index}`);
        scene._endTour();
        await wait(1500);
        log(`story over: tour ${scene._tour} missions ${scene._trajectories.length} focus ${scene._focus?.id ?? 'none'}`);
        scene.startTour('story', 'apollo11');
        await wait(4000);
        log(`moon story view ${scene._focus?.id} step "${scene._tour?.steps[scene._tour.index].title}"`);
        await shot('moon-story');
        scene._endTour();
        await wait(1500);
        scene.startTour('planets');
        await wait(1000);
        scene._nextTourStep();
        await wait(2000);
        log(`planet tour at ${scene._focus?.id} caption "${scene._caption.text}"`);
        scene._timeline._handlers.zoom(-1);
        await wait(1500);
        log(`zooming out ends it: tour ${scene._tour}`);
        // The automatic tour, and a touch to stop it.
        s.set_int('tour-idle-minutes', 0);
        s.set_string('tour-mission', 'apollo13');
        s.set_string('tour', 'mission');
        await wait(4000);
        log(`automatic tour ${scene._tour?.auto} ${scene._tour?.name}`);
        scene._activity();
        await wait(1000);
        log(`after a touch: tour ${scene._tour}`);
        s.set_string('tour', 'off');
        s.set_value('see-through-apps', new GLib.Variant('a{ss}', {'org.gnome.Ptyxis.desktop': 'music'}));
        s.set_string('animation', 'paused');
        await wait(6000);
        log(`animation ${s.get_string('animation')} paused ${o.stateObj._paused}`);
        scene._activity();
        await wait(500);
        log('paused after activity ' + o.stateObj._paused);
        s.set_string('animation', 'background');
        s.set_value('see-through-apps', new GLib.Variant('a{ss}', {}));
        await wait(1500);
        log('paused in background mode ' + o.stateObj._paused);
        // The second monitor: a scene of its own at the same date, a copy,
        // or nothing.
        const others = () => o.stateObj._others.map(x => x.scene ? `scene@${Math.round(x.scene.jd)}` : x.copy ? 'copy' : '?').join();
        log(`monitors ${Main.layoutManager.monitors.length} main@${Math.round(scene.jd)} others ${others()}`);
        await shot('two-monitors');
        s.set_string('other-monitors', 'copy');
        await wait(1000);
        log('copy mode ' + others());
        s.set_string('other-monitors', 'none');
        await wait(1000);
        log(`none mode [${others()}]`);
        s.set_string('other-monitors', 'own');
        await wait(1000);
        Main.overview.show();
        await wait(1500);
        Main.overview.hide();
        await wait(1000);
        log('own mode again ' + others());
        Main.extensionManager.disableExtension('orrery@fqazzazee.github.io');
        await wait(1000);
        Main.extensionManager.enableExtension('orrery@fqazzazee.github.io');
        await wait(1500);
        log('re-enabled state ' + Main.extensionManager.lookup('orrery@fqazzazee.github.io').state);
    }
}

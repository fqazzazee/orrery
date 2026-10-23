// The overview and the workspace-switch animation draw their own copies of
// the wallpaper, so they would show plain black where the solar system is.
// This puts live clones of the scene in those places: in each workspace card
// (with the card's rounded corners), behind the whole overview (dimmed, so
// app icons stay readable), and in the sliding workspaces of a switch.

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspaceAnimation from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

const BACKDROP_OPACITY = 150;     // of 255, behind the overview
const CORNER_RADIUS = 30;         // as GNOME's workspace cards

// Rounds the corners of the work-area part of a monitor-sized clone, the
// way the workspace card rounds its wallpaper.
const RoundedCorners = GObject.registerClass(
class OrreryRoundedCorners extends Shell.GLSLEffect {
    _init() {
        super._init();
        this._size = this.get_uniform_location('size');
        this._bounds = this.get_uniform_location('bounds');
        this._radius = this.get_uniform_location('radius');
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT,
            'uniform vec2 size;\nuniform vec4 bounds;\nuniform float radius;\n',
            `vec2 p = cogl_tex_coord_in[0].xy * size;
             vec2 d = max(max(bounds.xy + radius - p, p - bounds.zw + radius), vec2(0.0));
             if (radius > 0.0)
                 cogl_color_out *= clamp(radius - length(d) + 0.5, 0.0, 1.0);`,
            false);
    }

    // size: [w, h] of the monitor; bounds: [x0, y0, x1, y1] of its work area.
    setShape(size, bounds, radius) {
        this.set_uniform_float(this._size, 2, size);
        this.set_uniform_float(this._bounds, 4, bounds);
        this.set_uniform_float(this._radius, 1, [radius]);
        this.queue_repaint();
    }
});

export class SceneMirror {
    constructor(source) {
        this._source = source;
        this._clones = new Set();
        this.enabled = false;
    }

    enable() {
        if (this.enabled)
            return;
        this.enabled = true;
        const mirror = this;
        this._injections = new InjectionManager();
        this._injections.overrideMethod(Workspace.WorkspaceBackground.prototype, '_init', original => function (...args) {
            original.call(this, ...args);
            mirror._decorateCard(this);
        });
        this._injections.overrideMethod(WorkspaceAnimation.WorkspaceBackground.prototype, '_createBackground', original => function (...args) {
            original.call(this, ...args);
            mirror._decorateSwitch(this);
        });

        // Behind the overview's own content, above any blurred wallpaper
        // another extension may have put there.
        this._backdrop = this._clone({opacity: BACKDROP_OPACITY});
        Main.layoutManager.overviewGroup.insert_child_below(this._backdrop, Main.overview._overview);
        this._placeBackdrop();
        Main.layoutManager.connectObject('monitors-changed', () => this._placeBackdrop(), this);

        // Cards made before this was turned on (the session can start in the
        // overview).
        const visit = actor => {
            if (actor instanceof Workspace.WorkspaceBackground)
                this._decorateCard(actor);
            else
                actor.get_children().forEach(visit);
        };
        visit(Main.overview._overview);
    }

    disable() {
        if (!this.enabled)
            return;
        this.enabled = false;
        this._injections.clear();
        this._injections = null;
        Main.layoutManager.disconnectObject(this);
        for (const c of [...this._clones])
            c.destroy();
        this._clones.clear();
        this._backdrop = null;
    }

    _clone(params = {}) {
        const clone = new Clutter.Clone({source: this._source, reactive: false, ...params});
        this._clones.add(clone);
        clone.connect('destroy', () => this._clones.delete(clone));
        return clone;
    }

    _placeBackdrop() {
        const m = Main.layoutManager.primaryMonitor;
        if (m && this._backdrop)
            this._backdrop.set({x: m.x, y: m.y, width: m.width, height: m.height});
    }

    // A workspace card in the overview: the clone fills the card's
    // background group just like the wallpaper does.
    _decorateCard(bg) {
        if (bg._monitorIndex !== Main.layoutManager.primaryIndex || !bg._backgroundGroup)
            return;
        const clone = this._clone({x_expand: true, y_expand: true});
        bg._backgroundGroup.add_child(clone);
        let effect = null;
        try {
            effect = new RoundedCorners();
            clone.add_effect(effect);
        } catch (e) {
            console.warn(`Orrery: square corners in the overview: ${e.message}`);
        }
        const shape = () => {
            const m = Main.layoutManager.monitors[bg._monitorIndex];
            const wa = Main.layoutManager.getWorkAreaForMonitor(bg._monitorIndex);
            if (!m || !effect)
                return;
            const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
            const k = bg._stateAdjustment?.value ?? 1;
            effect.setShape([m.width, m.height], [wa.x - m.x, wa.y - m.y, wa.x - m.x + wa.width, wa.y - m.y + wa.height],
                k * CORNER_RADIUS * scaleFactor);
        };
        shape();
        bg._stateAdjustment?.connectObject('notify::value', shape, clone);
        global.display.connectObject('workareas-changed', shape, clone);
    }

    // A workspace sliding past during a switch.
    _decorateSwitch(group) {
        const container = group._bgManager?._container;
        if (!container || group._bgManager._monitorIndex !== Main.layoutManager.primaryIndex)
            return;
        const clone = this._clone();
        container.add_child(clone);
        const m = Main.layoutManager.primaryMonitor;
        clone.set_size(m.width, m.height);
    }
}

// Interactive widgets for the scene: fact cards that can be pinned and
// expanded, and the timeline along the bottom.
//
// Both sit on pure black with dim text, like the rest of the scene.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Render from './render.js';

const EASE = Clutter.AnimationMode.EASE_OUT_QUAD;

// St.Label that never ellipsizes (labels here are short and sized to fit).
export function label(styleClass, text = '') {
    const l = new St.Label({style_class: styleClass, text});
    l.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
    return l;
}

function wrapped(styleClass, text) {
    const l = label(styleClass, text);
    l.clutter_text.set_line_wrap(true);
    l.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
    return l;
}

function iconButton(icon, styleClass = 'orrery-button') {
    const button = new St.Button({
        style_class: styleClass, can_focus: false, y_align: Clutter.ActorAlign.CENTER,
        child: new St.Icon({icon_name: icon, style_class: 'orrery-button-icon'}),
    });
    return button;
}

// Whether an event landed on a button inside `actor`. Buttons recognize
// clicks with a gesture, which stopping the event on the way up would cancel.
export function onButton(actor, event) {
    for (let a = global.stage.get_event_actor(event); a && a !== actor; a = a.get_parent()) {
        if (a instanceof St.Button)
            return true;
    }
    return false;
}

// Swallow presses and releases so they never reach the scene below (where a
// click on empty space clears the selection), except those meant for buttons.
function absorb(actor, onClick) {
    actor.connect('button-press-event', (_a, event) =>
        onButton(actor, event) ? Clutter.EVENT_PROPAGATE : Clutter.EVENT_STOP);
    actor.connect('button-release-event', (_a, event) => {
        if (onButton(actor, event))
            return Clutter.EVENT_PROPAGATE;
        if (event.get_button() === Clutter.BUTTON_PRIMARY)
            onClick?.();
        return Clutter.EVENT_STOP;
    });
}

// A card: title, subtitle and wrapped lines, plus a leader line to its
// subject. With details (stats, events or sections), it can expand into a
// scrolling sheet; with `onClose` it is pinned and gets a close button.
//
// content: {title, subtitle, lines[], stats[[label, value]],
//           events[{ev, text, past}],
//           sections[{title, stats[[label, value]], notes[], links[{text, subject, dim}]}]}
export class Card {
    constructor(parent, content, color, width, {expanded = false, interactive = true, onActivate, onClose, onEvent, onLink, onResize, onZoom} = {}) {
        this._color = color;
        this._onEvent = onEvent;
        this._onLink = onLink;
        this._onResize = onResize;
        this.expanded = false;
        this.box = new St.BoxLayout({
            style_class: onClose ? 'orrery-card orrery-card-pinned' : 'orrery-card',
            orientation: Clutter.Orientation.VERTICAL, opacity: 0, width,
            reactive: interactive, track_hover: interactive,
        });
        absorb(this.box, onActivate);

        const header = new St.BoxLayout({style_class: 'orrery-card-header'});
        this._title = label('orrery-card-title', content.title);
        this._title.set_style(`color: ${color};`);
        this._title.x_expand = true;
        header.add_child(this._title);
        this._hasDetails = !!(content.stats || content.sections || content.events);
        if (this._hasDetails) {
            this._expander = iconButton('pan-down-symbolic', 'orrery-card-button');
            this._expander.connect('clicked', () => this.setExpanded(!this.expanded));
            header.add_child(this._expander);
        }
        // A planet's card can fly in for a close-up.
        if (content.zoomable && onZoom) {
            const zoom = iconButton('zoom-in-symbolic', 'orrery-card-button');
            zoom.connect('clicked', () => onZoom());
            header.add_child(zoom);
        }
        if (onClose) {
            const close = iconButton('window-close-symbolic', 'orrery-card-button');
            close.connect('clicked', () => onClose());
            header.add_child(close);
        }
        this.box.add_child(header);
        this._subtitle = wrapped('orrery-card-subtitle', content.subtitle ?? '');
        this._subtitle.visible = !!content.subtitle;
        this.box.add_child(this._subtitle);

        this._lines = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'orrery-card-lines'});
        this.box.add_child(this._lines);
        // The full sheet scrolls once it is taller than the screen allows.
        this._sheet = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'orrery-card-details'});
        this._details = new St.ScrollView({
            style_class: 'orrery-card-scroll', visible: false, overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC,
            child: this._sheet,
        });
        this.box.add_child(this._details);
        this._content = {};
        this.update(content);

        // A 1x1 line stretched with scale_x inside a rotated holder, so moving
        // it never triggers a relayout.
        this._line = new St.Widget({style_class: 'orrery-leader', width: 1, height: 1, translation_y: -0.5});
        this.leader = new Clutter.Actor({opacity: 0});
        this.leader.add_child(this._line);
        this.ring = new St.Widget({style_class: 'orrery-ring', opacity: 0});
        parent.add_child(this.leader);
        parent.add_child(this.ring);
        parent.add_child(this.box);
        this.width = width;
        if (expanded)
            this.setExpanded(true, false);
        this._measure();
        for (const a of [this.box, this.leader, this.ring])
            a.ease({opacity: 255, duration: 450, mode: EASE});
    }

    _measure() {
        const h = this.box.get_preferred_height(this.width)[1];
        if (h !== this.height) {
            this.height = h;
            this._onResize?.(this);
        }
    }

    // The tallest the whole card may be; the sheet scrolls past that.
    setMaxHeight(px) {
        if (px === this._maxHeight)
            return;
        this._maxHeight = px;
        const head = this.box.get_preferred_height(this.width)[1] - (this._details.visible ? this._details.get_preferred_height(this.width)[1] : 0);
        this._details.set_style(`max-height: ${Math.max(120, Math.round(px - head))}px;`);
        this._measure();
    }

    setExpanded(expanded, animate = true) {
        if (!this._hasDetails || expanded === this.expanded)
            return;
        this.expanded = expanded;
        this._expander.child.icon_name = expanded ? 'pan-up-symbolic' : 'pan-down-symbolic';
        this._lines.visible = !expanded;
        this._details.visible = expanded;
        if (expanded && animate) {
            this._details.opacity = 0;
            this._details.ease({opacity: 255, duration: 300, mode: EASE});
        }
        if (this._maxHeight) {
            const max = this._maxHeight;
            this._maxHeight = null;
            this.setMaxHeight(max);
        }
        this._measure();
    }

    // Refresh the text in place; rebuilds the sheet only when its shape
    // changes, so it keeps its scroll position while the numbers tick.
    update(content) {
        const old = this._content;
        this._content = content;
        if (this._title.text !== content.title)
            this._title.text = content.title;
        if (content.subtitle && this._subtitle.text !== content.subtitle)
            this._subtitle.text = content.subtitle;

        const lines = (content.lines ?? []).filter(Boolean);
        this._syncList(this._lines, lines, old.lines?.filter(Boolean),
            text => wrapped('orrery-card-line', text), (l, text) => {
                if (l.text !== text)
                    l.text = text;
            });
        if (!this._hasDetails)
            return;

        const shape = c => JSON.stringify([
            (c.stats ?? []).map(([k]) => k),
            (c.events ?? []).map(e => `${e.text}${e.past}`),
            (c.sections ?? []).map(x => [x.title, (x.stats ?? []).map(([k]) => k), x.notes?.length, (x.links ?? []).map(l => l.text)]),
        ]);
        const sig = shape(content);
        if (sig === this._shape) {
            for (const set of this._setters)
                set(content);
        } else {
            this._shape = sig;
            this._buildSheet(content);
        }
        if (this.width)
            this._measure();
    }

    _buildSheet(content) {
        this._sheet.destroy_all_children();
        this._setters = [];
        const set = (actor, get) => this._setters.push(c => {
            const text = get(c);
            if (text !== undefined && actor.text !== text)
                actor.text = text;
        });
        const statRows = (box, rows, get) => {
            rows.forEach(([key], i) => {
                const row = new St.BoxLayout({style_class: 'orrery-stat'});
                const k = wrapped('orrery-stat-key', key);
                const v = wrapped('orrery-stat-value', rows[i][1]);
                v.x_expand = true;
                row.add_child(k);
                row.add_child(v);
                box.add_child(row);
                set(v, c => get(c)?.[i]?.[1]);
            });
        };
        const block = styleClass => {
            const b = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: styleClass});
            this._sheet.add_child(b);
            return b;
        };

        if (content.stats?.length)
            statRows(block('orrery-card-stats'), content.stats, c => c.stats);

        // Events are buttons: clicking one moves the timeline to it.
        if (content.events?.length) {
            const box = block('orrery-card-events');
            for (const item of content.events) {
                const dot = new St.Widget({style_class: 'orrery-event-dot', y_align: Clutter.ActorAlign.CENTER});
                dot.set_style(item.past ? `background-color: ${this._color};` : `border: 1px solid ${this._color};`);
                box.add_child(this._row(item.past ? 'orrery-event-row orrery-event-past' : 'orrery-event-row', dot,
                    label('orrery-event-text', item.text), () => this._onEvent?.(item.ev)));
            }
        }

        (content.sections ?? []).forEach((section, si) => {
            const box = block('orrery-card-section');
            if (section.title)
                box.add_child(label('orrery-card-section-title', section.title.toUpperCase()));
            if (section.stats?.length)
                statRows(box, section.stats, c => c.sections?.[si]?.stats);
            (section.notes ?? []).forEach((text, ni) => {
                const l = wrapped('orrery-card-note', section.title ? `·  ${text}` : text);
                box.add_child(l);
                set(l, c => {
                    const t = c.sections?.[si]?.notes?.[ni];
                    return t === undefined ? undefined : section.title ? `·  ${t}` : t;
                });
            });
            // Links pick another subject: a moon, a planet, a spacecraft.
            for (const link of section.links ?? []) {
                const arrow = label('orrery-link-arrow', '›');
                arrow.y_align = Clutter.ActorAlign.CENTER;
                box.add_child(this._row(link.dim ? 'orrery-event-row orrery-event-past' : 'orrery-event-row', arrow,
                    label('orrery-event-text', link.text), () => this._onLink?.(link.subject)));
            }
        });
    }

    _row(styleClass, lead, text, onClick) {
        const row = new St.Button({style_class: styleClass, can_focus: false, x_align: Clutter.ActorAlign.FILL});
        const inner = new St.BoxLayout({x_expand: true, x_align: Clutter.ActorAlign.START});
        inner.add_child(lead);
        inner.add_child(text);
        row.child = inner;
        row.connect('clicked', onClick);
        return row;
    }

    _syncList(box, items, oldItems, create, set) {
        if (items.length === oldItems?.length && box.get_n_children() === items.length) {
            box.get_children().forEach((child, i) => set(child, items[i]));
            return;
        }
        box.destroy_all_children();
        for (const item of items)
            box.add_child(create(item));
        box.visible = items.length > 0;
    }

    place(x, y) {
        this.x = x;
        this.y = y;
        this.box.set_position(Math.round(x), Math.round(y));
    }

    // Point the leader at (tx, ty), stopping `gap` px short of it.
    aim(tx, ty, gap) {
        const {x, y, width: w, height: h} = this;
        const sx = tx < x ? x : tx > x + w ? x + w : x + w / 2;
        const sy = tx >= x && tx <= x + w ? (ty < y ? y : y + h) : Math.max(y + 14, Math.min(y + h - 14, ty));
        const dx = tx - sx, dy = ty - sy;
        const len = Math.hypot(dx, dy) - gap;
        this.leader.visible = len > 4;
        if (len > 4) {
            this.leader.set_translation(sx, sy, 0);
            this.leader.rotation_angle_z = Math.atan2(dy, dx) * 180 / Math.PI;
            this._line.scale_x = len;
        }
        const r = Math.round(gap);
        if (this._ringSize !== 2 * r) {
            this._ringSize = 2 * r;
            this.ring.set_size(2 * r, 2 * r);
        }
        this.ring.set_translation(tx - r, ty - r, 0);
    }

    dismiss() {
        for (const a of [this.box, this.leader, this.ring]) {
            a.remove_all_transitions();
            a.ease({opacity: 0, duration: 450, mode: Clutter.AnimationMode.EASE_IN_QUAD, onComplete: () => a.destroy()});
        }
    }

    destroy() {
        for (const a of [this.box, this.leader, this.ring])
            a.destroy();
    }
}

// The timeline: transport buttons, a track from t0 to t1 with a tick for
// every mission event, and a playhead that can be dragged (or clicked to
// pause and play). The music button and the panel of modes and layers sit
// at the end.
//
// handlers: {seek(t, done), toggle(), restart(), speed(dir), now(),
//            music(), zoom(dir), layers(),
//            hover({t, ev, x} | {text, x} | null), activity()}
// What the music button shows for each mode, and what a click does from
// there.
const MUSIC_ICONS = {muted: 'audio-volume-muted-symbolic', background: 'audio-volume-medium-symbolic', continuous: 'audio-volume-high-symbolic'};
const MUSIC_TIPS = {
    muted: 'Music off · click to play it while the desktop shows',
    background: 'Music while the desktop shows · click to keep it playing behind windows',
    continuous: 'Music all the time · click to mute',
};

export class Timeline {
    constructor(parent, handlers) {
        this._handlers = handlers;
        this.actor = new St.BoxLayout({style_class: 'orrery-timeline', reactive: true, track_hover: true, opacity: 0, visible: false});
        // A middle click anywhere on the bar plays or pauses. (Connected
        // before absorb(), which stops the event.)
        this.actor.connect('button-release-event', (_a, event) => {
            if (event.get_button() === Clutter.BUTTON_MIDDLE) {
                this._handlers.toggle();
                this._handlers.activity();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        absorb(this.actor);
        this.actor.connect('motion-event', () => {
            this._handlers.activity();
            return Clutter.EVENT_PROPAGATE;
        });

        const button = (icon, cb, tip) => {
            const b = iconButton(icon);
            const showTip = () => {
                const [x] = b.get_transformed_position();
                const text = typeof tip === 'function' ? tip() : tip;
                this._handlers.hover(b.hover ? {text, x: x + b.width / 2} : null);
            };
            b.connect('clicked', () => {
                cb();
                this._handlers.activity();
                // The tip says what the next click does, so it changes too.
                if (b.hover && typeof tip === 'function')
                    showTip();
            });
            b.connect('notify::hover', showTip);
            this.actor.add_child(b);
            return b;
        };
        this._restart = button('media-skip-backward-symbolic', () => this._handlers.restart(), 'Back to the start');
        this._play = button('media-playback-pause-symbolic', () => this._handlers.toggle(),
            () => this._state?.playing ? 'Pause (or click the playhead)' : 'Play (or click the playhead)');
        this._play.add_style_class_name('orrery-play');
        this._slower = button('media-seek-backward-symbolic', () => this._handlers.speed(-1), 'Slower');
        this._speed = label('orrery-timeline-speed');
        this._speed.y_align = Clutter.ActorAlign.CENTER;
        this.actor.add_child(this._speed);
        this._faster = button('media-seek-forward-symbolic', () => this._handlers.speed(+1), 'Faster');

        // The track: drawn once per layout; the playhead and the bright part
        // up to it only move.
        // min_width 0: otherwise the canvas, sized for the last layout, would
        // stop the track from giving room to the buttons.
        this._track = new St.Widget({style_class: 'orrery-timeline-track', reactive: true, x_expand: true, min_width: 0});
        this._canvas = new St.DrawingArea();
        this._canvas.connect('repaint', area => {
            const cr = area.get_context();
            if (this._range)
                Render.drawTimeline(cr, ...area.get_surface_size(), {...this._range, x: t => this._x(t)});
            cr.$dispose();
        });
        this._played = new St.Widget({style_class: 'orrery-timeline-played', width: 1, height: 2});
        this._head = new St.Widget({style_class: 'orrery-timeline-head'});
        this._years = new Clutter.Actor();
        for (const a of [this._canvas, this._years, this._played, this._head])
            this._track.add_child(a);
        this.actor.add_child(this._track);
        // Lay the track out after allocation, not during it.
        this._track.connect('notify::allocation', () => {
            this._laters ??= global.compositor.get_laters();
            if (!this._laterId) {
                this._laterId = this._laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
                    this._laterId = 0;
                    this._layoutTrack();
                    return GLib.SOURCE_REMOVE;
                });
            }
        });
        this._track.connect('button-press-event', (_a, event) => this._onPress(event));
        this._track.connect('motion-event', (_a, event) => this._onMotion(event));
        this._track.connect('button-release-event', (_a, event) => this._onRelease(event));
        this._track.connect('leave-event', () => {
            if (!this._grab)
                this._handlers.hover(null);
            return Clutter.EVENT_PROPAGATE;
        });
        this._track.connect('scroll-event', (_a, event) => this._onScroll(event));

        this._now = new St.Button({style_class: 'orrery-pill', label: 'Now', can_focus: false, y_align: Clutter.ActorAlign.CENTER});
        this._now.connect('clicked', () => {
            this._handlers.now();
            this._handlers.activity();
        });
        this._now.connect('notify::hover', () => {
            const [x] = this._now.get_transformed_position();
            this._handlers.hover(this._now.hover ? {text: 'Back to today', x: x + this._now.width / 2} : null);
        });
        this.actor.add_child(this._now);
        this._zoomOut = button('zoom-out-symbolic', () => this._handlers.zoom(-1),
            () => this._state?.zoom === 'planet' ? 'Back to the solar system' : 'Zoom out, toward the Oort cloud');
        this._zoomIn = button('zoom-in-symbolic', () => this._handlers.zoom(+1),
            () => this._state?.zoom === 'far' ? 'Zoom back in' : 'Fly to the picked planet (or Earth)');
        this._music = button('audio-volume-muted-symbolic', () => this._handlers.music(),
            () => MUSIC_TIPS[this._state?.music] ?? '');
        this._music.add_style_class_name('orrery-toggle');
        this._layers = button('view-list-bullet-symbolic', () => this._handlers.layers(),
            'Modes, what to show, missions and settings');
        this._layers.add_style_class_name('orrery-toggle');

        parent.add_child(this.actor);
        this.shown = false;
    }

    // range: {t0, t1, now, years[[t, major]], events[{t, rgb, kind, ev}], labels[[t, text]]}
    setRange(range) {
        this._range = range;
        this._layoutTrack();
    }

    _layoutTrack() {
        const w = Math.floor(this._track.width), h = Math.floor(this._track.height);
        if (!this._range || w <= 0 || h <= 0 || (w === this._w && h === this._hgt && this._range === this._drawnRange))
            return;
        [this._w, this._hgt, this._drawnRange] = [w, h, this._range];
        this._canvas.set_size(w, h);
        this._canvas.queue_repaint();
        this._years.destroy_all_children();
        let lastX = -Infinity;
        for (const [t, text] of this._range.labels) {
            const l = label('orrery-timeline-year', text);
            this._years.add_child(l);
            const lw = l.get_preferred_width(-1)[1];
            const x = Math.round(this._x(t) - lw / 2);
            if (x < lastX + 8 || x < 0 || x + lw > w) {
                l.destroy();
                continue;
            }
            lastX = x + lw;
            l.set_position(x, Math.round(h * 0.68) + 6);
        }
        this._played.set_position(0, Math.round(h * 0.68) - 0.5);
        this._head.set_position(0, Math.round(h * 0.68) - 7);
        this.setTime(this._time ?? this._range.now);
    }

    _x(t) {
        const {t0, t1} = this._range;
        return (t - t0) / (t1 - t0) * (this._w ?? this._track.width);
    }

    _timeAt(x) {
        const {t0, t1} = this._range;
        const w = this._w ?? this._track.width;
        return t0 + Math.max(0, Math.min(1, x / w)) * (t1 - t0);
    }

    setTime(t) {
        this._time = t;
        if (!this._range || !this._w || !this.actor.visible)
            return;
        const x = Math.max(0, Math.min(this._w, this._x(t)));
        if (Math.abs(x - (this._headX ?? -1)) < 0.25)
            return;
        this._headX = x;
        this._played.scale_x = Math.max(0.001, x);
        this._head.translation_x = Math.round(x - this._head.width / 2);
    }

    // music: a music-mode, or 'hidden' (no music button)
    setState(state) {
        const {playing, speed, live, music} = state;
        this._state = state;
        const icon = playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        if (this._play.child.icon_name !== icon)
            this._play.child.icon_name = icon;
        if (this._speed.text !== speed)
            this._speed.text = speed;
        const musicIcon = MUSIC_ICONS[music];
        if (musicIcon && this._music.child.icon_name !== musicIcon)
            this._music.child.icon_name = musicIcon;
        this._music.visible = music !== 'hidden';
        this._zoomOut.reactive = state.zoom !== 'max';
        this._zoomOut.opacity = state.zoom === 'max' ? 90 : 255;
        this._zoomIn.reactive = state.zoom !== 'planet';
        this._zoomIn.opacity = state.zoom === 'planet' ? 90 : 255;
        for (const [actor, on] of [[this._now, live], [this._music, music === 'background' || music === 'continuous'],
            [this._head, !playing], [this._layers, !!state.layers]]) {
            const name = actor === this._head ? 'orrery-timeline-head-paused' : 'orrery-toggle-on';
            if (actor.has_style_class_name(name) !== on)
                actor[on ? 'add_style_class_name' : 'remove_style_class_name'](name);
        }
    }

    // The event under x, if any, within a few pixels.
    _eventNear(x) {
        let best = null, bestD = 5;
        for (const e of this._range.events) {
            const d = Math.abs(this._x(e.t) - x);
            if (d < bestD || (best && d === bestD && e.kind === 'launch')) {
                best = e;
                bestD = d;
            }
        }
        return best;
    }

    _localX(event) {
        const [x] = event.get_coords();
        const [ok, lx] = this._track.transform_stage_point(x, 0);
        return ok ? lx : 0;
    }

    _onPress(event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this._range)
            return Clutter.EVENT_STOP;
        this._endDrag();
        this._grab = global.stage.grab(this._track);
        this._dragged = false;
        this._pressX = this._localX(event);
        return Clutter.EVENT_STOP;
    }

    _onMotion(event) {
        if (!this._range)
            return Clutter.EVENT_PROPAGATE;
        const x = this._localX(event);
        // A drag whose release went elsewhere (another grab took over).
        if (this._grab && !(event.get_state() & Clutter.ModifierType.BUTTON1_MASK))
            this._endDrag();
        if (this._grab) {
            if (Math.abs(x - this._pressX) > 3)
                this._dragged = true;
            if (this._dragged)
                this._handlers.seek(this._timeAt(x), false);
        }
        const near = this._grab ? null : this._eventNear(x);
        const onHead = !this._grab && Math.abs(x - (this._headX ?? -99)) <= 6;
        if (onHead)
            this._handlers.hover({text: this._state?.playing ? 'Click to pause · drag to move' : 'Click to play · drag to move', x: this._trackStageX(this._time)});
        else
            this._handlers.hover(near ? {t: near.t, ev: near.ev, x: this._trackStageX(near.t)} : {t: this._timeAt(x), x: this._trackStageX(this._timeAt(x))});
        this._handlers.activity();
        return Clutter.EVENT_STOP;
    }

    _trackStageX(t) {
        return this._track.get_transformed_position()[0] + this._x(t);
    }

    _onRelease(event) {
        if (event.get_button() === Clutter.BUTTON_MIDDLE) {
            this._handlers.toggle();
            this._handlers.activity();
            return Clutter.EVENT_STOP;
        }
        if (!this._grab)
            return Clutter.EVENT_STOP;
        this._grab.dismiss();
        this._grab = null;
        const x = this._localX(event);
        // A click on the playhead plays or pauses; one on an event tick
        // jumps to that event.
        if (!this._dragged && Math.abs(x - (this._headX ?? -99)) <= 6) {
            this._handlers.toggle();
            return Clutter.EVENT_STOP;
        }
        const near = this._dragged ? null : this._eventNear(x);
        this._handlers.seek(near ? near.t : this._timeAt(x), true, near?.ev);
        return Clutter.EVENT_STOP;
    }

    _onScroll(event) {
        let steps = 0;
        const dir = event.get_scroll_direction();
        if (dir === Clutter.ScrollDirection.UP || dir === Clutter.ScrollDirection.RIGHT)
            steps = 1;
        else if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.LEFT)
            steps = -1;
        else if (dir === Clutter.ScrollDirection.SMOOTH)
            steps = -event.get_scroll_delta()[1] || event.get_scroll_delta()[0];
        if (steps && this._range && this._time !== undefined) {
            // A month a step.
            this._handlers.seek(Math.max(this._range.t0, Math.min(this._range.t1, this._time + steps * 30.44)), true);
        }
        this._handlers.activity();
        return Clutter.EVENT_STOP;
    }

    show() {
        if (this.shown)
            return;
        this.shown = true;
        this.actor.show();
        this.actor.remove_all_transitions();
        this.actor.ease({opacity: 255, duration: 250, mode: EASE});
        this._headX = null;
        this.setTime(this._time);
    }

    hide() {
        if (!this.shown || this._grab)
            return;
        this.shown = false;
        this._handlers.hover(null);
        this.actor.remove_all_transitions();
        this.actor.ease({opacity: 0, duration: 600, mode: EASE, onComplete: () => this.actor.hide()});
    }

    get dragging() {
        if (this._grab?.is_revoked?.())
            this._endDrag();
        return !!this._grab;
    }

    _endDrag() {
        this._grab?.dismiss();
        this._grab = null;
    }

    destroy() {
        if (this._laterId)
            this._laters.remove(this._laterId);
        this._laterId = 0;
        this._grab?.dismiss();
        this._grab = null;
        this.actor.destroy();
    }
}

// A panel opened from the timeline: the modes of the music and the
// animation, the spin and the sunlight view, then chips to show and hide
// things on the desktop and turn missions on and off. Each chip mirrors a
// setting, so it stays in step with the preferences window.
//
// options: {settings, missions[{id, name, short, color, group}],
//           spin{isOn(), toggle()}, onPrefs(), onClose(), activity()}
const CONTENT = [
    ['show-orbits', 'Orbits'], ['show-labels', 'Names'], ['show-stars', 'Stars'], ['show-belts', 'Belts and Trojans'],
    ['show-moons', 'Moons'], ['show-pluto', 'Pluto'], ['show-small-bodies', 'Comets and asteroids'],
    ['show-lagrange', 'Lagrange points'], ['show-trails', 'Trails'],
    ['show-facts', 'Fact cards'], ['show-hud', 'Date and mission list'],
];
const MODES = [
    ['Music', 'music-mode', [['muted', 'Muted'], ['background', 'Background only'], ['continuous', 'Continuous']]],
    ['Animation', 'animation', [['paused', 'Paused'], ['background', 'Background only'], ['continuous', 'Continuous']]],
];

export class LayersPanel {
    constructor(parent, {settings, missions, spin, onPrefs, onClose, activity}) {
        this._settings = settings;
        this._activity = activity;
        this.isOpen = false;
        this.actor = new St.BoxLayout({
            style_class: 'orrery-card orrery-panel', orientation: Clutter.Orientation.VERTICAL,
            reactive: true, visible: false, opacity: 0,
        });
        absorb(this.actor);
        this.actor.connect('motion-event', () => {
            this._activity?.();
            return Clutter.EVENT_PROPAGATE;
        });

        const header = new St.BoxLayout({style_class: 'orrery-card-header'});
        const title = label('orrery-card-title', 'On the desktop');
        title.x_expand = true;
        header.add_child(title);
        const prefs = new St.Button({style_class: 'orrery-pill', label: 'Settings…', can_focus: false, y_align: Clutter.ActorAlign.CENTER});
        prefs.connect('clicked', () => onPrefs());
        header.add_child(prefs);
        const close = iconButton('window-close-symbolic', 'orrery-card-button');
        close.connect('clicked', () => onClose());
        header.add_child(close);
        this.actor.add_child(header);

        const sheet = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'orrery-card-details'});
        this._scroll = new St.ScrollView({
            style_class: 'orrery-card-scroll', overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC, child: sheet,
        });
        this.actor.add_child(this._scroll);

        this._chips = [];
        const flowOf = items => {
            const flow = new St.Widget({
                layout_manager: new Clutter.FlowLayout({column_spacing: 6, row_spacing: 6}),
                x_expand: true, style_class: 'orrery-panel-chips',
            });
            for (const item of items)
                flow.add_child(this._chip(item));
            return flow;
        };
        const section = (heading, items, all) => {
            const head = new St.BoxLayout({style_class: 'orrery-panel-heading'});
            const h = label('orrery-card-section-title', heading.toUpperCase());
            h.x_expand = true;
            h.y_align = Clutter.ActorAlign.CENTER;
            head.add_child(h);
            if (all) {
                for (const [text, on] of [['All', true], ['None', false]]) {
                    const b = new St.Button({style_class: 'orrery-pill orrery-pill-small', label: text, can_focus: false});
                    b.connect('clicked', () => all(on));
                    head.add_child(b);
                }
            }
            sheet.add_child(head);
            sheet.add_child(flowOf(items));
        };

        // Each mode a row of chips, one of them lit; Paused still moves
        // while the pointer is on the desktop.
        section('Modes', [
            {text: 'Spin the planets', isOn: () => spin.isOn(), toggle: () => spin.toggle()},
            {text: 'Sunlight view', isOn: () => settings.get_boolean('sunlight-view'),
                toggle: () => settings.set_boolean('sunlight-view', !settings.get_boolean('sunlight-view'))},
        ]);
        for (const [title, key, options] of MODES) {
            const row = new St.BoxLayout({style_class: 'orrery-panel-choice'});
            const t = label('orrery-panel-choice-title', title);
            t.y_align = Clutter.ActorAlign.CENTER;
            row.add_child(t);
            row.add_child(flowOf(options.map(([value, text]) => ({text,
                isOn: () => settings.get_string(key) === value, toggle: () => settings.set_string(key, value)}))));
            sheet.insert_child_at_index(row, sheet.get_n_children() - 1);
        }

        section('Show', CONTENT.map(([key, text]) => ({text, isOn: () => settings.get_boolean(key),
            toggle: () => settings.set_boolean(key, !settings.get_boolean(key))})));
        const disabled = () => settings.get_strv('disabled-missions');
        const setMissions = (ids, on) => {
            const rest = disabled().filter(id => !ids.includes(id));
            settings.set_strv('disabled-missions', on ? rest : [...rest, ...ids]);
        };
        const chipsFor = list => list.map(m => ({
            text: m.short ?? m.name, color: m.color, isOn: () => !disabled().includes(m.id),
            toggle: () => setMissions([m.id], disabled().includes(m.id)),
        }));
        const craft = missions.filter(m => m.group !== 'observatory');
        const scopes = missions.filter(m => m.group === 'observatory');
        // All missions at once: shown or hidden (keeping the picks below),
        // or every one of them turned on or off.
        section('Missions', [{text: 'Show missions', isOn: () => settings.get_boolean('show-missions'),
            toggle: () => settings.set_boolean('show-missions', !settings.get_boolean('show-missions'))}],
        on => {
            settings.set_strv('disabled-missions', on ? [] : missions.map(m => m.id));
            if (on)
                settings.set_boolean('show-missions', true);
        });
        section('Spacecraft', chipsFor(craft), on => setMissions(craft.map(m => m.id), on));
        section('Telescopes at L1 and L2', chipsFor(scopes), on => setMissions(scopes.map(m => m.id), on));

        settings.connectObject('changed', () => this.sync(), this);
        parent.add_child(this.actor);
        this.sync();
    }

    _chip(item) {
        const box = new St.BoxLayout({style_class: 'orrery-chip-box'});
        if (item.color) {
            const dot = new St.Widget({style_class: 'orrery-chip-dot', y_align: Clutter.ActorAlign.CENTER});
            dot.set_style(`background-color: ${item.color};`);
            box.add_child(dot);
        }
        box.add_child(label('orrery-chip-label', item.text));
        const chip = new St.Button({style_class: 'orrery-chip', child: box, can_focus: false});
        chip.connect('clicked', () => {
            item.toggle();
            this._activity?.();
        });
        this._chips.push([chip, item]);
        return chip;
    }

    sync() {
        for (const [chip, item] of this._chips) {
            const on = item.isOn();
            if (chip.has_style_class_name('orrery-chip-on') !== on)
                chip[on ? 'add_style_class_name' : 'remove_style_class_name']('orrery-chip-on');
        }
    }

    // Placed at (x, y) as its top left, no taller than maxHeight.
    place(x, y, width, maxHeight) {
        this.actor.width = width;
        const head = 60;
        this._scroll.set_style(`max-height: ${Math.max(120, maxHeight - head)}px;`);
        const h = Math.min(maxHeight, this.actor.get_preferred_height(width)[1]);
        this.actor.set_position(Math.round(x), Math.round(typeof y === 'function' ? y(h) : y));
    }

    open() {
        if (this.isOpen)
            return;
        this.isOpen = true;
        this.sync();
        this.actor.show();
        this.actor.remove_all_transitions();
        this.actor.ease({opacity: 255, duration: 200, mode: EASE});
    }

    close() {
        if (!this.isOpen)
            return;
        this.isOpen = false;
        this.actor.remove_all_transitions();
        this.actor.ease({opacity: 0, duration: 200, mode: EASE, onComplete: () => this.actor.hide()});
    }

    destroy() {
        this._settings.disconnectObject(this);
        this.actor.destroy();
    }
}

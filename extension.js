import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as A from './lib/astro.js';
import {BODY, PLANETS} from './lib/bodies.js';
import {FactDeck, eventCard, missionStatus} from './lib/facts.js';
import {MISSIONS, buildTrajectories} from './lib/missions.js';
import * as R from './lib/render.js';

const RELAYOUT_KEYS = ['distance-scale', 'tilt', 'azimuth', 'zoom', 'planet-scale', 'show-orbits',
    'show-stars', 'show-belts', 'show-pluto', 'show-labels', 'show-hud', 'show-missions', 'show-facts'];
const HOLD_SECONDS = 20;          // pause on "today" before the replay starts over
const EVENT_CARD_SECONDS = 8;
const TRAIL_HZ = 4;
const HUD_HZ = 2;

const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// St.Label that never ellipsizes (labels here are short and sized to fit).
function label(styleClass, text = '') {
    const l = new St.Label({style_class: styleClass, text});
    l.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
    return l;
}

// A small St.DrawingArea centered on a point.
class Sprite {
    constructor(parent, size, paint) {
        this.size = size;
        this.area = new St.DrawingArea({width: size, height: size});
        this.area.connect('repaint', area => {
            const cr = area.get_context();
            paint(cr, size);
            cr.$dispose();
        });
        parent.add_child(this.area);
    }

    // Translation, not position: moving by translation skips relayout.
    moveTo(x, y) {
        this.area.set_translation(x - this.size / 2, y - this.size / 2, 0);
    }

    repaint() {
        this.area.queue_repaint();
    }

    destroy() {
        this.area.destroy();
    }
}

// A DrawingArea that sizes itself to the bounding box of what it draws.
class BoxCanvas {
    constructor(parent) {
        this.area = new St.DrawingArea();
        this._paths = [];
        this._origin = [0, 0];
        this.area.connect('repaint', area => {
            const cr = area.get_context();
            cr.translate(-this._origin[0], -this._origin[1]);
            this._paint?.(cr);
            cr.$dispose();
        });
        parent.add_child(this.area);
    }

    // points: arrays of [x, y, ...]; bounds: [w, h] of the screen to clamp to.
    update(points, bounds, paint, pad = 6) {
        let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
        for (const [x, y] of points) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
        }
        x0 = Math.max(0, Math.floor(x0 - pad));
        y0 = Math.max(0, Math.floor(y0 - pad));
        x1 = Math.min(bounds[0], Math.ceil(x1 + pad));
        y1 = Math.min(bounds[1], Math.ceil(y1 + pad));
        if (!(x1 > x0 && y1 > y0)) {
            this.area.hide();
            return;
        }
        this._origin = [x0, y0];
        this._paint = paint;
        this.area.set_position(x0, y0);
        this.area.set_size(x1 - x0, y1 - y0);
        this.area.show();
        this.area.queue_repaint();
    }

    hide() {
        this.area.hide();
    }
}

// A card: title, subtitle and wrapped lines, plus a leader line to its subject.
class Card {
    constructor(parent, {title, subtitle, lines}, color, width) {
        this.box = new St.BoxLayout({style_class: 'orrery-card', vertical: true, opacity: 0, width});
        const titleLabel = new St.Label({style_class: 'orrery-card-title', text: title});
        titleLabel.set_style(`color: ${color};`);
        this.box.add_child(titleLabel);
        if (subtitle)
            this.box.add_child(new St.Label({style_class: 'orrery-card-subtitle', text: subtitle}));
        for (const line of lines.filter(Boolean)) {
            const text = new St.Label({style_class: 'orrery-card-line', text: line});
            text.clutter_text.set_line_wrap(true);
            text.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            text.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
            this.box.add_child(text);
        }
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
        this.height = this.box.get_preferred_height(width)[1];
        for (const a of [this.box, this.leader, this.ring])
            a.ease({opacity: 255, duration: 450, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
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

class OrreryScene {
    constructor(settings) {
        this._settings = settings;
        this._facts = new FactDeck();
        this._realTime = 0;
        this._hold = 0;
        this._trailClock = 0;
        this._hudClock = 0;
        this._factClock = 0;
        this._factCard = null;
        this._eventCards = [];
        this._factCount = 0;

        this.actor = new St.Widget({style_class: 'orrery', reactive: false, clip_to_allocation: true});
        this._content = new Clutter.Actor();
        this.actor.add_child(this._content);
        this._backdrop = new St.DrawingArea();
        this._backdrop.connect('repaint', area => this._paintBackdrop(area));
        this._content.add_child(this._backdrop);
        this._highlight = new BoxCanvas(this._content);
        this._trails = new BoxCanvas(this._content);
        this._world = new Clutter.Actor();
        this._craftLayer = new Clutter.Actor();
        this._labels = new Clutter.Actor();
        this._hud = new Clutter.Actor();
        for (const layer of [this._world, this._craftLayer, this._labels, this._hud])
            this._content.add_child(layer);

        this._buildHud();
        this._buildTrajectories();
        this._resetTime();
    }

    destroy() {
        this._factCard?.destroy();
        for (const c of this._eventCards)
            c.card.destroy();
        this.actor.destroy();
    }

    get jd() {
        return this._jd;
    }

    // ---- Time ----

    _startJd() {
        return A.jd(`${this._settings.get_int('replay-start-year')}-01-01`);
    }

    _resetTime() {
        const s = this._settings;
        if (s.get_string('mode') === 'live') {
            this._jd = A.jdNow();
        } else {
            const saved = s.get_double('replay-jd');
            this._jd = saved > this._startJd() && saved < A.jdNow() ? saved : this._startJd();
        }
        this._hold = 0;
        this._seekEvents();
    }

    _advance(dt) {
        const s = this._settings;
        if (s.get_string('mode') === 'live') {
            this._jd = A.jdNow();
            return;
        }
        const now = A.jdNow();
        if (this._jd < now) {
            this._jd = Math.min(now, this._jd + dt * s.get_double('days-per-second'));
            return;
        }
        // Hold on today for a moment, then fade out and start over.
        this._hold += dt;
        if (this._hold > HOLD_SECONDS && !this._restarting) {
            this._restarting = true;
            this._content.ease({
                opacity: 0, duration: 1200, mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    this._restarting = false;
                    this._jd = this._startJd();
                    this._hold = 0;
                    this._seekEvents();
                    this._updateAll(0);
                    this._content.ease({opacity: this._opacity(), duration: 1500, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
                },
            });
        }
    }

    _opacity() {
        return Math.round(255 * this._settings.get_double('brightness') / 100);
    }

    // ---- Spacecraft ----

    _buildTrajectories() {
        const disabled = this._settings.get_strv('disabled-missions');
        this._trajectories = buildTrajectories(MISSIONS.filter(m => !disabled.includes(m.id)));
        const horizon = A.jdNow() + 3 * 365.25;
        for (const tr of this._trajectories) {
            tr.cache = tr.samples(tr.launch, Math.min(tr.end, horizon));
            tr.rgb = R.hexToRgb(tr.mission.color);
        }
        this._events = this._trajectories.flatMap(tr => tr.events).sort((a, b) => a.t - b.t);
        this._seekEvents();
    }

    _seekEvents() {
        if (!this._events || this._jd === undefined)
            return;
        this._eventIndex = this._events.findIndex(ev => ev.t > this._jd);
        if (this._eventIndex < 0)
            this._eventIndex = this._events.length;
    }

    // ---- Layout ----

    relayout(monitor, workArea) {
        const s = this._settings;
        const W = monitor.width, H = monitor.height;
        this._W = W;
        this._H = H;
        this.actor.set_position(monitor.x, monitor.y);
        this.actor.set_size(W, H);
        this._backdrop.set_size(W, H);
        this._content.opacity = this._opacity();

        // Work area relative to the monitor: keep clear of the top bar and docks.
        const top = workArea.y - monitor.y, bottom = top + workArea.height;
        this._area = {left: workArea.x - monitor.x, right: workArea.x - monitor.x + workArea.width, top, bottom};
        const tilt = s.get_double('tilt');
        const zoom = s.get_double('zoom') / 100;
        const availH = bottom - top;
        const fitPx = Math.min(W * 0.46, availH * 0.46 / Math.max(0.2, Math.cos(tilt * Math.PI / 180))) * zoom;
        this._proj = new A.Projection({
            cx: W / 2, cy: top + availH / 2, fitPx,
            mode: s.get_string('distance-scale'), tilt, azimuth: s.get_double('azimuth'),
        });
        this._unit = W / 220 * s.get_double('planet-scale') / 100;

        this._buildBodies();
        this._buildCraft();
        this._layoutHud();
        this._backdrop.queue_repaint();
        this._updateAll(0);
        if (this._factCard && this._factSubject)
            this._showHighlight(this._factSubject, this._factColor);
    }

    _bodyRadius(id) {
        if (id === 'sun')
            return this._unit * 3.1;
        return Math.max(2.2, this._unit * (BODY[id].radiusKm / 6371) ** 0.45);
    }

    _buildBodies() {
        for (const b of this._bodies ?? []) {
            b.actor.destroy();
            b.label?.destroy();
        }
        this._comet?.sprite.destroy();

        const showPluto = this._settings.get_boolean('show-pluto');
        const showLabels = this._settings.get_boolean('show-labels');
        this._bodies = [];

        const sunR = this._bodyRadius('sun');
        const sunSize = Math.ceil(sunR * 7);
        const sunSprite = new Sprite(this._world, sunSize, cr => R.drawSun(cr, sunSize, sunR));
        sunSprite.repaint();
        this._sun = {id: 'sun', R: sunR, size: sunSize, actor: sunSprite.area, pos: [0, 0, 0]};
        this._bodies.push(this._sun);

        for (const body of PLANETS) {
            if (body.id === 'pluto' && !showPluto)
                continue;
            const r = this._bodyRadius(body.id);
            const size = 2 * R.spriteExtent(body.id, r);
            const pole = A.unit(this._proj.view(A.equatorialToEcliptic(...body.pole)));
            const b = {id: body.id, R: r, size, pole, phase: 0, light: [1, 0, 0], drawn: null, shaded: null, cache: null};

            // Layers, so a spin only redraws the surface: rings behind,
            // surface, day/night shading, rings in front.
            b.actor = new Clutter.Actor();
            this._world.add_child(b.actor);
            const layer = paint => {
                const area = new St.DrawingArea({width: size, height: size});
                area.connect('repaint', a => {
                    const cr = a.get_context();
                    paint(cr, a);
                    cr.$dispose();
                });
                b.actor.add_child(area);
                return area;
            };
            if (R.RINGS[body.id])
                layer(cr => R.drawRings(cr, size, body.id, r, pole, -1));
            b.surface = layer((cr, area) => {
                const scale = area.get_resource_scale();
                if (b.cache?.scale !== scale)
                    b.cache = R.bandCache(body.id, size, r, pole, scale);
                R.drawSurface(cr, size, body.id, r, {pole, phase: b.phase, cache: b.cache});
            });
            b.shade = layer(cr => R.drawShade(cr, size, r, b.light, body.atmosphere));
            if (R.RINGS[body.id])
                layer(cr => R.drawRings(cr, size, body.id, r, pole, +1));
            if (showLabels) {
                b.label = label('orrery-planet-label', body.name.toUpperCase());
                this._labels.add_child(b.label);
            }
            this._bodies.push(b);
        }

        const cometSize = Math.ceil(this._unit * 12);
        this._comet = {tail: [0, 0], drawn: null};
        this._comet.sprite = new Sprite(this._world, cometSize, cr =>
            R.drawComet(cr, cometSize, this._comet.tail[0], this._comet.tail[1]));
        this._comet.sprite.area.hide();
    }

    _buildCraft() {
        for (const tr of this._trajectories) {
            tr.marker?.destroy();
            tr.label?.destroy();
            tr.edge?.destroy();
            tr.marker = tr.label = tr.edge = null;
        }
        const show = this._settings.get_boolean('show-missions');
        const size = Math.ceil(this._unit * 2.2) | 1;
        for (const tr of this._trajectories) {
            tr.projected = tr.cache.map(({t, p}) => {
                const [x, y] = this._proj.project(p);
                return [x, y, t];
            });
            if (!show)
                continue;
            tr.marker = new Sprite(this._craftLayer, size, cr => R.drawCraft(cr, size, tr.rgb));
            tr.marker.repaint();
            tr.label = label('orrery-craft-label', tr.mission.short ?? tr.mission.name);
            tr.label.set_style(`color: ${tr.mission.color};`);
            tr.edge = label('orrery-edge');
            tr.edge.set_style(`color: ${tr.mission.color};`);
            this._labels.add_child(tr.label);
            this._labels.add_child(tr.edge);
        }
    }

    // ---- HUD ----

    _buildHud() {
        this._dateBox = new St.BoxLayout({style_class: 'orrery-datebox', vertical: true});
        this._dateLabel = label('orrery-date');
        this._caption = label('orrery-caption');
        this._dateBox.add_child(this._dateLabel);
        this._dateBox.add_child(this._caption);
        this._missionBox = new St.BoxLayout({style_class: 'orrery-missions', vertical: true});
        this._hud.add_child(this._dateBox);
        this._hud.add_child(this._missionBox);
        this._missionRows = new Map();
    }

    _layoutHud() {
        const show = this._settings.get_boolean('show-hud');
        this._dateBox.visible = show;
        const {left, top} = this._area;
        const m = Math.round(this._W * 0.018);
        this._margin = m;
        this._dateBox.set_position(left + m, top + Math.round(m * 0.6));
        this._cardWidth = Math.round(Math.min(380, Math.max(260, this._W * 0.19)));
        this._missionBox.visible = show && this._settings.get_boolean('show-missions');
        this._updateHud();
    }

    _updateHud() {
        const s = this._settings;
        const live = s.get_string('mode') === 'live';
        this._dateLabel.text = A.formatDate(this._jd);
        const today = this._jd >= A.jdNow() - 0.5;
        this._caption.text = live ? 'Live · the solar system right now'
            : today ? 'Today · the replay starts over shortly'
                : `Replaying the space age · ${+s.get_double('days-per-second').toFixed(1)} days per second`;

        if (!this._missionBox.visible)
            return;
        const active = [];
        for (const tr of this._trajectories) {
            const status = missionStatus(tr, this._jd);
            if (status)
                active.push([tr, status]);
        }
        const ids = new Set(active.map(([tr]) => tr.mission.id));
        for (const [id, row] of this._missionRows) {
            if (!ids.has(id)) {
                row.box.destroy();
                this._missionRows.delete(id);
            }
        }
        for (const [tr, status] of active) {
            let row = this._missionRows.get(tr.mission.id);
            if (!row) {
                row = {box: new St.BoxLayout({style_class: 'orrery-mission-row'})};
                const dot = new St.Widget({style_class: 'orrery-mission-dot', y_align: Clutter.ActorAlign.CENTER});
                dot.set_style(`background-color: ${tr.mission.color};`);
                const name = label('orrery-mission-name', tr.mission.short ?? tr.mission.name);
                name.y_align = Clutter.ActorAlign.CENTER;
                name.set_style(`color: ${tr.mission.color};`);
                row.status = label('orrery-mission-status');
                row.status.y_align = Clutter.ActorAlign.CENTER;
                row.box.add_child(dot);
                row.box.add_child(name);
                row.box.add_child(row.status);
                this._missionBox.add_child(row.box);
                this._missionRows.set(tr.mission.id, row);
            }
            row.status.text = status;
        }
        const h = this._missionBox.get_preferred_height(-1)[1];
        this._missionBox.set_position(this._area.left + this._margin, this._area.bottom - this._margin - h);
    }

    // ---- Backdrop ----

    _paintBackdrop(area) {
        const cr = area.get_context();
        const s = this._settings;
        if (s.get_boolean('show-stars'))
            R.drawStars(cr, this._W, this._H);
        if (s.get_boolean('show-belts')) {
            const rnd = R.seeded(4);
            const belt = (n, a0, a1, alpha) => {
                const pts = [];
                for (let i = 0; i < n; i++) {
                    const a = a0 + (a1 - a0) * rnd() ** 0.8, th = rnd() * 2 * Math.PI;
                    pts.push([...this._proj.project([a * Math.cos(th), a * Math.sin(th), (rnd() - 0.5) * 0.12 * a]).slice(0, 2), 0.4 + rnd() * 0.6]);
                }
                R.drawDots(cr, pts, alpha, 0.5);
            };
            belt(1600, 2.15, 3.3, 0.32);
            belt(900, 30, 48, 0.16);
        }
        if (s.get_boolean('show-orbits')) {
            for (const b of this._bodies.slice(1)) {
                const pts = this._orbitPath(b.id);
                R.strokePath(cr, pts, R.hexToRgb(BODY[b.id].color), b.id === 'pluto' ? 0.13 : 0.2, 1,
                    b.id === 'pluto' ? [3, 4] : null);
            }
        }
        cr.$dispose();
    }

    _orbitPath(id) {
        const o = A.planetOrbit(id, this._jd);
        const pts = [];
        for (let i = 0; i <= 240; i++) {
            const E = i / 240 * 2 * Math.PI;
            const x = o.a * (Math.cos(E) - o.e), y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
            pts.push(this._proj.project(A.add(A.scale(o.p, x), A.scale(o.q, y))));
        }
        return pts;
    }

    // ---- Per frame ----

    tick(dt) {
        if (!this._proj)
            return;
        this._realTime += dt;
        this._advance(dt);
        this._updateAll(dt);
    }

    _updateAll(dt) {
        this._updateBodies();
        this._updateCraft();
        this._fireEvents();
        this._updateCards(dt);

        this._trailClock += dt;
        if (dt === 0 || this._trailClock >= 1 / TRAIL_HZ) {
            this._trailClock = 0;
            this._updateTrails();
        }
        this._hudClock += dt;
        if (dt === 0 || this._hudClock >= 1 / HUD_HZ) {
            this._hudClock = 0;
            this._updateHud();
        }
        if (this._settings.get_boolean('pixel-shift')) {
            const t = this._realTime;
            const dx = Math.round(4 * Math.sin(t * 2 * Math.PI / 600));
            const dy = Math.round(3 * Math.sin(t * 2 * Math.PI / 830));
            if (dx !== this._content.translation_x || dy !== this._content.translation_y)
                this._content.set_translation(dx, dy, 0);
        } else if (this._content.translation_x || this._content.translation_y) {
            this._content.set_translation(0, 0, 0);
        }
    }

    _updateBodies() {
        const spinDay = this._settings.get_double('seconds-per-earth-day');
        const order = [];
        for (const b of this._bodies) {
            const p = b.id === 'sun' ? [0, 0, 0] : A.planetPosition(b.id, this._jd);
            b.pos = p;
            const [x, y, depth] = this._proj.project(p);
            b.x = x;
            b.y = y;
            b.actor.set_translation(x - b.size / 2, y - b.size / 2, 0);
            order.push([depth, b.actor]);
            if (b.label) {
                const w = b.label.width || b.label.get_preferred_width(-1)[1];
                b.label.set_translation(Math.round(x - w / 2), Math.round(y + b.R + 3 + (b.id === 'saturn' ? b.R * 0.5 : 0)), 0);
            }
            if (b.id === 'sun')
                continue;

            // Spin: one Earth day lasts spinDay seconds; others in proportion.
            const hours = BODY[b.id].rotationHours;
            b.phase = wrapAngle(2 * Math.PI * this._realTime / (Math.abs(hours) / 23.9345 * spinDay) * Math.sign(hours));
            b.light = A.unit(this._proj.view(A.scale(p, -1)));
            // Redraw only when something moved by most of a pixel, at most 20 times a second.
            if (b.drawn === null || (Math.abs(wrapAngle(b.phase - b.drawn.phase)) * b.R > 0.8 &&
                this._realTime - b.drawn.at > 0.05)) {
                b.drawn = {phase: b.phase, at: this._realTime};
                b.surface.queue_repaint();
            }
            if (!b.shaded || b.R * Math.sqrt(Math.max(0, 2 * (1 - A.dot(b.light, b.shaded)))) > 0.6) {
                b.shaded = b.light;
                b.shade.queue_repaint();
            }
        }

        // The comet Rosetta chased, while Rosetta is around.
        const rosetta = this._trajectories.find(tr => tr.mission.id === 'rosetta');
        const cometOn = rosetta && this._settings.get_boolean('show-missions') &&
            this._jd > rosetta.launch && this._jd < rosetta.end + 365;
        this._comet.sprite.area.visible = !!cometOn;
        if (cometOn) {
            const p = A.bodyPosition('67p', this._jd);
            const [x, y, depth] = this._proj.project(p);
            const [sx, sy] = [this._proj.cx, this._proj.cy];
            const r = A.norm(p);
            const angle = Math.atan2(y - sy, x - sx);
            const len = r < 4 ? this._unit * 5 * (4 - r) / 3 : 0;
            this._comet.sprite.moveTo(x, y);
            this._comet.pos = p;
            this._comet.x = x;
            this._comet.y = y;
            order.push([depth, this._comet.sprite.area]);
            const d = this._comet.drawn;
            if (!d || Math.abs(wrapAngle(angle - d[0])) > 0.03 || Math.abs(len - d[1]) > 0.5) {
                this._comet.tail = [angle, len];
                this._comet.drawn = [angle, len];
                this._comet.sprite.repaint();
            }
        }

        // Painter's order: farther from the camera first.
        order.sort((a, b) => a[0] - b[0]);
        const actors = order.map(([, a]) => a);
        if (actors.some((a, i) => a !== this._stacking?.[i])) {
            actors.forEach((a, i) => this._world.set_child_above_sibling(a, i ? actors[i - 1] : null));
            this._stacking = actors;
        }
    }

    _bodyById(id) {
        if (id === '67p')
            return this._comet;
        return this._bodies.find(b => b.id === id);
    }

    _updateCraft() {
        const show = this._settings.get_boolean('show-missions');
        const showLabels = this._settings.get_boolean('show-labels');
        const {left, right, top, bottom} = this._area;
        const inset = 10;
        for (const tr of this._trajectories) {
            if (!tr.marker)
                continue;
            const seg = show ? tr.segmentAt(this._jd) : null;
            tr.now = null;
            if (!seg) {
                tr.marker.area.hide();
                tr.label.hide();
                tr.edge.hide();
                continue;
            }
            let x, y;
            if (seg.kind === 'stay') {
                // Circle the body it orbits.
                const b = this._bodyById(seg.body);
                const ang = this._realTime * 2 * Math.PI / 6 + tr.mission.id.length;
                const rr = (b?.R ?? 2) + 5;
                [x, y] = [(b?.x ?? 0) + rr * Math.cos(ang), (b?.y ?? 0) + rr * Math.sin(ang) * 0.55];
            } else {
                [x, y] = this._proj.project(seg.pos(this._jd));
            }
            tr.now = [x, y];
            const onScreen = x > left + inset && x < right - inset && y > top + inset && y < bottom - inset;
            tr.marker.area.visible = onScreen;
            tr.marker.moveTo(x, y);
            tr.label.visible = onScreen && showLabels;
            if (tr.label.visible) {
                // Far craft can project near the Sun when they climb out of
                // the ecliptic toward or away from the camera; say how far.
                const r = seg.kind === 'stay' ? 0 : A.norm(seg.pos(this._jd));
                const name = tr.mission.short ?? tr.mission.name;
                const text = r > 40 ? `${name} · ${r.toFixed(0)} AU` : name;
                if (tr.label.text !== text)
                    tr.label.text = text;
                tr.label.set_translation(Math.round(x + 7), Math.round(y - 7), 0);
            }

            tr.edge.visible = !onScreen;
            if (!onScreen) {
                const r = A.norm(seg.pos(this._jd));
                const [cx, cy] = [this._proj.cx, this._proj.cy];
                const ang = Math.atan2(y - cy, x - cx);
                const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
                tr.edge.text = `${tr.mission.short ?? tr.mission.name} ${arrow} ${r.toFixed(0)} AU`;
                const w = tr.edge.width || tr.edge.get_preferred_width(-1)[1];
                const h = tr.edge.height || tr.edge.get_preferred_height(-1)[1];
                // Where the ray from the Sun leaves the work area.
                const sx = Math.cos(ang), sy = Math.sin(ang);
                const tx = sx > 0 ? (right - inset - cx) / sx : sx < 0 ? (left + inset - cx) / sx : Infinity;
                const ty = sy > 0 ? (bottom - inset - cy) / sy : sy < 0 ? (top + inset - cy) / sy : Infinity;
                const k = Math.min(tx, ty);
                const ex = Math.max(left + inset, Math.min(right - inset - w, cx + sx * k - (sx > 0 ? w : 0)));
                const ey = Math.max(top + inset, Math.min(bottom - inset - h, cy + sy * k - (sy > 0 ? h : 0)));
                tr.edge.set_translation(Math.round(ex), Math.round(ey), 0);
            }
        }
    }

    _updateTrails() {
        if (!this._settings.get_boolean('show-trails') || !this._settings.get_boolean('show-missions')) {
            this._trails.hide();
            return;
        }
        const window = this._settings.get_double('trail-years') * 365.25;
        const jd = this._jd;
        const draws = [];
        const all = [];
        for (const tr of this._trajectories) {
            if (jd < tr.launch || jd - Math.min(jd, tr.end) > window)
                continue;
            const pts = [];
            for (const [x, y, t] of tr.projected) {
                if (t > jd)
                    break;
                const age = jd - t;
                if (age > window)
                    continue;
                pts.push([x, y, 0.85 * (1 - age / window) ** 1.4]);
            }
            const seg = tr.segmentAt(jd);
            if (tr.now && seg && seg.kind !== 'stay')
                pts.push([...tr.now, 0.85]);
            // The rest of the current leg, faint and dashed.
            const ahead = [];
            if (seg?.kind === 'fly' && isFinite(seg.t1)) {
                if (tr.now)
                    ahead.push(tr.now);
                for (const [x, y, t] of tr.projected) {
                    if (t > jd && t <= seg.t1)
                        ahead.push([x, y]);
                }
            }
            if (pts.length < 2 && ahead.length < 2)
                continue;
            draws.push({pts, ahead, rgb: tr.rgb});
            for (const p of pts) {
                if (p[2] > 0.01)
                    all.push(p);
            }
            all.push(...ahead);
        }
        if (!draws.length) {
            this._trails.hide();
            return;
        }
        const width = Math.max(1, this._unit * 0.17);
        this._trails.update(all, [this._W, this._H], cr => {
            for (const {pts, ahead, rgb} of draws) {
                R.strokePath(cr, ahead, rgb, 0.16, 1, [2, 4]);
                R.strokeTrail(cr, pts, rgb, width);
            }
        });
    }

    // ---- Events and fact cards ----

    _fireEvents() {
        if (!this._events || this._settings.get_string('mode') === 'live')
            return;
        while (this._eventIndex < this._events.length && this._events[this._eventIndex].t <= this._jd) {
            const ev = this._events[this._eventIndex++];
            if (!this._settings.get_boolean('show-missions') || !this._settings.get_boolean('show-facts'))
                continue;
            // Skip events left far behind (e.g. after the replay speed was raised).
            if (this._jd - ev.t > 120)
                continue;
            this._queueEvent(ev);
        }
    }

    _queueEvent(ev) {
        const tr = this._trajectories.find(t => t.mission === ev.mission);
        const card = new Card(this._hud, eventCard(ev), ev.mission.color, this._cardWidth);
        this._eventCards.unshift({card, ev, tr, age: 0});
        while (this._eventCards.length > 3)
            this._eventCards.pop().card.dismiss();
        this._stackEventCards();
        if (ev.kind === 'flyby' || ev.kind === 'arrive')
            this._pulse(tr);
    }

    _stackEventCards() {
        let y = this._area.bottom - this._margin;
        const x = this._area.right - this._margin - this._cardWidth;
        for (const c of this._eventCards) {
            y -= c.card.height;
            c.card.place(x, y);
            y -= 10;
        }
    }

    // A brief ring that swells around a craft at a gravity assist.
    _pulse(tr) {
        if (!tr?.marker)
            return;
        const ring = new St.Widget({style_class: 'orrery-pulse', opacity: 230});
        ring.set_style(`border-color: ${tr.mission.color};`);
        const size = Math.ceil(this._unit * 6);
        ring.set_size(size, size);
        ring.set_pivot_point(0.5, 0.5);
        const [x, y] = tr.now ?? [0, 0];
        ring.set_translation(x - size / 2, y - size / 2, 0);
        ring.scale_x = ring.scale_y = 0.3;
        this._craftLayer.add_child(ring);
        ring.ease({scale_x: 2.2, scale_y: 2.2, opacity: 0, duration: 1600, mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete: () => ring.destroy()});
    }

    _updateCards(dt) {
        const showFacts = this._settings.get_boolean('show-facts');
        // Event cards follow their craft and expire.
        for (const c of [...this._eventCards]) {
            c.age += dt;
            if (c.age > EVENT_CARD_SECONDS || !showFacts) {
                c.card.dismiss();
                this._eventCards.splice(this._eventCards.indexOf(c), 1);
                this._stackEventCards();
                continue;
            }
            const target = c.tr?.now;
            c.card.leader.visible = !!target;
            c.card.ring.visible = !!target;
            if (target)
                c.card.aim(target[0], target[1], 6);
        }

        if (!showFacts) {
            this._factCard?.dismiss();
            this._factCard = null;
            this._hideHighlight();
            return;
        }
        this._factClock += dt;
        if (!this._factCard || this._factClock > this._settings.get_double('fact-interval')) {
            this._factClock = 0;
            this._nextFact();
        }
        const f = this._factCard;
        if (f) {
            const target = this._factTarget();
            f.leader.visible = !!target;
            f.ring.visible = !!target;
            if (target)
                f.aim(target[0], target[1], target[2]);
        }
    }

    _factTarget() {
        const subject = this._factSubject;
        if (!subject)
            return null;
        if (subject.tr) {
            const n = subject.tr.now;
            return n && subject.tr.marker?.area.visible ? [n[0], n[1], 6] : null;
        }
        const b = this._bodyById(subject.id);
        return b ? [b.x, b.y, b.R + 4] : null;
    }

    _nextFact() {
        this._factCard?.dismiss();
        this._factCard = null;
        const jd = this._jd;
        this._factCount++;

        // Every third card spotlights a spacecraft that is out there now.
        let subject = null, content = null, color = '#ffffff';
        if (this._factCount % 3 === 0 && this._settings.get_boolean('show-missions')) {
            const flying = this._trajectories.filter(tr => tr.segmentAt(jd) && tr.marker);
            const tr = flying[Math.floor(Math.random() * flying.length)];
            if (tr) {
                const last = [...tr.events].reverse().find(ev => ev.t <= jd && ev.note);
                const status = missionStatus(tr, jd);
                subject = {tr};
                color = tr.mission.color;
                content = {
                    title: tr.mission.name,
                    subtitle: `${tr.mission.agency} · launched ${A.formatDate(tr.launch)}`,
                    lines: [status, last ? `${A.formatMonth(last.t)}: ${last.note}` : null],
                };
            }
        }
        if (!content) {
            const ids = this._bodies.map(b => b.id);
            this._factOrder = this._factOrder?.length ? this._factOrder
                : ids.map(id => [Math.random(), id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
            const id = this._factOrder.pop();
            subject = {id};
            color = BODY[id].color;
            content = this._facts.card(id, jd);
        }
        this._factSubject = subject;
        this._factColor = color;
        const card = new Card(this._hud, content, color, this._cardWidth);
        card.place(this._area.right - this._margin - this._cardWidth, this._area.top + this._margin);
        this._factCard = card;
        this._showHighlight(subject, color);
    }

    _showHighlight(subject, color) {
        const rgb = R.hexToRgb(color);
        if (subject.tr) {
            const pts = subject.tr.projected.filter(([, , t]) => t <= this._jd);
            this._highlight.update(pts, [this._W, this._H], cr => R.strokePath(cr, pts, rgb, 0.3, 1.2));
        } else if (subject.id !== 'sun' && this._settings.get_boolean('show-orbits')) {
            const pts = this._orbitPath(subject.id);
            this._highlight.update(pts, [this._W, this._H], cr => R.strokePath(cr, pts, rgb, 0.5, 1.4));
        } else {
            this._hideHighlight();
        }
    }

    _hideHighlight() {
        this._highlight.hide();
    }

    onSettingChanged(key) {
        if (key === 'disabled-missions') {
            for (const tr of this._trajectories) {
                tr.marker?.destroy();
                tr.label?.destroy();
                tr.edge?.destroy();
            }
            this._buildTrajectories();
            this._buildCraft();
            this._updateAll(0);
        } else if (key === 'mode' || key === 'replay-start-year') {
            this._settings.set_double('replay-jd', 0);
            this._resetTime();
            this._backdrop.queue_repaint();
            this._updateAll(0);
        } else if (key === 'replay-jd') {
            // Set to 0 by the preferences' Restart button.
            if (this._settings.get_double('replay-jd') === 0 && this._settings.get_string('mode') === 'replay') {
                this._resetTime();
                this._updateAll(0);
            }
        } else if (key === 'brightness') {
            this._content.opacity = this._opacity();
        } else if (key === 'trail-years' || key === 'show-trails') {
            this._updateTrails();
        }
    }
}

export default class OrreryExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._scene = new OrreryScene(this._settings);

        // Inside the background group: above the wallpaper, below every window.
        const bgGroup = Main.layoutManager._backgroundGroup;
        bgGroup.add_child(this._scene.actor);
        bgGroup.set_child_above_sibling(this._scene.actor, null);

        const relayout = () => this._relayout();
        Main.layoutManager.connectObject('monitors-changed', relayout, this);
        global.display.connectObject('workareas-changed', relayout, this);
        this._settings.connectObject('changed', (_s, key) => {
            if (RELAYOUT_KEYS.includes(key))
                this._queueRelayout();
            else if (key === 'fps' || key === 'pause-when-covered')
                this._schedule();
            else
                this._scene.onSettingChanged(key);
        }, this);

        this._relayout();
        this._lastTick = GLib.get_monotonic_time();
        this._coveredClock = 0;
        this._paused = false;
        this._schedule();
    }

    disable() {
        if (this._timer)
            GLib.source_remove(this._timer);
        for (const id of [this._relayoutId, this._raiseId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._timer = this._relayoutId = this._raiseId = 0;

        if (this._scene && this._settings.get_string('mode') === 'replay')
            this._settings.set_double('replay-jd', this._scene.jd);
        Main.layoutManager.disconnectObject(this);
        global.display.disconnectObject(this);
        this._settings.disconnectObject(this);
        this._scene?.destroy();
        this._scene = null;
        this._settings = null;
    }

    _relayout() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor || !this._scene)
            return;
        this._raise();
        const workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        this._scene.relayout(monitor, workArea);
    }

    // Other desktop extensions (e.g. Depth Clock) also raise themselves in the
    // background group when they start or monitors change; raise once they are
    // done so the solar system stays on top.
    _raise() {
        if (this._raiseId)
            return;
        this._raiseId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this._raiseId = 0;
            if (this._scene)
                Main.layoutManager._backgroundGroup.set_child_above_sibling(this._scene.actor, null);
            return GLib.SOURCE_REMOVE;
        });
    }

    // Slider drags fire many changes; rebuild once they settle.
    _queueRelayout() {
        if (this._relayoutId)
            GLib.source_remove(this._relayoutId);
        this._relayoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            this._relayoutId = 0;
            this._relayout();
            return GLib.SOURCE_REMOVE;
        });
    }

    _schedule() {
        if (this._timer)
            GLib.source_remove(this._timer);
        const interval = this._paused ? 1000 : Math.round(1000 / this._settings.get_int('fps'));
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => this._tick());
    }

    _tick() {
        const now = GLib.get_monotonic_time();
        const dt = Math.min(0.25, (now - this._lastTick) / 1e6);
        this._lastTick = now;

        // Check about once a second whether anyone can see the desktop.
        this._coveredClock += dt;
        if (this._paused || this._coveredClock >= 1) {
            this._coveredClock = 0;
            const paused = this._settings.get_boolean('pause-when-covered') && this._isCovered();
            if (paused !== this._paused) {
                this._paused = paused;
                this._timer = 0;   // this source ends by returning REMOVE
                this._schedule();
                return GLib.SOURCE_REMOVE;
            }
        }
        if (!this._paused)
            this._scene.tick(dt);
        return GLib.SOURCE_CONTINUE;
    }

    _isCovered() {
        if (Main.overview.visible || Main.sessionMode.isLocked || Main.screenShield?.locked)
            return true;
        const monitor = Main.layoutManager.primaryIndex;
        const workspace = global.workspace_manager.get_active_workspace();
        for (const w of workspace.list_windows()) {
            if (w.minimized || w.get_monitor() !== monitor || !w.showing_on_its_workspace())
                continue;
            if (w.is_fullscreen())
                return true;
            const maximized = typeof w.is_maximized === 'function'
                ? w.is_maximized()
                : w.get_maximized() === Meta.MaximizeFlags.BOTH;
            if (maximized)
                return true;
        }
        return false;
    }
}

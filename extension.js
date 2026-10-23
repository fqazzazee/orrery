import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as A from './lib/astro.js';
import {BODY, PLANETS} from './lib/bodies.js';
import {FactDeck, bodyDetails, eventCard, eventTitle, missionDetails, missionStatus} from './lib/facts.js';
import {MISSIONS, buildTrajectories} from './lib/missions.js';
import {PowerMonitor} from './lib/power.js';
import * as R from './lib/render.js';
import {Card, Timeline, label} from './lib/ui.js';

const RELAYOUT_KEYS = ['distance-scale', 'tilt', 'azimuth', 'zoom', 'planet-scale', 'show-orbits',
    'show-stars', 'show-belts', 'show-pluto', 'show-labels', 'show-hud', 'show-missions', 'show-facts',
    'interactive', 'timeline'];
const SCHEDULE_KEYS = ['fps', 'pause-when-covered', 'pause-coverage', 'battery-saver', 'battery-fps',
    'idle-dim-minutes', 'adaptive-fps'];
const HOLD_SECONDS = 20;          // pause on "today" before the replay starts over
const EVENT_CARD_SECONDS = 8;
const TRAIL_HZ = 4;
const HUD_HZ = 2;
const CONTROLS_SECONDS = 4;       // the timeline fades this long after the pointer stops
const BROWSE_SECONDS = 120;       // live mode returns to today after this long untouched
const FUTURE_DAYS = 2 * 365.25;   // how far past today the timeline reaches
const SPEEDS = [0.5, 1, 2, 4, 8, 12, 20, 30, 60, 120, 240, 400];
const SUN_LEVELS = [10000, 3000, 1361, 300, 100, 30, 10, 3, 1];
const IDLE_FPS = 10;
const STILL_FPS = 5;

const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// Distance from (x, y) to a polyline of [x, y, ...] points.
function polylineDistance(pts, x, y) {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const dx = x1 - x0, dy = y1 - y0;
        const len2 = dx * dx + dy * dy;
        const k = len2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2)) : 0;
        best = Math.min(best, Math.hypot(x - x0 - k * dx, y - y0 - k * dy));
    }
    return best;
}

const sameSubject = (a, b) => !!a && !!b && (a.tr ? a.tr === b.tr : a.id === b.id);

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
        // Hidden until it has something to draw: a visible 0x0 area upsets
        // the stage's picking.
        this.area = new St.DrawingArea({visible: false});
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
        this._playing = true;
        this._browsing = false;       // live mode, looking at another date
        this._browseClock = 0;
        this._lastActivity = -Infinity;
        this._selected = null;        // {id} or {tr}, chosen by a click
        this._hover = null;
        this._pin = null;             // the card for the selection
        this._dim = 1;
        this.powerSaving = false;
        this.onActivity = null;

        this.actor = new St.Widget({style_class: 'orrery', reactive: false, clip_to_allocation: true});
        this._content = new Clutter.Actor();
        this.actor.add_child(this._content);
        this._backdrop = new St.DrawingArea();
        this._backdrop.connect('repaint', area => this._paintBackdrop(area));
        this._content.add_child(this._backdrop);
        this._sunLayer = new Clutter.Actor();
        this._content.add_child(this._sunLayer);
        this._hoverPath = new BoxCanvas(this._content);
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
        this._connectInput();
    }

    destroy() {
        this._factCard?.destroy();
        this._pin?.destroy();
        for (const c of this._eventCards)
            c.card.destroy();
        this._timeline.destroy();
        this.actor.destroy();
    }

    get jd() {
        return this._jd;
    }

    // ---- Time ----

    _live() {
        return this._settings.get_string('mode') === 'live';
    }

    _startJd() {
        return A.jd(`${this._settings.get_int('replay-start-year')}-01-01`);
    }

    _endJd() {
        return A.jdNow() + FUTURE_DAYS;
    }

    _resetTime() {
        const s = this._settings;
        if (this._live()) {
            this._jd = A.jdNow();
        } else {
            const saved = s.get_double('replay-jd');
            this._jd = saved > this._startJd() && saved < A.jdNow() ? saved : this._startJd();
        }
        this._browsing = false;
        this._hold = 0;
        this._seekEvents();
    }

    _advance(dt) {
        const s = this._settings;
        const now = A.jdNow();
        if (this._live() && !this._browsing) {
            this._jd = now;
            return;
        }
        if (this._live() && (this._browseClock += dt) > BROWSE_SECONDS) {
            this._goNow();
            return;
        }
        if (!this._playing || this._timeline.dragging)
            return;
        // Play up to today, or to the end of the timeline if someone moved
        // past today on purpose.
        const end = this._jd > now + 1 ? this._endJd() : now;
        if (this._jd < end) {
            this._jd = Math.min(end, this._jd + dt * s.get_double('days-per-second'));
            if (this._live() && this._jd >= now)
                this._browsing = false;
            return;
        }
        if (this._live()) {
            this._browsing = false;
            return;
        }
        // Hold on today for a moment, then fade out and start over.
        this._hold += dt;
        if (this._hold > HOLD_SECONDS && !this._restarting)
            this._restart();
    }

    _restart() {
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

    // Is the date on screen moving fast enough to see?
    _timeRuns() {
        if (this._live() && !this._browsing)
            return false;
        return this._playing && !this._timeline.dragging && this._jd < (this._jd > A.jdNow() + 1 ? this._endJd() : A.jdNow());
    }

    _spinning() {
        return this._settings.get_boolean('spin-planets') && !this.powerSaving;
    }

    // Nothing moves: the extension can drop to a few frames per second.
    get still() {
        return !this._timeRuns() && !this._spinning() && !this._restarting &&
            this._realTime - this._lastActivity > 3 && !this._eventCards.length;
    }

    get interacting() {
        return this._realTime - this._lastActivity < CONTROLS_SECONDS || this._timeline.dragging;
    }

    // Jump the clock; `done` is false while the playhead is being dragged.
    _seek(t, done = true, ev = null) {
        const lead = Math.min(60, 3 * this._settings.get_double('days-per-second'));
        if (ev) {
            // Land a little before the event so it plays out, and follow
            // the mission it belongs to.
            t = ev.t - lead;
            const tr = this._trajectories.find(x => x.mission === ev.mission);
            if (tr)
                this._select({tr}, {expand: this._pin?.expanded});
            this._playing = true;
        }
        t = Math.max(this._startJd(), Math.min(this._endJd(), t));
        if (this._live())
            this._browsing = Math.abs(t - A.jdNow()) > 0.5;
        this._browseClock = 0;
        this._jd = t;
        this._hold = 0;
        this._seekEvents();
        if (done) {
            for (const c of this._eventCards)
                c.card.dismiss();
            this._eventCards = [];
        }
        this._updateAll(0);
    }

    _goNow() {
        this._browsing = false;
        this._browseClock = 0;
        this._playing = true;
        this._seek(A.jdNow());
    }

    _togglePlay() {
        if (this._live() && !this._browsing) {
            // Pausing live time means looking at this moment for a while.
            this._browsing = true;
            this._playing = false;
        } else {
            this._playing = !this._playing;
            if (this._playing && !this._live() && this._jd >= A.jdNow() - 0.5 && this._jd <= A.jdNow() + 1)
                this._seek(this._startJd());
        }
        this._browseClock = 0;
        this._syncTimelineState();
        this._updateHud();
    }

    _changeSpeed(dir) {
        const dps = this._settings.get_double('days-per-second');
        let i = SPEEDS.findIndex(v => v >= dps - 1e-6);
        if (i < 0)
            i = SPEEDS.length - 1;
        else if (dir < 0 && SPEEDS[i] > dps + 1e-6)
            i--;
        const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + dir))];
        this._settings.set_double('days-per-second', next);
    }

    _opacity() {
        return Math.round(255 * this._settings.get_double('brightness') / 100 * this._dim);
    }

    // Dim the whole scene (idle) or bring it back (dim = 1).
    setDim(dim) {
        if (dim === this._dim)
            return;
        this._dim = dim;
        if (this._restarting)
            return;
        this._content.remove_transition('opacity');
        this._content.ease({opacity: this._opacity(), duration: dim < 1 ? 3000 : 400, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
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
        this.actor.reactive = s.get_boolean('interactive');
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
        this._orbitCache = new Map();

        this._buildBodies();
        this._buildCraft();
        this._layoutHud();
        this._layoutSunlight();
        this._backdrop.queue_repaint();
        this._setHover(null);

        // Cards are sized to the screen: rebuild the pinned one, move the rest.
        const selected = this._selected, expanded = this._pin?.expanded;
        this._pin?.destroy();
        this._pin = this._selected = null;
        if (selected && (!selected.tr || this._trajectories.includes(selected.tr)))
            this._select(selected, {expand: expanded});
        this._factCard?.place(this._area.right - this._margin - this._cardWidth, this._area.top + this._margin);
        this._stackEventCards();
        this._updateAll(0);
        this._showHighlight();
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
        this._dateBox = new St.BoxLayout({style_class: 'orrery-datebox', orientation: Clutter.Orientation.VERTICAL});
        this._dateLabel = label('orrery-date');
        this._caption = label('orrery-caption');
        this._dateBox.add_child(this._dateLabel);
        this._dateBox.add_child(this._caption);
        this._missionBox = new St.BoxLayout({style_class: 'orrery-missions', orientation: Clutter.Orientation.VERTICAL});
        this._hud.add_child(this._dateBox);
        this._hud.add_child(this._missionBox);
        this._missionRows = new Map();

        // Sunlight legend, under the date.
        this._legend = new St.BoxLayout({style_class: 'orrery-legend', orientation: Clutter.Orientation.VERTICAL, visible: false});
        this._legend.add_child(label('orrery-legend-title', 'Sunlight, W/m²'));
        const marks = [1, 10, 100, 1000, 10000];
        this._legendBar = new St.DrawingArea({width: 200, height: 9});
        this._legendBar.connect('repaint', area => {
            const cr = area.get_context();
            R.drawSunlightLegend(cr, ...area.get_surface_size(), marks);
            cr.$dispose();
        });
        this._legend.add_child(this._legendBar);
        const ticks = new Clutter.Actor({height: 12, width: 200});
        for (const [i, text] of ['1', '10', '100', '1k', '10k'].entries()) {
            const l = label('orrery-legend-tick', text);
            l.set_position(Math.round(200 * Math.log10(marks[i]) / Math.log10(30000)) - (i ? 6 : 0), 0);
            ticks.add_child(l);
        }
        this._legend.add_child(ticks);
        this._hud.add_child(this._legend);

        this._timeline = new Timeline(this._hud, {
            seek: (t, done, ev) => this._seek(t, done, ev),
            toggle: () => this._togglePlay(),
            restart: () => {
                this._playing = true;
                this._seek(this._startJd());
                this._syncTimelineState();
            },
            speed: dir => this._changeSpeed(dir),
            now: () => this._goNow(),
            sunlight: () => this._settings.set_boolean('sunlight-view', !this._settings.get_boolean('sunlight-view')),
            hover: h => this._timelineHover(h),
            activity: () => this._activity(),
        });

        this._timeline.actor.connect('enter-event', () => {
            this._setHover(null);
            return Clutter.EVENT_PROPAGATE;
        });

        // One tooltip, shared by the scene and the timeline.
        this._tooltip = label('orrery-tooltip');
        this._tooltip.opacity = 0;
        this._tooltip.hide();
        this._hud.add_child(this._tooltip);
    }

    _layoutHud() {
        const s = this._settings;
        const show = s.get_boolean('show-hud');
        this._dateBox.visible = show;
        const {left, right, top, bottom} = this._area;
        const m = Math.round(this._W * 0.018);
        this._margin = m;
        this._dateBox.set_position(left + m, top + Math.round(m * 0.6));
        this._cardWidth = Math.round(Math.min(380, Math.max(260, this._W * 0.19)));
        this._missionBox.visible = show && s.get_boolean('show-missions');

        // Timeline: between the mission list and the event cards.
        const mode = s.get_boolean('interactive') ? s.get_string('timeline') : 'never';
        this._timelineMode = mode;
        const tw = Math.round(Math.max(Math.min(1100, right - left - 2 * (this._cardWidth + 2 * m)), Math.min(560, right - left - 2 * m)));
        const th = 46;
        this._timeline.actor.set_size(tw, th);
        this._timeline.actor.set_position(Math.round((left + right - tw) / 2), bottom - m - th);
        this._timelineRange();
        if (mode === 'always')
            this._timeline.show();
        else if (mode === 'never' || !this.interacting)
            this._timeline.hide();
        this._syncTimelineState();
        this._updateHud();
    }

    _timelineRange() {
        const t0 = this._startJd(), now = A.jdNow(), t1 = this._endJd();
        const y0 = A.yearOfJd(t0), y1 = A.yearOfJd(t1);
        const step = y1 - y0 > 40 ? 10 : 5;
        const years = [], labels = [];
        for (let y = y0; y <= y1; y++) {
            const t = A.jd(`${y}-01-01`);
            if (t < t0 || t > t1)
                continue;
            years.push([t, y % step === 0]);
            if (y % step === 0)
                labels.push([t, `${y}`]);
        }
        const events = this._events.filter(ev => ev.kind !== 'note' || ev.title)
            .map(ev => ({t: ev.t, kind: ev.kind, ev, rgb: R.hexToRgb(ev.mission.color)}));
        this._timeline.setRange({t0, t1, now, years, labels, events});
    }

    _syncTimelineState() {
        const dps = this._settings.get_double('days-per-second');
        this._timeline.setState({
            playing: this._live() && !this._browsing ? true : this._playing,
            speed: dps >= 1 ? `${+dps.toFixed(1)} d/s` : `${dps} d/s`,
            sunlight: this._settings.get_boolean('sunlight-view'),
            live: this._live() && !this._browsing,
        });
    }

    _updateHud() {
        const s = this._settings;
        const live = this._live();
        this._dateLabel.text = A.formatDate(this._jd);
        const now = A.jdNow();
        const today = Math.abs(this._jd - now) < 0.5;
        const dps = +s.get_double('days-per-second').toFixed(1);
        let caption;
        if (live && !this._browsing)
            caption = 'Live · the solar system right now';
        else if (live)
            caption = `Exploring${this._playing ? ` · ${dps} days per second` : ' · paused'} · back to live soon`;
        else if (!this._playing)
            caption = 'Paused · press play on the timeline to go on';
        else if (this._jd > now + 0.5)
            caption = `Ahead of today · ${dps} days per second`;
        else if (today)
            caption = 'Today · the replay starts over shortly';
        else
            caption = `Replaying the space age · ${dps} days per second`;
        if (s.get_boolean('sunlight-view'))
            caption += ' · sunlight';
        this._caption.text = caption;
        this._timeline.setTime(this._jd);
        this._syncTimelineState();

        this._updateLabels();
        this._refreshPin();

        if (this._legend.visible) {
            const h = this._dateBox.visible ? this._dateBox.get_preferred_height(-1)[1] : 0;
            this._legend.set_position(this._dateBox.x, this._dateBox.y + h + 12);
        }

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
        const interactive = s.get_boolean('interactive');
        for (const [tr, status] of active) {
            let row = this._missionRows.get(tr.mission.id);
            if (!row) {
                const inner = new St.BoxLayout({style_class: 'orrery-mission-row'});
                const dot = new St.Widget({style_class: 'orrery-mission-dot', y_align: Clutter.ActorAlign.CENTER});
                dot.set_style(`background-color: ${tr.mission.color};`);
                const name = label('orrery-mission-name', tr.mission.short ?? tr.mission.name);
                name.y_align = Clutter.ActorAlign.CENTER;
                name.set_style(`color: ${tr.mission.color};`);
                row = {status: label('orrery-mission-status')};
                row.status.y_align = Clutter.ActorAlign.CENTER;
                inner.add_child(dot);
                inner.add_child(name);
                inner.add_child(row.status);
                // Each row is a button that picks its mission.
                row.box = new St.Button({style_class: 'orrery-mission-button', child: inner, can_focus: false,
                    reactive: interactive, x_align: Clutter.ActorAlign.START});
                row.box.connect('clicked', () => this._select({tr}, {toggle: true}));
                row.box.connect('notify::hover', () => this._setHover(row.box.hover ? {tr} : null, {fromList: true}));
                this._missionBox.add_child(row.box);
                this._missionRows.set(tr.mission.id, row);
            }
            row.status.text = status;
            row.box[sameSubject(this._selected, {tr}) ? 'add_style_class_name' : 'remove_style_class_name']('orrery-mission-selected');
        }
        // Rows are padded buttons; shift left so the names line up with the date.
        const h = this._missionBox.get_preferred_height(-1)[1];
        this._missionBox.set_position(this._area.left + this._margin - 6, this._area.bottom - this._margin - h);
    }

    // Planet and craft names; in the sunlight view they also say how much
    // sunlight falls there.
    _updateLabels() {
        const sunlight = this._settings.get_boolean('sunlight-view');
        for (const b of this._bodies) {
            if (!b.label || !b.pos)
                continue;
            const name = BODY[b.id].name.toUpperCase();
            const text = sunlight ? `${name}  ${A.formatIrradiance(A.irradiance(A.norm(b.pos)))}` : name;
            if (b.label.text !== text)
                b.label.text = text;
        }
    }

    // ---- Sunlight view ----

    _layoutSunlight() {
        this._sunLayer.destroy_all_children();
        const on = this._settings.get_boolean('sunlight-view');
        this._legend.visible = on;
        if (!on)
            return;
        const {cx, cy, squash} = this._proj;
        const {left, right, top, bottom} = this._area;
        const ang = -52 * Math.PI / 180;
        let lastY = -Infinity;
        // Contour labels along a ray to the upper right, outermost (highest
        // on screen) first, so the inner ones give way when crowded.
        for (const e of [...SUN_LEVELS].reverse()) {
            const rho = this._proj.radiusPx(A.irradianceRadius(e));
            const x = cx + rho * Math.cos(ang) + 4, y = cy + rho * squash * Math.sin(ang) - 14;
            if (rho < this._sun.R * 2.2 || x < left || y < top + 40 || y - lastY < 15)
                continue;
            const text = e === A.SOLAR_CONSTANT ? `${A.formatIrradiance(e)} · Earth` : A.formatIrradiance(e);
            const l = label('orrery-sun-contour', text);
            // The contour's color, lifted toward white so the dim outer ones read.
            const [r, g, b] = R.sunlightColor(e).map(c => Math.round(255 * (0.65 * c + 0.35)));
            l.set_style(`color: rgba(${r}, ${g}, ${b}, 0.75);`);
            this._sunLayer.add_child(l);
            if (x + l.get_preferred_width(-1)[1] > right) {
                l.destroy();
                continue;
            }
            l.set_position(Math.round(x), Math.round(y));
            lastY = y;
        }
        // The habitable zone, named below the Sun.
        const [zIn, zOut] = A.HABITABLE_ZONE.map(r => this._proj.radiusPx(r));
        const zone = label('orrery-sun-zone', 'Habitable zone');
        this._sunLayer.add_child(zone);
        const zw = zone.get_preferred_width(-1)[1];
        const zy = cy + (zIn + zOut) / 2 * squash - 6;
        if (zy < bottom && zOut - zIn > 6) {
            zone.set_position(Math.round(cx - zw / 2), Math.round(zy));
        } else {
            zone.destroy();
        }
    }

    // ---- Backdrop ----

    _paintBackdrop(area) {
        const cr = area.get_context();
        const s = this._settings;
        const sunlight = s.get_boolean('sunlight-view');
        if (s.get_boolean('show-stars') && !sunlight)
            R.drawStars(cr, this._W, this._H);
        if (sunlight) {
            R.drawSunlightField(cr, {
                cx: this._proj.cx, cy: this._proj.cy, squash: this._proj.squash,
                radiusPx: r => this._proj.radiusPx(r), levels: SUN_LEVELS, zone: A.HABITABLE_ZONE,
            });
        }
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
            belt(1600, 2.15, 3.3, sunlight ? 0.2 : 0.32);
            belt(900, 30, 48, sunlight ? 0.1 : 0.16);
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

    // Projected orbit; orbits drift so slowly that a decade-old one is fine.
    _orbitPath(id) {
        const hit = this._orbitCache.get(id);
        if (hit && Math.abs(hit.jd - this._jd) < 3650)
            return hit.pts;
        const o = A.planetOrbit(id, this._jd);
        const pts = [];
        for (let i = 0; i <= 240; i++) {
            const E = i / 240 * 2 * Math.PI;
            const x = o.a * (Math.cos(E) - o.e), y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
            pts.push(this._proj.project(A.add(A.scale(o.p, x), A.scale(o.q, y))));
        }
        this._orbitCache.set(id, {jd: this._jd, pts});
        return pts;
    }

    // ---- Per frame ----

    tick(dt) {
        if (!this._proj)
            return;
        this._realTime += dt;
        this._advance(dt);
        this._updateAll(dt);
        if (this._timelineMode === 'auto' && this._timeline.shown && !this.interacting && !this._timeline.actor.hover)
            this._timeline.hide();
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
            if (this._subject()?.tr)
                this._showHighlight();
        }
        this._hudClock += dt;
        if (dt === 0 || this._hudClock >= 1 / HUD_HZ) {
            this._hudClock = 0;
            this._updateHud();
        } else {
            this._timeline.setTime(this._jd);
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
        const spinning = this._spinning();
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
            // When spinning is off, the planets keep the face they had.
            if (spinning) {
                const hours = BODY[b.id].rotationHours;
                b.phase = wrapAngle(2 * Math.PI * this._realTime / (Math.abs(hours) / 23.9345 * spinDay) * Math.sign(hours));
            }
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
        const sunlight = this._settings.get_boolean('sunlight-view');
        const {left, right, top} = this._area;
        const bottom = this._timelineMode === 'never' ? this._area.bottom : this._timeline.actor.y - 4;
        const inset = 10;
        const placed = [];   // edge labels so far, so they do not overlap
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
            const featured = sameSubject(this._selected, {tr}) || sameSubject(this._hover, {tr});
            tr.label.visible = onScreen && (showLabels || featured);
            if (tr.label.visible) {
                // Far craft can project near the Sun when they climb out of
                // the ecliptic toward or away from the camera; say how far.
                const r = A.norm(seg.pos(this._jd));
                const name = tr.mission.short ?? tr.mission.name;
                let text = r > 40 && seg.kind !== 'stay' ? `${name} · ${r.toFixed(0)} AU` : name;
                if (sunlight)
                    text += ` · ${A.formatRatio(A.irradiance(r) / A.SOLAR_CONSTANT)} sun`;
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
                let ey = Math.max(top + inset, Math.min(bottom - inset - h, cy + sy * k - (sy > 0 ? h : 0)));
                // Step inward, away from the edge, past any label already there.
                const step = (ey > cy ? -1 : 1) * (h + 2);
                while (placed.some(([x0, y0, x1, y1]) => ex < x1 && ex + w > x0 && ey < y1 && ey + h > y0))
                    ey += step;
                placed.push([ex, ey, ex + w, ey + h]);
                tr.edge.set_translation(Math.round(ex), Math.round(ey), 0);
            }
        }
    }

    _updateTrails() {
        this._trailHits = [];
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
            this._trailHits.push({tr, pts: pts.filter(p => p[2] > 0.08)});
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
        if (!this._events || (this._live() && !this._browsing))
            return;
        while (this._eventIndex < this._events.length && this._events[this._eventIndex].t <= this._jd) {
            const ev = this._events[this._eventIndex++];
            if (!this._settings.get_boolean('show-missions') || !this._settings.get_boolean('show-facts'))
                continue;
            // Skip events left far behind (e.g. after the replay speed was
            // raised) and the ones swept past while dragging the timeline.
            if (this._jd - ev.t > 120 || this._timeline.dragging)
                continue;
            this._queueEvent(ev);
        }
    }

    _queueEvent(ev) {
        const tr = this._trajectories.find(t => t.mission === ev.mission);
        const card = new Card(this._hud, eventCard(ev), ev.mission.color, this._cardWidth, {
            interactive: this._interactive(),
            onActivate: tr ? () => this._select({tr}, {expand: true}) : null,
            onResize: () => this._stackEventCards(),
        });
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
        // Event cards follow their craft and expire, unless the pointer is
        // resting on them.
        for (const c of [...this._eventCards]) {
            if (!c.card.box.hover)
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

        // A pinned card stays until closed and follows its subject.
        if (this._pin) {
            this._aim(this._pin, this._selected);
            return;
        }
        if (!showFacts) {
            this._factCard?.dismiss();
            this._factCard = null;
            this._factSubject = null;
            this._showHighlight();
            return;
        }
        if (!this._factCard?.box.hover)
            this._factClock += dt;
        if (!this._factCard || this._factClock > this._settings.get_double('fact-interval')) {
            this._factClock = 0;
            this._nextFact();
        }
        if (this._factCard)
            this._aim(this._factCard, this._factSubject);
    }

    _aim(card, subject) {
        const target = this._target(subject);
        card.leader.visible = !!target;
        card.ring.visible = !!target;
        if (target)
            card.aim(target[0], target[1], target[2]);
    }

    // Where a subject is on screen: [x, y, radius], or null if hidden.
    _target(subject) {
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
        // Clicking a fact card pins it and opens it up.
        const card = new Card(this._hud, content, color, this._cardWidth, {
            interactive: this._interactive(),
            onActivate: () => this._select(subject, {expand: true}),
        });
        card.place(this._area.right - this._margin - this._cardWidth, this._area.top + this._margin);
        this._factCard = card;
        this._showHighlight();
    }

    // ---- Selection ----

    _interactive() {
        return this._settings.get_boolean('interactive');
    }

    _subject() {
        return this._selected ?? this._factSubject;
    }

    _subjectColor(subject) {
        return subject.tr ? subject.tr.mission.color : BODY[subject.id].color;
    }

    _details(subject, maxEvents = 8) {
        const sunlightView = this._settings.get_boolean('sunlight-view');
        return subject.tr
            ? missionDetails(subject.tr, this._jd, {maxEvents})
            : bodyDetails(subject.id, this._jd, {sunlightView});
    }

    // Pin a card for a subject; toggle: a second click on it lets go.
    _select(subject, {expand = false, toggle = false} = {}) {
        if (toggle && sameSubject(subject, this._selected)) {
            this._deselect();
            return;
        }
        if (sameSubject(subject, this._selected)) {
            if (expand)
                this._pin.setExpanded(true);
            return;
        }
        const wasExpanded = this._pin?.expanded;
        this._pin?.dismiss();
        this._pin = null;
        this._factCard?.dismiss();
        this._factCard = null;
        this._factSubject = null;
        this._selected = subject;
        this._trim = null;
        this._pin = new Card(this._hud, this._details(subject), this._subjectColor(subject), this._cardWidth, {
            expanded: expand || wasExpanded,
            onClose: () => this._deselect(),
            onEvent: ev => this._seek(ev.t, true, ev),
            onResize: () => this._fitPin(),
        });
        this._pin.place(this._area.right - this._margin - this._cardWidth, this._area.top + this._margin);
        this._fitPin();
        this._aim(this._pin, subject);
        this._showHighlight();
        this._updateHud();
    }

    _deselect() {
        if (!this._selected)
            return;
        this._pin?.dismiss();
        this._pin = null;
        this._selected = null;
        // The next fact card comes along shortly.
        this._factClock = this._settings.get_double('fact-interval') - 2;
        this._showHighlight();
        this._updateHud();
    }

    // Keep an expanded card clear of the event cards: drop trivia, then
    // events, until it fits.
    _fitPin() {
        const pin = this._pin;
        if (!pin || this._fitting)
            return;
        const avail = this._area.bottom - this._area.top - 2 * this._margin - 160;
        if (!pin.expanded || pin.height <= avail)
            return;
        this._fitting = true;
        const content = this._details(this._selected);
        this._trim = {notes: content.notes?.length ?? 0, events: content.events?.length ?? 0};
        while (pin.height > avail && (this._trim.notes > 0 || this._trim.events > 3)) {
            if (this._trim.notes > 0)
                this._trim.notes--;
            else
                this._trim.events--;
            pin.update(this._trimmed(content));
        }
        this._fitting = false;
    }

    _trimmed(content) {
        if (!this._trim)
            return content;
        return {...content, notes: content.notes?.slice(0, this._trim.notes), events: content.events && this._details(this._selected, this._trim.events).events};
    }

    _refreshPin() {
        if (this._pin && this._selected)
            this._pin.update(this._trimmed(this._details(this._selected)));
    }

    // Path for the current subject: a brighter orbit, or the craft's whole
    // flight, flown part solid and the rest dashed.
    _showHighlight() {
        const subject = this._subject();
        if (!subject || !this._proj) {
            this._highlight.hide();
            return;
        }
        const rgb = R.hexToRgb(this._subjectColor(subject));
        const strong = !!this._selected;
        if (subject.tr) {
            const past = subject.tr.projected.filter(([, , t]) => t <= this._jd);
            const future = strong ? subject.tr.projected.filter(([, , t]) => t >= this._jd) : [];
            if (subject.tr.now && past.length)
                past.push(subject.tr.now);
            this._highlight.update([...past, ...future], [this._W, this._H], cr => {
                R.strokePath(cr, past, rgb, strong ? 0.5 : 0.3, strong ? 1.6 : 1.2);
                R.strokePath(cr, future, rgb, 0.22, 1, [3, 4]);
            });
        } else if (subject.id !== 'sun' && (strong || this._settings.get_boolean('show-orbits'))) {
            const pts = this._orbitPath(subject.id);
            this._highlight.update(pts, [this._W, this._H], cr => R.strokePath(cr, pts, rgb, strong ? 0.7 : 0.5, strong ? 1.8 : 1.4));
        } else {
            this._highlight.hide();
        }
    }

    // ---- Pointer ----

    _connectInput() {
        this.actor.connect('motion-event', (_a, event) => {
            const [sx, sy] = event.get_coords();
            const [, x, y] = this.actor.transform_stage_point(sx, sy);
            this._activity();
            // Over a card or the timeline, nothing in the scene is hovered.
            const onScene = global.stage.get_event_actor(event) === this.actor;
            this._setHover(onScene ? this._hitTest(x, y) : null, {x, y});
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.connect('leave-event', () => {
            this._setHover(null);
            return Clutter.EVENT_PROPAGATE;
        });
        // Clicks that land on a card or a button are theirs; let them be.
        const own = event => global.stage.get_event_actor(event) === this.actor;
        this.actor.connect('button-press-event', (_a, event) => {
            if (!own(event))
                return Clutter.EVENT_PROPAGATE;
            this._press = event.get_coords();
            if (event.get_button() === Clutter.BUTTON_SECONDARY)
                this._openBackgroundMenu(...this._press);
            return Clutter.EVENT_STOP;
        });
        this.actor.connect('button-release-event', (_a, event) => {
            if (!own(event))
                return Clutter.EVENT_PROPAGATE;
            const [sx, sy] = event.get_coords();
            if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this._press ||
                Math.hypot(sx - this._press[0], sy - this._press[1]) > 6)
                return Clutter.EVENT_STOP;
            this._press = null;
            const [, x, y] = this.actor.transform_stage_point(sx, sy);
            const hit = this._hitTest(x, y);
            if (hit)
                this._select(hit, {toggle: true});
            else
                this._deselect();
            return Clutter.EVENT_STOP;
        });
    }

    // We cover the wallpaper, so pass right clicks on to its menu.
    _openBackgroundMenu(x, y) {
        const bg = Main.layoutManager._bgManagers?.[Main.layoutManager.primaryIndex]?.backgroundActor;
        const menu = bg?._backgroundMenu;
        if (!menu)
            return;
        Main.layoutManager.setDummyCursorGeometry(x, y, 0, 0);
        menu.open(BoxPointer.PopupAnimation.FULL);
    }

    _activity() {
        this._lastActivity = this._realTime;
        this._browseClock = 0;
        if (this._timelineMode === 'auto' && !this._timeline.shown) {
            this._timeline.show();
            this._syncTimelineState();
        }
        this.onActivity?.();
    }

    // What is under the pointer: a craft, a body, an orbit or a trail.
    _hitTest(x, y) {
        if (!this._proj)
            return null;
        let best = null, bestD = Infinity;
        for (const tr of this._trajectories) {
            if (!tr.now || !tr.marker?.area.visible)
                continue;
            const d = Math.hypot(x - tr.now[0], y - tr.now[1]);
            if (d < 10 && d < bestD)
                [best, bestD] = [{tr}, d];
        }
        if (best)
            return best;
        for (const b of this._bodies) {
            const d = Math.hypot(x - b.x, y - b.y);
            const reach = Math.max(b.R + 5, 11);
            if (d < reach && d / reach < bestD)
                [best, bestD] = [{id: b.id}, d / reach];
        }
        if (best)
            return best;
        bestD = 6;
        if (this._settings.get_boolean('show-orbits')) {
            for (const b of this._bodies.slice(1)) {
                const d = polylineDistance(this._orbitPath(b.id), x, y);
                if (d < bestD)
                    [best, bestD] = [{id: b.id}, d];
            }
        }
        for (const {tr, pts} of this._trailHits ?? []) {
            const d = polylineDistance(pts, x, y);
            if (d < bestD)
                [best, bestD] = [{tr}, d];
        }
        return best;
    }

    _setHover(subject, {x, y, fromList = false} = {}) {
        if (!sameSubject(subject, this._hover) && (subject || this._hover)) {
            const old = this._hover;
            this._hover = subject;
            const labelOf = s => s && !s.tr ? this._bodyById(s.id)?.label : null;
            labelOf(old)?.remove_style_class_name('orrery-label-hover');
            labelOf(subject)?.add_style_class_name('orrery-label-hover');
            this.actor.set_cursor_type(subject && !fromList ? Clutter.CursorType.POINTER : Clutter.CursorType.DEFAULT);
            this._drawHover();
            if (!fromList)
                this._showTooltip(subject ? this._hoverText(subject) : null);
        }
        if (subject && x !== undefined && !fromList)
            this._placeTooltip(x + 14, y + 16);
    }

    _hoverText(subject) {
        const jd = this._jd;
        if (subject.tr) {
            const p = subject.tr.position(jd);
            const name = subject.tr.mission.short ?? subject.tr.mission.name;
            return p ? `${name} · ${A.norm(p).toFixed(A.norm(p) < 10 ? 2 : 0)} AU from the Sun` : name;
        }
        if (subject.id === 'sun')
            return 'The Sun';
        const r = A.norm(A.planetPosition(subject.id, jd));
        const sunlight = this._settings.get_boolean('sunlight-view') ? ` · ${A.formatIrradiance(A.irradiance(r))}` : '';
        return `${BODY[subject.id].name} · ${r.toFixed(2)} AU${sunlight}`;
    }

    _drawHover() {
        const h = this._hover;
        if (!h || sameSubject(h, this._subject())) {
            this._hoverPath.hide();
            return;
        }
        const rgb = R.hexToRgb(this._subjectColor(h));
        if (h.tr) {
            const pts = h.tr.projected.filter(([, , t]) => t <= this._jd);
            if (h.tr.now && pts.length)
                pts.push(h.tr.now);
            this._hoverPath.update(pts, [this._W, this._H], cr => R.strokePath(cr, pts, rgb, 0.35, 1.3));
        } else if (h.id !== 'sun') {
            const pts = this._orbitPath(h.id);
            this._hoverPath.update(pts, [this._W, this._H], cr => R.strokePath(cr, pts, rgb, 0.45, 1.4));
        } else {
            this._hoverPath.hide();
        }
    }

    _showTooltip(text) {
        const tip = this._tooltip;
        if (!text) {
            if (tip.visible)
                tip.ease({opacity: 0, duration: 150, mode: Clutter.AnimationMode.EASE_OUT_QUAD, onComplete: () => tip.hide()});
            return;
        }
        tip.text = text;
        tip.remove_all_transitions();
        tip.show();
        this._hud.set_child_above_sibling(tip, null);
        tip.ease({opacity: 255, duration: 150, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
    }

    _placeTooltip(x, y) {
        const w = this._tooltip.get_preferred_width(-1)[1];
        const {left, right, top, bottom} = this._area;
        this._tooltip.set_position(
            Math.round(Math.max(left + 4, Math.min(right - w - 4, x))),
            Math.round(Math.max(top + 4, Math.min(bottom - 28, y))));
    }

    _timelineHover(h) {
        if (!h) {
            this._showTooltip(null);
            return;
        }
        let text = h.text;
        if (!text && h.ev)
            text = `${A.formatDate(h.ev.t)} · ${h.ev.mission.short ?? h.ev.mission.name} · ${eventTitle(h.ev)}`;
        else if (!text)
            text = A.formatMonth(h.t);
        this._showTooltip(text);
        const w = this._tooltip.get_preferred_width(-1)[1];
        const [, ty] = this._timeline.actor.get_position();
        const x = h.x - this.actor.get_transformed_position()[0] - w / 2;
        this._placeTooltip(x, ty - 30);
    }

    onSettingChanged(key) {
        if (key === 'disabled-missions') {
            for (const tr of this._trajectories) {
                tr.marker?.destroy();
                tr.label?.destroy();
                tr.edge?.destroy();
            }
            if (this._selected?.tr)
                this._deselect();
            this._buildTrajectories();
            this._buildCraft();
            this._timelineRange();
            this._updateAll(0);
        } else if (key === 'mode' || key === 'replay-start-year') {
            this._settings.set_double('replay-jd', 0);
            this._resetTime();
            this._playing = true;
            this._backdrop.queue_repaint();
            this._timelineRange();
            this._syncTimelineState();
            this._updateAll(0);
        } else if (key === 'replay-jd') {
            // Set to 0 by the preferences' Restart button.
            if (this._settings.get_double('replay-jd') === 0 && !this._live()) {
                this._resetTime();
                this._playing = true;
                this._updateAll(0);
            }
        } else if (key === 'brightness') {
            this._content.opacity = this._opacity();
        } else if (key === 'trail-years' || key === 'show-trails') {
            this._updateTrails();
        } else if (key === 'sunlight-view') {
            this._backdrop.queue_repaint();
            this._layoutSunlight();
            this._syncTimelineState();
            this._updateAll(0);
        } else if (key === 'days-per-second') {
            this._syncTimelineState();
            this._updateHud();
        }
    }
}

export default class OrreryExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._scene = new OrreryScene(this._settings);
        this._scene.onActivity = () => this._wake();

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
            else if (SCHEDULE_KEYS.includes(key))
                this._schedule();
            else
                this._scene.onSettingChanged(key);
            if (key === 'spin-planets')
                this._schedule();
        }, this);
        this._power = new PowerMonitor(() => this._schedule());

        this._relayout();
        this._lastTick = GLib.get_monotonic_time();
        this._coveredClock = 0;
        this._paused = false;
        this._idle = false;
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
            this._settings.set_double('replay-jd', Math.min(this._scene.jd, A.jdNow()));
        Main.layoutManager.disconnectObject(this);
        global.display.disconnectObject(this);
        this._settings.disconnectObject(this);
        this._power?.destroy();
        this._power = null;
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

    // On battery or in power-saver mode.
    get _saving() {
        return this._settings.get_boolean('battery-saver') && !!(this._power?.onBattery || this._power?.powerSaver);
    }

    _fps() {
        const s = this._settings;
        let fps = s.get_int('fps');
        if (this._saving)
            fps = Math.min(fps, s.get_int('battery-fps'));
        if (this._idle)
            fps = Math.min(fps, IDLE_FPS);
        if (s.get_boolean('adaptive-fps') && this._scene?.still)
            fps = Math.min(fps, STILL_FPS);
        return fps;
    }

    _interval() {
        return this._paused ? 1000 : Math.round(1000 / this._fps());
    }

    _schedule() {
        if (!this._settings)
            return;
        if (this._scene)
            this._scene.powerSaving = this._saving;
        if (this._timer)
            GLib.source_remove(this._timer);
        this._intervalMs = this._interval();
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._intervalMs, () => this._tick());
    }

    // The pointer moved over the desktop: come back to full speed now
    // rather than at the next once-a-second check.
    _wake() {
        if (this._idle) {
            this._idle = false;
            this._scene.setDim(1);
        }
        if (this._interval() !== this._intervalMs)
            this._schedule();
    }

    _tick() {
        const now = GLib.get_monotonic_time();
        const dt = Math.min(0.25, (now - this._lastTick) / 1e6);
        this._lastTick = now;

        // About once a second: can anyone see the desktop, is anyone there,
        // and is anything moving?
        this._coveredClock += dt;
        if (this._paused || this._coveredClock >= 1) {
            this._coveredClock = 0;
            const s = this._settings;
            const paused = s.get_boolean('pause-when-covered') && this._coverage() * 100 >= s.get_int('pause-coverage');
            const minutes = s.get_int('idle-dim-minutes');
            const idle = minutes > 0 && global.backend.get_core_idle_monitor().get_idletime() > minutes * 60000;
            if (idle !== this._idle) {
                this._idle = idle;
                this._scene.setDim(idle ? s.get_double('idle-brightness') / 100 : 1);
            }
            this._paused = paused;
            if (this._interval() !== this._intervalMs) {
                this._timer = 0;   // this source ends by returning REMOVE
                this._schedule();
                if (!this._paused)
                    this._scene.tick(dt);
                return GLib.SOURCE_REMOVE;
            }
        }
        if (!this._paused)
            this._scene.tick(dt);
        return GLib.SOURCE_CONTINUE;
    }

    // How much of the desktop windows hide, 0 to 1. Maximized and fullscreen
    // windows count as all of it; otherwise sample a grid over the monitor.
    _coverage() {
        if (Main.overview.visible || Main.sessionMode.isLocked || Main.screenShield?.locked)
            return 1;
        const index = Main.layoutManager.primaryIndex;
        const area = Main.layoutManager.getWorkAreaForMonitor(index);
        const workspace = global.workspace_manager.get_active_workspace();
        const rects = [];
        for (const w of workspace.list_windows()) {
            if (w.minimized || w.get_monitor() !== index || !w.showing_on_its_workspace())
                continue;
            const type = w.get_window_type();
            if (type === Meta.WindowType.DESKTOP || type === Meta.WindowType.DOCK)
                continue;
            if (w.is_fullscreen())
                return 1;
            const maximized = typeof w.is_maximized === 'function'
                ? w.is_maximized()
                : w.get_maximized() === Meta.MaximizeFlags.BOTH;
            if (maximized)
                return 1;
            rects.push(w.get_frame_rect());
        }
        if (!rects.length)
            return 0;
        const [nx, ny] = [32, 18];
        let hidden = 0;
        for (let i = 0; i < nx; i++) {
            const x = area.x + (i + 0.5) * area.width / nx;
            for (let j = 0; j < ny; j++) {
                const y = area.y + (j + 0.5) * area.height / ny;
                if (rects.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height))
                    hidden++;
            }
        }
        return hidden / (nx * ny);
    }
}

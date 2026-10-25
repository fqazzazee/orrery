import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Astro from './lib/astro.js';
import {BODY, LAGRANGE, LPOINT, MOON, PLANETS, SMALL, SMALL_BODIES, SMALL_PLANETS, moonsOf, placeName} from './lib/bodies.js';
import {SAT} from './lib/satellites.js';
import {FactDeck, clearCache, details, eventCard, eventDate, eventTitle, missionDetails, missionStatus} from './lib/facts.js';
import {FarLayer} from './lib/far.js';
import {PlanetView} from './lib/focus.js';
import {SceneMirror} from './lib/mirror.js';
import {MISSIONS, buildTrajectories} from './lib/missions.js';
import {Music} from './lib/music.js';
import {PowerMonitor} from './lib/power.js';
import * as Render from './lib/render.js';
import {MUSIC_MODES, migrateSettings, nextMode} from './lib/settings.js';
import {planSpan, planetTour, storyPlan} from './lib/tour.js';
import {Card, LayersPanel, StoryBar, Timeline, label} from './lib/ui.js';

const RELAYOUT_KEYS = ['other-monitors', 'distance-scale', 'tilt', 'azimuth', 'zoom', 'planet-scale', 'show-orbits',
    'show-stars', 'show-belts', 'show-pluto', 'show-labels', 'show-hud', 'show-missions', 'show-facts',
    'interactive', 'timeline', 'timeline-position', 'show-moons', 'show-small-bodies', 'show-lagrange'];
const SCHEDULE_KEYS = ['fps', 'battery-saver', 'battery-fps', 'idle-dim-minutes', 'adaptive-fps'];
// What decides whether the desktop counts as hidden, and what then stops.
const HIDDEN_KEYS = ['animation', 'pause-coverage', 'see-through-apps'];
const MUSIC_KEYS = ['music-mode', 'music-button', 'music-source', 'music-folder', 'music-volume'];
const HOLD_SECONDS = 20;          // pause on "today" before the replay starts over
const EVENT_CARD_SECONDS = 8;
const TRAIL_HZ = 4;
const HUD_HZ = 2;
const CONTROLS_SECONDS = 4;       // the timeline fades this long after the pointer stops
const BROWSE_SECONDS = 120;       // live mode returns to today after this long untouched
const FUTURE_DAYS = 2 * 365.25;   // the timeline reaches at least this far past today
const LAST_JD = Astro.jd('2049-12-31');  // and never past the end of the planets' ephemeris
const SPEEDS = [0.5, 1, 2, 4, 8, 12, 20, 30, 60, 120, 240, 400];
// Zooming out: the stops the buttons step through (0 is the planets, 1 the
// nearest stars), and how far a wheel notch goes.
const ZOOM_STOPS = [0, 0.22, 0.6, 1];
const WHEEL_STEP = 0.06;
const FAR_FROM = 0.3;                   // past this, time quickens with the view
const FAR_END = Astro.jd('2500-01-01');     // how far the timeline reaches then
// Zoomed out, time runs this power of how much wider the view is than where
// the far view starts: from the planets' own pace there to some 30 times
// that at the nearest stars.
const FAR_QUICKEN = 0.5;
const FAR_RATES = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];   // times the far view's own pace
const FOCUS_RATES = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];   // times the close-up's own pace
const FOCUS_MS = 750;
const SUN_LEVELS = [10000, 3000, 1361, 300, 100, 30, 10, 3, 1];
const IDLE_FPS = 10;
const STILL_FPS = 5;
const TOUR_KEYS = ['tour', 'tour-mission', 'tour-idle-minutes'];

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
const LAGRANGE_COLOR = '#9fb4d8';
const TROJAN_COLOR = '#c9b48a';

// Color of any place on screen.
function placeColor(id) {
    if (SAT[id])
        return SAT[id].color ?? '#f2d6a0';
    if (LPOINT[id])
        return id.startsWith('j') ? TROJAN_COLOR : LAGRANGE_COLOR;
    return (BODY[id] ?? MOON[id] ?? SMALL[id])?.color ?? '#ffffff';
}

// A stable pseudo-random number in [0, 1) for a name.
function hashUnit(name) {
    let h = 2166136261;
    for (const c of name)
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
}

// A small St.DrawingArea centered on a point.
class Sprite {
    constructor(parent, size, paint) {
        this.size = size;
        this.area = new St.DrawingArea({width: size, height: size});
        this.area.connectObject('repaint', area => {
            const cr = area.get_context();
            paint(cr, size);
            cr.$dispose();
        }, this);
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
        this.area = null;
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
        this.area.connectObject('repaint', area => {
            const cr = area.get_context();
            cr.translate(-this._origin[0], -this._origin[1]);
            this._paint?.(cr);
            cr.$dispose();
        }, this);
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

    destroy() {
        this.area.destroy();
        this.area = null;
        this._paint = null;
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
        this._moonClock = 0;          // advances while the planets spin
        this._zoomOut = 0;            // 0 the planets ... 1 the nearest stars
        this._zoomTarget = 0;
        this._farMul = 1;             // the far view's speed, times its own pace
        this._focus = null;           // PlanetView of a planet up close
        this._focusMul = 1;
        // Days the moons (and satellites, up close) have run on while the
        // date was paused; they keep turning as long as the spin is on.
        this._drift = 0;
        this._tour = null;            // a tour or story playing, see lib/tour.js
        this._storyOnly = null;       // the one mission a story shows
        this.powerSaving = false;
        this.onActivity = null;
        this.musicState = 'hidden';   // for the timeline's music button: a music-mode, or hidden
        this.onMusicToggle = null;
        this.onOpenPrefs = null;

        this.actor = new St.Widget({style_class: 'orrery', reactive: false, clip_to_allocation: true});
        this._content = new Clutter.Actor();
        this.actor.add_child(this._content);
        // The solar system, the close-up of one planet, and the HUD on top.
        this._system = new Clutter.Actor();
        this._content.add_child(this._system);
        this._backdrop = new St.DrawingArea();
        this._backdrop.connectObject('repaint', area => this._paintBackdrop(area), this);
        this._system.add_child(this._backdrop);
        this._far = new FarLayer(this._system);
        this._sunLayer = new Clutter.Actor();
        this._system.add_child(this._sunLayer);
        this._hoverPath = new BoxCanvas(this._system);
        this._highlight = new BoxCanvas(this._system);
        this._trojans = new BoxCanvas(this._system);
        this._trails = new BoxCanvas(this._system);
        this._smallLayer = new Clutter.Actor();
        this._world = new Clutter.Actor();
        this._markerLayer = new Clutter.Actor();
        this._craftLayer = new Clutter.Actor();
        this._labels = new Clutter.Actor();
        for (const layer of [this._smallLayer, this._world, this._markerLayer, this._craftLayer, this._labels])
            this._system.add_child(layer);
        this._focusLayer = new Clutter.Actor();
        this._content.add_child(this._focusLayer);
        this._hud = new Clutter.Actor();
        this._content.add_child(this._hud);

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
        this._panel.destroy();
        this.actor.disconnectObject(this);

        // Children before their parents: the HUD, the layers of the solar
        // system, then the scene itself.
        this._legendBar.destroy();
        this._legend.destroy();
        this._dateBox.destroy();
        this._missionBox.destroy();
        this._backButton.destroy();
        this._storyBar.destroy();
        this._hud.destroy();
        this._far.destroy();
        this._hoverPath.destroy();
        this._highlight.destroy();
        this._trojans.destroy();
        this._trails.destroy();
        this._backdrop.destroy();
        this._sunLayer.destroy();
        this._smallLayer.destroy();
        this._world.destroy();
        this._markerLayer.destroy();
        this._craftLayer.destroy();
        this._labels.destroy();
        this._focusLayer.destroy();
        this._system.destroy();
        this._content.destroy();
        this.actor.destroy();

        this._legendBar = null;
        this._legend = null;
        this._dateBox = null;
        this._missionBox = null;
        this._backButton = null;
        this._storyBar = null;
        this._hud = null;
        this._far = null;
        this._hoverPath = null;
        this._highlight = null;
        this._trojans = null;
        this._trails = null;
        this._backdrop = null;
        this._sunLayer = null;
        this._smallLayer = null;
        this._world = null;
        this._markerLayer = null;
        this._craftLayer = null;
        this._labels = null;
        this._focusLayer = null;
        this._system = null;
        this._content = null;
        this.actor = null;
        this._focus = null;
        this._missionRows = null;
        this._timeline = null;
        this._panel = null;
        this._factCard = null;
        this._pin = null;
        this._eventCards = [];
    }

    get jd() {
        return this._jd;
    }

    // ---- Time ----

    _live() {
        return this._settings.get_string('mode') === 'live';
    }

    _startJd() {
        const t = Astro.jd(`${this._settings.get_int('replay-start-year')}-01-01`);
        return this._tour ? Math.min(t, this._tour.start) : t;
    }

    // Far enough ahead to take in every planned mission event.
    _endJd() {
        if (this._isFar)
            return FAR_END;
        const last = this._events?.length ? this._events.at(-1).t + 120 : 0;
        return Math.min(LAST_JD, Math.max(Astro.jdNow() + FUTURE_DAYS, last));
    }

    _intoFuture() {
        return !this._live() && this._settings.get_boolean('replay-into-future');
    }

    _resetTime() {
        const s = this._settings;
        if (this._live()) {
            this._jd = Astro.jdNow();
        } else {
            const saved = s.get_double('replay-jd');
            this._jd = saved > this._startJd() && saved < Astro.jdNow() ? saved : this._startJd();
        }
        this._browsing = false;
        this._hold = 0;
        this._seekEvents();
    }

    _advance(dt) {
        if (this._tour) {
            // A tour keeps its own time, up to the end of each step.
            const to = this._tour.steps[this._tour.index]?.to;
            this._jd = Math.min(this._endJd(), to ?? Infinity, this._jd + dt * this._dps());
            return;
        }
        const s = this._settings;
        const now = Astro.jdNow();
        if (this._live() && !this._browsing) {
            this._jd = now;
            return;
        }
        // (Not while zoomed in or out: looking around there is the point.)
        if (this._live() && !this._focus && !this._isFar && (this._browseClock += dt) > BROWSE_SECONDS) {
            this._goNow();
            return;
        }
        if (!this._playing || this._timeline.dragging)
            return;
        // Play up to today, or to the end of the timeline if someone moved
        // past today on purpose (or the replay goes on into the future).
        const end = this._jd > now + 1 || this._intoFuture() || this._isFar || this._focus ? this._endJd() : now;
        if (this._jd < end) {
            this._jd = Math.min(end, this._jd + dt * this._dps());
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
        if (this._tour)
            return this._dps() > 0;
        if (this._live() && !this._browsing)
            return false;
        return this._playing && !this._timeline.dragging &&
            this._jd < (this._jd > Astro.jdNow() + 1 || this._intoFuture() || this._isFar || this._focus ? this._endJd() : Astro.jdNow());
    }

    _spinning() {
        return this._settings.get_boolean('spin-planets') && (!this.powerSaving || this._spinAnyway);
    }

    set powerSaving(on) {
        if (on !== this._powerSaving)
            this._spinAnyway = false;
        this._powerSaving = on;
        if (this._timeline)
            this._syncTimelineState();
    }

    get powerSaving() {
        return !!this._powerSaving;
    }

    // The spin button: on battery saver it first overrides the saver.
    _toggleSpin() {
        if (this._settings.get_boolean('spin-planets') && this.powerSaving && !this._spinAnyway) {
            this._spinAnyway = true;
            this.onActivity?.();
            this._syncTimelineState();
            return;
        }
        this._spinAnyway = false;
        this._settings.set_boolean('spin-planets', !this._settings.get_boolean('spin-planets'));
    }

    // Nothing moves: the extension can drop to a few frames per second.
    get still() {
        // (Up close everything turns with the clock, so stopping it is enough.)
        return !this._timeRuns() && !this._spinning() && !this._restarting &&
            Math.abs(this._zoomTarget - this._zoomOut) < 1e-4 && this._realTime - this._lastActivity > 3 && !this._eventCards.length;
    }

    get interacting() {
        return this._realTime - this._lastActivity < CONTROLS_SECONDS || this._timeline.dragging;
    }

    // Jump the clock; `done` is false while the playhead is being dragged.
    _seek(t, done = true, ev = null) {
        const lead = Math.min(60, 3 * this._dps());
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
            this._browsing = Math.abs(t - Astro.jdNow()) > 0.5;
        this._browseClock = 0;
        this._jd = t;
        this._drift = 0;
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
        this._seek(Astro.jdNow());
    }

    _togglePlay() {
        if (this._tour) {
            this._tour.paused = !this._tour.paused;
            this._playing = !this._tour.paused;
            this._syncTimelineState();
            this._updateHud();
            return;
        }
        if (this._live() && !this._browsing) {
            // Pausing live time means looking at this moment for a while.
            this._browsing = true;
            this._playing = false;
        } else {
            this._playing = !this._playing;
            const end = this._intoFuture() ? this._endJd() : Astro.jdNow();
            // (At the end of the replay, play starts it over; not up close
            // or zoomed out, where time runs on past today.)
            if (this._playing && !this._live() && !this._focus && !this._isFar && this._jd >= end - 0.5 && this._jd <= end + 1)
                this._seek(this._startJd());
        }
        this._browseClock = 0;
        this._syncTimelineState();
        this._updateHud();
    }

    _changeSpeed(dir) {
        // Up close and far away keep their own speeds.
        const step = (list, v) => {
            const i = list.findIndex(x => x >= v - 1e-9);
            return list[Math.max(0, Math.min(list.length - 1, (i < 0 ? list.length - 1 : i) + dir))];
        };
        if (this._focus) {
            this._focusMul = step(FOCUS_RATES, this._focusMul);
            this._syncTimelineState();
            this._updateHud();
            return;
        }
        if (this._isFar) {
            this._farMul = step(FAR_RATES, this._farMul);
            this._syncTimelineState();
            this._updateHud();
            return;
        }
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
        // (A story shows its mission alone, even one turned off.)
        this._trajectories = buildTrajectories(MISSIONS.filter(m => this._storyOnly ? m.id === this._storyOnly : !disabled.includes(m.id)));
        this._events = this._trajectories.flatMap(tr => tr.milestones).sort((a, b) => a.t - b.t);
        const horizon = this._endJd() + 365.25;
        for (const tr of this._trajectories) {
            tr.cache = tr.samples(tr.launch, Math.min(tr.end, horizon));
            tr.rgb = Render.hexToRgb(tr.mission.color);
        }
        // Asteroids and comets that are only shown while a mission visits:
        // from its launch until a year after it leaves (or ends).
        this._smallWindows = new Map();
        for (const tr of this._trajectories) {
            const visits = tr.events.filter(ev => SMALL[ev.at]);
            for (const id of new Set(visits.map(ev => ev.at))) {
                const last = visits.filter(ev => ev.at === id).at(-1);
                const until = last.kind === 'arrive' ? (isFinite(tr.end) ? tr.end : Infinity) : last.t;
                const list = this._smallWindows.get(id) ?? [];
                list.push([tr.launch, until + 365]);
                this._smallWindows.set(id, list);
            }
        }
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
        this._monitorIndex = monitor.index;
        this._W = W;
        this._H = H;
        this.actor.set_position(monitor.x, monitor.y);
        this.actor.set_size(W, H);
        this.actor.reactive = s.get_boolean('interactive');
        this._backdrop.set_size(W, H);
        this._system.set_size(W, H);
        this._focusLayer.set_size(W, H);
        this._content.opacity = this._opacity();

        // Work area relative to the monitor: keep clear of the top bar and docks.
        const top = workArea.y - monitor.y, bottom = top + workArea.height;
        this._area = {left: workArea.x - monitor.x, right: workArea.x - monitor.x + workArea.width, top, bottom};
        const tilt = s.get_double('tilt');
        const zoom = s.get_double('zoom') / 100;
        const availH = bottom - top;
        const fitPx = Math.min(W * 0.46, availH * 0.46 / Math.max(0.2, Math.cos(tilt * Math.PI / 180))) * zoom;
        this._projParams = {
            cx: W / 2, cy: top + availH / 2, fitPx,
            mode: s.get_string('distance-scale'), tilt, azimuth: s.get_double('azimuth'),
        };
        this._proj = new Astro.Projection({...this._projParams, zoomOut: this._zoomOut});
        this._farReach = new Astro.Projection({...this._projParams, zoomOut: FAR_FROM}).reach;
        this._unit = W / 220 * s.get_double('planet-scale') / 100;
        this._orbitCache = new Map();
        this._trojansDrawn = null;

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
        this._factCard?.place(this._area.right - this._margin - this._cardWidth, this._slots.cardTop);
        this._stackEventCards();
        // A close-up is sized to the screen too.
        if (this._focus) {
            const id = this._focus.id;
            this._focus.destroy();
            this._focus = this._makeFocus(id);
        }
        this._applyCamera();
        if (this._panel.isOpen)
            this._togglePanel(true);
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
            for (const m of b.moons ?? [])
                m.label?.destroy();
        }
        for (const x of [...this._smalls ?? [], ...this._lpoints ?? []]) {
            x.sprite.destroy();
            x.label?.destroy();
        }

        const showPluto = this._settings.get_boolean('show-pluto');
        const showSmall = this._settings.get_boolean('show-small-bodies');
        const showLabels = this._settings.get_boolean('show-labels');
        this._bodies = [];

        const sunR = this._bodyRadius('sun');
        const sunSize = Math.ceil(sunR * 7);
        const sunSprite = new Sprite(this._world, sunSize, cr => Render.drawSun(cr, sunSize, sunR));
        sunSprite.repaint();
        sunSprite.area.set_pivot_point(0.5, 0.5);
        this._sun = {id: 'sun', R: sunR, size: sunSize, actor: sunSprite.area, pos: [0, 0, 0], moons: [], orbits: null};
        this._bodies.push(this._sun);

        for (const body of PLANETS) {
            if (body.id === 'pluto' && !showPluto || SMALL_PLANETS.includes(body.id) && !showSmall)
                continue;
            const r = this._bodyRadius(body.id);
            const size = 2 * Render.spriteExtent(body.id, r);
            const pole = Astro.unit(this._proj.view(Astro.equatorialToEcliptic(...body.pole)));
            const b = {id: body.id, R: r, size, pole, phase: 0, light: [1, 0, 0], drawn: null, shaded: null, cache: null};

            // Layers, so a spin only redraws the surface: rings behind,
            // surface, day/night shading, rings in front.
            // Sized, so it can shrink about its center when zoomed out.
            b.actor = new Clutter.Actor({width: size, height: size, pivot_point: new Graphene.Point({x: 0.5, y: 0.5})});
            this._world.add_child(b.actor);
            // Faint rings for the moons' orbits, shown when the planet is
            // picked; first, so they sit behind it.
            b.orbits = new St.DrawingArea({visible: false});
            b.actor.add_child(b.orbits);
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
            if (Render.RINGS[body.id])
                layer(cr => Render.drawRings(cr, size, body.id, r, pole, -1));
            b.surface = layer((cr, area) => {
                const scale = area.get_resource_scale();
                if (b.cache?.scale !== scale)
                    b.cache = Render.bandCache(body.id, size, r, pole, scale);
                Render.drawSurface(cr, size, body.id, r, {pole, phase: b.phase, cache: b.cache});
            });
            b.shade = layer(cr => Render.drawShade(cr, size, r, b.light, body.atmosphere));
            if (Render.RINGS[body.id])
                layer(cr => Render.drawRings(cr, size, body.id, r, pole, +1));
            if (showLabels) {
                b.label = label(SMALL_PLANETS.includes(body.id) ? 'orrery-planet-label orrery-small-label' : 'orrery-planet-label',
                    body.name.toUpperCase());
                this._labels.add_child(b.label);
            }
            this._buildMoons(b);
            this._bodies.push(b);
        }
        this._buildSmallBodies();
        this._buildMarkers();
    }

    // Moons circle their planet on a squeezed scale: just outside the planet
    // (or its rings) out to a few planet radii, spaced by the logarithm of
    // their real distances, in the planet's equatorial plane (the ecliptic
    // for our Moon).
    _buildMoons(b) {
        b.moons = [];
        const list = this._settings.get_boolean('show-moons') ? moonsOf(b.id) : [];
        if (!list.length)
            return;
        const rings = Render.RINGS[b.id];
        const inner = (rings ? rings.at(-1)[1] * b.R : b.R) + 4;
        const span = Math.max(10, Math.min(34, b.R * 1.6));
        const logs = list.map(m => Math.log(m.a));
        const [lo, hi] = [Math.min(...logs), Math.max(...logs)];
        const planetPole = Astro.equatorialToEcliptic(...BODY[b.id].pole);
        let reach = 0;
        for (const m of list) {
            const pole = m.ecliptic ? [0, 0, 1] : planetPole;
            const e1 = Astro.unit(Math.abs(pole[2]) > 0.99 ? Astro.cross(pole, [1, 0, 0]) : Astro.cross(pole, [0, 0, 1]));
            const e2 = Astro.cross(pole, e1);
            const r = list.length === 1 ? inner + span * 0.45 : inner + span * (Math.log(m.a) - lo) / (hi - lo);
            const dot = Math.max(1.2, Math.min(2.8, this._unit * (m.radiusKm / 6371) ** 0.45 * 0.42));
            const size = Math.ceil(2 * dot + 1);
            const rgb = Render.hexToRgb(m.color);
            const moon = {
                id: m.id, data: m, r, size, R: dot, e1: this._proj.view(e1), e2: this._proj.view(e2),
                phase0: 2 * Math.PI * hashUnit(m.id), front: true,
            };
            moon.area = new St.DrawingArea({width: size, height: size});
            moon.area.connect('repaint', area => {
                const cr = area.get_context();
                Render.drawMoon(cr, size, rgb, b.light);
                cr.$dispose();
            });
            b.actor.add_child(moon.area);
            b.moons.push(moon);
            reach = Math.max(reach, r + size);
        }
        const M = Math.ceil(reach + 2);
        b.orbits.set_size(2 * M, 2 * M);
        b.orbits.set_translation(b.size / 2 - M, b.size / 2 - M, 0);
        const rings2 = b.moons.map(moon => Array.from({length: 73}, (_, i) => {
            const a = i / 72 * 2 * Math.PI;
            return [moon.r * (Math.cos(a) * moon.e1[0] + Math.sin(a) * moon.e2[0]),
                -moon.r * (Math.cos(a) * moon.e1[1] + Math.sin(a) * moon.e2[1])];
        }));
        b.orbits.connect('repaint', area => {
            const cr = area.get_context();
            Render.drawMoonOrbits(cr, 2 * M, rings2, 0.16);
            cr.$dispose();
        });
    }

    // Comets and the asteroids missions visit.
    _buildSmallBodies() {
        this._smalls = [];
        const showLabels = this._settings.get_boolean('show-labels');
        for (const s of SMALL_BODIES) {
            const x = {id: s.id, data: s, R: 3, drawn: null, tail: [0, 0], shown: false};
            const rgb = Render.hexToRgb(s.color);
            if (s.comet) {
                const size = Math.ceil(this._unit * 12);
                x.sprite = new Sprite(this._smallLayer, size, cr => Render.drawComet(cr, size, x.tail[0], x.tail[1], rgb));
            } else {
                const size = 9;
                x.sprite = new Sprite(this._smallLayer, size, cr => Render.drawSpeck(cr, size, rgb));
                x.sprite.repaint();
            }
            x.sprite.area.hide();
            if (showLabels) {
                x.label = label('orrery-planet-label orrery-small-label', (s.short ?? s.name).toUpperCase());
                x.label.hide();
                this._labels.add_child(x.label);
            }
            this._smalls.push(x);
        }
    }

    // Lagrange points: Sun-Earth L1 to L5, and Jupiter's Trojan camps.
    _buildMarkers() {
        this._lpoints = [];
        if (!this._settings.get_boolean('show-lagrange'))
            return;
        for (const l of LAGRANGE) {
            const size = 9;
            const rgb = Render.hexToRgb(placeColor(l.id));
            const x = {id: l.id, data: l, R: 4};
            x.sprite = new Sprite(this._markerLayer, size, cr => Render.drawMarker(cr, size, rgb, l.id.startsWith('j') ? 0.45 : 0.6));
            x.sprite.repaint();
            x.label = label('orrery-marker-label', l.id.startsWith('j') ? l.id.slice(1).toUpperCase() : l.short);
            x.label.set_style(`color: rgba(${rgb.map(c => Math.round(c * 255)).join(', ')}, 0.55);`);
            this._labels.add_child(x.label);
            this._lpoints.push(x);
        }
    }

    _projectTrails() {
        for (const tr of this._trajectories) {
            tr.projected = tr.cache.map(({t, p}) => {
                const [x, y] = this._proj.project(p);
                return [x, y, t];
            });
        }
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
        this._projectTrails();
        for (const tr of this._trajectories) {
            if (!show)
                continue;
            tr.marker = new Sprite(this._craftLayer, size, cr => Render.drawCraft(cr, size, tr.rgb));
            tr.marker.repaint();
            tr.label = label('orrery-craft-label', tr.mission.short ?? tr.mission.name);
            tr.label.set_style(`color: ${tr.mission.color};`);
            tr.edge = label('orrery-edge');
            tr.edge.set_style(`color: ${tr.mission.color};`);
            this._labels.add_child(tr.label);
            this._labels.add_child(tr.edge);
        }
    }

    // ---- Camera ----

    // Zoomed out: everything is projected again, the planets shrink to a
    // knot and the far layer fades in.
    _applyCamera() {
        if (!this._projParams)
            return;
        const u = this._zoomOut;
        // The camera rises as it pulls back, so things heading up out of
        // the plane of the planets (Voyager 1) are not seen end-on.
        const tilt = this._projParams.tilt;
        this._proj = new Astro.Projection({...this._projParams, zoomOut: u, tilt: tilt + (Math.min(tilt, 25) - tilt) * smooth(u / 0.6)});
        this._orbitCache = new Map();
        this._trojansDrawn = null;
        this._projectTrails();
        this._backdrop.queue_repaint();
        if (this._settings.get_boolean('sunlight-view'))
            this._layoutSunlight();
        this._bodyScale = 1 - 0.7 * smooth(u / 0.35);
        for (const b of this._bodies) {
            b.actor.set_scale(this._bodyScale, this._bodyScale);
            for (const m of b.moons)
                m.area.visible = u < 0.04;
        }
        this._markerLayer.visible = u < 0.12;
        this._far.layout({proj: this._proj, W: this._W, H: this._H, trajectories: this._trajectories,
            area: {...this._area, top: this._slots?.sceneTop ?? this._area.top, bottom: this._slots?.sceneBottom ?? this._area.bottom}});
        const far = u > FAR_FROM;
        if (far !== this._isFar) {
            this._isFar = far;
            // Coming back in from a far future, return to today.
            if (!far && this._jd > this._endJd())
                this._seek(Math.min(this._jd, Astro.jdNow()));
            if (far && this._live())
                this._browsing = true;
            this._timelineRange();
        }
        this._syncTimelineState();
        this._updateTrails();
        this._showHighlight();
        this._drawHover();
    }

    // Zoom one step: out toward the stars or back, or in to a planet
    // (the one under the pointer, the one picked, or Earth).
    _zoom(dir, near = null) {
        if (dir < 0) {
            if (this._focus) {
                this._leaveFocus();
                return;
            }
            this._zoomTarget = ZOOM_STOPS.find(z => z > this._zoomTarget + 0.01) ?? 1;
        } else if (this._zoomTarget > 0.01) {
            this._zoomTarget = [...ZOOM_STOPS].reverse().find(z => z < this._zoomTarget - 0.01) ?? 0;
        } else if (!this._focus) {
            const pick = s => s && !s.tr && BODY[s.id] && s.id !== 'sun' ? s.id : null;
            this._focusOn(pick(near) ?? pick(this._selected) ?? 'earth');
        }
        this._activity();
        this._syncTimelineState();
    }

    // The mouse wheel zooms smoothly; past the planets it flies to the one
    // under the pointer.
    _wheel(steps, x, y) {
        this._tourYield();
        if (steps < 0 && this._focus) {
            this._leaveFocus();
            return;
        }
        if (steps > 0 && this._zoomTarget <= 0.001 && !this._focus) {
            const hit = this._hitTest(x, y);
            if (hit && !hit.tr && BODY[hit.id] && hit.id !== 'sun')
                this._focusOn(hit.id);
            return;
        }
        this._zoomTarget = Math.max(0, Math.min(1, this._zoomTarget - steps * WHEEL_STEP));
        this._syncTimelineState();
    }

    _makeFocus(id) {
        const view = new PlanetView(this._focusLayer, id, {
            view: v => this._proj.view(v), area: this._area, W: this._W, H: this._H,
            trajectories: this._trajectories, showLabels: this._settings.get_boolean('show-labels'),
        });
        view.update(this._jd + this._drift);
        return view;
    }

    // Fly in: the system swells around the planet and fades as the
    // close-up grows out of it.
    _focusOn(id) {
        if (this._focus?.id === id)
            return;
        if (this._focus)
            this._leaveFocus(false);
        if (this._zoomOut) {
            this._zoomOut = this._zoomTarget = 0;
            this._applyCamera();
        }
        const b = this._bodyById(id);
        const [px, py] = [b?.x ?? this._W / 2, b?.y ?? this._H / 2];
        this._drift = 0;
        this._focus = this._makeFocus(id);
        this._focusMul = 1;
        if (this._live())
            this._browsing = true;
        this._playing = true;
        const [cx, cy] = [this._focus.cx, this._focus.cy];
        const mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
        for (const a of [this._system, this._focusLayer])
            a.remove_all_transitions();
        this._system.show();
        this._system.set_pivot_point(px / this._W, py / this._H);
        this._system.ease({scale_x: 6, scale_y: 6, opacity: 0, duration: FOCUS_MS, mode,
            onComplete: () => {
                if (this._focus)
                    this._system.hide();
            }});
        this._focusLayer.set({pivot_point: new Graphene.Point({x: cx / this._W, y: cy / this._H}),
            scale_x: 0.12, scale_y: 0.12, translation_x: px - cx, translation_y: py - cy, opacity: 0});
        this._focusLayer.show();
        this._focusLayer.ease({scale_x: 1, scale_y: 1, translation_x: 0, translation_y: 0, opacity: 255, duration: FOCUS_MS, mode});
        this._setHover(null);
        this._showHighlight();
        this._syncTimelineState();
        this._updateHud();
        this._refreshFact();
    }

    // A new fact card for the new view (unless one is pinned).
    _refreshFact() {
        if (!this._pin && this._settings.get_boolean('show-facts'))
            this._factClock = this._settings.get_double('fact-interval');
    }

    // Fly back out to the planet's place in the system.
    _leaveFocus(animate = true) {
        const leaving = this._focus;
        if (!leaving)
            return;
        this._focus = null;
        this._focusMul = 1;
        this._drift = 0;
        this._updateAll(0);
        const b = this._bodyById(leaving.id);
        const [px, py] = [b?.x ?? this._W / 2, b?.y ?? this._H / 2];
        const mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
        for (const a of [this._system, this._focusLayer])
            a.remove_all_transitions();
        this._system.show();
        this._system.set_pivot_point(px / this._W, py / this._H);
        this._system.ease({scale_x: 1, scale_y: 1, opacity: 255, duration: animate ? FOCUS_MS : 0, mode});
        this._focusLayer.ease({scale_x: 0.12, scale_y: 0.12, translation_x: px - leaving.cx, translation_y: py - leaving.cy,
            opacity: 0, duration: animate ? FOCUS_MS : 0, mode,
            onComplete: () => leaving.destroy()});
        if (this._live())
            this._goNow();
        this._setHover(null);
        this._syncTimelineState();
        this._updateHud();
        this._refreshFact();
    }

    // ---- Tours and stories ----

    // kind: 'planets' (fly past each planet), 'story' (one mission, from
    // launch to the end) or 'stories' (each mission's in turn). An automatic
    // tour (started after the desktop sits untouched) loops, and stops at
    // the first touch.
    startTour(kind, missionId = null, {auto = false} = {}) {
        if (this._tour)
            this._endTour(false);
        const ids = kind === 'stories' ? this._storyIds(missionId) : [missionId];
        if (kind !== 'planets' && !ids[0])
            return;
        this._tour = {
            kind, auto, ids, which: 0, steps: [], index: -1, clock: 0, dps: null, start: Infinity,
            saved: {jd: this._jd, playing: this._playing, zoom: this._zoomTarget, focus: this._focus?.id ?? null,
                browsing: this._browsing, expanded: this._pin?.expanded,
                selected: this._selected?.tr ? {mission: this._selected.tr.mission.id} : this._selected},
        };
        if (this._panel.isOpen)
            this._togglePanel(false);
        this._loadTour();
    }

    // Missions with a story, in launch order, from the given one on.
    _storyIds(from = null) {
        const disabled = this._settings.get_strv('disabled-missions');
        const ids = MISSIONS.filter(m => m.group !== 'observatory' && !disabled.includes(m.id))
            .sort((a, b) => Astro.jd(a.events[0].date) - Astro.jd(b.events[0].date)).map(m => m.id);
        const i = Math.max(0, ids.indexOf(from));
        return [...ids.slice(i), ...ids.slice(0, i)];
    }

    _loadTour() {
        const tour = this._tour;
        let steps;
        if (tour.kind === 'planets') {
            this._setStoryOnly(null);
            steps = planetTour();
            tour.name = 'Planet flybys';
        } else {
            const id = tour.ids[tour.which % tour.ids.length];
            this._setStoryOnly(id);
            const tr = this._trajectories[0];
            if (!tr) {
                this._endTour();
                return;
            }
            steps = storyPlan(tr);
            for (const step of steps) {
                if (step.pick)
                    step.pick = {tr};
            }
            tour.name = tr.mission.short ?? tr.mission.name;
        }
        tour.steps = steps;
        tour.start = Math.min(planSpan(steps, this._jd)[0], this._jd) - 30;
        if (this._live())
            this._browsing = true;
        this._playing = true;
        this._timelineRange();
        // (An automatic tour is to watch, not to steer: no bar.)
        if (!tour.auto)
            this._storyBar.show(tour.name);
        this._tourStep(0);
    }

    // Only this mission on screen (null: the usual ones).
    _setStoryOnly(id) {
        if (id === this._storyOnly)
            return;
        this._storyOnly = id;
        this.onSettingChanged('disabled-missions');
    }

    _tourStep(i) {
        const tour = this._tour;
        const step = tour.steps[i];
        tour.index = i;
        tour.clock = 0;
        if (step.from !== undefined && Math.abs(step.from - this._jd) > 1e-4)
            this._tourSeek(step.from);
        tour.dps = step.to !== undefined ? Math.max(0, (step.to - this._jd) / step.seconds) : step.dps ?? null;
        if (step.view === 'system' || step.view === 'far') {
            if (this._focus)
                this._leaveFocus();
            this._zoomTarget = step.zoom ?? (step.view === 'far' ? 0.6 : 0);
        } else if (this._focus?.id !== step.view) {
            this._focusOn(step.view);
        }
        if (step.pick && !sameSubject(step.pick, this._selected))
            this._select(step.pick);
        this._storyBar.setStep(step.title, i, tour.steps.length);
        this._syncTimelineState();
        this._updateHud();
    }

    // Jump within a tour: no clamping to the replay's range, no lingering cards.
    _tourSeek(t) {
        for (const c of this._eventCards)
            c.card.dismiss();
        this._eventCards = [];
        this._jd = t;
        this._drift = 0;
        this._seekEvents();
        this._updateAll(0);
    }

    _updateTour(dt) {
        const tour = this._tour;
        if (!tour) {
            // Start the automatic tour once the desktop has sat untouched.
            const kind = this._settings.get_string('tour');
            if (kind !== 'off' && this._proj && !this._timeline.dragging && !this._panel.isOpen &&
                this._realTime - Math.max(0, this._lastActivity, this._tourRest ?? 0) > this._settings.get_int('tour-idle-minutes') * 60 + 2)
                this.startTour(kind === 'mission' ? 'story' : kind, this._settings.get_string('tour-mission') || null, {auto: true});
            return;
        }
        const step = tour.steps[tour.index];
        if (tour.paused)
            return;
        tour.clock += dt;
        const done = step.to !== undefined ? this._jd >= step.to - 1e-9 || tour.clock > step.seconds * 1.5 + 3 : tour.clock >= step.seconds;
        if (done)
            this._nextTourStep();
    }

    _nextTourStep() {
        const tour = this._tour;
        if (tour.index + 1 < tour.steps.length) {
            this._tourStep(tour.index + 1);
            return;
        }
        // The end: on to the next story, round again, or back to before.
        if (tour.kind === 'stories' && (tour.auto || tour.which + 1 < tour.ids.length)) {
            tour.which++;
            this._loadTour();
        } else if (tour.auto) {
            this._loadTour();
        } else {
            this._endTour();
        }
    }

    _prevTourStep() {
        const tour = this._tour;
        // Back to the start of this step, or of the one before if just begun.
        let i = tour.clock < 2 ? Math.max(0, tour.index - 1) : tour.index;
        // A step that runs on from where the last one stopped needs a date
        // to start from: the end of the step before it.
        const startOf = k => {
            for (let j = k; j >= 0; j--) {
                if (tour.steps[j].from !== undefined)
                    return tour.steps[j].from;
                if (j < k && tour.steps[j].to !== undefined)
                    return tour.steps[j].to;
            }
            return this._jd;
        };
        while (i > 0 && tour.steps[i].to === undefined && tour.steps[i].from === undefined)
            i--;
        this._tourSeek(startOf(i));
        this._tourStep(i);
    }

    // Stop, and put things back as they were.
    _endTour(restore = true) {
        const tour = this._tour;
        if (!tour)
            return;
        this._tour = null;
        this._storyBar.hide();
        this._setStoryOnly(null);
        if (restore) {
            const {saved} = tour;
            if (saved.focus)
                this._focusOn(saved.focus);
            else if (this._focus)
                this._leaveFocus();
            this._zoomTarget = saved.zoom;
            this._browsing = saved.browsing;
            if (this._live() && !saved.browsing)
                this._goNow();
            else
                this._seek(saved.jd);
            this._playing = saved.playing;
            const tr = saved.selected?.mission && this._trajectories.find(x => x.mission.id === saved.selected.mission);
            const subject = tr ? {tr} : saved.selected?.id ? saved.selected : null;
            if (subject)
                this._select(subject, {expand: saved.expanded});
            else if (this._selected)
                this._deselect();
        }
        // Wait a while before an automatic tour starts again.
        this._tourRest = this._realTime;
        this._timelineRange();
        this._syncTimelineState();
        this._updateHud();
    }

    // Someone took the controls: a tour gives way.
    _tourYield() {
        if (this._tour)
            this._endTour(this._tour.auto);
    }

    // Simulated days per real second, for the view on screen.
    _dps() {
        if (this._tour?.paused)
            return 0;
        if (this._tour?.dps !== null && this._tour?.dps !== undefined)
            return this._tour.dps;
        if (this._focus)
            return this._focus.rate * this._focusMul / Astro.DAY_S;
        const dps = this._settings.get_double('days-per-second');
        if (this._isFar)
            return dps * this._farMul * (this._proj.reach / this._farReach) ** FAR_QUICKEN;
        return dps;
    }

    _speedText() {
        if (this._focus && this._tour?.dps !== null && this._tour?.dps !== undefined)
            return `×${Astro.formatCount(Math.round(this._tour.dps * Astro.DAY_S))}`;
        if (this._focus)
            return `×${Astro.formatCount(Math.round(this._focus.rate * this._focusMul))}`;
        // Two figures at most, so it holds still while the view zooms.
        const dps = this._dps(), round = v => v < 10 ? +v.toFixed(1) : Math.round(v);
        return dps >= 36.5 ? `${round(dps / 365.25)} y/s` : `${round(dps)} d/s`;
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
        this._legendBar.connectObject('repaint', area => {
            const cr = area.get_context();
            Render.drawSunlightLegend(cr, ...area.get_surface_size(), marks);
            cr.$dispose();
        }, this);
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
            seek: (t, done, ev) => {
                this._tourYield();
                this._seek(t, done, ev);
            },
            toggle: () => this._togglePlay(),
            restart: () => {
                this._tourYield();
                this._playing = true;
                this._seek(this._startJd());
                this._syncTimelineState();
            },
            speed: dir => {
                this._tourYield();
                this._changeSpeed(dir);
            },
            now: () => {
                this._tourYield();
                this._goNow();
            },
            zoom: dir => {
                this._tourYield();
                this._zoom(dir);
            },
            layers: () => this._togglePanel(),
            spin: () => this._toggleSpin(),
            sunlight: () => this._settings.set_boolean('sunlight-view', !this._settings.get_boolean('sunlight-view')),
            music: () => this.onMusicToggle?.(),
            hover: h => this._timelineHover(h),
            activity: () => this._activity(),
        });

        this._timeline.actor.connectObject('enter-event', () => {
            this._setHover(null);
            return Clutter.EVENT_PROPAGATE;
        }, this);

        // Chips to show and hide things and missions, from the timeline.
        this._panel = new LayersPanel(this._hud, {
            settings: this._settings, missions: MISSIONS,
            onTour: kind => this.startTour(kind, kind === 'stories' ? this._selected?.tr?.mission.id ?? null : null),
            onPrefs: () => {
                this._togglePanel(false);
                this.onOpenPrefs?.();
            },
            onClose: () => this._togglePanel(false),
            activity: () => this._activity(),
        });

        // Back out of a close-up or a zoom, from the top of the screen.
        this._backButton = new St.Button({style_class: 'orrery-pill orrery-back', label: '‹  Back to the solar system',
            can_focus: false, visible: false});
        this._backButton.connectObject('clicked', () => {
            if (this._focus)
                this._leaveFocus();
            else
                this._zoomTarget = 0;
            this._syncTimelineState();
        }, this);
        this._hud.add_child(this._backButton);

        // A story's controls, in the same place.
        this._storyBar = new StoryBar(this._hud, {
            onPrev: () => this._tour && this._prevTourStep(),
            onNext: () => this._tour && this._nextTourStep(),
            onExit: () => this._endTour(),
            onResize: () => this._placeStoryBar(),
            activity: () => this._tour?.auto || this._activity(),
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
        this._cardWidth = Math.round(Math.min(380, Math.max(260, this._W * 0.19)));
        this._missionBox.visible = show && s.get_boolean('show-missions');

        // Timeline: centered between the mission list and the cards, or in
        // a corner, at the top or bottom. Whatever shares its corner moves
        // out of its way.
        const mode = s.get_boolean('interactive') ? s.get_string('timeline') : 'never';
        this._timelineMode = mode;
        const place = s.get_string('timeline-position');
        const atTop = place.startsWith('top');
        const side = place.endsWith('left') ? 'left' : place.endsWith('right') ? 'right' : 'center';
        const th = 46;
        const tw = side === 'center'
            ? Math.round(Math.max(Math.min(1100, right - left - 2 * (this._cardWidth + 2 * m)), Math.min(560, right - left - 2 * m)))
            : Math.round(Math.min(760, Math.max(520, (right - left) * 0.42), right - left - 2 * m));
        const tx = side === 'left' ? left + m : side === 'right' ? right - m - tw : Math.round((left + right - tw) / 2);
        const ty = atTop ? top + Math.round(m * 0.6) : bottom - m - th;
        this._timeline.actor.set_size(tw, th);
        this._timeline.actor.set_position(tx, ty);
        this._timelineTop = atTop;
        const on = mode !== 'never';
        const gap = 10;
        this._slots = {
            dateTop: on && atTop && side === 'left' ? ty + th + gap : top + Math.round(m * 0.6),
            cardTop: on && atTop && side === 'right' ? ty + th + gap : top + m,
            cardBottom: (on && !atTop && side === 'right' ? ty - gap : bottom - m) - 170,
            eventBottom: on && !atTop && side === 'right' ? ty - gap : bottom - m,
            listBottom: on && !atTop && side === 'left' ? ty - gap : bottom - m,
            // Where craft names and edge arrows may go.
            sceneTop: on && atTop ? ty + th + 4 : top,
            sceneBottom: on && !atTop ? ty - 4 : bottom,
        };
        this._dateBox.set_position(left + m, this._slots.dateTop);
        const bw = this._backButton.get_preferred_width(-1)[1];
        this._topY = on && atTop && side === 'center' ? ty + th + gap : top + Math.round(m * 0.6);
        this._backButton.set_position(Math.round((left + right - bw) / 2), this._topY);
        this._placeStoryBar();
        this._timelineRange();
        if (mode === 'always')
            this._timeline.show();
        else if (mode === 'never' || !this.interacting)
            this._timeline.hide();
        this._syncTimelineState();
        this._updateHud();
    }

    // Open or close the chip panel, beside the timeline's right end, on
    // the side of it with room.
    _togglePanel(open = !this._panel.isOpen) {
        if (open) {
            const {left, right, top, bottom} = this._area;
            const m = this._margin, tl = this._timeline.actor;
            const w = Math.min(460, right - left - 2 * m);
            const x = Math.max(left + m, Math.min(right - m - w, tl.x + tl.width - w));
            if (this._timelineTop) {
                const y = tl.y + tl.height + 10;
                this._panel.place(x, y, w, bottom - m - y);
            } else {
                this._panel.place(x, h => tl.y - 10 - h, w, tl.y - 10 - (top + m));
            }
            this._hud.set_child_above_sibling(this._panel.actor, null);
            this._panel.open();
            this._timeline.show();
        } else {
            this._panel.close();
        }
        this._syncTimelineState();
    }

    _placeStoryBar() {
        if (!this._storyBar || this._topY === undefined)
            return;
        const {left, right} = this._area;
        const w = this._storyBar.actor.get_preferred_width(-1)[1];
        this._storyBar.actor.set_position(Math.round((left + right - w) / 2), this._topY);
    }

    _timelineRange() {
        const t0 = this._startJd(), now = Astro.jdNow(), t1 = this._endJd();
        const y0 = Astro.yearOfJd(t0), y1 = Astro.yearOfJd(t1);
        const step = y1 - y0 > 300 ? 100 : y1 - y0 > 120 ? 25 : y1 - y0 > 40 ? 10 : 5;
        const years = [], labels = [];
        for (let y = y0; y <= y1; y++) {
            const t = Astro.jd(`${y}-01-01`);
            if (t < t0 || t > t1)
                continue;
            if (y1 - y0 < 120 || y % step === 0)
                years.push([t, y % step === 0]);
            if (y % step === 0)
                labels.push([t, `${y}`]);
        }
        const events = this._events.filter(ev => ev.kind !== 'note' && ev.kind !== 'point' || ev.title)
            .map(ev => ({t: ev.t, kind: ev.kind, ev, rgb: Render.hexToRgb(ev.mission.color)}));
        this._timeline.setRange({t0, t1, now, years, labels, events});
    }

    _syncTimelineState() {
        this._backButton?.set({visible: !this._tour && (!!this._focus || this._zoomTarget > 0.01),
            label: this._focus ? '‹  Back to the solar system' : '‹  Back to the planets'});
        this._timeline.setState({
            playing: this._live() && !this._browsing ? true : this._playing,
            speed: this._speedText(),
            zoom: this._focus ? 'planet' : this._zoomTarget >= 0.999 ? 'max' : this._zoomTarget > 0.01 ? 'far' : 'system',
            live: this._live() && !this._browsing,
            music: this.musicState,
            layers: this._panel?.isOpen,
            spinning: this._spinning(),
            spinHeld: this._settings.get_boolean('spin-planets') && !this._spinning(),
            sunlight: this._settings.get_boolean('sunlight-view'),
        });
    }

    _updateHud() {
        const s = this._settings;
        const live = this._live();
        // Up close, time runs in minutes and hours.
        const clock = new Date(Astro.msFromJd(this._jd));
        this._dateLabel.text = this._focus
            ? `${Astro.formatDate(this._jd)}  ${String(clock.getUTCHours()).padStart(2, '0')}:${String(clock.getUTCMinutes()).padStart(2, '0')} UTC`
            : Astro.formatDate(this._jd);
        const now = Astro.jdNow();
        const today = Math.abs(this._jd - now) < 0.5;
        const dps = +s.get_double('days-per-second').toFixed(1);
        let caption;
        if (this._tour) {
            const step = this._tour.steps[this._tour.index];
            caption = `${this._tour.auto ? 'Tour · ' : ''}${this._tour.name} · ${step?.title ?? ''}${this._tour.paused ? ' · paused' : ` · ${this._speedText()}`}`;
        } else if (this._focus)
            caption = `${BODY[this._focus.id].name} up close · ${this._speedText()} real speed${this._playing ? ''
                : this._spinning() ? ' · date paused, orbits still turning' : ' · paused'}`;
        else if (this._isFar)
            caption = `From beyond the planets · ${this._speedText()}${this._playing ? '' : ' · paused'}`;
        else if (live && !this._browsing)
            caption = 'Live · the solar system right now';
        else if (live)
            caption = `Exploring${this._playing ? ` · ${dps} days per second` : ' · paused'} · back to live soon`;
        else if (!this._playing)
            caption = 'Paused · press play on the timeline to go on';
        else if (this._jd > now + 0.5)
            caption = `Ahead of today: planned missions · ${dps} days per second`;
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
        // Spacecraft in flight (telescopes have their Lagrange point's card).
        let active = [];
        for (const tr of this._trajectories) {
            const status = tr.mission.group === 'observatory' ? null : missionStatus(tr, this._jd);
            if (status)
                active.push([tr, status]);
        }
        // On a short screen, keep the picked one and those with the most
        // going on (an event nearest in time), and count the rest.
        const rowH = this._missionRows.values().next().value?.box.height || 20;
        const room = this._slots.listBottom - (this._dateBox.y + this._dateBox.height + (this._legend.visible ? this._legend.height + 12 : 0) + 30);
        const fit = Math.max(1, Math.floor(room / rowH) - 1);
        if (active.length > fit + 1) {
            const busy = tr => sameSubject(this._selected, {tr}) ? -Infinity
                : Math.min(...tr.milestones.map(ev => Math.abs(ev.t - this._jd)));
            const keep = new Set(active.map(([tr]) => tr).sort((a, b) => busy(a) - busy(b)).slice(0, fit));
            this._moreMissions = active.length - fit;
            active = active.filter(([tr]) => keep.has(tr));
        } else {
            this._moreMissions = 0;
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
                row.box.connectObject(
                    'clicked', () => this._select({tr}, {toggle: true}),
                    'notify::hover', () => this._setHover(row.box.hover ? {tr} : null, {fromList: true}),
                    this);
                this._missionBox.add_child(row.box);
                this._missionRows.set(tr.mission.id, row);
            }
            row.status.text = status;
            row.box[sameSubject(this._selected, {tr}) ? 'add_style_class_name' : 'remove_style_class_name']('orrery-mission-selected');
        }
        if (this._moreMissions) {
            this._moreLabel ??= label('orrery-mission-more');
            if (!this._moreLabel.get_parent())
                this._missionBox.add_child(this._moreLabel);
            this._missionBox.set_child_above_sibling(this._moreLabel, null);
            this._moreLabel.text = `+ ${this._moreMissions} more in flight`;
        } else if (this._moreLabel?.get_parent()) {
            this._missionBox.remove_child(this._moreLabel);
        }
        // Rows are padded buttons; shift left so the names line up with the date.
        const h = this._missionBox.get_preferred_height(-1)[1];
        this._missionBox.set_position(this._area.left + this._margin - 6, this._slots.listBottom - h);
    }

    // Planet and craft names; in the sunlight view they also say how much
    // sunlight falls there.
    _updateLabels() {
        const sunlight = this._settings.get_boolean('sunlight-view');
        for (const b of this._bodies) {
            if (!b.label || !b.pos)
                continue;
            const name = BODY[b.id].name.toUpperCase();
            const text = sunlight ? `${name}  ${Astro.formatIrradiance(Astro.irradiance(Astro.norm(b.pos)))}` : name;
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
            const rho = this._proj.radiusPx(Astro.irradianceRadius(e));
            const x = cx + rho * Math.cos(ang) + 4, y = cy + rho * squash * Math.sin(ang) - 14;
            if (rho < this._sun.R * 2.2 || x < left || y < top + 40 || y - lastY < 15)
                continue;
            const text = e === Astro.SOLAR_CONSTANT ? `${Astro.formatIrradiance(e)} · Earth` : Astro.formatIrradiance(e);
            const l = label('orrery-sun-contour', text);
            // The contour's color, lifted toward white so the dim outer ones read.
            const [r, g, b] = Render.sunlightColor(e).map(c => Math.round(255 * (0.65 * c + 0.35)));
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
        const [zIn, zOut] = Astro.HABITABLE_ZONE.map(r => this._proj.radiusPx(r));
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
            Render.drawStars(cr, this._W, this._H);
        if (sunlight) {
            Render.drawSunlightField(cr, {
                cx: this._proj.cx, cy: this._proj.cy, squash: this._proj.squash,
                radiusPx: r => this._proj.radiusPx(r), levels: SUN_LEVELS, zone: Astro.HABITABLE_ZONE,
            });
        }
        if (s.get_boolean('show-belts')) {
            const rnd = Render.seeded(4);
            const belt = (n, a0, a1, alpha) => {
                const pts = [];
                for (let i = 0; i < n; i++) {
                    const a = a0 + (a1 - a0) * rnd() ** 0.8, th = rnd() * 2 * Math.PI;
                    pts.push([...this._proj.project([a * Math.cos(th), a * Math.sin(th), (rnd() - 0.5) * 0.12 * a]).slice(0, 2), 0.4 + rnd() * 0.6]);
                }
                Render.drawDots(cr, pts, alpha, 0.5);
            };
            belt(1600, 2.15, 3.3, sunlight ? 0.2 : 0.32);
            belt(900, 30, 48, sunlight ? 0.1 : 0.16);
        }
        if (s.get_boolean('show-orbits')) {
            for (const b of this._bodies.slice(1)) {
                const pts = this._orbitPath(b.id);
                const minor = SMALL_PLANETS.includes(b.id);
                Render.strokePath(cr, pts, Render.hexToRgb(BODY[b.id].color), b.id === 'pluto' ? 0.13 : minor ? 0.1 : 0.2, 1,
                    b.id === 'pluto' || minor ? [3, 4] : null);
            }
        }
        cr.$dispose();
    }

    // Projected orbit; orbits drift so slowly that a decade-old one is fine.
    _orbitPath(id) {
        const hit = this._orbitCache.get(id);
        if (hit && Math.abs(hit.jd - this._jd) < 3650)
            return hit.pts;
        const pts = Astro.orbitPoints(Astro.planetOrbit(id, this._jd)).map(p => this._proj.project(p));
        this._orbitCache.set(id, {jd: this._jd, pts});
        return pts;
    }

    // ---- Per frame ----

    tick(dt) {
        if (!this._proj)
            return;
        this._realTime += dt;
        // Ease toward the zoom asked for.
        // Paused, the orbits run on at the view's own pace (up close) or the
        // spin clock (our Moon), while the date stands still.
        if (!this._timeRuns() && this._spinning() && !this._restarting && !(this._live() && !this._browsing)) {
            this._drift += dt * (this._focus ? this._dps()
                : 1 / this._settings.get_double('seconds-per-earth-day'));
        }
        const dz = this._zoomTarget - this._zoomOut;
        if (Math.abs(dz) > 1e-4) {
            this._zoomOut = Math.abs(dz) < 0.002 ? this._zoomTarget : this._zoomOut + dz * Math.min(1, dt * 5);
            this._applyCamera();
        }
        this._advance(dt);
        this._updateTour(dt);
        this._updateAll(dt);
        if (this._timelineMode === 'auto' && this._timeline.shown && !this.interacting && !this._timeline.actor.hover && !this._panel.isOpen)
            this._timeline.hide();
    }

    _updateAll(dt) {
        // Up close, the system behind is hidden once the flight in is over.
        const system = !this._focus || this._system.visible;
        if (system) {
            this._updateBodies();
            this._updateCraft();
        }
        if (this._focus) {
            this._focus.update(this._jd + this._drift);
            const featured = it => sameSubject(this._subject(), it.tr ? {tr: it.tr} : {id: it.id}) ||
                sameSubject(this._hover, it.tr ? {tr: it.tr} : {id: it.id});
            this._focus.placeLabels(featured);
        }
        this._fireEvents();
        this._updateCards(dt);

        this._trailClock += dt;
        if (dt === 0 || this._trailClock >= 1 / TRAIL_HZ) {
            this._trailClock = 0;
            this._updateTrails();
            this._updateTrojans();
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
        if (system)
            this._declutter();
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
            const p = b.id === 'sun' ? [0, 0, 0] : Astro.planetPosition(b.id, this._jd);
            b.pos = p;
            const [x, y, depth] = this._proj.project(p);
            b.x = x;
            b.y = y;
            b.actor.set_translation(x - b.size / 2, y - b.size / 2, 0);
            order.push([depth, b.actor]);
            if (b.label) {
                const w = b.label.width || b.label.get_preferred_width(-1)[1];
                const r = b.R * (this._bodyScale ?? 1);
                b.label.set_translation(Math.round(x - w / 2), Math.round(y + r + 3 + (b.id === 'saturn' ? r * 0.5 : 0)), 0);
            }
            if (b.id === 'sun')
                continue;

            // Spin: one Earth day lasts spinDay seconds; others in proportion.
            // When spinning is off, the planets keep the face they had.
            if (spinning) {
                const hours = BODY[b.id].rotationHours;
                b.phase = wrapAngle(2 * Math.PI * this._realTime / (Math.abs(hours) / 23.9345 * spinDay) * Math.sign(hours));
            }
            b.light = Astro.unit(this._proj.view(Astro.scale(p, -1)));
            // Redraw only when something moved by most of a pixel, at most 20 times a second.
            if (b.drawn === null || (Math.abs(wrapAngle(b.phase - b.drawn.phase)) * b.R > 0.8 &&
                this._realTime - b.drawn.at > 0.05)) {
                b.drawn = {phase: b.phase, at: this._realTime};
                b.surface.queue_repaint();
            }
            if (!b.shaded || b.R * Math.sqrt(Math.max(0, 2 * (1 - Astro.dot(b.light, b.shaded)))) > 0.6) {
                b.shaded = b.light;
                b.shade.queue_repaint();
                for (const m of b.moons)
                    m.area.queue_repaint();
            }
            this._updateMoons(b, spinDay);
        }
        if (spinning)
            this._moonClock = this._realTime;
        this._updateMarkers();

        this._updateSmallBodies();

        // Painter's order: farther from the camera first.
        order.sort((a, b) => a[0] - b[0]);
        const actors = order.map(([, a]) => a);
        if (actors.some((a, i) => a !== this._stacking?.[i])) {
            actors.forEach((a, i) => this._world.set_child_above_sibling(a, i ? actors[i - 1] : null));
            this._stacking = actors;
        }
    }

    _updateMoons(b, spinDay) {
        if (!b.moons.length)
            return;
        const c = b.size / 2;
        for (const m of b.moons) {
            let a;
            if (m.id === 'moon') {
                // Our Moon sits where it really is.
                a = Astro.moonAngle(m.data, this._jd + this._drift);
            } else {
                a = m.phase0 + 2 * Math.PI * this._moonClock / (Math.abs(m.data.period) * spinDay) * Math.sign(m.data.period);
            }
            const [ca, sa] = [Math.cos(a), Math.sin(a)];
            const dx = m.r * (ca * m.e1[0] + sa * m.e2[0]);
            const dy = -m.r * (ca * m.e1[1] + sa * m.e2[1]);
            const front = ca * m.e1[2] + sa * m.e2[2] > 0;
            m.x = b.x + dx;
            m.y = b.y + dy;
            m.area.set_translation(Math.round(c + dx - m.size / 2), Math.round(c + dy - m.size / 2), 0);
            if (front !== m.front) {
                m.front = front;
                if (front)
                    b.actor.set_child_above_sibling(m.area, null);
                else
                    b.actor.set_child_above_sibling(m.area, b.orbits);
            }
            if (m.label) {
                m.label.visible = true;   // _declutter() decides
                const w = m.label.width || m.label.get_preferred_width(-1)[1];
                m.label.set_translation(Math.round(m.x - w / 2), Math.round(m.y + m.R + 2), 0);
            }
        }
    }

    _smallVisible(x) {
        const s = x.data, jd = this._jd;
        if (s.show === 'always')
            return this._settings.get_boolean('show-small-bodies');
        if (s.show === 'far')
            return this._settings.get_boolean('show-small-bodies') && this._zoomOut > 0.05;
        if (Array.isArray(s.show))
            return this._settings.get_boolean('show-small-bodies') && jd > Astro.jd(s.show[0]) && jd < Astro.jd(s.show[1]);
        return this._settings.get_boolean('show-missions') &&
            (this._smallWindows.get(x.id) ?? []).some(([t0, t1]) => jd > t0 && jd < t1);
    }

    // Comets (with a tail pointing away from the Sun, longer up close) and
    // asteroids, each while it is of interest.
    _updateSmallBodies() {
        const [sx, sy] = [this._proj.cx, this._proj.cy];
        for (const x of this._smalls) {
            const on = this._smallVisible(x);
            if (on !== x.shown) {
                x.shown = on;
                x.sprite.area.visible = on;
            }
            if (!on) {
                x.label?.hide();
                continue;
            }
            const p = Astro.bodyPosition(x.id, this._jd);
            const [px, py] = this._proj.project(p);
            x.pos = p;
            x.x = px;
            x.y = py;
            x.sprite.moveTo(px, py);
            if (x.data.comet) {
                const r = Astro.norm(p);
                const angle = Math.atan2(py - sy, px - sx);
                const len = r < 4 ? this._unit * 5 * (4 - r) / 3 : 0;
                const d = x.drawn;
                if (!d || Math.abs(wrapAngle(angle - d[0])) > 0.03 || Math.abs(len - d[1]) > 0.5) {
                    x.tail = [angle, len];
                    x.drawn = [angle, len];
                    x.sprite.repaint();
                }
            }
            if (x.label) {
                const featured = sameSubject(this._subject(), {id: x.id}) || sameSubject(this._hover, {id: x.id});
                x.label.visible = featured || x.data.comet || this._smallNear(x.id);
                if (x.label.visible) {
                    const w = x.label.width || x.label.get_preferred_width(-1)[1];
                    x.label.set_translation(Math.round(px - w / 2), Math.round(py + 5), 0);
                }
            }
        }
    }

    // Is a mission at (or within a few months of) this asteroid?
    _smallNear(id) {
        return this._events.some(ev => ev.at === id && Math.abs(ev.t - this._jd) < 120) ||
            this._trajectories.some(tr => tr.segmentAt(this._jd)?.body === id);
    }

    // L1 and L2 are only 1.5 million km from Earth, far too close to see at
    // this scale, so they are drawn a little way out along the Sun-Earth
    // line, past the Moon. The others sit where they really are.
    _updateMarkers() {
        if (!this._lpoints.length)
            return;
        const earth = this._bodyById('earth');
        const [dx, dy] = [this._proj.cx - earth.x, this._proj.cy - earth.y];
        const n = Math.hypot(dx, dy) || 1;
        const k = Math.max(earth.R * 3.2, (earth.moons[0]?.r ?? earth.R * 2) + 9);
        for (const x of this._lpoints) {
            if (x.id === 'l1' || x.id === 'l2') {
                const s = x.id === 'l1' ? k : -k;
                [x.x, x.y] = [earth.x + dx / n * s, earth.y + dy / n * s];
            } else {
                [x.x, x.y] = this._proj.project(Astro.bodyPosition(x.id, this._jd));
            }
            x.sprite.moveTo(x.x, x.y);
            if (x.label) {
                x.label.visible = this._markerLayer.visible;   // then _declutter() decides
                const w = x.label.width || x.label.get_preferred_width(-1)[1];
                x.label.set_translation(Math.round(x.x - w / 2), Math.round(x.y + 5), 0);
            }
        }
    }

    // A swarm of dots 60 degrees either side of Jupiter: the Trojans.
    _updateTrojans() {
        const jup = this._bodyById('jupiter');
        // (Up close the system is not updated, so after a relayout its
        // planets have no positions yet.)
        if (!this._settings.get_boolean('show-belts') || !jup?.pos) {
            this._trojans.hide();
            return;
        }
        if (this._trojansDrawn && Math.hypot(jup.x - this._trojansDrawn[0], jup.y - this._trojansDrawn[1]) < 1.5)
            return;
        this._trojansDrawn = [jup.x, jup.y];
        if (!this._trojanCloud) {
            const rnd = Render.seeded(1772);
            const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 0.5;
            this._trojanCloud = Array.from({length: 520}, (_, i) =>
                [(i % 2 ? 60 : -60) + gauss() * 11, 1 + gauss() * 0.035, gauss() * 0.12, 0.35 + rnd() * 0.65]);
        }
        const o = Astro.planetOrbit('jupiter', this._jd);
        const n = Astro.unit(Astro.cross(o.p, o.q));
        const p = jup.pos;
        const pts = this._trojanCloud.map(([dl, dr, dz, a]) => {
            const q = Astro.add(Astro.scale(Astro.rotateAbout(p, n, dl), dr), Astro.scale(n, dz * Astro.norm(p)));
            return [...this._proj.project(q).slice(0, 2), a];
        });
        this._trojans.update(pts, [this._W, this._H], cr => Render.drawDots(cr, pts, 0.28, 0.55));
    }

    _bodyById(id) {
        return this._bodies.find(b => b.id === id) ?? this._smalls?.find(x => x.id === id) ??
            this._lpoints?.find(x => x.id === id) ?? this._moonById(id);
    }

    _moonById(id) {
        for (const b of this._bodies) {
            const m = b.moons?.find(x => x.id === id);
            if (m)
                return m;
        }
        return null;
    }

    _updateCraft() {
        const show = this._settings.get_boolean('show-missions');
        const showLabels = this._settings.get_boolean('show-labels');
        const sunlight = this._settings.get_boolean('sunlight-view');
        const {left, right} = this._area;
        const {sceneTop: top, sceneBottom: bottom} = this._slots;
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
                // Circle the body it orbits (or loop around its Lagrange point).
                const b = this._bodyById(seg.body);
                const ang = this._realTime * 2 * Math.PI / 6 + 2 * Math.PI * hashUnit(tr.mission.id);
                const rr = (b?.R ?? 2) + (LPOINT[seg.body] ? 2 + 3 * hashUnit(`${tr.mission.id}r`) : 5);
                [x, y] = [(b?.x ?? 0) + rr * Math.cos(ang), (b?.y ?? 0) + rr * Math.sin(ang) * 0.55];
            } else if (tr.lunar) {
                [x, y] = this._lunarSpot(tr);
            } else if (seg.hop) {
                // Short trips near a planet slide between the places as drawn,
                // since L1 and L2 are drawn away from their true spots.
                const [a, b] = [this._screenOf(seg.from), this._screenOf(seg.to)];
                const k = smooth((this._jd - seg.t0) / (seg.t1 - seg.t0));
                [x, y] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
            } else {
                [x, y] = this._proj.project(seg.pos(this._jd));
            }
            tr.now = [x, y];
            const onScreen = x > left + inset && x < right - inset && y > top + inset && y < bottom - inset;
            tr.marker.area.visible = onScreen;
            tr.marker.moveTo(x, y);
            const featured = sameSubject(this._selected, {tr}) || sameSubject(this._hover, {tr});
            // Telescopes crowd around L1 and L2, so they are named only on request,
            // and Moon missions crowd around Earth.
            tr.label.visible = onScreen && (showLabels && !tr.mission.group || featured);
            if (tr.label.visible) {
                // Far craft can project near the Sun when they climb out of
                // the ecliptic toward or away from the camera; say how far.
                const r = Astro.norm(seg.pos(this._jd));
                const name = tr.mission.short ?? tr.mission.name;
                let text = r > 40 && seg.kind !== 'stay' ? `${name} · ${r.toFixed(0)} AU` : name;
                if (sunlight)
                    text += ` · ${Astro.formatRatio(Astro.irradiance(r) / Astro.SOLAR_CONSTANT)} sun`;
                if (tr.label.text !== text)
                    tr.label.text = text;
                tr.label.set_translation(Math.round(x + 7), Math.round(y - 7), 0);
            }

            tr.edge.visible = !onScreen;
            if (!onScreen) {
                const r = Astro.norm(seg.pos(this._jd));
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

    // Hide names that would land on top of more important ones: planets
    // first, then whatever is picked or pointed at, spacecraft, comets,
    // asteroids and Lagrange points.
    _declutter() {
        const featured = s => sameSubject(this._subject(), s) || sameSubject(this._hover, s);
        const items = [];
        const add = (actor, prio) => {
            if (actor?.visible)
                items.push([prio, actor]);
        };
        for (const b of this._bodies)
            add(b.label, this._zoomOut > 0.1 && b.id !== 'sun' ? 2 : 0);   // zoomed out, inner names give way
        for (const tr of this._trajectories)
            add(tr.label, featured({tr}) ? 1 : 2);
        for (const x of this._smalls)
            add(x.label, featured({id: x.id}) ? 1 : x.data.comet ? 3 : 4);
        for (const x of this._lpoints)
            add(x.label, featured({id: x.id}) ? 1 : 5);
        for (const b of this._bodies) {
            for (const m of b.moons)
                add(m.label, featured({id: m.id}) ? 1 : 3);
        }
        items.sort((a, b) => a[0] - b[0]);
        const placed = [];
        for (const [prio, actor] of items) {
            const w = actor.width || actor.get_preferred_width(-1)[1];
            const h = actor.height || actor.get_preferred_height(-1)[1];
            const [x0, y0] = [actor.translation_x, actor.translation_y];
            const r = [x0 + 1, y0 + 2, x0 + w - 1, y0 + h - 2];
            if (prio > 1 && placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]))
                actor.visible = false;
            else
                placed.push(r);
        }
    }

    // Where an event's place is drawn on screen.
    // Missions to the Moon: Earth's neighborhood drawn with the Moon on its
    // ring, and the craft near the Moon around its dot.
    _lunarSpot(tr) {
        const earth = this._bodyById('earth');
        const m = earth.moons.find(x => x.id === 'moon');
        const k = (m?.r ?? earth.R * 2 + 6) / 384400;
        const place = v => {
            const d = this._proj.view(v);
            return [earth.x + d[0] * k, earth.y - d[1] * k, d[2] * k];
        };
        const moon = m ? [m.x, m.y, 0] : place(Astro.moonPosition(this._jd));
        const p = tr.screen(this._jd, {place, moon, R: Math.max(2, m?.R ?? 2), view: v => this._proj.view(v)});
        return p ?? [earth.x, earth.y];
    }

    _screenOf(ev) {
        const b = ev?.at && this._bodyById(ev.at);
        if (b)
            return [b.x, b.y];
        return ev ? this._proj.project(ev.via ?? Astro.bodyPosition(ev.at ?? 'earth', ev.t)).slice(0, 2) : [0, 0];
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
                Render.strokePath(cr, ahead, rgb, 0.16, 1, [2, 4]);
                Render.strokeTrail(cr, pts, rgb, width);
            }
        });
    }

    // ---- Events and fact cards ----

    _fireEvents() {
        if (!this._events || (this._live() && !this._browsing && !this._tour))
            return;
        while (this._eventIndex < this._events.length && this._events[this._eventIndex].t <= this._jd) {
            const ev = this._events[this._eventIndex++];
            if (!this._settings.get_boolean('show-missions') || !this._settings.get_boolean('show-facts') || this._isFar && !this._tour)
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
        let y = this._slots.eventBottom;
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
            const target = c.tr ? this._target({tr: c.tr}) : null;
            c.card.leader.visible = !!target;
            c.card.ring.visible = !!target;
            if (target)
                c.card.aim(target[0], target[1], target[2]);
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
        if (this._focus)
            return this._focus.targetOf(subject);
        if (subject.tr) {
            const n = subject.tr.now;
            return n && subject.tr.marker?.area.visible ? [n[0], n[1], 6] : null;
        }
        const b = this._bodyById(subject.id);
        return b && b.x !== undefined && b.shown !== false ? [b.x, b.y, b.R + 4] : null;
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
                const last = [...tr.milestones].reverse().find(ev => ev.t <= jd && ev.note);
                const status = missionStatus(tr, jd);
                subject = {tr};
                color = tr.mission.color;
                content = {
                    title: tr.mission.name,
                    subtitle: `${tr.mission.agency} · launched ${Astro.formatDate(tr.launch)}`,
                    lines: [status, last ? `${eventDate(last, true)}: ${last.note}` : null],
                };
            }
        }
        if (!content) {
            // Mostly the planets and the Sun; every fourth card, a moon, a
            // comet, an asteroid on screen or a Lagrange point.
            const extras = [
                ...this._bodies.flatMap(b => b.moons.map(m => m.id)),
                ...this._smalls.filter(x => x.shown).map(x => x.id),
                ...this._lpoints.map(x => x.id),
            ];
            // Up close: the planet and what is around it.
            const pool = this._focus ? `focus:${this._focus.id}` : this._factCount % 4 === 1 && extras.length ? 'extras' : 'bodies';
            this._factOrder ??= {};
            if (!this._factOrder[pool]?.length) {
                const ids = this._focus ? [this._focus.id, ...this._focus.present]
                    : pool === 'extras' ? extras : this._bodies.map(b => b.id);
                this._factOrder[pool] = ids.map(id => [Math.random(), id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
            }
            let id = this._factOrder[pool].pop();
            if (!this._bodyById(id) && !this._focus?.has({id}))
                id = this._focus?.id ?? 'sun';
            subject = {id};
            color = placeColor(id);
            content = this._facts.card(id, jd);
        }
        this._factSubject = subject;
        // Clicking a fact card pins it and opens it up.
        const card = new Card(this._hud, content, color, this._cardWidth, {
            interactive: this._interactive(),
            onActivate: () => this._select(subject, {expand: true}),
        });
        card.place(this._area.right - this._margin - this._cardWidth, this._slots.cardTop);
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
        return subject.tr ? subject.tr.mission.color : placeColor(subject.id);
    }

    _details(subject) {
        if (subject.tr)
            return missionDetails(subject.tr, this._jd);
        const sunlightView = this._settings.get_boolean('sunlight-view');
        return details(subject.id, this._jd, {sunlightView, residents: this._residents(subject.id)});
    }

    // Missions staying at a place now, and those that stayed there before.
    _residents(id) {
        const now = [], past = [];
        for (const tr of this._trajectories) {
            const stays = tr.segments.filter(sg => (sg.kind === 'stay' || sg.phase === 'orbit' || sg.phase === 'surface') && sg.body === id);
            if (stays.some(sg => this._jd >= sg.t0 && this._jd < Math.min(sg.t1, tr.end)))
                now.push(tr.mission.id);
            else if (stays.some(sg => sg.t0 <= this._jd))
                past.push(tr.mission.id);
        }
        return {now, past};
    }

    // A link from a card: a place, or a spacecraft (if it is turned on).
    _follow(link) {
        if (link.mission) {
            const tr = this._trajectories.find(x => x.mission.id === link.mission);
            if (tr)
                this._select({tr}, {expand: true});
        } else if (this._bodyById(link.id)) {
            this._select({id: link.id}, {expand: true});
        }
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
        this._pin = new Card(this._hud, this._details(subject), this._subjectColor(subject), this._cardWidth, {
            expanded: expand || wasExpanded,
            onClose: () => this._deselect(),
            onEvent: ev => {
                this._tourYield();
                this._seek(ev.t, true, ev);
            },
            onLink: link => this._follow(link),
            onZoom: () => {
                this._tourYield();
                this._focusOn(subject.id);
            },
            onStory: subject.tr && subject.tr.mission.group !== 'observatory' ? () => this.startTour('story', subject.tr.mission.id) : null,
        });
        this._pin.place(this._area.right - this._margin - this._cardWidth, this._slots.cardTop);
        this._pin.setMaxHeight(this._slots.cardBottom - this._slots.cardTop);
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

    _refreshPin() {
        if (this._pin && this._selected)
            this._pin.update(this._details(this._selected));
    }

    // Path for the current subject: a brighter orbit, or the craft's whole
    // flight, flown part solid and the rest dashed.
    _showHighlight() {
        const subject = this._subject();
        if (!subject || !this._proj || this._focus) {
            this._highlight.hide();
            return;
        }
        const rgb = Render.hexToRgb(this._subjectColor(subject));
        const strong = !!this._selected;
        if (subject.tr) {
            const past = subject.tr.projected.filter(([, , t]) => t <= this._jd);
            const future = strong ? subject.tr.projected.filter(([, , t]) => t >= this._jd) : [];
            if (subject.tr.now && past.length)
                past.push(subject.tr.now);
            this._highlight.update([...past, ...future], [this._W, this._H], cr => {
                Render.strokePath(cr, past, rgb, strong ? 0.5 : 0.3, strong ? 1.6 : 1.2);
                Render.strokePath(cr, future, rgb, 0.22, 1, [3, 4]);
            });
        } else if (this._orbitOf(subject.id) && (strong || this._settings.get_boolean('show-orbits'))) {
            // A Lagrange point lights up its planet's orbit, faintly.
            const id = this._orbitOf(subject.id), faint = id !== subject.id;
            const pts = this._orbitPath(id);
            this._highlight.update(pts, [this._W, this._H], cr =>
                Render.strokePath(cr, pts, rgb, (strong ? 0.7 : 0.5) * (faint ? 0.5 : 1), strong ? 1.8 : 1.4, faint ? [2, 4] : null));
        } else {
            this._highlight.hide();
        }
        this._syncMoonOrbits();
    }

    // Whose orbit to trace for a place: its own, its host planet's for a
    // Lagrange point, none for moons and the Sun.
    _orbitOf(id) {
        if (LPOINT[id])
            return id.startsWith('j') ? 'jupiter' : 'earth';
        return id !== 'sun' && (BODY[id] || SMALL[id]) ? id : null;
    }

    // A planet's moon orbits (and names) show while it, or one of its moons,
    // is picked or pointed at.
    _syncMoonOrbits() {
        const parentOf = s => s && !s.tr ? MOON[s.id]?.parent ?? s.id : null;
        const featured = new Set([parentOf(this._subject()), parentOf(this._hover)]);
        for (const b of this._bodies) {
            if (!b.orbits)
                continue;
            const on = featured.has(b.id) && b.moons.length > 0;
            if (b.orbits.visible !== on) {
                b.orbits.visible = on;
                if (on)
                    b.orbits.queue_repaint();
            }
            for (const m of b.moons) {
                if (on && !m.label) {
                    m.label = label('orrery-moon-label', m.data.name.replace(/^The /, ''));
                    this._labels.add_child(m.label);
                } else if (!on && m.label) {
                    m.label.destroy();
                    m.label = null;
                }
            }
        }
    }

    // ---- Pointer ----

    _connectInput() {
        this.actor.connectObject('motion-event', (_a, event) => {
            const [sx, sy] = event.get_coords();
            const [, x, y] = this.actor.transform_stage_point(sx, sy);
            this._activity();
            // Over a card or the timeline, nothing in the scene is hovered.
            const onScene = global.stage.get_event_actor(event) === this.actor;
            this._setHover(onScene ? this._hitTest(x, y) : null, {x, y});
            return Clutter.EVENT_PROPAGATE;
        }, this);
        this.actor.connectObject('leave-event', () => {
            this._setHover(null);
            return Clutter.EVENT_PROPAGATE;
        }, this);
        // Clicks that land on a card or a button are theirs; let them be.
        const own = event => global.stage.get_event_actor(event) === this.actor;
        this.actor.connectObject('button-press-event', (_a, event) => {
            if (!own(event))
                return Clutter.EVENT_PROPAGATE;
            this._press = event.get_coords();
            if (event.get_button() === Clutter.BUTTON_SECONDARY)
                this._openBackgroundMenu(...this._press);
            return Clutter.EVENT_STOP;
        }, this);
        this.actor.connectObject('button-release-event', (_a, event) => {
            if (!own(event))
                return Clutter.EVENT_PROPAGATE;
            const [sx, sy] = event.get_coords();
            if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this._press ||
                Math.hypot(sx - this._press[0], sy - this._press[1]) > 6)
                return Clutter.EVENT_STOP;
            this._press = null;
            const [, x, y] = this.actor.transform_stage_point(sx, sy);
            const hit = this._hitTest(x, y);
            // A double click on a planet flies in to it.
            const time = event.get_time();
            const double = hit && sameSubject(hit, this._lastClick?.hit) && time - this._lastClick.time < 400;
            this._lastClick = {hit, time};
            if (double && !hit.tr && BODY[hit.id] && hit.id !== 'sun' && this._focus?.id !== hit.id) {
                this._select(hit);
                this._focusOn(hit.id);
            } else if (hit) {
                this._select(hit, {toggle: true});
            } else if (this._panel.isOpen) {
                this._togglePanel(false);
            } else {
                this._deselect();
            }
            return Clutter.EVENT_STOP;
        }, this);
        // The wheel zooms: out toward the stars, in to a planet.
        this.actor.connectObject('scroll-event', (_a, event) => {
            if (!own(event) || !this._interactive())
                return Clutter.EVENT_PROPAGATE;
            const dir = event.get_scroll_direction();
            let steps = 0;
            if (dir === Clutter.ScrollDirection.UP)
                steps = 1;
            else if (dir === Clutter.ScrollDirection.DOWN)
                steps = -1;
            else if (dir === Clutter.ScrollDirection.SMOOTH)
                steps = -event.get_scroll_delta()[1];
            // Smooth scrolling comes in small pieces; a jump to or from a
            // planet waits for a whole notch.
            this._wheelSum = (this._wheelSum ?? 0) + steps;
            const [sx, sy] = event.get_coords();
            const [, x, y] = this.actor.transform_stage_point(sx, sy);
            const atEdge = !this._focus && this._zoomTarget <= 0.001 && steps > 0 || this._focus && steps < 0;
            if (atEdge && Math.abs(this._wheelSum) < 1)
                return Clutter.EVENT_STOP;
            this._wheel(atEdge ? Math.sign(this._wheelSum) : steps, x, y);
            this._wheelSum = 0;
            this._activity();
            return Clutter.EVENT_STOP;
        }, this);
    }

    // We cover the wallpaper, so pass right clicks on to its menu.
    _openBackgroundMenu(x, y) {
        const bg = Main.layoutManager._bgManagers?.[this._monitorIndex ?? Main.layoutManager.primaryIndex]?.backgroundActor;
        const menu = bg?._backgroundMenu;
        if (!menu)
            return;
        Main.layoutManager.setDummyCursorGeometry(x, y, 0, 0);
        menu.open(BoxPointer.PopupAnimation.FULL);
    }

    _activity() {
        this._lastActivity = this._realTime;
        if (this._tour?.auto)
            this._endTour();
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
        if (this._focus)
            return this._focus.hitTest(x, y);
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
        // Moons, comets, asteroids and markers are small: a tight reach,
        // checked before the planets they sit next to.
        const points = [
            ...this._bodies.flatMap(b => b.moons),
            ...this._smalls.filter(sm => sm.shown),
            ...this._lpoints,
        ];
        for (const pt of points) {
            if (pt.x === undefined)
                continue;
            const d = Math.hypot(x - pt.x, y - pt.y);
            if (d < Math.max(5, pt.R + 3) && d < bestD)
                [best, bestD] = [{id: pt.id}, d];
        }
        if (best)
            return best;
        for (const b of this._bodies) {
            const d = Math.hypot(x - b.x, y - b.y);
            const reach = Math.max(b.R * (this._bodyScale ?? 1) + 5, 11);
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
            this._syncMoonOrbits();
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
            return p ? `${name} · ${Astro.norm(p).toFixed(Astro.norm(p) < 10 ? 2 : 0)} AU from the Sun` : name;
        }
        const id = subject.id;
        if (id === 'sun')
            return 'The Sun';
        if (SAT[id])
            return `${SAT[id].short ?? SAT[id].name} · ${SAT[id].kind}`;
        if (MOON[id])
            return id === 'moon' ? 'The Moon' : `${MOON[id].name} · moon of ${BODY[MOON[id].parent].name}`;
        if (LPOINT[id])
            return `${LPOINT[id].name} · ${LPOINT[id].where}`;
        const r = Astro.norm(Astro.bodyPosition(id, jd));
        const sunlight = this._settings.get_boolean('sunlight-view') ? ` · ${Astro.formatIrradiance(Astro.irradiance(r))}` : '';
        return `${placeName(id)} · ${r.toFixed(2)} AU${sunlight}`;
    }

    _drawHover() {
        const h = this._hover;
        if (!h || sameSubject(h, this._subject()) || this._focus) {
            this._hoverPath.hide();
            return;
        }
        const rgb = Render.hexToRgb(this._subjectColor(h));
        if (h.tr) {
            const pts = h.tr.projected.filter(([, , t]) => t <= this._jd);
            if (h.tr.now && pts.length)
                pts.push(h.tr.now);
            this._hoverPath.update(pts, [this._W, this._H], cr => Render.strokePath(cr, pts, rgb, 0.35, 1.3));
        } else if (this._orbitOf(h.id)) {
            const pts = this._orbitPath(this._orbitOf(h.id));
            this._hoverPath.update(pts, [this._W, this._H], cr => Render.strokePath(cr, pts, rgb, 0.45, 1.4));
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
            text = `${Astro.formatDate(h.ev.t)} · ${h.ev.mission.short ?? h.ev.mission.name} · ${eventTitle(h.ev)}`;
        else if (!text)
            text = Astro.formatMonth(h.t);
        this._showTooltip(text);
        const w = this._tooltip.get_preferred_width(-1)[1];
        const [, ty] = this._timeline.actor.get_position();
        const x = h.x - this.actor.get_transformed_position()[0] - w / 2;
        // Above the bar, or below it when the bar is at the top.
        this._placeTooltip(x, this._timelineTop ? ty + this._timeline.actor.height + 8 : ty - 30);
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
            // Cards, hover and hit areas still point at the old craft.
            for (const c of this._eventCards)
                c.card.dismiss();
            this._eventCards = [];
            if (this._factSubject?.tr) {
                this._factCard?.dismiss();
                this._factCard = null;
                this._factSubject = null;
            }
            if (this._hover?.tr)
                this._setHover(null);
            this._trailHits = [];
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
        } else if (TOUR_KEYS.includes(key)) {
            // A new choice of automatic tour starts afresh.
            if (this._tour?.auto)
                this._endTour();
            this._tourRest = this._realTime;
        } else if (key === 'days-per-second' || key === 'spin-planets') {
            this._syncTimelineState();
            this._updateHud();
        }
    }

    setMusicState(state) {
        this.musicState = state;
        this._syncTimelineState();
    }

    // Jump to the same date as another monitor's scene.
    setTime(jd) {
        if (!this._live())
            this._seek(jd);
    }

    // In the overview the desktop (and the scene with it) is hidden while
    // clones of it are shown, and hidden actors are not laid out. Lay out
    // whatever changed by hand so the clones stay up to date.
    syncHidden() {
        if (this.actor.mapped || !this.actor.get_parent())
            return;
        const box = this.actor.get_allocation_box();
        if (box.get_width() > 0)
            this.actor.allocate(box);
    }
}

export default class OrreryExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        migrateSettings(this._settings);
        // The scene on the main monitor; the others get scenes of their own
        // or copies of it (see _syncMonitors).
        this._others = [];
        this._scene = this._makeScene();

        const relayout = () => this._relayout();
        Main.layoutManager.connectObject('monitors-changed', relayout, this);
        global.display.connectObject('workareas-changed', relayout, this);
        this._settings.connectObject('changed', (_s, key) => {
            if (RELAYOUT_KEYS.includes(key))
                this._queueRelayout();
            else if (SCHEDULE_KEYS.includes(key))
                this._schedule();
            else if (HIDDEN_KEYS.includes(key))
                this._syncAnimation();
            else if (MUSIC_KEYS.includes(key))
                this._syncMusic();
            else if (key === 'show-in-overview')
                this._syncMirror();
            else if (key === 'sunlight-auto')
                this._syncSunlightAuto(true);
            else
                this._scenes.forEach(scene => scene.onSettingChanged(key));
            if (key === 'spin-planets')
                this._schedule();
        }, this);
        this._power = new PowerMonitor(() => {
            this._schedule();
            this._syncSunlightAuto();
        });

        // The overview and workspace switches show clones of the scenes
        // instead of the plain wallpaper.
        this._mirror = new SceneMirror(index => this._actorOn(index));
        this._syncMirror();
        Main.overview.connectObject('showing', () => this._recheck(), 'hidden', () => this._recheck(), this);

        this._music = new Music({
            onError: message => {
                this._settings.set_string('music-mode', 'muted');
                Main.notify('Orrery', `No music: ${message}`);
            },
        });
        this._syncMusic();

        this._relayout();
        this._lastTick = GLib.get_monotonic_time();
        this._coveredClock = 0;
        this._paused = false;
        this._musicHidden = false;
        this._idle = false;
        this._syncAnimation();
        this._schedule();
    }

    disable() {
        if (this._timer)
            GLib.source_remove(this._timer);
        if (this._relayoutId)
            GLib.source_remove(this._relayoutId);
        if (this._raiseId)
            GLib.source_remove(this._raiseId);
        if (this._recheckId)
            GLib.source_remove(this._recheckId);
        this._timer = this._relayoutId = this._raiseId = this._recheckId = 0;

        if (this._scene && this._settings.get_string('mode') === 'replay')
            this._settings.set_double('replay-jd', Math.min(this._scene.jd, Astro.jdNow()));
        Main.layoutManager.disconnectObject(this);
        global.display.disconnectObject(this);
        Main.overview.disconnectObject(this);
        this._settings.disconnectObject(this);
        this._mirror?.disable();
        this._mirror = null;
        this._music?.destroy();
        this._music = null;
        this._power?.destroy();
        this._power = null;
        this._clearOthers();
        this._scene?.destroy();
        this._scene = null;
        this._settings = null;
        clearCache();
    }

    // Every scene running, the main one first.
    get _scenes() {
        return this._scene ? [this._scene, ...this._others.filter(o => o.scene).map(o => o.scene)] : [];
    }

    // A scene in the background group: above the wallpaper, below every
    // window.
    _makeScene() {
        const scene = new OrreryScene(this._settings);
        scene.onActivity = () => this._wake();
        scene.onMusicToggle = () => this._settings.set_string('music-mode', nextMode(MUSIC_MODES, this._settings.get_string('music-mode')));
        scene.onOpenPrefs = () => this.openPreferences();
        scene.powerSaving = this._saving;
        scene.setMusicState(this._musicState ?? 'hidden');
        Main.layoutManager._backgroundGroup.add_child(scene.actor);
        return scene;
    }

    // What the desktop of a monitor shows: a scene, a copy, or nothing.
    _actorOn(index) {
        if (index === Main.layoutManager.primaryIndex)
            return this._scene?.actor ?? null;
        const other = this._others.find(o => o.index === index);
        return other?.scene?.actor ?? other?.copy ?? null;
    }

    _clearOthers() {
        for (const o of this._others) {
            o.scene?.destroy();
            o.copy?.destroy();
        }
        this._others = [];
    }

    _relayout() {
        const lm = Main.layoutManager;
        const monitor = lm.primaryMonitor;
        if (!monitor || !this._scene)
            return;
        this._scene.relayout(monitor, lm.getWorkAreaForMonitor(lm.primaryIndex));
        this._syncMonitors();
        this._raise();
    }

    // The other monitors: a solar system of their own (at the same date as
    // the main one), a copy of the main one fitted to the screen, or the
    // plain wallpaper. Rebuilt when the monitors or the choice change.
    _syncMonitors() {
        const lm = Main.layoutManager;
        const mode = this._settings.get_string('other-monitors');
        const monitors = mode === 'none' ? [] : lm.monitors.filter(m => m.index !== lm.primaryIndex);
        const key = `${mode}:${monitors.map(m => m.index).join()}`;
        const fresh = key !== this._othersKey;
        if (fresh) {
            this._othersKey = key;
            this._clearOthers();
            this._others = monitors.map(m => ({index: m.index}));
        }
        const main = this._scene.actor;
        for (const o of this._others) {
            const m = lm.monitors[o.index];
            if (mode === 'own') {
                o.scene ??= this._makeScene();
                o.scene.relayout(m, lm.getWorkAreaForMonitor(o.index));
                if (fresh)
                    o.scene.setTime(this._scene.jd);
            } else {
                if (!o.copy) {
                    o.copy = new St.Widget({style: 'background-color: black;', clip_to_allocation: true});
                    o.copy.add_child(new Clutter.Clone({source: main}));
                    lm._backgroundGroup.add_child(o.copy);
                }
                // Fitted whole and centered; the rest stays black.
                const k = Math.min(m.width / main.width, m.height / main.height);
                o.copy.set({x: m.x, y: m.y, width: m.width, height: m.height});
                o.copy.get_first_child().set({width: main.width, height: main.height, scale_x: k, scale_y: k,
                    x: Math.round((m.width - main.width * k) / 2), y: Math.round((m.height - main.height * k) / 2)});
            }
        }
        if (fresh) {
            this._mirror?.refresh();
            this._syncMusic();
        }
    }

    // Other desktop extensions (e.g. Depth Clock) also raise themselves in the
    // background group when they start or monitors change; raise once they are
    // done so the solar system stays on top.
    _raise() {
        if (this._raiseId)
            return;
        this._raiseId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this._raiseId = 0;
            const group = Main.layoutManager._backgroundGroup;
            for (const actor of [this._scene?.actor, ...this._others.map(o => o.scene?.actor ?? o.copy)]) {
                if (actor)
                    group.set_child_above_sibling(actor, null);
            }
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

    // The sunlight view follows the charger, if asked: switched when it is
    // plugged in or out (so a click on ☀ in between still holds).
    _syncSunlightAuto(force = false) {
        const s = this._settings;
        const mode = s?.get_string('sunlight-auto');
        if (!mode || mode === 'manual' || !this._power?.known)
            return;
        const charging = !this._power.onBattery;
        if (!force && charging === this._wasCharging)
            return;
        this._wasCharging = charging;
        const on = mode === 'charging' ? charging : !charging;
        if (s.get_boolean('sunlight-view') !== on)
            s.set_boolean('sunlight-view', on);
    }

    _syncMirror() {
        if (this._settings.get_boolean('show-in-overview'))
            this._mirror.enable();
        else
            this._mirror.disable();
        this._recheck();
    }

    // Play when not muted, and (unless it should carry on regardless) while
    // a desktop can be seen.
    _syncMusic() {
        if (!this._music)
            return;
        const s = this._settings;
        this._music.setSource(s.get_string('music-source'), s.get_string('music-folder'));
        this._music.setVolume(s.get_double('music-volume') / 100);
        const mode = s.get_string('music-mode');
        const want = mode !== 'muted' && !this._locked && (mode === 'continuous' || !this._musicHidden);
        if (want)
            this._music.play();
        else
            this._music.pause({release: mode === 'muted'});
        this._musicState = s.get_boolean('music-button') ? mode : 'hidden';
        this._scenes.forEach(scene => scene.setMusicState(this._musicState));
    }

    // What hides the desktop changed: look again now. Each see-through app
    // lets the animation, the music or both carry on behind it.
    _syncAnimation() {
        this._seeThrough = new Map();
        for (const [id, what] of Object.entries(this._settings.get_value('see-through-apps').deepUnpack()))
            this._seeThrough.set(id.toLowerCase().replace(/\.desktop$/, ''), what);
        this._recheck();
    }

    get _locked() {
        return Main.sessionMode.isLocked || Main.screenShield?.locked;
    }

    // Look again at once (the overview opened or closed) rather than at the
    // next once-a-second check.
    _recheck() {
        if (this._recheckId || !this._scene)
            return;
        // After the overview has finished changing state.
        this._recheckId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._recheckId = 0;
            if (this._check())
                this._schedule();
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
        if (s.get_boolean('adaptive-fps') && this._scenes.every(scene => scene.still))
            fps = Math.min(fps, STILL_FPS);
        return fps;
    }

    _interval() {
        return this._paused ? 1000 : Math.round(1000 / this._fps());
    }

    _schedule() {
        if (!this._settings)
            return;
        for (const scene of this._scenes)
            scene.powerSaving = this._saving;
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
            this._scenes.forEach(scene => scene.setDim(1));
        }
        // Paused, it comes to life while the pointer is on it.
        if (this._paused)
            this._recheck();
        else if (this._interval() !== this._intervalMs)
            this._schedule();
    }

    _tick() {
        const now = GLib.get_monotonic_time();
        const dt = Math.min(0.25, (now - this._lastTick) / 1e6);
        this._lastTick = now;

        // About once a second: can anyone see the desktop, is anyone there,
        // and is anything moving?
        this._coveredClock += dt;
        let again = GLib.SOURCE_CONTINUE;
        if (this._paused || this._coveredClock >= 1) {
            this._coveredClock = 0;
            if (this._check()) {
                this._timer = 0;   // this source ends by returning REMOVE
                this._schedule();
                again = GLib.SOURCE_REMOVE;
            }
        }
        if (!this._paused) {
            for (const scene of this._scenes) {
                this._safely(() => {
                    scene.tick(dt);
                    scene.syncHidden();
                });
            }
        }
        return again;
    }

    // A throw inside the timer would remove it and freeze everything, so
    // log it (once per message) and carry on.
    _safely(f) {
        try {
            f();
        } catch (e) {
            this._logged ??= new Set();
            if (!this._logged.has(e.message)) {
                this._logged.add(e.message);
                console.error(`Orrery: ${e.message}\n${e.stack}`);
            }
        }
    }

    // Update pause and dim states; true if the frame rate should change.
    _check() {
        const s = this._settings;
        // Hidden once every desktop showing the solar system is hidden.
        const shown = [Main.layoutManager.primaryIndex, ...this._others.map(o => o.index)];
        const hiddenFor = what => shown.every(index => this._coverage(index, what) * 100 >= s.get_int('pause-coverage'));
        const hidden = hiddenFor('animation'), musicHidden = hiddenFor('music');
        // Paused, it still moves while someone uses it; nobody sees it
        // behind the lock screen whatever the mode.
        const mode = s.get_string('animation');
        const paused = this._locked || (mode !== 'continuous' && hidden) ||
            (mode === 'paused' && !this._scenes.some(scene => scene.interacting));
        const minutes = s.get_int('idle-dim-minutes');
        const idle = minutes > 0 && global.backend.get_core_idle_monitor().get_idletime() > minutes * 60000;
        if (idle !== this._idle) {
            this._idle = idle;
            this._scenes.forEach(scene => scene.setDim(idle ? s.get_double('idle-brightness') / 100 : 1));
        }
        if (paused !== this._paused || musicHidden !== this._musicHidden) {
            this._paused = paused;
            this._musicHidden = musicHidden;
            this._syncMusic();
        }
        return this._interval() !== this._intervalMs;
    }

    // How much of a monitor's desktop windows hide, 0 to 1, for the animation
    // or the music. Maximized and fullscreen windows count as all of it;
    // otherwise sample a grid over the monitor. The windows of see-through
    // apps that let that carry on do not count.
    _coverage(index, what) {
        if (this._locked)
            return 1;
        // The overview shows the scene in its workspace cards and behind
        // them, unless that is turned off.
        if (Main.overview.visible)
            return this._mirror?.enabled ? 0 : 1;
        const area = Main.layoutManager.getWorkAreaForMonitor(index);
        const workspace = global.workspace_manager.get_active_workspace();
        const rects = [];
        for (const w of workspace.list_windows()) {
            if (w.minimized || w.get_monitor() !== index || !w.showing_on_its_workspace())
                continue;
            const type = w.get_window_type();
            if (type === Meta.WindowType.DESKTOP || type === Meta.WindowType.DOCK || this._seesThrough(w, what))
                continue;
            if (w.is_fullscreen())
                return 1;
            // is_maximized() arrived in GNOME 49; GNOME 48 has the properties.
            const maximized = w.is_maximized?.() ?? (w.maximized_horizontally && w.maximized_vertically);
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

    // Whether the animation or the music carries on behind this window: it
    // belongs to a see-through app, found by its app or, for windows the
    // shell cannot match to one, by its class.
    _seesThrough(w, what) {
        if (!this._seeThrough?.size)
            return false;
        const app = Shell.WindowTracker.get_default().get_window_app(w);
        const ids = [app?.get_id(), w.get_sandboxed_app_id(), w.get_wm_class(), w.get_wm_class_instance()]
            .filter(Boolean).map(id => id.toLowerCase().replace(/\.desktop$/, ''));
        const lets = this._seeThrough.get(ids.find(id => this._seeThrough.has(id)));
        return lets === 'both' || lets === what;
    }
}

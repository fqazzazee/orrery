#!/usr/bin/env python3
"""Fit waypoints so modeled spacecraft paths follow the real ones.

For each mission with a JPL Horizons trajectory, compare the model with
Horizons every 15 days and pin the worst point as a waypoint, until the
model stays within 4% of the distance from the Sun (or 0.02 AU) or the
mission has MAX waypoints. Writes lib/waypoints.js.

    tools/fit-waypoints.py [id ...]     (needs gjs and network access)
"""
import json, math, re, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'lib' / 'waypoints.js'
HORIZONS = {
    'mariner10': None, 'pioneer10': '-23', 'pioneer11': '-24', 'voyager1': '-31', 'voyager2': '-32',
    'galileo': '-77', 'ulysses': '-55', 'cassini': '-82', 'rosetta': '-226',
    'messenger': '-236', 'newhorizons': '-98', 'dawn': '-203', 'juno': '-61', 'hayabusa2': '-37',
    'osirisrex': '-64', 'parker': None, 'bepicolombo': '-121', 'solarorbiter': '-144', 'lucy': '-49',
    'psyche': '-255', 'juice': '-28', 'europaclipper': '-159', 'hera': '-91',
}
STEP, MAX = 15, 40
MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()


def horizons(**p):
    p = {k: f"'{v}'" for k, v in p.items()}
    p['format'] = 'json'
    with urllib.request.urlopen('https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(p), timeout=180) as r:
        return json.load(r)['result']


def cal(jd):
    # JD -> 'YYYY-MM-DD HH:MM' (UTC-ish; fine at this step size)
    z = jd + 0.5
    f, z = math.modf(z)
    a = int((z - 1867216.25) / 36524.25)
    a = z + 1 + a - a // 4
    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)
    day = b - d - int(30.6001 * e)
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    return f'{int(year):04d}-{int(month):02d}-{int(day):02d} {int(f * 24):02d}:00'


def real_path(hid, t0, t1):
    """Horizons positions every STEP days in [t0, t1], clipped to its coverage."""
    for _ in range(3):
        res = horizons(COMMAND=hid, EPHEM_TYPE='VECTORS', CENTER='500@10', START_TIME=cal(t0), STOP_TIME=cal(t1),
                       STEP_SIZE=f'{STEP} d', VEC_TABLE='2', OUT_UNITS='AU-D', REF_PLANE='ECLIPTIC', CSV_FORMAT='YES',
                       OBJ_DATA='NO')
        if '$$SOE' in res:
            rows = res.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()
            return [[float(f[0])] + [float(x) for x in f[2:5]] for f in (line.split(',') for line in rows)]
        m = re.search(r'(after|prior to) A\.D\. (\d{4})-([A-Z]{3})-(\d{2})', res)
        if not m:
            raise RuntimeError(res[-400:])
        y, mon, d = int(m[2]), MONTHS.index(m[3].title()) + 1, int(m[4])
        jd = 367 * y - (7 * (y + (mon + 9) // 12)) // 4 + 275 * mon // 9 + d + 1721013.5
        if m[1] == 'after':
            t1 = jd - 1
        else:
            t0 = jd + 1
    raise RuntimeError('no coverage')


def model(ids):
    out = subprocess.run(['gjs', '-m', str(ROOT / 'tools' / 'dump-paths.js'), '1', *ids],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def write(waypoints):
    lines = [
        '// Points on the real paths of some spacecraft (JPL Horizons, heliocentric',
        '// ecliptic J2000, AU), where the conic between two encounters strays from the',
        '// path actually flown: ion-engine cruises, engine burns, long loops.',
        '// [JD, x, y, z]. Made by tools/fit-waypoints.py.',
        '',
        'export const WAYPOINTS = {',
    ]
    for mid in sorted(waypoints):
        if waypoints[mid]:
            lines.append(f'    {mid}: [')
            for t, x, y, z in sorted(waypoints[mid]):
                lines.append(f'        [{t:.1f}, {x:.5f}, {y:.5f}, {z:.5f}],')
            lines.append('    ],')
    lines.append('};')
    OUT.write_text('\n'.join(lines) + '\n')


def current():
    text = OUT.read_text()
    got = {}
    for m in re.finditer(r'(\w+): \[\n(.*?)\n    \]', text, re.S):
        got[m[1]] = [list(map(float, row)) for row in re.findall(r'\[([\d.-]+), ([\d.-]+), ([\d.-]+), ([\d.-]+)\]', m[2])]
    return got


def main(ids):
    waypoints = current()
    # Parker's resonant Venus loops already match; waypoints would split them.
    for mid, hid in HORIZONS.items():
        if not hid:
            waypoints.pop(mid, None)
    targets = [m for m in (ids or HORIZONS) if HORIZONS.get(m)]
    for mid in targets:
        waypoints[mid] = []
        write(waypoints)
        path = model([mid])[mid]
        days = {round(p[0], 1): p for p in path}
        real = real_path(HORIZONS[mid], path[0][0], path[-1][0])
        for _ in range(MAX):
            pts = {round(p[0], 1): p for p in model([mid])[mid]}
            worst, pick = 0, None
            for t, x, y, z in real:
                p = pts.get(round(t - 0.0, 1)) or pts.get(round(math.floor(t) + 0.5 if t % 1 else t, 1))
                p = p or min(pts.values(), key=lambda q: abs(q[0] - t))
                if abs(p[0] - t) > 1 or p[4] not in ('fly',):
                    continue
                d = math.dist(p[1:4], (x, y, z))
                r = math.hypot(x, y, z)
                score = d / max(0.02, 0.04 * r)
                # Keep away from other waypoints and encounters.
                if score > worst and all(abs(t - w[0]) > 20 for w in waypoints[mid]):
                    worst, pick = score, [round(t, 1), x, y, z]
            if worst <= 1 or not pick:
                break
            waypoints[mid].append(pick)
            write(waypoints)
        else:
            worst = max(math.dist(p[1:4], q[1:]) / max(0.02, 0.04 * math.hypot(*q[1:]))
                        for q in real for p in [min(model([mid])[mid], key=lambda p: abs(p[0] - q[0]))]
                        if abs(p[0] - q[0]) <= 1 and p[4] == 'fly')
        print(f'{mid:14s} {len(waypoints[mid]):2d} waypoints, worst left {worst:.2f}', flush=True)
    write(waypoints)


if __name__ == '__main__':
    main(sys.argv[1:])

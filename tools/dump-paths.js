// Prints each mission's modeled position every `step` days as JSON:
// {id: [[jd, x, y, z, kind], ...]}. Used by fit-waypoints.py.
//   gjs -m tools/dump-paths.js [step] [id ...]
import System from 'system';

import {buildTrajectories, MISSIONS} from '../lib/missions.js';

const [step = '15', ...ids] = System.programArgs;
const out = {};
for (const tr of buildTrajectories(MISSIONS.filter(m => !ids.length || ids.includes(m.id)))) {
    const pts = [];
    const end = Math.min(tr.end, tr.launch + 40 * 365.25);
    for (let t = tr.launch + 10; t < end; t += +step) {
        const s = tr.segmentAt(t);
        if (s)
            pts.push([t, ...s.pos(t), s.hop ? 'hop' : s.kind]);
    }
    out[tr.mission.id] = pts;
}
print(JSON.stringify(out));

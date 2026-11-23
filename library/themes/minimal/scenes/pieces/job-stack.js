import {scene, h, set, esc, popIn, chip, stamp, slamStyle, icon, lines, HERO, C} from '../../kit.js';

// Job-posting cards dealt into a fanned stack, one per time in `at`; at `stampAt` a stamp ("SKIP") slams onto
// each card in turn. With `agent` set, a small glowing badge (the AI doing the rejecting) pops above the stack.
// Times are seconds from the start of the shot.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', jobs: [{role: 'Senior Engineer', tags: ['Remote', 'Full-time']}, {role: 'Product Manager', tags: ['Hybrid']}, {role: 'Data Analyst', tags: ['On-site']}],
  at: [0, .25, .5], stamp: 'SKIP', stampColor: 'red', stampAt: 1.2, stampStep: .14, agent: 'AI', agentAt: .8,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const n = p.jobs.length, W = 760, H = 300, tone = {red: M.hue.red, green: M.hue.green, blue: M.hue.blue}[p.stampColor] ?? p.stampColor;
  const slots = p.jobs.map((job, i) => {
    const off = i - (n - 1) / 2, gap = n > 1 ? Math.min(240, 780 / (n - 1)) : 0, cx = HERO.x + off * 40, cy = HERO.y + off * gap + (n > 4 ? 300 : 150), rot = off * 2.5;
    const c = h(root, 'a mn-card', {left: cx - W / 2, top: cy - H / 2, width: W, height: H, padding: '38px 44px', zIndex: i});
    h(c, '', {display: 'flex', alignItems: 'center', gap: 20},
      `<div style="width:70px;height:70px;border-radius:18px;background:${M.raised};border:1.5px solid ${M.line};display:flex;align-items:center;justify-content:center">${icon('briefcase', 36, M.dim)}</div>
       <div style="flex:1"><div style="font:700 40px/1.15 Inter;color:${M.ink};letter-spacing:-.01em">${esc(job.role)}</div><div class="skel" style="width:220px;height:14px;margin-top:12px"></div></div>`);
    const tags = h(c, '', {display: 'flex', gap: 12, marginTop: 30});
    for (const tag of job.tags ?? []) chip(tags, tag, 'plain', {dot: false, css: {height: 46, fontSize: 22, letterSpacing: '.02em', fontWeight: 600}});
    const ph = h(c, '', {position: 'relative', height: 30, marginTop: 24}); lines(ph, 0, 0, W - 120, 1, {seed: i + 2, last: .7});
    const st = p.stamp ? stamp(root, p.stamp, tone, {size: 84, rotate: -10 + i * 4, seed: i + 3}) : null;
    if (st) { st.style.zIndex = 10 + i; set(st, {left: cx + 150, top: cy}); }
    return {c, st, rot, at: p.at[i] ?? i * .25, stampAt: p.stampAt + i * p.stampStep};
  });
  const badge = p.agent ? h(root, 'c', {left: HERO.x, top: HERO.y - 330, width: 150, height: 150, borderRadius: 40, background: 'linear-gradient(160deg,#ff9a3d,#f05a14)', boxShadow: '0 0 90px rgba(255,122,26,.65), inset 0 3px 0 rgba(255,255,255,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 60px/1 Inter', color: '#fff', zIndex: 20}, esc(p.agent)) : null;
  return {
    seek(t) {
      for (const s of slots) {
        popIn(s.c, t, s.at, `rotate(${s.rot}deg)`, {d: .45, from: .85, rise: 60});
        if (s.st) set(s.st, slamStyle(t, s.stampAt, s.st.rotate));
        set(s.c, {filter: t >= s.stampAt + .1 ? 'saturate(.4) brightness(.8)' : 'none'});
      }
      if (badge) popIn(badge, t, p.agentAt, 'translate(-50%,-50%)', {d: .5, from: .6});
    },
  };
}

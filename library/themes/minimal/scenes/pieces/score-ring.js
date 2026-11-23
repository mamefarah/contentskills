import {scene, h, set, esc, popIn, tick, stamp, slamStyle, jolt, glow, breathe, icon, span, expo, HERO, C} from '../../kit.js';

// A score out of `max` on a big ring gauge: the arc fills while the number ticks up, a tick marks the threshold.
// At or over the threshold the ring is green and a verdict chip says so; under it the ring turns red and a stamp
// slams ("SKIP"). Two small chips above show what is compared (resume ↔ role). Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'light', value: 4.3, max: 5, threshold: 4, label: 'Resume match', compare: ['Your resume', 'This role'], note: 'example',
  popAt: 0, fillAt: .3, fillFor: 1.1, verdict: 'Worth applying', stamp: 'SKIP', stampAt: 1.6,
  // Optional, for a busier scene: docsAt puts the two documents on screen (resume left, role right) and scans them;
  // matches = [{text, at, ok}] are the reasons, ticked or crossed under the ring; burst = rays when the fill lands.
  docsAt: null, matches: [], burst: false,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const docs = p.docsAt != null, good = p.value >= p.threshold, tone = good ? M.green : M.red, R = docs ? 225 : 270, cy = HERO.y + (docs ? 130 : 60);
  const halo = glow(root, HERO.x, cy, 900, good ? 'rgba(34,197,94,.22)' : 'rgba(229,72,77,.25)');
  const cmp = h(root, 'c', {left: HERO.x, top: cy - R - 150, display: 'flex', alignItems: 'center', gap: 20, whiteSpace: 'nowrap'});
  if (docs) cmp.style.display = 'none';
  // the two documents: a resume and a job post, each with a few lines, scanned by a beam, wired into the ring
  const cards = docs ? p.compare.map((c, i) => {
    const x = i ? 800 : 280, card = h(root, 'c mn-card', {left: x, top: cy - R - 215, width: 400, height: 210, padding: '26px 28px', overflow: 'hidden'});
    h(card, '', {display: 'flex', alignItems: 'center', gap: 14, font: '700 30px/1 Inter', color: M.ink}, `${icon(i ? 'briefcase' : 'doc', 32, M.hue.orange)}${esc(c)}`);
    for (const [wd, top] of [[.9, 82], [.7, 112], [.8, 142], [.5, 172]]) h(card, 'a skel', {left: 28, top, width: `${wd * 340}px`, height: 14});
    const beam = h(card, 'a', {left: 0, right: 0, top: 0, height: 70, background: `linear-gradient(180deg, transparent, color-mix(in srgb, ${M.hue.orange} 30%, transparent), transparent)`, opacity: 0});
    return {card, beam, i};
  }) : [];
  const wires = docs ? h(root, 'c', {left: HERO.x, top: cy - R - 60, width: 700, height: 160},
    `<svg width="700" height="160" viewBox="0 0 700 160"><path d="M90 0 C 90 90, 300 80, 350 160 M610 0 C 610 90, 400 80, 350 160" fill="none" stroke="${M.hue.orange}" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 14" pathLength="1000"/></svg>`) : null;
  const wirePath = wires?.querySelector('path');
  const rows = (p.matches ?? []).map(m => h(root, 'mn-chip ' + (m.ok === false ? 'red' : 'green'), {position: 'absolute', height: 58, fontSize: 25, padding: '0 22px', transform: 'translate(-50%,-50%)'}, `${m.ok === false ? '✕' : '✓'} ${esc(m.text)}`));
  rows.forEach((row, i) => set(row, {left: HERO.x + (i - (rows.length - 1) / 2) * 300, top: cy + R + 175}));
  const rays = p.burst ? h(root, 'c', {left: HERO.x, top: cy, width: 2 * R + 420, height: 2 * R + 420},
    `<svg width="${2 * R + 420}" height="${2 * R + 420}" viewBox="${-R - 210} ${-R - 210} ${2 * R + 420} ${2 * R + 420}">${Array.from({length: 14}, (_, i) => { const a = i / 14 * 2 * Math.PI; return `<line x1="${Math.cos(a) * (R + 50)}" y1="${Math.sin(a) * (R + 50)}" x2="${Math.cos(a) * (R + 150)}" y2="${Math.sin(a) * (R + 150)}" stroke="${tone}" stroke-width="10" stroke-linecap="round"/>`; }).join('')}</svg>`) : null;
  const [a, b] = p.compare.map((c, i) => h(cmp, 'mn-chip plain', {height: 66, fontSize: 28, letterSpacing: '.01em', fontWeight: 600, padding: '0 26px'}, `${icon(i ? 'briefcase' : 'doc', 30, M.dim)}${esc(c)}`));
  cmp.insertBefore(h(null, '', {font: '600 34px/1 Inter', color: M.fieldDim}, '↔'), b);
  const C2 = 2 * Math.PI * R, start = 135, sweep = 270;    // a 270° gauge open at the bottom
  const arc = f => `${(C2 * sweep / 360 * f).toFixed(1)} ${C2.toFixed(1)}`;
  const th = start + sweep * p.threshold / p.max, rad = th * Math.PI / 180;
  const svg = h(root, 'c', {left: HERO.x, top: cy, width: 2 * R + 240, height: 2 * R + 240},
    `<svg width="${2 * R + 240}" height="${2 * R + 240}" viewBox="${-R - 120} ${-R - 120} ${2 * R + 240} ${2 * R + 240}">
      <circle r="${R}" fill="none" stroke="${M.faint}" stroke-width="34" stroke-linecap="round" stroke-dasharray="${arc(1)}" transform="rotate(${start})"/>
      <circle class="val" r="${R}" fill="none" stroke="${tone}" stroke-width="34" stroke-linecap="round" stroke-dasharray="${arc(0)}" transform="rotate(${start})"/>
      <line x1="${Math.cos(rad) * (R - 40)}" y1="${Math.sin(rad) * (R - 40)}" x2="${Math.cos(rad) * (R + 40)}" y2="${Math.sin(rad) * (R + 40)}" stroke="${M.fieldInk}" stroke-width="6" stroke-linecap="round"/>
      <text x="${Math.cos(rad) * (R + 78)}" y="${Math.sin(rad) * (R + 78) + 12}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="34" fill="${M.fieldInk}">${p.threshold.toFixed(1)}</text>
    </svg>`);
  const val = svg.querySelector('.val');
  const num = h(root, 'c', {left: HERO.x, top: cy - 10, font: '800 210px/1 Inter', letterSpacing: '-.05em', color: M.fieldInk, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'});
  const lab = h(root, 'c', {left: HERO.x, top: cy + 130, font: '600 26px/1 "Inter Tight"', letterSpacing: '.3em', color: M.fieldDim, whiteSpace: 'nowrap', textTransform: 'uppercase'}, esc(p.label));
  const note = p.note ? h(root, 'c', {left: HERO.x, top: cy + R + ((p.matches ?? []).length ? 250 : 120), font: '500 22px/1 "JetBrains Mono"', color: M.fieldDim, opacity: .8}, esc(p.note)) : null;
  const verdict = good && p.verdict ? h(root, 'c', {left: HERO.x, top: cy + R + 50, whiteSpace: 'nowrap'}, `<span class="mn-chip green" style="height:70px;font-size:30px;padding:0 30px"><i></i>${esc(p.verdict)}</span>`) : null;
  const st = !good && p.stamp ? stamp(root, p.stamp, M.hue.red, {size: 130, rotate: -12, seed: 5}) : null;
  if (st) set(st, {left: HERO.x, top: cy + R + 40});
  return {
    seek(t) {
      const f = expo(span(t, p.fillAt, p.fillFor)) * p.value / p.max, k = jolt(t, p.stampAt, 12);
      popIn(svg, t, p.popAt, `translate(-50%,-50%) translateX(${st ? k : 0}px)`, {d: .5, from: .85});
      val.setAttribute('stroke-dasharray', arc(f));
      popIn(cmp, t, p.popAt + .1, 'translate(-50%,-50%)');
      num.innerHTML = t < p.fillAt ? '' : `${tick(t, p.fillAt, p.fillFor, p.value).toFixed(1)}<span style="font-size:.32em;color:${M.fieldDim};letter-spacing:0;font-weight:600">/${p.max}</span>`;
      popIn(num, t, p.fillAt, 'translate(-50%,-50%)', {d: .3, from: .9});
      popIn(lab, t, p.fillAt + .1, 'translate(-50%,-50%)');
      if (note) popIn(note, t, p.fillAt + .3, 'translate(-50%,-50%)');
      if (verdict) popIn(verdict, t, p.fillAt + p.fillFor * .8, 'translate(-50%,-50%)', {d: .4, from: .7});
      if (st) set(st, slamStyle(t, p.stampAt, -12));
      for (const {card, beam, i} of cards) {
        popIn(card, t, p.docsAt + i * .12, `translate(-50%,-50%) rotate(${i ? 3 : -3}deg)`, {d: .45, from: .6});
        const sweep = span(t, p.docsAt + .35, .9);
        set(beam, {opacity: sweep > 0 && sweep < 1 ? 1 : 0, top: `${-70 + sweep * 280}px`});
      }
      if (wirePath) { const f2 = span(t, p.docsAt + .5, .6); set(wires, {opacity: f2 > 0 ? 1 : 0}); wirePath.setAttribute('stroke-dashoffset', String(-t * 60)); wirePath.style.clipPath = `inset(0 0 ${(1 - expo(f2)) * 100}% 0)`; }
      (p.matches ?? []).forEach((m, i) => popIn(rows[i], t, m.at, 'translate(-50%,-50%)', {d: .35, from: .5}));
      if (rays) { const q = span(t, p.fillAt + p.fillFor, .55); set(rays, {opacity: q > 0 && q < 1 ? 1 - q : 0, transform: `translate(-50%,-50%) scale(${.8 + .45 * expo(q)})`}); }
      set(halo, {opacity: t >= p.fillAt + p.fillFor * .6 ? .7 + .3 * breathe(t, 2) : 0});
    },
  };
}

import {C, F, coastStage, rrect, label, measure, burst, poly, slam, shake, hash, span, clamp, easeOut, easeBack} from '../../coast.js';

// A cartoon shoot-out with two toy water pistols, one from each side of the frame: each sign stamps in, the pistols
// squirt at it (jets of water, splashes, cracks spreading on every hit) and it blows apart into shards on a comic
// BOOM burst. Toy water guns only, bright plastic with a water tank: never a real weapon.
// props.signs: [{text, color, tilt, at, shots: [s, …], boom}] (seconds from the piece's start); y: the signs' centre;
// gunY: the height of the pistols' grips (keep the jets above the speaker's head); boomText: the burst's word.
// Sound: put water_burst / water_shot on the shots and explosion on each boom in the storyboard.
export const meta = {duration: 1.7, live: true};
export const defaults = {
  signs: [{text: 'NO APPS', color: 'pink', tilt: -9, at: .07, shots: [.33, .45, .57], boom: .72},
    {text: 'NO EDITING', color: 'yellow', tilt: 7, at: .84, shots: [1.08, 1.2, 1.32], boom: 1.45}],
  y: 400, gunY: 700, gunX: 60, gunScale: .85, boomText: 'BOOM!',
};

const GUN_TIP = [282, -20];   // the nozzle, in the pistol's own drawing (grip at 0,0, pointing +x)
function pistol(g, {body, tank, trim}) {
  const s = {stroke: C.ink, 'stroke-width': 7, 'stroke-linejoin': 'round'}, at = (el, a) => { Object.entries({...s, ...a}).forEach(([k, v]) => el.attr(k, v)); return el; };
  at(g.append('path').attr('d', poly([[-6, 0], [58, 0], [44, 128], [-30, 122]])), {fill: body});                         // grip
  at(g.append('path').attr('d', 'M40 4 C40 46 92 46 96 8'), {fill: 'none', 'stroke-width': 9});                       // trigger guard
  at(g.append('path').attr('d', rrect(-34, -52, 270, 62, 26)), {fill: body});                                               // body and barrel
  at(g.append('path').attr('d', rrect(96, 6, 120, 34, 14)), {fill: trim});                                                  // pump
  at(g.append('path').attr('d', rrect(232, -36, 52, 32, 10)), {fill: C.yellow});                                            // nozzle
  at(g.append('path').attr('d', rrect(6, -132, 150, 86, 30)), {fill: tank, 'fill-opacity': .78});                           // the water tank
  g.append('path').attr('d', rrect(16, -96, 130, 44, 18)).attr('fill', C.sky).attr('opacity', .75);                          // water inside it
  g.append('path').attr('d', rrect(26, -122, 70, 14, 7)).attr('fill', '#fff').attr('opacity', .7);                           // glare
  g.append('path').attr('d', rrect(-14, -44, 180, 12, 6)).attr('fill', '#fff').attr('opacity', .35);
}

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root} = coastStage(el, {overlay: true}), CX = 540, CY = p.y;
  const layer = root.append('g'), jets = root.append('g'), fx = root.append('g');
  // ---- the signs, each cut into shards that fly apart on the boom
  const signs = p.signs.map((sg, si) => {
    const color = C[sg.color] ?? sg.color, size = Math.min(150, 150 * 700 / measure(sg.text, 150, F.display, .03));
    const w = measure(sg.text, size, F.display, .03) + 110, h = size * 1.25 + 20, g = layer.append('g'), cracks = [];
    const N = 9, cuts = Array.from({length: N}, (_, i) => (i + .25 + hash(i, si + 5) * .5) / N * Math.PI * 2);
    const shards = cuts.map((a0, i) => {
      const a1 = cuts[(i + 1) % N] + (i === N - 1 ? Math.PI * 2 : 0), R = w, cx = (hash(si, 9) - .5) * 40, cy = (hash(si, 8) - .5) * 20;
      const id = `ws${si}_${i}_${Math.floor(hash(si * 31 + i, 3) * 1e6)}`;
      g.append('clipPath').attr('id', id).append('path').attr('d', poly([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos((a0 + a1) / 2) * R * 1.3, cy + Math.sin((a0 + a1) / 2) * R * 1.3], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]]));
      const sh = g.append('g'), inner = sh.append('g').attr('clip-path', `url(#${id})`);
      inner.append('path').attr('d', rrect(-w / 2, -h / 2, w, h, 26)).attr('fill', C.paper).attr('stroke', color).attr('stroke-width', 14);
      inner.append('path').attr('d', rrect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40, 14)).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 5);
      label(inner, 0, size * .36, sg.text, {size, font: F.display, color, anchor: 'middle', spacing: .03});
      // a gentle spin: each shard carries the whole (clipped) sign, and a wide tilt would sweep its words up under the app's top bar
      return {sh, a: (a0 + a1) / 2, spin: (hash(i, si + 2) - .5) * 180, v: 700 + hash(i, si + 3) * 600};
    });
    sg.shots.forEach((ts, k) => [0, 1].forEach(side => {      // a crack where each jet hits
      const hx = (side ? 1 : -1) * (w * .18 + k * 28), hy = (k - 1) * 18, path = [[hx, hy]];
      for (let j = 1; j < 4; j++) path.push([hx + (hash(k * 7 + j, side + si * 3) - .5) * 120 * j / 2, hy + (hash(k * 5 + j, side + 11 + si) - .5) * 90 * j / 2]);
      cracks.push({at: ts + side * .06 + .08, el: g.append('path').attr('d', 'M' + path.map(q => q.join(' ')).join('L')).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 6).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round'), hx, hy});
    }));
    return {...sg, g, shards, cracks, w, h, color};
  });
  // ---- the two pistols
  const guns = [0, 1].map(side => {
    const outer = layer.append('g'), g = outer.append('g');
    pistol(g, side ? {body: C.teal, tank: C.aqua, trim: C.pink} : {body: C.orange, tank: C.aqua, trim: C.violet});
    return {side, outer, g};
  });
  const gx = p.gunX, gy = p.gunY;
  const aim = () => Math.atan2(CY - gy, CX - 120 - gx);   // both pistols aim at their half of the sign (the right one is drawn mirrored)
  const tip = (side, ang) => {          // the nozzle in frame pixels
    const [lx, ly] = GUN_TIP, k = p.gunScale, x = gx + k * (Math.cos(ang) * lx - Math.sin(ang) * ly), y = gy + k * (Math.sin(ang) * lx + Math.cos(ang) * ly);
    return side ? [1080 - x, y] : [x, y];
  };
  // jets and splashes: one per shot per side
  const shots = signs.flatMap((s, si) => s.shots.flatMap((ts, k) => [0, 1].map(side => {
    const at = ts + side * .06, drops = Array.from({length: 7}, (_, j) => jets.append('circle').attr('fill', j % 2 ? '#e9fdff' : C.aqua).attr('stroke', C.ink).attr('stroke-width', 4));
    const splash = Array.from({length: 9}, (_, j) => fx.append('circle').attr('fill', j % 3 ? C.aqua : '#fff').attr('stroke', C.ink).attr('stroke-width', 3));
    const muzzle = fx.append('path').attr('fill', '#fff').attr('stroke', C.ink).attr('stroke-width', 5);
    return {si, k, side, at, drops, splash, muzzle};
  })));
  const boomG = fx.append('g'), boomOuter = boomG.append('path').attr('fill', C.yellow).attr('stroke', C.ink).attr('stroke-width', 10);
  const boomInner = boomG.append('path').attr('fill', C.orange), boomCore = boomG.append('path').attr('fill', C.pink);
  const boomWord = label(boomG, 0, 34, p.boomText, {size: 150, font: F.comic, color: C.paper, anchor: 'middle', spacing: .02}).attr('stroke', C.ink).attr('stroke-width', 9).attr('paint-order', 'stroke');
  const spray = Array.from({length: 22}, (_, j) => fx.append('circle').attr('fill', j % 2 ? C.aqua : C.yellow).attr('stroke', C.ink).attr('stroke-width', 3));

  return {
    seek(t) {
      // which sign is up
      signs.forEach((s, si) => {
        const next = signs[si + 1], visible = t >= s.at && t < s.boom + .6 && (!next || t < next.at);
        s.g.attr('opacity', visible ? 1 : 0); if (!visible) return;
        const hits = s.shots.flatMap(ts => [ts + .08, ts + .14]).filter(h => t >= h), lastHit = hits.length ? Math.max(...hits) : -9;
        const [sx, sy] = shake(t, lastHit, 18), q = slam(t, s.at, .22) || .0001;
        s.g.attr('transform', `translate(${CX + sx} ${CY + sy}) rotate(${s.tilt}) scale(${q})`);
        const b = t - s.boom;
        s.shards.forEach(sh => {
          if (b < 0) { sh.sh.attr('transform', null).attr('opacity', 1); return; }
          const d = sh.v * b, fall = 1400 * b * b;
          const up = Math.sin(sh.a) < 0 ? .2 : .8;   // shards barely rise: the app's top bar is just above the sign
          sh.sh.attr('transform', `translate(${Math.cos(sh.a) * d} ${Math.sin(sh.a) * d * up + fall}) rotate(${sh.spin * b})`).attr('opacity', 1 - span(b, .1, .18));
        });
        s.cracks.forEach(c => c.el.attr('opacity', t >= c.at && b < 0 ? 1 : 0).attr('stroke-dasharray', 400).attr('stroke-dashoffset', 400 * (1 - easeOut(span(t, c.at, .1)))));
      });
      // the pistols: slide in from the sides, aim, kick back on each shot
      guns.forEach(gun => {
        const inQ = easeBack(span(t, .12, .22)), ang0 = aim(gun.side);
        const mine = shots.filter(s => s.side === gun.side && t >= s.at).map(s => t - s.at), k = mine.length ? Math.min(...mine) : 9;
        const kick = 14 * Math.exp(-k * 18) * (k < .3 ? 1 : 0), ang = ang0 - kick * Math.PI / 180, slide = (1 - inQ) * -420;
        const tr = `translate(${gx + slide - kick * 1.5} ${gy}) rotate(${ang * 180 / Math.PI}) scale(${p.gunScale})`;
        gun.outer.attr('transform', gun.side ? `translate(1080 0) scale(-1 1) ${tr}` : tr);
      });
      // jets, splashes, muzzle flashes
      shots.forEach(s => {
        const sign = signs[s.si], u = (t - s.at) / .09, ang = aim(s.side), [x0, y0] = tip(s.side, ang);
        const c = sign.cracks[s.k * 2 + s.side], rot = sign.tilt * Math.PI / 180;
        const x1 = CX + Math.cos(rot) * c.hx - Math.sin(rot) * c.hy, y1 = CY + Math.sin(rot) * c.hx + Math.cos(rot) * c.hy;
        s.drops.forEach((d, j) => {
          const f = u - j * .12; const on = f > 0 && f < 1.25 && t < sign.boom;
          const q = clamp(f), x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * 26;
          d.attr('cx', x).attr('cy', y).attr('r', on ? 17 - j * 1.6 : 0);
        });
        const sp = (t - s.at - .09) / .28;
        s.splash.forEach((d, j) => {
          const a = rot + (s.side ? -1 : 1) * 0 + j / 9 * Math.PI * 2 + hash(j, s.k) * .5, r = 30 + 110 * easeOut(clamp(sp)) * (.6 + hash(j, s.side) * .6);
          d.attr('cx', x1 + Math.cos(a) * r).attr('cy', y1 + Math.sin(a) * r + 80 * sp * sp).attr('r', sp > 0 && sp < 1 ? 12 * (1 - sp) + 3 : 0);
        });
        const mq = (t - s.at) / .08;
        s.muzzle.attr('d', mq > 0 && mq < 1 ? burst(x0, y0, 46 * (1 - mq * .4), 20, 8, s.k) : 'M0 0');
      });
      // the boom
      const sign = [...signs].reverse().find(s => t >= s.boom), b = sign ? t - sign.boom : -1;
      if (sign && b < .45) {
        const q = easeBack(span(b, 0, .16)), fade = 1 - span(b, .28, .14);
        boomG.attr('transform', `translate(${CX} ${CY}) rotate(${-6 + 4 * Math.sin(b * 20)}) scale(${q * (1 + .04 * Math.sin(b * 40))})`).attr('opacity', fade);
        boomOuter.attr('d', burst(0, 0, 330, 190, 16, b * 1.5)); boomInner.attr('d', burst(0, 0, 250, 150, 13, -b * 2)); boomCore.attr('d', burst(0, 0, 170, 105, 11, b));
        spray.forEach((d, j) => {
          const a = j / spray.length * Math.PI * 2 + hash(j, 4) * .3, r = 120 + 560 * easeOut(clamp(b / .5)) * (.5 + hash(j, 6) * .7);
          d.attr('cx', CX + Math.cos(a) * r).attr('cy', CY + Math.sin(a) * r * .75 + 500 * b * b).attr('r', (1 - clamp(b / .55)) * (8 + hash(j, 7) * 14));
        });
      } else { boomG.attr('opacity', 0); spray.forEach(d => d.attr('r', 0)); }
    },
  };
}

import {C, stage, group, rr, circle, line, text, image, topBar, keyboard, KEYS, KB_Y, iconPlus, iconSliders, iconMic, iconArrowUp, EDGE} from '../../ui.js';

// The Claude app composer with your clip attached. Types the slash command (autocomplete shows it),
// then the command's argument (autocomplete shows that too), and sends. It fills the frame with the app, so a plain overlay covers the footage.
// Timing: 0.15 s still, then 0.8 s of typing; the send lands at 0.9 s. While only "/" is typed, `menu` ([[command, description], ...])
// shows the app's slash-command list for `hold` extra seconds (the rest of the typing shifts later), like the real app (the first row should be the command itself).
// `prompt` types a plain message instead (no slash command): letter by letter over `typeFor` seconds (default 1.2), then send;
// `hold` delays the typing (the empty composer shows first). No `thumb`: nothing is attached.
// `dropAt` (seconds): the clip (`thumb`) is dragged in and dropped onto the composer at that moment (a drop zone lights up first).
// `pace` stretches the typing (1.6 = 1.6x slower; the overlay must be long enough: 0.15 + 0.8 x pace + hold s).
// Start it part-way ("offset" on the overlay, e.g. 0.25 s) for a cold open that is already typing on frame one.
export const meta = {duration: 0.95, live: true};   // live: a longer overlay (a "hold") keeps the timing running instead of freezing at 0.95 s
export const defaults = {command: '/effects', commandDesc: 'video effects for your clips', name: 'glitch', desc: 'the frame tears apart on a cut', thumb: '', menu: null, hold: 0, pace: 1, prompt: '', typeFor: 1.2, dropAt: null};

const START = .15;
function promptEvents(text, typeFor, hold = 0) {
  const chars = [...text], step = typeFor / Math.max(1, chars.length), out = [];
  chars.forEach((ch, i) => { const typed = chars.slice(0, i + 1).join(''), word = typed.split(/[\s/]/).pop();
    out.push([i * step, typed, null, ch === ' ' ? null : ch.toLowerCase(), word]); });
  out.push([typeFor + .12, text, null, 'send', '']);
  return out.map(e => [e[0] + hold, ...e.slice(1)]);
}
function events(cmd, name, hold = 0, pace = 1) {
  const first = name[0];
  return [[0, '/', 'cmd', '/', ''], [.1, '/' + cmd[1], 'cmd', cmd[1], cmd[1]], [.2, cmd.slice(0, 3), 'cmd', cmd[2], cmd.slice(1, 3)],
    [.35, cmd + ' ', null, null, ''], [.45, `${cmd} ${first}`, 'fx', first, first], [.6, `${cmd} ${name}`, null, null, ''],
    [.75, `${cmd} ${name}`, null, 'send', '']].map((e, i) => i ? [e[0] * pace + hold, ...e.slice(1)] : e);
}

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), base = group(svg), live = group(svg), ev = p.prompt ? promptEvents(String(p.prompt), Number(p.typeFor) || 1.2, Number(p.hold) || 0) : events(p.command, p.name, Number(p.hold) || 0, Number(p.pace) || 1);
  topBar(base);
  rr(base, 38, 815, 1048, 1220, 48, C.surf, EDGE);                                       // composer
  let drop = null;
  if (p.thumb) {                                                                    // the attached clip, with its remove button
    const att = group(base);
    image(att, p.thumb, 66, 840, 120, 168, 16);
    circle(att, 165, 861, 15, '#fafaf8'); line(att, [[159, 855], [171, 867]], '#141414', 3.5); line(att, [[171, 855], [159, 867]], '#141414', 3.5);
    if (p.dropAt != null) {                                                         // dragged in from above, then dropped
      const zone = rr(base, 46, 823, 1040, 1212, 42, 'none', {stroke: '#D97757', 'stroke-width': 5, 'stroke-dasharray': '18 12'});
      const fly = group(svg); image(fly, p.thumb, -110, -154, 220, 308, 22);
      const tag = text(fly, 0, 190, 'edit-this-one.MOV', 30, 600, '#fafaf8', 'middle');
      drop = {att, zone, fly, tag};
    }
  }
  iconPlus(base, 88, 1152); iconSliders(base, 162, 1152); iconMic(base, 888, 1152);
  keyboard(base);
  return {
    seek(t) {
      if (drop) {
        const d = Number(p.dropAt), k = Math.max(0, Math.min(1, (t - d + .55) / .55)), e = 1 - (1 - k) ** 3, landed = t >= d;
        const x = 840 - (840 - 126) * e, y = 380 + (924 - 380) * e, sc = 1 - .45 * Math.max(0, (t - d) / .12);
        drop.fly.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(8 * (1 - e)).toFixed(2)}) scale(${Math.max(.55, Math.min(1, sc)).toFixed(3)})`);
        drop.fly.setAttribute('opacity', t < d - .55 ? 0 : t < d + .12 ? 1 : 0);
        drop.zone.setAttribute('opacity', t > d - .45 && t < d + .1 ? .9 : 0);
        drop.tag.setAttribute('opacity', Math.max(0, 1 - e * 1.6).toFixed(3));   // the file name fades before the clip lands on the reply line
        drop.att.setAttribute('opacity', landed ? 1 : 0);
      }
      live.replaceChildren();
      let cur = null;
      for (const e of ev) if (t - START >= e[0]) cur = e;
      const [, typed, ac, key] = cur ?? [0, '', null, null], word = cur?.[4] ?? '', pressedFor = cur ? t - START - cur[0] : 1;
      if (typed === '/' && p.menu?.length) {                                         // the slash-command list
        const rows = p.menu.slice(0, 4), top = 798 - rows.length * 116 - 20;
        rr(live, 38, top, 1048, 798, 40, C.surf, EDGE);
        rows.forEach(([title, sub], i) => { const y = top + 62 + i * 116; text(live, 76, y, title, 44, 700, C.text); text(live, 76, y + 50, sub ?? '', 32, 450, C.sub); });
      } else if (ac) {                                                                 // autocomplete card
        rr(live, 38, 648, 1048, 798, 40, C.surf, EDGE);
        const [title, sub] = ac === 'cmd' ? [p.command, p.commandDesc] : [p.name, p.desc];
        text(live, 76, 700, title, 44, 700, C.text); text(live, 76, 754, sub, 32, 450, C.sub);
      }
      const ty = 1058;
      if (typed) {
        const tx = text(live, 66, ty, typed, 50, 450, C.text);
        const w = tx.getComputedTextLength ? tx.getComputedTextLength() : typed.length * 25;
        rr(live, 66 + w + 4, ty - 30, 70 + w + 4, ty + 30, 0, C.orange);
      } else {
        rr(live, 66, ty - 30, 70, ty + 30, 0, C.orange); text(live, 80, ty, 'Reply to Claude...', 44, 450, C.placeholder);
      }
      rr(live, 936, 1110, 1020, 1194, 26, key === 'send' ? C.orangeHot : C.orange); iconArrowUp(live, 978, 1152);
      if (word) text(live, 260, KB_Y + 44, `“${word}”`, 38, 500, C.text);
      const k = key && key !== 'send' && pressedFor < .09 ? key : null;               // key pop-up while pressed
      if (k && KEYS[k] && k.length === 1 && k !== ' ') {
        const [x0, y0, x1, y1] = KEYS[k], cx = (x0 + x1) / 2;
        rr(live, cx - 64, y0 - 150, cx + 64, y1 + 4, 22, C.keyHi); text(live, cx, y0 - 72, k, 92, 400, '#fafaf8', 'middle');
      }
    },
  };
}

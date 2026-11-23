import {stage, text, measure, wrap, fade, leave, span, easeBack, easeInOut, raised, on} from '../../kit.js';

// A short spoken exchange as speech bubbles: each line pops in from its tail at its moment, the other person on the
// left, the reply on the right. One word per line can be marked (`mark`): it is drawn in the accent and underlined, for
// "say the name back". A small line above, a big label landing under the bubbles. Shared piece: drawn in the theme's look.
// Props: lines [{text, side 'left' | 'right', at (seconds; below 0 = already there), mark}], size, top, gap, max (text
// measure), kicker, label, labelAt, labelY, warn (label in the accent).
export const meta = {duration: 3, live: true};
export const defaults = {
  lines: [{text: "Hi, I'm Rose.", side: 'left', at: -1, mark: 'Rose'}, {text: 'Nice to meet you, Rose!', side: 'right', at: .5, mark: 'Rose'}],
  size: 84, top: 520, gap: 50, max: 620, kicker: '', label: '', labelAt: 1.2, labelY: 1400, warn: false,
};

const bare = s => String(s ?? '').replace(/[^\p{L}\p{N}']/gu, '').toLowerCase();
const PAD = 54, PADY = 46, TAIL = 46, L = 80, R = 940;

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), g = st.root.append('g');
  const lead = p.size * 1.2, space = measure('a a', look, 'head', p.size) - measure('aa', look, 'head', p.size);
  let y = p.top;
  const bubbles = p.lines.map(line => {
    const right = line.side === 'right', rows = wrap(line.text, p.max, look, 'head', p.size);
    const tw = Math.max(...rows.map(r => measure(r, look, 'head', p.size)));
    const bw = tw + PAD * 2, bh = rows.length * lead + PADY * 2 - p.size * .2, x = right ? R - bw : L;
    const fill = right ? (look.accent2 ?? look.ink) : raised(look), ink = on(fill, look);
    const b = g.append('g'), ox = right ? x + bw - 40 : x + 40, oy = y + bh + TAIL;      // grows from the tail's tip
    const rad = Math.min(look.radius ?? 24, 40) + 14;
    b.append('rect').attr('x', x).attr('y', y).attr('width', bw).attr('height', bh).attr('rx', rad).attr('fill', fill).attr('filter', st.lift);
    b.append('path').attr('d', right ? `M${x + bw - 130} ${y + bh - 4} L${ox + 12} ${oy} L${x + bw - 50} ${y + bh - 4}Z` : `M${x + 130} ${y + bh - 4} L${ox - 12} ${oy} L${x + 50} ${y + bh - 4}Z`).attr('fill', fill);
    let under = null;
    rows.forEach((row, i) => {
      let wx = x + PAD;
      const by = y + PADY + p.size * .82 + i * lead;
      for (const word of row.split(' ')) {
        const marked = line.mark && bare(word) === bare(line.mark), ww = measure(word, look, 'head', p.size);
        text(b, wx, by, word, {size: p.size, role: 'head', color: marked ? look.accent : ink}, look);
        if (marked) under = {node: b.append('rect').attr('x', wx).attr('y', by + 14).attr('height', 10).attr('rx', 5).attr('fill', look.accent), w: measure(word.replace(/[^\p{L}\p{N}]+$/u, ''), look, 'head', p.size)};
        wx += ww + space;
      }
    });
    y += bh + TAIL + p.gap;
    return {b, ox, oy, at: line.at ?? 0, under};
  });
  const kick = p.kicker ? text(g, 540, p.top - 70, p.kicker, {size: 36, role: 'mono', color: look.dim, anchor: 'middle'}, look).style('letter-spacing', '.22em') : null;
  const lSize = p.label ? Math.min(128, 128 * 700 / Math.max(1, measure(p.label, look, 'head', 128))) : 0;
  const lab = p.label ? st.root.append('g') : null;
  if (lab) text(lab, 0, 0, p.label, {size: lSize, role: 'head', color: p.warn ? look.accent : look.ink, anchor: 'middle'}, look);

  return {
    seek(t) {
      const gone = 1 - leave(t, p.life);
      g.attr('opacity', gone);
      for (const d of bubbles) {
        const a = d.at < 0 ? 1 : span(t, d.at, .24), s = .3 + .7 * easeBack(a);
        d.b.attr('opacity', Math.min(1, a * 4)).attr('transform', `translate(${d.ox} ${d.oy}) scale(${s.toFixed(4)}) translate(${-d.ox} ${-d.oy})`);
        d.under?.node.attr('width', d.under.w * easeInOut(span(t, Math.max(0, d.at) + .22, .22)));
      }
      kick?.attr('opacity', fade(t, .05, .2));
      if (lab) {
        const a = span(t, p.labelAt, .28);
        lab.attr('opacity', (a > 0 ? 1 : 0) * gone).attr('transform', `translate(540 ${p.labelY}) scale(${(.6 + .4 * easeBack(a)).toFixed(4)})`);
      }
    },
  };
}

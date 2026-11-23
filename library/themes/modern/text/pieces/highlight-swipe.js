import {C, STEP, stage, word, measure, wrap, capH, up, span, snap, leave} from '../../kit.js';

// A line of heavy type over the footage, built word by word on the beat; the words of `mark` get a solid
// charcoal block that wipes in behind them from the left (white type on charcoal) — an editorial highlight.
// `y` is the top line's baseline area centre; `width` the text measure; `maxSize` the largest size.
export const meta = {duration: 4, live: true};
export const defaults = {text: 'This is the part that matters', mark: 'the part', y: 1520, width: 900, maxSize: 110};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, text = up(props.text), mark = up(props.mark ?? ''), o = {track: .01};
  let size = props.maxSize ?? 110, lines; for (; size > 36; size -= 3) { lines = wrap(text, size, props.width ?? 900, o); if (lines.length <= 3) break; }
  const cap = capH(size, o), pitch = cap * 1.6, top = (props.y ?? 1520) - (lines.length * pitch) / 2;
  const mi = text.indexOf(mark), blocks = st.root.append('g'), type = st.root.append('g'), items = []; let n = 0, pos = 0;
  lines.forEach((line, li) => {
    const lw = measure(line, size, o); let x = W / 2 - lw / 2; const y = top + cap + li * pitch;
    line.split(' ').forEach(wd => {
      const at = text.indexOf(wd, pos); pos = at + wd.length;
      const isM = mark && mi >= 0 && at >= mi && at < mi + mark.length, w = measure(wd, size, o), sp = measure(' ', size, o);
      const blk = isM ? blocks.append('rect').attr('x', x - size * .14).attr('y', y - cap - size * .16).attr('height', cap + size * .32).attr('fill', C.coal) : null;
      items.push({w: word(type, wd, x, y, size, {anchor: 'start', order: 'left', track: o.track, seed: n, lift: isM ? null : st}), blk, bw: w + sp * (isM ? 1 : 0) + size * .28, at: .1 + n * STEP});
      x += w + sp; n++;
    });
  });
  // join neighbouring mark blocks: each block reaches into the next word's space
  const life = props.life ?? meta.duration, out = Math.max(.8, life - .45);
  return {seek(t) {
    items.forEach(it => {
      it.w.seek(t, {at: it.at, step: .03, hold: .06, out, outStep: .02});
      if (it.blk) { const a = snap(span(t, it.at - .08, STEP)), b = snap(span(t, out, STEP)); it.blk.attr('width', Math.max(0, it.bw * a - (it.bw * b))).attr('transform', `translate(${it.bw * b} 0)`).attr('opacity', a > 0 && b < 1 ? 1 : 0); }
    });
  }};
}

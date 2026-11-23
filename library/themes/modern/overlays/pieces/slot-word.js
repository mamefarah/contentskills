import {C, STEP, stage, word, label, fit, capH, measure, up, span, snap} from '../../kit.js';

// A word in a slot: a charcoal bar opens from a thin vertical line to the word's width on the beat, the word
// builds inside it in white, and the bar closes to a line and goes. Props: word, y, size, sub (small label in
// a white tab under the bar), align centre|left.
export const meta = {duration: 3, live: true};
export const defaults = {word: 'TRENDING', y: 1580, size: 120, sub: 'THIS WEEK', align: 'centre'};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, w = up(props.word), y = props.y ?? 1580;
  const size = fit(w, W * .78, props.size ?? 120), cap = capH(size), bw = measure(w, size) + size * .9, bh = cap + size * .7;
  const cx = props.align === 'left' ? 72 + bw / 2 : W / 2;
  const bar = st.root.append('rect').attr('y', y - bh / 2).attr('height', bh).attr('fill', C.coal);
  const wd = word(st.root, w, cx, y + cap / 2, size, {seed: 8});
  const sw = props.sub ? measure(up(props.sub), 20, {font: '"Inter Tight"', weight: 800, track: .3}) + 36 : 0;
  const tab = props.sub ? st.root.append('rect').attr('x', cx - sw / 2).attr('y', y + bh / 2).attr('width', sw).attr('height', 38).attr('fill', C.white) : null;
  const tt = props.sub ? st.root.append('text').attr('x', cx + 3).attr('y', y + bh / 2 + 26).attr('text-anchor', 'middle').attr('fill', C.ink).style('font', '800 20px "Inter Tight"').style('letter-spacing', '.3em').text(up(props.sub)) : null;
  const life = props.life ?? meta.duration, out = Math.max(.9, life - .4);
  return {seek(t) {
    const a = snap(span(t, 0, STEP * 1.5)), b = snap(span(t, out + .12, STEP * 1.3)), ww = Math.max(6, bw * a) * (1 - b);
    bar.attr('x', cx - ww / 2).attr('width', ww).attr('opacity', t >= 0 && b < 1 ? 1 : 0);
    wd.seek(t, {at: .18, step: .04, hold: .07, out, outStep: .025});
    const on = t > .4 && t < out; tab?.attr('opacity', on ? 1 : 0); tt?.attr('opacity', on ? 1 : 0);
  }};
}

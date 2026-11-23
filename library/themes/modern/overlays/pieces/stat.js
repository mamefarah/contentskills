import {C, STEP, stage, word, label, fit, capH, count, up, span, snap} from '../../kit.js';

// A statistic in huge heavy type that counts up to its value, then settles solid; a tracked label under it and
// a small note in a white tab above. Pass the value as a string ('87%', '$4.2M', '10,000'). Props: value,
// label, note, y (the figure's centre), size.
export const meta = {duration: 3.5, live: true};
export const defaults = {value: '87%', label: 'OF VIEWERS STAY', note: 'ILLUSTRATIVE', y: 1540, size: 300};

export function mount(el, props = defaults) {
  const st = stage(el, {mode: 'overlay'}), {W} = st, v = String(props.value), y = props.y ?? 1540;
  const size = fit(v, W * .8, props.size ?? 300, {weight: 900, track: -.02}), cap = capH(size, {weight: 900});
  const num = st.root.append('text').attr('x', W / 2).attr('y', y + cap / 2).attr('text-anchor', 'middle').attr('fill', C.white).attr('filter', st.url('lift')).style('font', `900 ${size}px Montserrat`).style('letter-spacing', '-0.02em');
  const lab = props.label ? word(st.root, up(props.label), W / 2, y + cap / 2 + 70, Math.min(48, fit(up(props.label), W * .8, 48)), {seed: 2, lift: st}) : null;
  const nt = props.note ? up(props.note) : '', nw = nt.length * 13 + 40;
  const tab = nt ? st.root.append('rect').attr('x', W / 2 - nw / 2).attr('y', y - cap / 2 - 70).attr('width', nw).attr('height', 38).attr('fill', C.white) : null;
  const tn = nt ? st.root.append('text').attr('x', W / 2 + 3).attr('y', y - cap / 2 - 44).attr('text-anchor', 'middle').attr('fill', C.ink).style('font', '800 17px "Inter Tight"').style('letter-spacing', '.3em').text(nt) : null;
  const life = props.life ?? meta.duration, out = Math.max(1.2, life - .4);
  return {seek(t) {
    const q = snap(span(t, .05, .9)), on = t < out + .15;
    num.text(count(v, q)).attr('opacity', on ? 1 : 0).attr('fill-opacity', q < .999 ? .4 + .5 * q : 1);
    lab?.seek(t, {at: .5, step: .025, hold: .06, out, outStep: .02});
    const tb = t > .3 && t < out; tab?.attr('opacity', tb ? 1 : 0); tn?.attr('opacity', tb ? 1 : 0);
  }};
}

import {scene, h, set, esc, popIn, icon, lines, span, HERO, C} from '../../kit.js';

// The call to action: a dark comments panel (placeholder comments, nothing readable invented), an input where the
// keyword is typed letter by letter from `typeAt`, sent at `sendAt` (it lands at the top of the list, highlighted),
// then a reply bubble ("Sent! Check your DMs") pops at `replyAt`. No brand marks. Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {mode: 'dark', title: 'Comments', word: 'JOB', reply: 'Sent! Check your DMs', popAt: 0, typeAt: .4, sendAt: 1.1, replyAt: 1.6};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 900, H = 900, x = HERO.x - W / 2, y = HERO.y - H / 2 + 10;
  const box = h(root, 'a mn-card', {left: x, top: y, width: W, height: H, overflow: 'hidden'});
  h(box, 'a', {left: 0, right: 0, top: 34, textAlign: 'center', font: '700 34px/1 Inter', color: M.ink}, esc(p.title));
  h(box, 'a', {left: 0, right: 0, top: 96, height: 1.5, background: M.line});
  const avatar = (parent, size, color) => h(parent, '', {width: size, height: size, borderRadius: '50%', flex: 'none', background: color});
  // the list: the new comment slides in at the top, the placeholder comments move down
  const list = h(box, 'a', {left: 40, right: 40, top: 130});
  const mine = h(list, '', {display: 'flex', gap: 22, alignItems: 'flex-start', padding: '20px 22px', borderRadius: 24, background: 'rgba(59,91,219,.16)', border: '1.5px solid rgba(123,150,255,.5)', marginBottom: 26});
  avatar(mine, 76, 'linear-gradient(160deg,#7b96ff,#3b5bdb)');
  const mineBody = h(mine, '', {flex: 1});
  h(mineBody, '', {font: '600 26px/1 Inter', color: M.dim, marginBottom: 14}, 'you · now');
  h(mineBody, '', {font: '800 52px/1 Inter', color: M.ink, letterSpacing: '.04em'}, esc(p.word));
  const reply = h(list, '', {display: 'flex', gap: 18, alignItems: 'center', marginLeft: 98, marginBottom: 30, marginTop: -6});
  avatar(reply, 56, 'linear-gradient(160deg,#ff9a3d,#f05a14)');
  h(reply, '', {padding: '18px 26px', borderRadius: 26, background: M.raised, border: `1.5px solid ${M.line}`, font: '600 32px/1 Inter', color: M.ink, display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap'}, `${icon('send', 32, M.hue.blue)}${esc(p.reply)}`);
  const others = [];
  for (let i = 0; i < 4; i++) {
    const row = h(list, '', {display: 'flex', gap: 22, alignItems: 'center', height: 110});
    avatar(row, 70, M.raised);
    const r = h(row, '', {position: 'relative', flex: 1, height: 50}); lines(r, 0, 0, 560, 2, {gap: 30, height: 14, seed: i + 11});
    others.push(row);
  }
  const input = h(box, 'a', {left: 30, right: 30, bottom: 30, height: 110, borderRadius: 999, background: M.raised, border: `1.5px solid ${M.line}`, display: 'flex', alignItems: 'center', gap: 20, padding: '0 16px 0 22px'});
  avatar(input, 70, 'linear-gradient(160deg,#7b96ff,#3b5bdb)');
  const field = h(input, '', {flex: 1, font: '700 44px/1 Inter', color: M.ink, letterSpacing: '.04em', whiteSpace: 'nowrap'});
  const send = h(input, '', {width: 80, height: 80, borderRadius: '50%', background: M.hue.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}, icon('send', 40, '#fff'));
  return {
    seek(t) {
      popIn(box, t, p.popAt, '', {d: .5, from: .92, rise: 40});
      const letters = t < p.typeAt ? 0 : Math.min(p.word.length, 1 + Math.floor((t - p.typeAt) / .12));
      const sent = t >= p.sendAt;
      field.innerHTML = sent ? `<span style="color:${M.dim};font:500 34px/1 Inter;letter-spacing:0">Add a comment…</span>`
        : letters ? esc(p.word.slice(0, letters)) + (Math.floor(t * 3) % 2 ? '' : `<span style="display:inline-block;width:3px;height:44px;background:${M.hue.blue};vertical-align:middle;margin-left:4px"></span>`)
        : `<span style="color:${M.dim};font:500 34px/1 Inter;letter-spacing:0">Add a comment…</span>`;
      const press = 1 - .15 * (span(t, p.sendAt, .08) - span(t, p.sendAt + .1, .12));
      set(send, {transform: `scale(${press})`, opacity: letters || sent ? 1 : .45});
      const drop = span(t, p.sendAt, .4), mh = 160, rh = 110;
      set(list, {transform: `translateY(${(-(mh + rh) * (1 - (1 - Math.pow(1 - drop, 3)))).toFixed(1)}px)`});
      popIn(mine, t, p.sendAt, '', {d: .45, from: .9, rise: 0});
      popIn(reply, t, p.replyAt, '', {d: .45, from: .8, rise: 12});
    },
  };
}

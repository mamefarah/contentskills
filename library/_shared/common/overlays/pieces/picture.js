// A still picture filling the frame (cover-cropped), with a slow push-in from `zoom[0]` to `zoom[1]` over its life,
// centred on `focus` (fractions of the frame). For a full-screen cutaway of a contact sheet, a poster, a screenshot.
// Shared piece: theme-neutral; the field behind it is the theme's ink. Deterministic: the zoom is a function of t.
export const meta = {duration: 3, live: true};
export const defaults = {src: '', zoom: [1, 1.12], focus: [0.5, 0.5], fadeIn: 0.12, ease: 'linear'};

const W = 1080, H = 1920, NS = 'http://www.w3.org/2000/svg';
export async function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props};
  if (p.src) { const pic = new Image(); pic.src = p.src; await pic.decode().catch(() => {}); }   // decoded before the first seek
  el.style.background = 'transparent';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  Object.assign(svg.style, {position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden'});
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', W); bg.setAttribute('height', H); bg.setAttribute('fill', look?.ink ?? '#111');
  const g = document.createElementNS(NS, 'g'), img = document.createElementNS(NS, 'image');
  img.setAttribute('href', p.src); img.setAttribute('width', W); img.setAttribute('height', H);
  img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  g.appendChild(img); svg.append(bg, g); el.appendChild(svg);
  const fx = p.focus[0] * W, fy = p.focus[1] * H;
  return {
    seek(t) {
      const life = p.life ?? meta.duration, k = Math.min(1, Math.max(0, t / Math.max(.01, life)));
      const e = p.ease === 'inout' ? (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2) : k;
      const s = p.zoom[0] + (p.zoom[1] - p.zoom[0]) * e;
      g.setAttribute('transform', `translate(${fx} ${fy}) scale(${s.toFixed(4)}) translate(${-fx} ${-fy})`);
      svg.style.opacity = Math.min(1, Math.max(0, t / Math.max(.001, p.fadeIn))).toFixed(3);
    },
  };
}

// Drawing kit for ui/instagram: generic Instagram-style app UI (comments sheet, notification, feed card, insights card)
// in frame pixels (1080x1920). The SVG basics (stage, shapes, text, measuring, pictures, easing) are shared with the
// reel kit, whose cards these sit beside; this file adds the app's own colours and marks. All drawn in code, no logos.
export {clamp, easeOut, easeInOut, easeBack, fadeOut, mix, uid, stage, node, group, rr, circle, poly, line, text, measure, fit,
  clipRect, image, loadImages, SAFE, BRAND} from '../reel-kit/ui.js';
import {node, group, rr, circle, line, text, uid, image} from '../reel-kit/ui.js';

export const IG = {blue: '#0095F6', grey: '#737373', line: '#DBDBDB', text: '#262626', black: '#000000', white: '#FFFFFF', note: '#F6F6F8', handle: '#DBDBDB',
  send: '#3C51FD', mine: '#E4F4FD', name: '#202329', meta: '#67747B', faint: '#EFEFEF'};   // sampled from a screen recording of the iOS app
/** The app's text face: the phone's system font (wide, like the app), not the reel kit's narrow Inter Tight. */
export const IGF = 'system-ui, -apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const AVATAR = '/library/ui/instagram/assets/avatar-placeholder.jpg';
export const COVERS = [1, 2, 3, 4].map(i => `/library/ui/instagram/assets/reels/0${i}.jpg`);
const STOPS = [[0, '#FEDA75'], [.3, '#FA7E1E'], [.55, '#D62976'], [.8, '#962FBF'], [1, '#4F5BD5']];

/** The app's yellow-orange-pink-purple diagonal gradient, as a paint server id. */
export function gradient(svg) {
  const id = uid('ig'), g = node(svg.defs, 'linearGradient', {id, x1: 0, y1: 1, x2: .7, y2: 0});
  for (const [o, c] of STOPS) node(g, 'stop', {offset: o, 'stop-color': c});
  return `url(#${id})`;
}

/** A round avatar: the photo (a data URL from loadImages), or a warm gradient disc with the name's initial. */
export function avatar(svg, p, href, name, cx, cy, d) {
  if (href) return image(svg, p, href, cx - d / 2, cy - d / 2, d, d, d / 2);
  const id = uid('av'), g = node(svg.defs, 'linearGradient', {id, x1: 0, y1: 0, x2: 0, y2: 1});
  node(g, 'stop', {offset: 0, 'stop-color': '#FFAA5A'}); node(g, 'stop', {offset: 1, 'stop-color': '#D63C8C'});
  circle(p, cx, cy, d / 2, `url(#${id})`);
  return text(p, cx, cy + d * .02, String(name || 'J').slice(0, 1).toUpperCase(), d * .45, 800, '#fff', 'middle');
}

/** A generic camera-app badge: gradient rounded square with a camera outline (not the real logo). */
export function appIcon(svg, p, x, y, s) {
  const g = group(p), lw = Math.max(2, s * .08);
  rr(g, x, y, s, s, s * .26, gradient(svg));
  rr(g, x + s * .2, y + s * .2, s * .6, s * .6, s * .16, 'none', {stroke: '#fff', 'stroke-width': lw});
  circle(g, x + s * .5, y + s * .5, s * .14, 'none', {stroke: '#fff', 'stroke-width': lw});
  circle(g, x + s * .675, y + s * .305, s * .035, '#fff');
  return g;
}

/** Heart outline (or filled) centred at cx, cy with radius r. */
export function heart(p, cx, cy, r, col, width = 2, fill = 'none') {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const a = i / 60 * Math.PI * 2;
    pts.push([cx + r * 16 * Math.sin(a) ** 3 / 17, cy - r * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17]);
  }
  return node(p, 'polygon', {points: pts.map(q => q.join(',')).join(' '), fill, stroke: fill === 'none' ? col : 'none', 'stroke-width': width, 'stroke-linejoin': 'round'});
}

/** Count-up formatting that keeps the target's shape: "212,480" -> "106,240", "$4.1K" -> "$2.0K". */
export function parseNumber(s) {
  const m = String(s).match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return {format: () => String(s)};
  const [, pre, num, suf] = m, commas = num.includes(','), dp = (num.split('.')[1] || '').length, value = parseFloat(num.replace(/,/g, ''));
  return {format: k => {
    let v = (value * k).toFixed(dp);
    if (commas) { const [i, d] = v.split('.'); v = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); }
    return pre + v + suf;
  }};
}

/** A drawn stand-in for someone's profile photo (no real person): a soft-coloured backdrop, shoulders, a face and hair,
 *  with colours picked from the name so each viewer looks different. */
export function person(svg, p, cx, cy, d, name = '') {
  let h = 7; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = ['#F4D9C6', '#CFE3F2', '#E3D7F2', '#D6EBD9', '#F6E2B3'][h % 5], skin = ['#F1C7A5', '#D9A27C', '#B97B55', '#8D5A3B', '#F3D3BA'][(h >> 3) % 5];
  const hair = ['#2B1E16', '#5A3A22', '#1B1B1B', '#8A5A2B', '#C9A26B'][(h >> 6) % 5], top = ['#2F3A4A', '#B5485C', '#3E6B5A', '#6B4FA0', '#D9822B'][(h >> 9) % 5];
  const id = uid('pa'), cp = node(svg.defs, 'clipPath', {id}); circle(cp, cx, cy, d / 2, '#000');
  const g = group(p, {'clip-path': `url(#${id})`}), r = d / 2;
  circle(g, cx, cy, r, bg);
  node(g, 'ellipse', {cx, cy: cy + r * .98, rx: r * .78, ry: r * .55, fill: top});
  node(g, 'rect', {x: cx - r * .13, y: cy + r * .12, width: r * .26, height: r * .3, fill: skin});
  node(g, 'ellipse', {cx, cy: cy - r * .12, rx: r * .4, ry: r * .46, fill: hair});
  node(g, 'ellipse', {cx, cy: cy - r * .02, rx: r * .3, ry: r * .36, fill: skin});
  node(g, 'path', {d: `M${cx - r * .34} ${cy - r * .12} Q${cx - r * .1} ${cy - r * .62} ${cx + r * .36} ${cy - r * .2} Q${cx + r * .1} ${cy - r * .5} ${cx - r * .34} ${cy - r * .12}Z`, fill: hair});
  return g;
}

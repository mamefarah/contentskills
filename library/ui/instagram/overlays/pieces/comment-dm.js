import {IG, IGF, AVATAR, SAFE, clamp, easeOut, easeBack, fadeOut, stage, group, rr, line, text, measure, fit, loadImages, avatar, person, appIcon, heart} from '../../ui.js';

// The call to action as Instagram: a comments sheet above your head, a viewer types your keyword and taps send, the
// comment lands in the list (tinted as theirs, "1s", Reply · Edit), then your auto-DM drops in as a notification with your
// photo and handle. As it drops, the sheet folds down to just the comment and tucks under the notification, so the comment
// and its DM read as a pair. Proportions, colours and the system font follow a screen recording of the iOS app.
// Times (seconds into the overlay): typing 0.25–0.75, postAt 1.0, noteAt 1.7. Text the viewer would type is `keyword`.
// avatar is your picture (a server path; default: the placeholder photo in this kit). viewerAvatar is the commenter's photo
// (a server path); without one they get a drawn stand-in. Use a real person's name and photo only with their OK.
export const meta = {duration: 3};
// keyword and handle default to the user's settings (me.keyword, me.handle); avatar to me.avatar, else the kit's placeholder.
export const defaults = {keyword: '{me.keyword}', handle: '{me.handle}', avatar: '{me.avatar}', viewer: 'jess.makes', viewerAvatar: '',
  message: "Here's my reel setup! Tap the link to get it", postAt: 1, noteAt: 1.7,
  x: SAFE.left, y: 205, width: SAFE.right - SAFE.left};

const EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];
const T = (p, x, y, s, size, weight, fill, anchor = 'start') => text(p, x, y, s, size, weight, fill, anchor, {'font-family': IGF});

export async function mount(el, props = defaults) {
  const p = {...defaults, ...props}, svg = stage(el), sheet = group(svg), live = group(sheet), noteG = group(svg);
  const [photo, viewerPhoto] = await loadImages([p.avatar || AVATAR, ...(p.viewerAvatar ? [p.viewerAvatar] : [])], 240, 240);
  const face = (g, cx, cy, d) => viewerPhoto ? avatar(svg, g, viewerPhoto, p.viewer, cx, cy, d) : person(svg, g, cx, cy, d, p.viewer);
  const W = p.width, hh = 100, rh = 140, eh = 74, ih = 112, H = hh + rh + eh + ih, kw = String(p.keyword);
  const ax = 58, tx = 112, typedW = [...Array(kw.length + 1)].map((_, n) => measure(svg, kw.slice(0, n), 32, 400, IGF));
  const nameW = measure(svg, p.viewer, 29, 700, IGF), replyW = measure(svg, 'Reply', 27, 600, IGF);

  // The notification, drawn once (iOS banner: rounded, frosted, app badge on the photo).
  const nh = 205, note = group(noteG), na = nh * .6;
  rr(note, 0, 0, W, nh, nh * .24, IG.note, {filter: svg.shadow, 'fill-opacity': .98});
  avatar(svg, note, photo, p.handle, 38 + na / 2, nh / 2, na);
  appIcon(svg, note, 38 + na - nh * .26 * .75, (nh + na) / 2 - nh * .26 * .8, nh * .26);
  const nx = 38 + na + 38;
  T(note, nx, nh * .34, p.handle, 36, 700, IG.black); T(note, W - 38, nh * .34, 'now', 28, 400, IG.grey, 'end');
  T(note, nx, nh * .66, fit(svg, p.message, W - nx - 38, 32, 400, IGF), 32, 400, IG.text);

  return {
    seek(t) {
      live.replaceChildren();
      const out = fadeOut(t, p.life), n = Math.floor(kw.length * clamp((t - .25) / .5)), posted = t >= p.postAt;
      const k = easeBack(t / .32), m = t >= p.noteAt ? easeOut((t - p.noteAt) / .35) : 0;      // m: the fold under the notification
      const tuck = m * (nh + 24 - hh);                                                          // the comment's top lands 24 px under it
      sheet.setAttribute('opacity', clamp(k * 2) * out);
      sheet.setAttribute('transform', `translate(${p.x} ${p.y + (1 - k) * 115 + tuck})`);
      // the sheet: while folding it shrinks to the comment row
      const top = m * hh, bottom = H - m * (eh + ih);
      rr(live, 0, top, W, bottom - top, 40, IG.white, {filter: svg.shadow});
      const head = group(live, {opacity: 1 - m}), foot = group(live, {opacity: 1 - m});
      rr(head, W / 2 - 36, 18, 72, 7, 3.5, IG.handle);
      T(head, W / 2, 62, 'Comments', 34, 700, IG.black, 'middle');

      // the list: empty state until the comment lands, then the viewer's own comment (tinted, like the app shows yours)
      const kNew = posted ? easeOut((t - p.postAt) / .3) : 0, y = hh;
      if (kNew < 1) {
        const e = group(live, {opacity: 1 - kNew});
        T(e, W / 2, y + rh * .4, 'No comments yet', 32, 700, IG.black, 'middle'); T(e, W / 2, y + rh * .68, 'Start the conversation.', 27, 400, IG.meta, 'middle');
      }
      if (kNew > 0) {
        const r = group(live, {opacity: kNew, transform: `translate(0 ${(1 - kNew) * 18})`});
        const tint = group(r, {opacity: 1 - m});                     // the tint goes once it is a plain pair with the DM
        rr(tint, 0, y, W, rh, 0, IG.mine);
        face(r, ax, y + 44, 66);
        T(r, tx, y + 32, p.viewer, 29, 700, IG.name); T(r, tx + nameW + 10, y + 32, '1s', 29, 400, IG.meta);
        T(r, tx, y + 72, kw, 32, 400, IG.black);
        T(r, tx, y + 112, 'Reply', 27, 600, IG.meta); T(r, tx + replyW + 34, y + 112, 'Edit', 27, 600, IG.meta);
        heart(r, W - 46, y + 66, 17, IG.name, 2.4);
      }

      // the quick-reaction emoji row and the comment field
      const ey = hh + rh;
      line(foot, [[0, ey], [W, ey]], IG.faint, 2, {'stroke-linecap': 'butt'});
      EMOJI.forEach((em, i) => text(foot, 46 + i * (W - 92) / 7, ey + eh / 2 + 2, em, 40, 400, '#000', 'middle'));
      const iy = ey + eh, cy = iy + ih / 2 - 6, bx0 = 112, bx1 = W - 26, bh = 76;
      face(foot, ax, cy, 70);
      rr(foot, bx0, cy - bh / 2, bx1 - bx0, bh, bh / 2, IG.white, {stroke: IG.line, 'stroke-width': 2});
      const fx = bx0 + 28, typing = n > 0 && !posted;
      if (!typing) {
        T(foot, fx, cy, fit(svg, `Add a comment for ${p.handle}`, bx1 - fx - 90, 30, 400, IGF), 30, 400, IG.meta);
        const gx = bx1 - 62;                                            // GIF button
        rr(foot, gx - 22, cy - 17, 44, 34, 8, 'none', {stroke: IG.name, 'stroke-width': 2.6});
        T(foot, gx, cy + 1, 'GIF', 17, 800, IG.name, 'middle');
      } else {
        T(foot, fx, cy, kw.slice(0, n), 32, 400, IG.black);
        if (Math.floor(t * 3) % 2 === 0) rr(foot, fx + typedW[n] + 3, cy - 21, 3.5, 42, 0, IG.send);
        const sx = bx1 - 52, pressed = t >= p.postAt - .12;           // the blue send button, pressed just before it posts
        rr(foot, sx - 42, cy - 27, 84, 54, 27, pressed ? '#2F41D6' : IG.send);
        line(foot, [[sx, cy + 14], [sx, cy - 14]], '#fff', 4.5); line(foot, [[sx - 12, cy - 3], [sx, cy - 15], [sx + 12, cy - 3]], '#fff', 4.5);
      }

      // The auto-DM lands as a notification on top, with a small bump when it arrives.
      const on = t >= p.noteAt, kn = on ? easeOut((t - p.noteAt) / .35) : 0;
      const bump = 1 + .02 * Math.sin(Math.PI * clamp((t - p.noteAt - .35) / .25));
      noteG.setAttribute('opacity', on ? clamp(kn * 1.5) * out : 0);
      const ny = p.y - (1 - kn) * (nh + 230), cx = p.x + W / 2;
      noteG.setAttribute('transform', `translate(${cx} ${ny + nh / 2}) scale(${bump}) translate(${-W / 2} ${-nh / 2})`);
    },
  };
}

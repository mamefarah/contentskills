# Building a theme

A theme is one unified visual style. Everything a video shows — text effects, footage overlays,
diagrams, 3D, Lottie accents, captions, effects — comes from a single theme, so it all matches.
This is the checklist for adding one. `futuristic` is the reference implementation: read its
`theme.json`, its kit `hud.js`, each category's `catalog.json` and a few pieces from each folder first.
Also read `docs/REFERENCE.md` (storyboard formats), `CLAUDE.md`, and `library/_shared/` (`loader.js`,
`kit.js`, `captions.js`, `stage.html`, `effects_engine.py`, `shader_transitions.py`).

## Ground rules

- **Original work in a genre.** A reference shows the look to aim for: palette, texture, shapes,
  type, rhythm of motion. Never reproduce its specific words, layouts, logos, characters or assets,
  and never download art. Everything is drawn in code (SVG, canvas, shaders).
- **One kit.** Each theme has one drawing kit (`library/themes/<theme>/kit.js`) holding its colours,
  fonts, textures and shape helpers. Every piece draws with it. If two pieces disagree about what
  the theme looks like, the kit is missing something.
- **The piece contract.** One ES module per piece: `export const meta = {duration, live?, loop?}`,
  optional `export const defaults = {...}` (everything a storyboard may override: all text, data,
  colours, positions), `export function mount(el, props) -> {seek(t)}`. `seek(t)` is a pure
  function of `t`: no timers, CSS animations or transitions, `Math.random`, `Date.now`. Seeded
  hashes only. D3 v7 is `window.d3` for `overlays`, `text` and `d3`; Three.js r160 core (no addons)
  is `window.THREE` for `three`.
- **No fake facts.** Sample data is labelled illustrative. Sample text is generic.
- **Look at everything.** A piece that runs without errors can still be unreadable or off-style.

## Folder layout — `library/themes/<theme>/`

| Path | Contents | Minimum |
| --- | --- | --- |
| `theme.json` | `id`, `title`, `summary`, `categories` (in the order below), `pieceFonts`, `colors`, `frame` | |
| `kit.js` | the drawing kit | |
| `overlays/` | see-through graphics for footage, 1080×1920, `"over": true` in the catalog. Positions are props; defaults keep the middle of the frame (the face) clear; `props.life` makes them animate out before their time ends | 12 |
| `text/` | text effects — the same set in every theme so storyboards can switch themes. Title cards (`"tall": true`, must work from 1000×1000 square to 1080×1920): `headline-slam`, `split-stack`, `marquee-wall`, `statement`, `big-number`, `quote-card`, `agenda`, `versus`, `chapter`, `countdown`, `end-card`. Overlays (`"over": true`): `keyword-slam`, `highlight-swipe`, `lower-third`, `side-text`, `marquee-band`, `corner-labels`, `pip-frame`, `sticker` | all 19 |
| `effects/` | `catalog.json`, `make_previews.py`, `clips/`, and `theme_effects.py` with `EFFECTS = {name: fn(img, progress, amount, frame, seed) -> img}` for effects only this theme has. The catalog may also list effects from the shared engine | 6 own |
| `transitions/` | `catalog.json`, `make_previews.py`, `clips/`: the theme's own transitions plus a selection from `library/_shared/shader_transitions.py` that suits the theme | 8 |
| `transitions/theme_transitions.py` | `PALETTE` (the theme's backdrop, edge and glow colours for the shared transitions, plus its own colour names), and `PIXEL = {name: fragment GLSL}` / `VERTEX = {name: mesh spec}` for transitions only this theme has, written with the shared engine's helpers. Deterministic: hashes of cell ids and `seed` only. See README, Transitions | 6 own |
| `fonts/` | `files/*.ttf` with licence texts, `catalog.json`. Open licences only (google/fonts raw URLs) | 10 |
| `captions/` | `styles.js` (uses `library/_shared/captions.js`), `catalog.json` | 5 |
| `d3/` | diagrams on 1000×1000 cards; support `clear: true` | 10 |
| `three/` | 3D scenes | 6 |
| `lottie/` | `generate.mjs` writing `animations/*.json` | 10 |

Category order in `theme.json`: `overlays`, `text`, `effects`, `transitions`, `fonts`, `captions`,
`voiceover`, `d3`, `three`, `lottie`. (`voiceover` is shared: list it, add no folder.) Catalog items
keep the shape `{id, name, group, piece: "<category>/<id>", description}`.

## A theme that restyles another (`"extends"`)

When a new theme is an existing theme drawn with a different kit, do not copy its pieces. Put `"extends": "<parent>"` in
the new theme's `theme.json` and give it only its own `kit.js`, fonts, catalogs and the pieces that really differ. A piece
it does not have is the parent's file, loaded at the child's address, so its `../../kit.js` import picks up the child's
kit (the local server and the frame cache both follow this: `themeFile` in `pipeline/tools.mjs`). The child's
`catalog.json` files still list every piece it offers. Glass extends fashion this way.

A piece that shows a person's name, handle or call to action takes it from the user's settings: write
`handle: '{me.handle}'` (or `{me.name}`, `{me.role}`, `{me.keyword}`) in `defaults`, never a real name.

## Demos

- `projects/<theme>-demo/storyboard.json`: a shot storyboard, 5 shots, 2–3 candidates each marked
  usable, with transitions. A candidate may be just a full-frame `background` title card.
- `projects/talking-head-<theme>/`: `npm run footage talking-head-<theme> sample-talking-head.mov library/_shared/sample/words.json`,
  then author overlays, text effects, zooms, effects and transitions timed to the words in
  `words.json`, with graphics kept off the face using `faces.json`. `projects/talking-head/` shows how.
- `npm run make` must succeed on both.

## Checking

The server is usually running on port 4600 (`node dashboard/serve.mjs` starts it).

```sh
CH=$(find .tools/browser -type f -name chrome-headless-shell | head -1)
"$PWD/$CH" --headless --no-sandbox --hide-scrollbars --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=500,500 --virtual-time-budget=5000 --screenshot=/tmp/out.png \
  "http://localhost:4600/library/_shared/stage.html?theme=<theme>&piece=<category>/<id>&t=2"
```

- Overlays: `--window-size=432,768 --default-background-color=30405000` and `&clear=1`. Title cards: check both 432,768 and 500,500.
- Props: `&props=<url-encoded json>`. Try long and short text.
- Errors print in red in the page. A black WebGL frame usually means a shader failed to compile.
  In this software renderer, lines that pass behind the camera can vanish.
- Look at every piece at 2–3 moments, at frames from every effect and transition preview, at frames
  from both demo videos, and at `http://localhost:4600/dashboard/?theme=<theme>` (no console errors,
  every section present).
- Put the reference and your pieces side by side and judge honestly whether a stranger would say
  they belong to the same style. If not, fix the kit, not individual pieces.
- `npm run check` on the existing projects must still pass.

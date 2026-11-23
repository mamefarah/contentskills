# ContentSkills video — instructions for coding agents

**Setup, first thing.** When the user says "setup", "set me up", "set up contentskills" or "setup blotato/contentskills":
1. If this folder is not the repository yet, clone it: `git clone https://github.com/blotato/contentskills` and work inside it.
2. Check Node 22+, FFmpeg and uv (`node --version`, `ffmpeg -version`, `uv --version`); install what is missing.
3. Run `npm run setup` (about 1.5 GB of downloads; safe to run again).
4. Run `npm run link`, open the address it prints, and tell the user: "Ask me for a video whenever you're ready."
The details, written for a user who has never used a terminal, are in "Set me up" below.

"setup blotato contentskills" always means this repository (https://github.com/blotato/contentskills), never the older
`blotato-skills` one, whose skills moved here. Besides the video skills, `skills/` holds the writing skills (content-coach,
brand-brief, post-writer, post-grader, viral-hooks, repurpose, post-scheduler) and `generate` (paid AI clips through
kie.ai). A request for "a video" means the local pipeline in this file unless the user asks for AI-generated footage.

This file is for every coding agent (Claude Code, Codex, Gemini CLI, Cursor, Copilot, …). `CLAUDE.md` and `GEMINI.md`
only import it, so there is one source. Read `README.md` for the layout and `docs/REFERENCE.md` for the storyboard formats. This file is the
short list of rules plus a map of the code (below), so you do not have to read the code base before starting.
The practical playbook — which workflow to use, the footage edit step by step, sections and fast re-makes, the review
loop, how to look at results, pitfalls, every command — is `skills/make-video/SKILL.md` (a plain Markdown
file; agents other than Claude Code should open it directly). Read it before making or changing a video.

## "Set me up" and "open my dashboard" (beginners)

The user may not know what a terminal, Homebrew, npm or Node is. Never ask them to type a command; do it for them
and explain in one plain sentence what you are installing and why.

**"Set me up"** (or any first-run request, or when a command fails because a tool is missing):
1. Check `node --version` (22+), `ffmpeg -version` and `uv --version`.
2. Install what is missing, simplest route first:
   - `uv`: its official installer needs no admin rights (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
   - Node 22+ and FFmpeg: with Homebrew if `brew` exists (`brew install node ffmpeg`). Without it, Homebrew's
     installer or Node's macOS installer asks for the Mac password: tell the user a macOS password prompt is coming and
     that typing it there is expected. Never ask them to paste a password into the chat.
   - Re-check each tool afterwards and add new install locations to PATH for the rest of the session if needed.
3. `npm run setup` (about 1.5 GB of downloads; it prints progress and skips finished steps, so re-running is safe).
   Tell the user roughly how long it will take.
4. Make the tool theirs: if `settings/user.json` does not exist, ask for their name, their social handle and (optionally)
   what they do, and write them there (see "The user's settings" below). Never guess these.
5. Start the dashboard (below) and finish with the link and one line: "Ask me for a video whenever you're ready."

**"Open my dashboard"**: `npm run link` starts the dashboard if it is not running and prints its address; open that
(`open <url>` on macOS) and give the link.

**Every link comes from `npm run link`**, never from a remembered port: `npm run link <name>` prints the storyboard page,
`npm run link <name> review` the finished video. The dashboard is usually on port 4600 but takes the next free port when
another program has that one, so a typed `localhost:4600` can open the wrong page. Addresses below show 4600 as the usual case.

## The user's settings (never hard-code a person)

Everything about the person using this tool lives in two files, not in code, pieces or docs:

- `settings/user.json` (git-ignored; `settings/user.example.json` is the template): who they are and how they like their
  videos. It overrides `settings/defaults.json` key by key, so it only needs the keys that differ.
  - `me`: `name`, `handle`, `role`, `brand`, `keyword` (their usual comment call-to-action word), `avatar` (a server path).
    Pieces take these as defaults through placeholders: a piece writes `handle: '{me.handle}'` in its `defaults` and the
    loader fills it in (`library/_shared/settings.js`). A new piece that shows a name, handle or call to action must do
    the same, never a literal name.
  - `audio`: `voiceLufs` (the house voice level, default -14; a storyboard's `"voiceLufs"` still wins for one video),
    `truePeak`, and the mix against the voice: `music.{gain, max, duck}`, `effects.{gain, offset, max, duck}`.
  - `captions.bottom`: where they like the caption line (frame pixels); use it as `captionAt` when a storyboard sets one.
  - `style.cookiesBrowser`: the browser `npm run style -- from <url>` may borrow a login from. Empty until they say so.
- `style/profile.json` (git-ignored; `style/profile.example.json` is the template): their look and learnt tastes
  ("Styles", below).

Read both before writing a storyboard. When the user states a lasting preference ("always a bit louder", "my handle
is…"), write it into `settings/user.json` (or the style profile, for a taste about the look) instead of into a
storyboard, a piece or this file. Code reads them with `pipeline/settings.mjs` (`settings()`, `houseLufs()`),
`pipeline/settings.py`, and in the browser `GET /api/settings`. The app safe zone is not a preference: its numbers are in
`library/_shared/safe-zone.json`, the one source for `placement.js`, `qa.py` and `signature.py`.

## Changing a video that exists

- The user marks what they want changed on the review page (`/pipeline/review/?project=<name>`). `npm run review <name>`
  lists the open marks with what is on screen there. Change only those sections, re-make, look, then
  `npm run review <name> -- --done <id> "<what you changed>"`.
  A mark can carry screenshots (`shots`; the Screenshot button saves the frame on screen to
  `projects/<name>/review-shots/`). Open every one before changing anything: it shows exactly what they mean.
- **Listen while they edit.** The user's feedback reaches you without them saying "I left notes", two ways (`pipeline/watch.mjs`):
- **One section at a time, several at once.** A note on a footage video changes only its section: edit only the storyboard entries whose `start`/`at` falls in that section (re-read storyboard.json right before each edit; other runs may be editing other sections), then `npm run patch <project> <section> -- --marks <id> --label "<what changed>"`. It re-makes just that section and splices it into out/cut.mp4 (the rest is kept exactly, from out/cut.manifest.json), so it takes seconds to a minute instead of a full make. Never run `npm run make` for a one-section note. Every patch can be undone: `npm run undo <project>` lists the last 12, `npm run undo <project> <id>` puts that section back. Status per section is in out/jobs/ and shows on the review page and the dashboard. A patch needs one full make first (it writes the manifest); notes that span the whole video (theme, captions style, music) still need `npm run make`. The whole-video quality check runs at the full make / Finish video.
  - **Automatic, every message:** a hook (`.claude/settings.json`, SessionStart and UserPromptSubmit) adds every review mark,
    candidate pick and approval the user saved since their last message to your context (open marks at session start).
  - **Live, while they review:** whenever you send a review or storyboard link, or they say they are reviewing or editing,
    run `npm run watch <name>` with Monitor (re-arm when it expires). Each `MARK` / `CHANGED` / `PICK` / `APPROVED` line
    arrives the moment they save.
  Queue it: say in a line that you have it, keep collecting while they are still marking, then apply the batch in one
  pass (one re-make, not one per mark) and close each with `--done`. Act only on projects your session owns; ask
  before taking marks that look like another session's. Stop the live watch when they are finished.
- A re-make draws only what changed (`projects/<name>/.cache/`); `npm run make <name> -- --section <id>` renders one
  section for a quick look without touching `out/cut.mp4`. Never overwrite `out/cut-v<n>.mp4`: those are earlier versions the user kept.
- The cache is fine-grained, so fix the real cause instead of working around it: a Python effect is fingerprinted by
  the code it runs (`pipeline/effect_stamps.py`), so editing one effect re-makes only its chunks; graphics frames depend
  only on what the draft page loads; the quality check re-measures only changed frames and reuses the transcript when
  the sound is unchanged. A one-scene note should come back in a minute or two; if a re-make redoes far more than the
  note touched (`Compositing: made 94 of 94`, `drew 1200 of 1399`), find out why before making again.
- One render of a project at a time: `make` and `combine` take `out/.make.lock` (`pipeline/lock.mjs`) and wait, saying who
  holds it, while another run (another session, the user's review page's apply run) renders that project; `--no-wait` stops instead.
  A lock left by a crashed run is taken over. Before editing a project's storyboard, check no one else is mid-render on it.
- The **Make a new version** button on the review page starts `claude -p` with the same request (`dashboard/serve.mjs`,
  `/apply`, log in `out/apply.log`): it keeps the current cut as the next `cut-v<n>.mp4`, applies the open notes, re-makes and marks them done.
- When they are happy they press **Finish video ✓**: the version on screen is copied to `out/final.mp4`, recorded in
  `projects/<name>/final.json` and downloaded; My videos shows it as Final. Never overwrite `out/final.mp4` yourself.
- **No new storyboard approval at this stage.** Once the first video exists, apply the user's notes on the finished video and
  re-make it straight away: no storyboard page, no re-approval (`npm run make` allows it once `out/cut.mp4` exists).

## Storyboard first, then the user's approval, then the video

The user approves every storyboard before the final video is made. Work on your own up to the storyboard
(no questions between stages), then **stop and wait**:

**Storyboard rounds must be fast.** The storyboard exists so that the video is NOT edited yet: it is a plan they can
change in seconds. At the storyboard stage do not render the video. That means:
- no section previews (`make --section`);
- no full-clip preview quality check (`npm run qa <name> -- --preview`);
- no `frames --scenes`;
- no frame sheets for every beat.

Effects that change the picture itself are rendered in Python (cut-outs, gta6_poster, reel_flythrough,
text_behind_slice, 3D behind the person, grades). They cost minutes, and they belong to `npm run make`, after the user
approves. The storyboard page plays the clip with the browser-drawn graphics live; say which scenes have a picture
effect the page cannot play live.

1. Get the storyboard right on your own: write it, `npm run check <name>`, and use `npm run sketch <name>` for the
   layout. Render a single still (`npm run frames <name> <t>`) only when a placement cannot be judged otherwise, e.g.
   whether a card covers the face. The full quality check runs at `make` time and its fixes need no new approval.
2. Run `npm run link <name>` (it starts the local server if needed) and send the user the **storyboard page** it prints
   (`http://localhost:4600/pipeline/storyboard/?project=<name>` on the usual port), plus a short beat-by-beat summary (time, line, what is
   on screen). The page is an animatic for beginners: a phone-size preview that plays right away, every scene as a comic
   panel with 👍 / ✎ Change, the hook called out, and one "Make my video" button (it approves and makes the video). **End your turn there.** Do not make the final video.
3. The user either leaves notes or approves:
   - **Change requests** (they press ✎ Change on a scene, then pastes "apply my storyboard changes"): `npm run review <name>`
     lists them as `STORYBOARD NOTE`s (a 👍 is stored too, as a done mark of kind `keep`; ignore those). Change
     the storyboard (its generator, if the project has one), `npm run check <name>`, then
     `npm run review <name> -- --done <id> "<what you changed>"` for each. The page reloads by itself. Tell the user it is
     ready again and stop. Keep the round to minutes: no rendering. A single still is fine only for a note about
     placement on the face.
   - **"Make my video"**: the page records the approval and runs `npm run make` itself (log in `out/make.log`). Nothing for
     you to do until they review the video.
   - **"Approved" in chat**: `npm run approve <name>`, then `npm run make <name>`.
   `npm run sketch <name>` (a still image of the storyboard, `out/sketch/storyboard.jpg`) is still useful for your own
   check of the whole layout, but it is not what they approve.

`npm run make` and `npm run combine` refuse to write the first `out/cut.mp4` until the current storyboard is approved; a
change to `storyboard.json` before that needs a new approval. After the first video, changes from the user's video notes need none. Run `npm run approve` only after they have said they approve,
never on your own judgement. Section previews (`--section`), stills and sketches need no approval. A template that
renders by itself (`compare`) has no storyboard: show the user the filled-in spec and wait for approval before running it.
Also stop for things that cost money or publish something (paid voices, posting), or when the brief is genuinely ambiguous.

**From a topic or script**

1. Write `projects/<name>/storyboard.json`: one shot per spoken line, 2–3 candidate pieces per shot,
   all from one theme (`"theme": "modern"` unless told otherwise).
2. `npm run check <name>` — fix anything it reports.
3. `npm run voice <name>` — free local narration with real word timings.
4. `npm run stills <name>` — then open each image in `out/review/` and judge the candidates yourself:
   does it show what the line says, is every label readable, is anything cut off?
5. `npm run mark <name> <shot> <A|B|…> <usable|rejected|pick>` for each decision. If no candidate
   works, write a better one and repeat from step 2 for that shot.
6. Before the user sees it, look at every picked shot yourself, at its end (when all its text is in) and at its
   busiest moment: `npm run stills <name>` already made the images, and `npm run sketch <name>` puts them on one sheet.
   Fix now, not after the render, anything that would need a second make: a word running past the frame edge (long
   words in big type are the usual cause: make the type smaller or break the line), a caption sitting on the shot's
   drawing (move the drawing up, or set the caption line lower), text under the top 220 or bottom 450 pixels.
   The quality check does not catch a word cut off by the frame edge. Then send the user the storyboard page
   (`/pipeline/storyboard/?project=<name>`) and **wait for the user's approval** (above).
7. After they approve: `npm run approve <name>`, then `npm run make <name>` — it ends with the quality check. Follow `skills/quality-check/SKILL.md`: on FAIL apply
   each fix to the storyboard and make again until it passes; open `out/qa.png` even on PASS.

**From footage (a talking head)**

Given a reference video or image, analyze it visually first (a video frame by frame) and match its look; see
"When the user gives a reference" in the skill.

1. **Cut the raw take first — always.** `npm run cut <name> <raw video> -- --list` prints the numbered transcript and
   what the cut would remove (dead air, long pauses, fillers, stutters, repeated takes). Read it yourself and look for
   false starts and restarted sentences the detector missed; add them with `--drop <word numbers>` (and `--keep` to
   save anything it drops wrongly). Then run it for real: `npm run cut <name> <raw video> [-- --drop …]`. It writes
   `edit/clean.mp4` (normalised to the house voice level, `audio.voiceLufs` in settings), `edit/words.json` and `edit/edl.json`. Tell the user in one line how long the
   take was before and after and what was removed.
2. `npm run footage <name> projects/<name>/edit/clean.mp4 projects/<name>/edit/words.json` — prepares the clip, finds
   the face, writes a starter storyboard. It refuses a raw take, and `npm run check` / `make` fail a footage project
   without `edit/edl.json`, so this order cannot be skipped by accident. Only a clip that is already edited or a few
   seconds long may skip the cut, with `--uncut` (recorded as `"footage": {"uncut": true}`); say so when you do.
3. **Write the visual plan** (`projects/<name>/plan.json`, next section) from `words.json`, then the storyboard from
   the plan: each beat's piece at its moment, plus zooms on turns in the argument and layouts. Captions run throughout
   and carry the words, so the plan mixes big text, plain talking
   and visuals that explain.
4. `npm run sketch <name>` and look at `out/sketch/storyboard.jpg` yourself: graphics and captions must stay off the red
   face oval and inside the blue safe zone. Fix the storyboard and sketch again. Then send the user the storyboard page
   (`/pipeline/storyboard/?project=<name>`) and **wait for the user's approval** (above).
5. After they approve: `npm run approve <name>`, then `npm run make <name>` — it ends with the quality check (`npm run qa <name>` on its own). Captions place themselves off
   the face and clear of graphics; the check fails captions on the face, outside the safe zone or on a graphic.
   Follow `skills/quality-check/SKILL.md`: apply each fix to the storyboard and make again until it passes,
   and look at `out/qa.png`. Never weaken a check to let a video through.

## The visual plan (before any storyboard)

The plan is built for videos that teach something. It exists to keep the video varied and engaging: big text behind the speaker, then just the speaker
talking, then a visual that explains the idea, then text again. Not every idea needs a picture, but the key ones get one
that clarifies them, never the spoken sentence repeated in big type. The first pass does not look at the library at all.

**Pass 1, the moments (`plan.json`).** Read the transcript and split it into beats (a listicle: roughly one per item,
plus the hook, any turn and the ask). For each beat choose its `kind` and write what is said, the idea, and what we see:
- `text`: a big type moment (a word slammed behind the speaker, a headline), for punch;
- `talk`: just the speaker, no graphic, a breather that makes the next visual hit harder;
- a picture that explains (`ui`, `diagram`, `chart`, `object`, `demo`), as concrete as a sketch: "an ad dashboard where
  the sales line climbs as the spend switches on", "a calendar invite: AI workshop · 12 seats · $2,000". Ask: what would
  make this land in one second on a phone, with the sound off?

**Plan the sound with the picture.** Everyday sounds are automatic (a whoosh on a cut, a pop when a card lands;
"Sound effects follow the picture"). The plan decides the moments that carry the story: a `riser` building suspense into
a reveal or a big number, an `impact` or `trailer_hit` on the biggest line, a `sub_drop` under a heavy stat, a `ding` or
`coin` on a win, and silence before a punchline (`"cue": null`). Write it on the beat as `"sound": {"cue": "riser",
"why": "suspense into the $2,000 reveal"}`; it goes onto that beat's overlay as `"sound": "riser"` and always plays (a
riser starts 1.6 s early so it peaks on the moment). Save the big cues for a few moments; they stop working if every
beat has one.

**Plan the pace with the beats.** A beat is a phrase, not a sentence: a new picture or a new element lands about every
1-1.5 s, on the stressed word, and something keeps moving in between. Split long sentences into two or three beats
("Step one. Open Claude Code," / "or ChatGPT Work," / "and type: …"), and give each beat its moments (`"at"`: the word
a stamp, strike, chip or count lands on). With a reference, measure both with `npm run pace` and match its numbers.
In a shot video set `"lead": 0` so cuts land on the first word.

Then read the sequence as a whole: does it keep changing? Never the same kind three beats running; at least three kinds
in a video; at least a quarter of the beats explain with a picture.

**Pass 2, the theme.** For each beat pick the piece in the base theme that draws that picture (overlays, d3 charts,
three.js scenes, lottie, UI kits; check catalogs and `/dashboard/?theme=<theme>`). When none does, **build it in the
theme** (a calendar, an ad dashboard, a DM thread): a new piece in `library/themes/<theme>/` that draws with the theme's
kit, palette and fonts (three.js, d3 or canvas, whatever suits), follows the piece contract and gets a catalog entry
(`library/themes/BUILDING-A-THEME.md`). Every visual in the video looks like one family. Then write the storyboard.

```json
{"beats": [
  {"at": 41.2, "said": "run ads for a business that's already selling", "idea": "ads multiply sales that already exist",
   "visual": "an ad dashboard where the sales line climbs as the spend switches on", "kind": "ui", "piece": "overlays/ad-dashboard",
   "sound": {"cue": "riser", "why": "build into the sales line taking off"}},
  {"at": 43.1, "said": "the sales line takes off", "idea": "same", "visual": "same dashboard, line climbs", "kind": "ui", "piece": "overlays/ad-dashboard",
   "moments": [{"at": 43.6, "what": "spend toggle flips on"}, {"at": 44.2, "what": "line climbs, +312% chip"}]},
  {"at": 44.9, "said": "and that's the easiest one", "kind": "talk"}
]}
```

`kind` is one of `talk`, `text`, `ui`, `diagram`, `chart`, `object`, `demo`, `footage` (a `talk` beat needs only `said`).
A beat is a phrase; one visual may span several beats (same `piece`, counted once for variety). `moments` are optional
extra hits inside a beat (`at` + `what`). `npm run footage` puts `"plan":
"plan.json"` in the storyboard, and from then on `npm run check` (and `make`) fails when the plan is missing or
incomplete, when one kind runs three beats in a row, when it uses fewer than three kinds (six beats or more), when
fewer than a quarter of the beats explain with a picture, when a picture beat uses a words-only piece, when a piece
does not exist yet, when the storyboard does not show a beat's piece at its moment, when a planned sound cue is
not in the storyboard around its beat, when nothing new lands for more than 3 s (outside a
`talk` beat), or when a `talk` beat runs over 4 s. Title each section with its
beat's visual, so on the storyboard page they approve ideas, not piece names.

## Templates

A template is a reusable structure, a theme is a style. When a request matches a template in `templates/` (`npm run template` lists them), build the project with it instead of writing the storyboard by hand: copy its `example.json`, fill it in, `npm run template <template> <spec> <project>`, sketch it and get the user's approval, then `npm run make <project> -- --scale 1`. UI a template needs goes into a UI kit in `library/ui/<name>/` (the Claude app is `library/ui/claude/`, named `"theme": "ui/claude"` in a storyboard).

## Storyboards

A storyboard is where the video is won or lost. Hold every one to this:

- **Plan inside the app safe zone.** TikTok, Reels and Shorts draw their search bar over the top 220 px, and the
  caption, name and buttons over the bottom 450 px (sides 35 px; the button column right of x 945 below y 1160; 1080x1920). Big text,
  every graphic box and the face go inside it from the first storyboard; the user should never have to ask.
  `npm run check` refuses overlay regions and layouts that put a box or the face there, the storyboard page shades
  those edges, and the quality check fails headline words (`text-safe-zone`) or the face (`face-top-bar`) under them.
- **Start from the library.** The themes already hold hundreds of visuals. For each beat, shortlist
  the existing pieces that could show it (the catalogs say what each does) before thinking about
  building anything. Build a new piece only when nothing fits.
- **Audition, then pick by looking.** Put the real content into 2–4 candidate pieces, render stills
  (`npm run stills` for shots, `npm run frames <project> <seconds…> -- --sheet` for footage), look at
  them side by side and keep the one that looks best and reads fastest on a phone.
- **Every beat has a job**: hook, proof, demonstration, payoff, call to action. The visual must make
  the spoken point land faster than the words alone. Cut anything that is only decoration.
- **Charts wherever a quantity or comparison is spoken or true.** Use the `d3/` pieces with real
  data: numbers from the script, or facts about the project itself. Never invented figures.
- **Contrast between neighbours.** Consecutive beats should differ in layout, scale, colour or
  direction of motion, and the strongest visuals belong on the strongest lines.
- **Pace for short video.** Something changes roughly every half second to a second, landing on
  stressed words; nothing holds still for more than about a second without motion inside it.

## Superimposing on a person

Graphics must never sit on the speaker's face, and words must be readable on the picture behind them: light letters over a
bright part of the picture (a white top, a pale wall) need their own card, tab or outline. `npm run footage` measures the
picture where captions sit and `npm run check` refuses a caption style with no box when it is too bright. `faces.json` (written by `npm run footage`, using
the YuNet face detector in `library/models/`) records where the face is at every moment; its
`bounds` give the area to keep clear. Put panels and counters above or below that area, and use
a face-following piece (`props.locate`) when a graphic should follow the face. Zooms push in toward the face automatically.

**The face never sits at the very top of the frame** (the user's rule): above y 220 it is under the app's top bar and
search field. This holds in every scene and every layout: a small clip window (a plate above a chart, a card) starts at
y 220 or lower, never at the top edge; in a full layout keep the face (forehead included) below y 220, lowering `face`
(fy) or that moment's zoom if needed. The quality check fails it (`face-top-bar`).

## Themes

A theme is one unified style — fonts, captions, effects, overlays, diagrams, 3D and Lottie — in
`library/themes/<theme>/`. One base theme per video; a second theme may be used sparingly as a deliberate accent when the user asks for it
(an overlay, effect, transition or caption-track entry names it with `"theme": "…"` — a handful of beats, never two styles fighting). New pieces for a theme must draw with that
theme's kit (`library/themes/<theme>/kit.js`) so they match the rest.
Themes take inspiration from a genre; every piece is original work, never a copy of someone's template.
A theme that is another theme redrawn with a different kit says `"extends": "<theme>"` in its `theme.json` and keeps only the pieces that differ: a piece it does not have is the parent's, loaded at the child's address
so it draws with the child's `kit.js` (`themeFile` in `pipeline/tools.mjs`). Its catalogs still list every piece.

**Where a new piece goes (one question each, in order):**
1. A real product the viewer recognises (Claude Code, Instagram DMs, iMessage, a YouTube screen)? → `library/ui/<app>/`.
   It looks exactly like the real app in every theme (named with `"theme": "ui/<app>"`). Never a made-up "some app" mockup.
2. The theme's signature look (the GTA6 poster, a minimal card)? → that theme's folder. Other videos borrow it by name.
3. Anything else (stat card, arrows and circles, diagrams, charts, tier lists, 3D explainers)? → `library/_shared/common/<category>/`.
   Drawn once with `_shared/common/kit.js` and the theme's `look` (theme.json), so it wears every theme. Never hard-code a colour or font.
   A theme's own piece of the same name wins, so a theme can still restyle one.
Before building, check all three places: a piece another session already built is usually there.

## Styles: the user's look, over any theme

A style (`style/`, `npm run style`) is the user's look: colours, fonts, captions and grade, laid over whatever theme
the storyboard uses. Themes keep their pieces; the style changes what they wear (`library/_shared/style.js`).

- **From a reel they like:** `npm run style -- from <reel URL or file>` downloads and measures it (pace, grade, palette)
  and drafts `style/references/<name>/style.json`. Instagram needs a login: ask the user before using `--cookies <their browser>` (their standing choice, once given, is `style.cookiesBrowser` in settings).
  Then look at `sheet.jpg` and `frames/` yourself and fill in `fonts` and `captions` (`npm run style -- fonts` lists the
  families bundled here). In `colors`, `accent` is the colour that pops, `ink` the dark surface, `paper` the light one.
  Take only general traits (colours, type feel, pace), never a reference's layouts, graphics or assets.
- **The user's profile** is `style/profile.json` (`npm run style -- use <name>`). New footage projects get `"style": "profile"`;
  `npm run style -- apply <project>` adds it to an existing one (and to its build-storyboard.py, if it has one).
- **Learn from the user's marks.** When a review mark shows a taste rather than a one-off fix ("too many graphics", "captions
  too big", "hate the blue"), change the profile (`npm run style -- set captions.size 5`) or record it
  (`npm run style -- learn "fewer graphics, two per section at most" --project <name>`). Read the profile's `prefs`,
  `notes` and `pace` before writing any storyboard and follow them, so the next video needs fewer marks.
- Readability rules (text size, contrast, safe zone) still win over matching a reference.

## Rules for pieces

- `seek(t)` depends only on `t`: no timers, no `Math.random`, no `Date.now`.
- After adding or changing a piece, look at it (the dashboard, or `npm run stills`). A piece that
  runs without errors can still be unreadable.
- Do not invent statistics. Data shown in a diagram is either from the script or labelled illustrative.
  The user may ask for made-up figures in their own video; do that only when asked, only where asked, and note in the project that they are invented.

## Map for agents (read this instead of the code)

Everything below is true of the code today; follow the pointers only when you need more.

**Where things are**

| Path | What |
| --- | --- |
| `projects/<name>/storyboard.json` | the video. Shot videos: `shots[]` (`id`, `narration`, `candidates[]` each with a full-frame `background` piece, `pick`, optional `duration`, `emphasis`, `tone`), `sections[]`, `theme`, `captions`, `voice`. Footage videos: `footage` + `overlays[]`. Formats in `README.md`. |
| `projects/<name>/build-storyboard.mjs` (or `.py`) | when present, the storyboard is generated: edit this, never the JSON |
| `projects/<name>/voice/` | narration clips + `voice.json` (per-shot word timings) |
| `projects/<name>/review.json` | the user's notes: `stage: "storyboard"` (before the video) or `"video"` (on the finished cut). `npm run review <name>` reads them |
| `projects/<name>/approval.json` | the user's approval, a fingerprint of `storyboard.json` (`pipeline/approve.mjs`) |
| `projects/<name>/out/` | everything generated: `review/*.jpg` stills, `sketch/`, `cut.mp4`, `qa.png`, `make.log` (not committed) |
| `library/themes/<theme>/` | a style: `theme.json`, `kit.js` (drawing helpers), and one folder per category (`scenes/`, `overlays/`, `captions/`, `transitions/`, …) each with `catalog.json` + `pieces/*.js` |
| `library/_shared/` | loader, captions engine (`captions.js`), safe zone (`placement.js`), `stage.html` (one piece on its own) |
| `pipeline/` | the commands (`check`, `voice`, `stills`, `sketch`, `approve`, `make`, `qa`, `review`) and the browser pages: `storyboard/` (the user's sign-off), `draft/` (live player, also what frames are drawn from), `review/` (finished video) |
| `settings/` | `defaults.json` (shared defaults) and the user's own `user.json` (git-ignored): name, handle, loudness, mix. See "The user's settings" |
| `dashboard/serve.mjs` | the local server (`npm run dashboard`; port 4600, or the next free one: `npm run link` prints the address) and its JSON API, listed at the top of the file |

**A piece** (`library/themes/<t>/<category>/pieces/<name>.js`): `export const meta = {duration}`, `export const defaults = {…}`,
`export function mount(el, props) { …; return {seek(t) {…}} }`. `seek` is a pure function of `t` (seconds from the start
of the shot): no timers, no randomness. Add it to the category's `catalog.json`. Draw with the theme's `kit.js`.
- A kit's `scene(el, opts)` reads `width`/`height` from `opts`: pass `{mode: p.mode}`, never the whole props object.
- Prefix CSS class names per theme (`mn-card`, `mn-chip`): the dashboard's stylesheet has global `.card` and `.chip` rules
  that leak into the player.
- Look at one piece without a project: `http://localhost:4600/library/_shared/stage.html?theme=<t>&piece=<category>/<name>&t=<s>&props=<url-encoded JSON>`.
  Headless screenshots: the Chrome in `.tools/browser/` (`import('./pipeline/tools.mjs').then(m => m.browserBinary())`)
  with `--headless --screenshot=<png> --window-size=1080,1920 --virtual-time-budget=4000 <url>`.

**Timing** (`pipeline/timeline.js`): a shot lasts `duration` if set, else 0.1 s lead + its narration + 0.3 s tail; its
narration starts 0.1 s in. Time beats inside a scene to the spoken word that triggers them, using the word starts in
`voice/voice.json` (a small generator script with a helper that looks a word's start time up is the usual way). Per shot, `"emphasis": {"word": 1|2|3}`
styles caption words and `"tone": "light"` darkens captions on light backgrounds.

**Captions and the quality check** (`pipeline/qa.py`, `library/_shared/placement.js`): the frame is 1080×1920; captions
must stay inside x 35–1045 (945 on the right below y 1160) and y 220–1660 (captions may sit lower than graphics, whose bottom is 1470; the user's preferred caption line is `captions.bottom` in settings, about y 1650 by default, with captions on all the way through). Captions sync: the word being spoken must be
in the caption on screen, so a phrase must not span a shot cut, and the last word of a shot must end before the cut.

**Voice** (`pipeline/voice.mjs`): free local Kokoro by default. `"provider": "elevenlabs"` needs `ELEVENLABS_API_KEY` in
`.env.local` and makes one call per shot with exact word timings; `"speed"` is applied afterwards with ffmpeg
(ElevenLabs' own speed setting stops at 1.2). `"provider": "recorded"` uses clips already in `voice/` (one long take
cut per shot at the pauses between lines), for when there is no key. Paid voices cost money: ask first.

**Pace, camera and sound on shot videos:** a shot can carry
`"camera": {"push": 0.012, "kicks": [{"at": 1.2, "amp": 0.9}]}` (slow push-in plus a zoom bump and decaying shake at
each kick, on the picture only, `pipeline/draft/player.js`) and `"sounds": [{"name": "pop", "at": 1.2, "gain": -18}]`
(`at` in seconds into the shot, may be down to -1 to lead a cut; names from `library/_shared/sfx`). Aim for something
landing on every stressed word (0.4-0.8 s apart), a fast whoosh 0.12 s before each cut, sounds 14-22 dB under the voice
and never two within 0.25 s. The storyboard page plays the sounds; `make` mixes them (`pipeline/sounds.py`).
A generator script can derive kicks and hits from each shot's `emphasis` automatically.
The minimal theme has modes `dark`, `light`, `claude` (warm ivory), `clay` (saturated clay-orange field, white cards), `sky` (saturated periwinkle field), `charcoal` (Claude-app near-black field, ivory cards, clay accent) and `uv` (blacklight). Text drawn straight on the field uses `M.fieldInk` / `M.fieldDim`, text on cards uses `M.ink` / `M.dim`. Dark modes (charcoal, dark, uv) add an ambient layer (drifting dot grid, rising sparks, slow light blobs) driven by the playhead through `el.__ambient(t)`, which the player calls after each piece's seek; pass `ambient: false` to a scene to turn it off.

**Music and effects:** every sound in `library/_shared/sfx` is synthesized in code (`npm run sfx` rebuilds them), so they can be shared freely. No music beds ship: `library/_shared/music/catalog.json` is empty until the user adds their own mp3 and an entry (its `beatAt` is where the beat kicks in). A shot storyboard sets one bed with `"music": {"name", "start"}`; never name a bed that is not in the catalog.

**Presenter:** `"presenter": {"name": "mushroom", "x", "height", "bottom", "room"}` puts a narrating Lottie character at the bottom of every shot (library/_shared/presenters: generate.mjs writes <name>/body.json + mouth.json; presenter.js plays them). Its mouth is driven from the narration clips' loudness, gated by the transcript's word times, 40 ms early, with a wide and a round mouth shape; the shot graphics are scaled by `room` so they sit above it.

**Sound effects follow the picture (automatic).** Every event brings its own sound (`soundCues` in `pipeline/timeline.js`,
the picture decides the sound): a whoosh into each cut and transition, a swish on each layout move, and a sound
for each graphic as it lands, picked from its name (a slam stamps, a counter ticks, a card pops, money chimes). A taste
filter keeps it sparse, about one sound every 1.5-2 s: cuts and slams always play; pops and ticks need 0.35 s of room and
at most one a second. Do not place sounds by hand by default. Only for a moment that needs a specific sound: set `"sound":
"<sfx id>"` (or `null` for silence) on that overlay, effect, transition or layout, or add it to `"sounds"`. A storyboard
that has a `"sounds"` list and no `"autoSounds": true` is hand-placed only (older projects); `"autoSounds": false` turns
event sounds off. `npm run check` prints how many sounds play and how many are automatic; the storyboard page plays them.

**House mix (every video):** the voice is normalised to the house level (`audio.voiceLufs` in settings, default -14 LUFS; a storyboard's `voiceLufs` overrides it for one video) and is always the loudest thing. Every other level is set against the speaking level, never against the file: music set by loudness as heard (LUFS, not raw power — bass-heavy beds otherwise vanish on phones): -15 LU in the gaps and about -21 under the words (`gain`/`duck`, capped at -10); prefer light, mid-range beds; each effect's loudest 100 ms at `gain + 6` dB (default -14 gives -8 dB, never above -4) and 4 dB softer under the words, so effects pop in the gaps without covering words. Each mix prints "Levels vs the voice" and writes them to sound-report.json (`levelsVsVoice`). Visuals: keep text and key numbers inside `SAFE` (kit.js) — no content within 35 px of either side or under the right-side app buttons (`library/_shared/safe-zone.json`). Only add sounds and music you have the right to share.

**Direct the voice with punctuation** (ElevenLabs reads it as intonation; never send the caption text raw). Write a
performance script with the same words as `narration` (keep it next to the take, e.g. `projects/<name>/voice/take.md`): `?` makes the
pitch rise, `,` is a short breath (leave it out where words should run together), `.` falls and pauses, `…` holds a
beat before a reveal, `—` punches in, `!` lifts energy (sparingly), CAPS stresses one word per line at most, spell
numbers out the way they are said, `<break time="0.4s" />` (multilingual v2 only, 3 per take at most) for silence
before a payoff. eleven_v3 has no break tags; it uses `[excited]`-style audio tags instead. Show the user the
performance script before paying for the take.

**User-facing pages**: storyboard `http://localhost:4600/pipeline/storyboard/?project=<name>`, finished video
`http://localhost:4600/pipeline/review/?project=<name>`. Get them from `npm run link <name>` and `npm run link <name> review`. Send the user these links, not image paths.

---
name: make-video
description: Use when making or editing short vertical videos in this repo — writing or changing a storyboard, editing a talking-head clip (cut, transcribe, layouts, zooms, captions, effects, transitions, sounds), choosing or building theme pieces, re-rendering one section, or acting on the user's review marks.
---

# Making videos: the working playbook

`docs/REFERENCE.md` is the reference (every storyboard field, every tool). `CLAUDE.md` holds the standing rules.
The person you are working for is described in `settings/user.json` (name, handle, loudness, caption line) and
`style/profile.json` (their look and learnt tastes): read both before writing a storyboard, and write lasting preferences
there, never into code or a piece (AGENTS.md, "The user's settings").
This file is how to get a good video out quickly and change it without wasting the user's time.

Carry a job on your own up to an approved-ready storyboard, without asking questions between stages. Then **stop**:
send the user the storyboard page (the link `npm run link <name>` prints; it starts the server if needed)
with a short beat-by-beat summary, and end your turn. There the user plays it, leaves a note per scene, or presses
"Approve & make video" (which approves and makes it for you). Notes: `npm run review <name>` lists them as STORYBOARD
NOTEs; apply, `--done` each, tell the user, stop. If they approve in chat instead: `npm run approve <name>`, then
`npm run make <name>`. `make` refuses without a current approval; any storyboard change after it needs a new one.
Also stop for things that cost money or publish something, or when the brief is truly ambiguous.

**Storyboard rounds must be fast (the user's rule).** At the storyboard stage do not render the video: no
`make --section`, no `qa --preview`, no `frames --scenes`, no frame sheets for every beat. Edit the storyboard, `npm run
check`, `npm run sketch` if needed, send the link. One still only for a face-placement question. Python picture effects
(cut-outs, poster, fly-through, 3D behind the speaker, grades) are rendered by `make`, after approval.

## 1. Pick the workflow

| You are given | Workflow | Storyboard has |
| --- | --- | --- |
| A topic or a script, no footage | **Shot storyboard**: one shot per spoken line, narrated locally | `"shots": [...]` |
| A recorded clip (a talking head) | **Footage edit**: the clip runs throughout, graphics on top | `"footage": {...}` |

A project is `projects/<name>/` (lowercase letters, digits, dashes). Everything it needs lives there.

### When the user gives a reference

A reference (a video, an image, a link, "make it like X") sets the **look** as well as the pacing. Analyze it visually
before choosing a theme or writing a storyboard. Reading its script or notes is not enough.

- **A video:** go through it frame by frame. Make contact sheets that cover the whole video, at least 2 frames a
  second, plus every shot change:
  `ffmpeg -i ref.mp4 -vf "fps=2,scale=270:-1,tile=6x4" ref-sheet-%02d.jpg`, and add
  `select='gt(scene,0.3)'` to catch the cuts. Open every sheet. Step through fast beats one frame at a time.
- **An image:** open it at full size.
- **Write down what you see**, beat by beat, in `projects/<name>/reference.md`:
  - backgrounds and colours;
  - type (font, weight, case, size, placement);
  - the caption style and how keywords are highlighted;
  - layouts (full frame, cards, split, takeovers);
  - each graphic and what it shows;
  - transitions and effects, and where they land;
  - the cut rate.
- **Measure its pace** with `npm run pace -- <ref.mp4>` (words per second, first word, visual hits per second, the
  longest still stretch) and write the numbers into `reference.md`. A contact sheet shows the look, not the pace: step
  through the first 6 s at 6 frames a second (`fps=6,tile=12x3`) and note what lands on which word.
- **Pick the theme that matches.** Then say in one line which theme or UI kit matches and what differs. If none
  matches, adapt or build one; do not fall back on the default (`modern`).
- **Compare before reporting.** Put the reference's sheet beside your own (`npm run frames ... -- --sheet`) at the same
  beats and fix what does not match. Then render a section of ours and run `npm run pace` on it: our visual hits per
  second and longest still stretch must be within about 20% of the reference's before the storyboard goes to the user.

## 2. Themes

- One **base theme** per video (`"theme": "gta6"`); every graphic, caption, effect and transition comes from it. The
  table of looks is in `README.md`; the dashboard (`/dashboard/?theme=<theme>`) shows every piece moving.
- A **second theme only as an accent**, only when the user asks, on a handful of beats: an overlay, effect, transition
  or caption-track entry carries `"theme": "gta6"`. Two styles must never compete in one frame.
- Build a new piece only when nothing in the library fits. It draws with the theme's kit, follows the piece contract
  (`seek(t)` depends only on `t`), gets a `catalog.json` entry, and you look at it before using it
  (`library/themes/BUILDING-A-THEME.md`).
- **The Claude app look** (`library/ui/claude/`, a UI kit, not a theme) works in any video, over any base theme: an
  overlay with `"theme": "ui/claude"`. Use it whenever a video shows Claude doing the work. Pieces (`overlays/…`):
  `composer` (clip attached, slash command typed on the keyboard with autocomplete; `menu` + `hold` show the
  slash-command list), `chat` (command pill, "Editing with…" spark; put the clip in a card layout x 30, y 545,
  632 x 1125 for the result; or `reply` for a streamed answer), `stamp` ("Edited by Claude" pill on a result),
  `greeting` (new chat, a keyword typed and sent), `endcard` (comment-keyword end card with a grid of results).
  Full-screen pieces paint the whole app, so use them as cutaway moments, not over the face. To restyle
  the app, edit `library/ui/claude/ui.js` (colours, top bar, keyboard, icons): every piece draws with it.

## 3. The storyboard standard

1. **Start from the ideas, not the library.** Write the visual plan first (AGENTS.md, "The visual plan"): for each
   beat, its kind (big text, just talking, or a picture that explains), then the theme piece that draws it, or a new
   piece built in the theme. Keep it varied; the key ideas get explanatory visuals; plan the story sounds (risers into reveals, hits on the big
   line, silence before a punchline). `check` enforces it on new projects.
2. **Audition 2–4 candidates and pick by looking.** Put the real content in, render stills side by side, keep the one
   that reads fastest on a phone. Record what was tried and why the winner won (`auditions.md` in the project).
3. **Every beat has a job** — hook, proof, demo, contrast, turn, payoff, ask. If a visual does not make the spoken
   point land faster than the words alone, cut it.
4. **Contrast between neighbours**: consecutive beats differ in layout, scale, colour or direction of motion.
   Strongest visual on the strongest line.
5. **Pace**: something changes every half second to a second, on stressed words; nothing sits still for more than
   about a second. In a shot video (no footage) this means **one shot per phrase, not per sentence** (about 1-1.5 s),
   hard cuts inside a sentence (no transition) and a short punch between sentences, **timed beats inside every shot**
   (a stamp, strike, chip, tick or counter on the key word, from the word times), and `"lead": 0` in the storyboard
   so each shot opens on its first word instead of 0.1 s of silence (cut the take mid-pause, a hair after each last
   word). One scene per sentence at 2.4 s a shot reads as much slower than a fast-cut reference.
6. **True data.** Numbers come from the script or from the project itself (`"use": "project"` pieces read the edit
   decision list and the storyboard). Never invent figures — unless the user asks for made-up ones in their own video;
   then do it only where asked and record it in the project (a comment in the generator and a line in `auditions.md`).

Name the beats as **sections** (below) so they can be previewed and reviewed one at a time. A long storyboard is
easier to keep right when a small script writes it (`projects/<name>/build-storyboard.py` or `.mjs`); if a
project has one, edit the script and re-run it, never the JSON.

## 4. Shot storyboard, start to finish

```sh
npm run check <name>      # every piece, effect, transition exists; prints the running order and sections
npm run voice <name>      # free local narration with real word timings (only changed lines are redone)
npm run stills <name>     # out/review/<nn>-<shot>.jpg: every candidate side by side — open them and judge
npm run mark <name> <shot> <A|B|…> <usable|rejected|pick>
npm run sketch <name>     # one still image of the whole storyboard: look at every shot for words cut off by the frame edge and captions on the drawing, and fix before sending
# then send the user the link from `npm run link <name>` and stop until they approve (or presses the button)
npm run approve <name>    # only after the user said yes
npm run make <name>       # check + voice + combine -> out/cut.mp4 (full 1080x1920; QA fails a half-size cut)
```

2–3 candidates per shot. If none works, write a better one and go round again for that shot.

## 5. Footage edit, start to finish

1. **Cut** a raw take: `npm run cut <name> <raw video> -- --list`, then `npm run cut <name> <raw video>` (with
   `--drop` / `--keep` word numbers for your own decisions: read the `--list` output for false starts and restarted
   sentences the detector missed). It writes `edit/clean.mp4`, `edit/words.json`, `edit/edl.json`. Never skip it:
   `footage` refuses a raw take and `check`/`make` fail without `edit/edl.json` (only `--uncut`, for an already edited
   or few-second clip, skips it).
   The user wants it tight: every pause over 0.15 s goes (`--gap`, the default), but never the tail of a sentence
   (`--pad-end`, 0.22 s). Whisper hides false starts and pauses inside stretched words, so the cut re-transcribes every
   word over 0.7 s, cuts silences measured in the sound, and prints "Check by ear" for anything still suspicious. Read
   that line before building the storyboard.
   Audio: the cut levels every phrase to the same loudness (they move nearer and further from the mic), then
   normalises to the house voice level (`audio.voiceLufs` in the user's settings, -14 LUFS by default). For an existing cut, redo only the
   audio with `node pipeline/cut.mjs <name> --relevel`, then `npm run footage` and `npm run make`.
   Trims after the cut: the review page's trim buttons (pause on the moment in a scene, "Cut start → here" or "Cut here → end", then "Apply trims") or
   `node pipeline/trim.mjs <name> --cut a-b,c-d [--make]`. It cuts edit/clean.mp4, moves words/edl, records
   edit/trims.json, and keeps every graphic on its word. A build-storyboard.py must call `apply_trims` (pipeline/trims.py)
   just before writing storyboard.json, or re-running it undoes the user's trims.
2. **Prepare**: `npm run footage <name> projects/<name>/edit/clean.mp4 projects/<name>/edit/words.json --theme <theme>`
   (transcribes locally if no words are given; writes `faces.json` and a starter storyboard).
3. **Read `words.json`** and place everything on the words: a counter when a number is said, list items as they are
   named, a chart when a quantity or comparison is spoken.
4. **Face clearance.** `faces.json` `bounds` is the area to keep clear. Nothing may sit on the face. Put panels above or
   below it; use face-following pieces (`props.locate`) when a graphic should track the head.
5. **Layouts** move the clip itself (card, half frame, small window over a chart, split). Use them for contrast between
   beats; a hard switch (`"ramp": 0`) on a jump cut, a short move elsewhere.
6. **Zooms** on stressed words and turns in the argument; vary the sizes; `rampIn`/`rampOut: 0` for a punch on a cut.
7. **Captions** run throughout. `captionTrack` switches style for a stretch (dark type on a light backdrop), moves the
   captions (`dy`) or hides them under a busy card. `emphasis` marks the words that matter; level 2 puts a word alone.
8. **Effects** change the footage only, so type stays sharp. Add `"layer": "all"` only when the whole picture,
   captions included, should be hit (a strobe, a grade the script calls for).
9. **Transitions** sit exactly on a cut in the picture (`at` = the cut). Put a punch-in change or an effect on every
   jump cut in `edl.json` so the cuts read as intended.
10. **Sounds are automatic**: each cut, transition, layout move and graphic brings its own sound, thinned so they never
    crowd (AGENTS.md, "Sound effects follow the picture"). Do not write a `sounds` list by hand; override one moment with
    `"sound": "<sfx id>"` / `null` on that entry (`library/_shared/sfx/`, `gain` −10 to −20 dB, `siren` about −24).
    The voice is never altered; check `out/sound-report.json` after a make.
11. **Approval.** `npm run check <name>`, check the layout with `npm run sketch <name>` (no rendering at this stage), then send the user the storyboard page (`/pipeline/storyboard/?project=<name>`) and a
    beat-by-beat summary, and stop. After they approve:
    `npm run approve <name>`, `npm run make <name>`. Fixing a FAIL in the final quality check needs no new approval.
    Approval is needed once: after the first video, the user's notes are applied and the video re-made directly.

## 6. Sections, the cache and quick looks

- **Sections** name the parts of a video. Footage: `"sections": [{"id": "hook", "title": "…", "start": 0, "end": 1.7, "job": "hook"}, …]`
  in seconds, covering the clip with no gaps or overlaps. Shots: `{"id", "title", "shots": ["hook", "pipeline"], "job"}`,
  every shot once, in order. Without them sections are derived (cuts in the picture, or one per shot).
  `npm run check <name>` lists and validates them.
- **A re-make only redoes what changed.** Drawn frames, half-second chunks of the composited picture and the later
  passes are kept in `projects/<name>/.cache/`, keyed by everything they are made from (storyboard entries on screen,
  piece and theme code, words, size). Change one prop and only that stretch is drawn and composited; the transitions and
  sound passes then run over the whole video (seconds). Nothing changed: it says so and does nothing.
- **Effects are keyed one by one.** A chunk holds the fingerprint of only the effects on it (`pipeline/effect_stamps.py`),
  so editing `gta6_poster` in `library/_shared/signature.py` re-composites only the poster's chunks, and a shared helper
  only the chunks of effects that call it. Don't hesitate to fix one effect for fear of re-making every video.
- **The quality check re-measures only changed frames** (`out/.layout-frames.json`) and reuses the transcript when the
  sound is identical (`out/heard-audio.txt`), so a picture-only note re-checks in seconds, not minutes.
- `--no-cache` redoes everything. Use it when a result looks stale, or for one clean full draw of a deliverable
  (a frame drawn out of order can differ from the same frame drawn in order by a few pixels at 1–3 levels of 255: invisible, not bit-identical).
  The cache is safe to delete (`rm -rf projects/<name>/.cache`). Editing what the draft page loads to draw
  (`pipeline/draft/`, `pipeline/timeline.js`, the `library/_shared` modules they import) invalidates every graphics frame;
  editing one piece file invalidates only the frames it is on; Python effects, `inspect.js` and the quality check invalidate no frame.
- **Section preview**: `npm run make <name> -- --section <id>` (or `--section 18.2-20.4`, add `--scale 1` for full
  size) writes `out/sections/<id>.mp4` with sound, half a second either side, without touching `out/cut.mp4`.
  What it makes is reused by the next full make.
- **Stills** are faster still: `npm run frames <name> 18.4 19.2 20.1 -- --sheet`.

## 7. The review loop

The user watches on the review page (`npm run link <name> review` prints the link), selects a section or a range and
leaves a mark: a note, a kind (change / cut / keep / question) and a status. Marks are `projects/<name>/review.json`.

```sh
npm run review                                   # which projects have open marks
npm run review <name>                            # each open mark: reference, range, note, what is on screen there
npm run review <name> -- --progress m3           # say you are on it
npm run make <name> -- --section <id>            # a quick look at just that part while you work
npm run make <name> -- --scale 1                 # re-make right away: no storyboard page, no new approval at this stage
npm run review <name> -- --done m3 "what you changed"      # closes the mark; the page shows the reply
npm run review <name> -- --reply m3 "a question back"      # answer without closing
```

Rules: change **only** what the marks ask for, in the sections they point at; `keep` marks mean leave it alone;
answer `question` marks with `--reply` instead of editing; look at the result before `--done`; say in the reply
exactly what changed. When the user writes a reference such as `my-video · reels (18.2–20.4 s)`,
that is the project, the section id and the range.

## 8. Looking at results

You cannot watch video or hear sound. Look at stills, and say so: ask the user to watch for motion, timing and audio.

- Shots: `npm run stills <name>`. Footage: `npm run frames <name> <seconds…> -- --sheet`, or
  `--from 3 --to 6 --fps 6 --sheet` for a run. Frames show everything except transitions and sound.
- For transitions or the finished file: `ffmpeg -ss <t> -i projects/<name>/out/cut.mp4 -frames:v 1 /path/still.jpg`.
- Check, every time: nothing on the face; nothing cut off or above y ≈ 190; every label readable at phone size;
  the frame at the middle **and** the end of each graphic's slot (is the text fully in?); captions not fighting a card;
  the first frame is already interesting; neighbours look different.
- Read `out/sound-report.json`: true peak at or under −1.5 dBTP and the mix within half a LU of the voice, or a `note` saying why not.

## 9. Pitfalls already paid for

- **Graphics over the face.** Check `faces.json` bounds after zooms and layouts, on frames, not in your head.
- **Top-of-frame safe area.** Keep graphics at about y ≥ 190 (frame pixels, 1080×1920), and off the hair when the head is high in frame.
- **Text caught mid-entrance.** A slot shorter than the piece's entrance shows half-arrived text. Give each element
  about 1.2 s, or use a faster piece, or start it part-way in with `"offset"`.
- **Invented numbers.** A chart with made-up figures is a defect unless the user asked for it and it is recorded.
- **Captions on busy cards.** Hide or move captions (`captionTrack` `hide` / `dy`) while a full card is up.
- **`visibility: visible` inside a piece** shows through an overlay that is hidden; pieces must not set it explicitly.
- **Waiter loops that `pgrep -f` their own pattern** never end. Wait on a process id or on the output file instead.
- **Things left running.** A make starts headless browsers and FFmpeg; when you stop one, make sure they are gone
  (`pgrep -fl chrome-headless-shell`). Leave only the dashboard server running.
- **Stale server.** After changing `dashboard/serve.mjs`, restart the server.
- **Editing generated JSON.** If the project has a generator script, change the script.
- **Old versions.** `out/cut-v<n>.mp4` are the user's earlier iterations: never overwrite or delete them. To keep
  the current cut before a big change, copy it to the next `cut-v<n>.mp4`.

## 10. Commands

| Command | What it does |
| --- | --- |
| `npm run dashboard` | The local server: `/dashboard/`, `/pipeline/draft/`, `/pipeline/review/` (port 4600, or the next free one) |
| `npm run link [<name> [review]]` | Prints the right link (dashboard, storyboard page or review page); starts the server if needed |
| `npm run check <name>` | Validate the storyboard; print the running order and the sections |
| `npm run voice <name>` | Narrate a shot storyboard locally (free) |
| `npm run stills <name>` / `npm run mark …` | Review candidates of a shot storyboard without a browser |
| `npm run cut <name> <raw video> [-- --list \| --drop … --keep …]` | Tighten a raw take; writes `edit/` |
| `npm run transcribe <video> <words.json>` | Word timings only |
| `npm run footage <name> <video> [words.json] [--theme <theme>]` | Start a footage project |
| `npm run frames <name> <seconds…> [-- --sheet --from --to --fps --scale]` | Stills of the finished picture |
| `npm run approve <name> [-- --status \| --revoke]` | Record the user's approval of the current storyboard (only after they say so) |
| `npm run make <name> [-- --scale 1] [--section <id\|a-b>] [--no-cache] [--jobs 4]` | Make the video (needs approval), or one section (does not) |
| `npm run review [<name>] [-- --done <id> "<reply>" \| --progress <id> \| --reply <id> "…" \| --reopen <id> \| --add <section\|a-b> "<note>" \| --all \| --json]` | Read and answer review marks |
| `npm run sfx` / `npm run setup` | Regenerate the sound effects / install the tools into `.tools/` |

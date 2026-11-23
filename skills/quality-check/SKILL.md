---
name: quality-check
description: Check a finished video before calling it done, and keep fixing the storyboard and re-making until it passes. Catches captions on the face, captions outside the app safe zone or running into graphics, graphics covering the face, wrong format, bad loudness, dead air, black or frozen frames. Use after every `npm run make` and before reporting a video to the user.
---

# Quality check

No video is done until it has been checked. Never hand the user a video whose check says FAIL.

`npm run make <name>` runs the check as its last step. To run it on its own:

```
npm run qa <name>            # projects/<name>/out/cut.mp4
npm run qa <name> --json     # the report as JSON
```

It writes `out/qa.json` (the report) and `out/qa.png` (a contact sheet). Exit code 0 = PASS (warnings allowed), 1 = FAIL. Each problem has a `fix` line.

Footage projects write `out/layout.json` on every make: where the face and the caption were on each frame, plus `out/occupancy.json`, a map of where graphics are drawn (5 times a second). That is what lets the caption and graphic checks run. Topic/script videos with no person get the format, audio and picture checks and a warning that placement was not checked; look at the sheet for those.
After a re-make only the frames whose picture changed are measured again (`out/.layout-frames.json`, keyed like the make's frame cache), and the transcript in `out/heard.json` is reused when the sound is identical (`out/heard-audio.txt`). Delete those two files to force a full re-check.

## The loop

0. While building the storyboard: `npm run qa <name> --preview` (also run by `npm run stills` and `npm run frames`) catches placement, caption and text-size problems in about 20 s, without making the video. Fix those **before** showing the user the storyboard, so the plan they approve already passes.
1. After they approve (`npm run approve <name>`): `npm run make <name>` (a draft at half size is fine while iterating). A fix that changes `storyboard.json` needs the user's approval again: sketch, show the user the change, wait.
2. Read the result. Open `out/qa.png` and look at it, even on PASS. Green box = the face, yellow = a caption, red = a caption on the face, grey = the app safe zone. Look for what the script cannot see: unreadable text, clipped words, a graphic that looks wrong, a caption that doesn't match what is said.
3. On FAIL: apply the `fix` for each FAIL to `storyboard.json`, make again, check again. Fix the cause in the storyboard, never by editing the checks, their thresholds or `library/_shared/placement.js` to let a video through.
4. Stop when it passes and the sheet looks right. After 5 rounds without a pass, stop and tell the user what still fails and the trade-off, for example: "the selfie is so close the chin is below the safe zone, and the panels take the space above the head; captions go under the chin into the app's text area. Shrink the panels, put the clip in a "top" layout, or accept it?"
5. Make the final at full size (`npm run make <name> --scale 1`), check once more, and report the path, the status and any warnings you kept.

## Checks

| Check | Level | Meaning | Usual fix |
|---|---|---|---|
| `captions-on-face` | FAIL | A caption covers more than 3% of the face box in some frame | Remove `"captionPlacement": "fixed"`; shorter phrases (`captionBreaks`) |
| `captions-safe-zone` | FAIL | A caption leaves the app safe zone (top 220, bottom 450, sides 35, right edge x 945 below y 1160, on 1080x1920) | No clear spot was left, so the caption went below it to stay off the face: end or shrink the graphic above the head, lower that zoom, or use a `top`/`card` layout |
| `face-top-bar` | FAIL | The face (forehead included) goes above y 220, under the app's top bar and search field. The user never wants the face at the very top, in any scene | Start the clip's window at y 250 or lower (a small plate: y 250+), lower `face` (fy) in a full layout, or lower that moment's zoom |
| `text-safe-zone` | FAIL / WARN | Words drawn by a graphic (cutaways included) sit under the app's top bar and search field or its bottom caption and buttons. Headline-size words (60 px+) seen there twice FAIL; small print and words near a side edge WARN. Effects drawn in Python are not measured: look at the sheet | Move the overlay's "region" inside the safe zone, or a smaller scale / fewer words. `npm run check` already refuses regions outside it |
| `captions-collide` | FAIL | A caption sits on a graphic (over 8% of the caption) | End the graphic sooner, start it after the phrase, a smaller `region`, or `captionTrack` `hide` for that span |
| `captions-sync` | FAIL | The word being said is not in the caption on screen | Re-transcribe after any cut (`npm run transcribe`); check `captionTrack` `hide` spans |
| `captions-heard` | FAIL/WARN | The finished audio, transcribed again, differs from the captions (FAIL above 8%). Words in or within 0.4 s of a stretch where captions are hidden on purpose are not counted | Fix the misheard words in `words.json`; names and numbers spelled as said |
| `captions-linger` | WARN | A caption stays up 1 s+ after the words stop | Re-transcribe, or a `captionBreaks` entry |
| `text-size` | FAIL/WARN | Caption letters under 28 px (FAIL) / 34 px; graphic text under 26 px tall | Bigger caption style; shorter phrases so placement need not shrink them; larger text in the piece |
| `text-contrast` | FAIL/WARN | Caption contrast under 3:1 (FAIL) / 4.5:1 against its box, outline or the picture | A style with a box or dark outline, or a scrim behind |
| `overlay-on-face` | WARN | A graphic covers over 25% of the face for 0.5 s or more | Move it above or below the face, `"behind": true`, or make it a full-screen `cutaway` |
| `face-tracking` | WARN | No face track for over 30% of the frames | Run `npm run footage` again so `faces.json` exists |
| `format` | FAIL/WARN | Not portrait, under 3 s, not 9:16, draft size, odd fps, over 3 min | Final render with `--scale 1` |
| `audio` | FAIL/WARN | Silent, loudness off the house voice level (`audio.voiceLufs` in settings; FAIL more than 7 LU under or 4 LU over it), true peak above -0.5 dBFS, loudness range over 10 LU, silence before the first word, pauses over 1.5 s | Clean footage with `npm run cut` (it trims and normalises); lower sound-effect `gain` |
| `picture` | WARN | Black frames (not counting fades), or nothing moving for 2 s or more | A piece failed to draw or a gap; add a zoom, a graphic or a cut |

Full-screen cutaways are skipped by the face and caption checks: the face is hidden and captions sit on the cutaway by design.

## How captions keep clear

`library/_shared/placement.js`, used by the footage player. For each phrase it tries, at full size, then 85%, then 72%: the bottom of the safe zone, just under the chin, above the head, then every height up the frame. The first spot that is off the face, clear of graphics and inside the safe zone wins. It checks again every frame, so if a graphic arrives on the caption or the face moves into it, the caption pops up in a clear spot. It jumps rather than slides, because a slide could cross the face. If there is no clear spot, the order of what to give up is: the safe zone first, then clearing the graphics, and never the face. `"captionPlacement": "fixed"` in the storyboard keeps each style's own position, and a `captionTrack` `dy` turns placement off for that span.

## Adding a check

Add a `check_<name>(...)` to `pipeline/qa.py` that appends `dict(check, level, msg, fix, at)` to `issues`, call it from `main()`, and add a row above. Give every issue a concrete `fix` in storyboard terms and, when it happens at a moment, an `at` time so the sheet shows that frame.

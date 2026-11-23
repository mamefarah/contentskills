// Writes storyboard.json for faceless-ai-voice. Edit this file, not the JSON: `node projects/faceless-ai-voice/build-storyboard.mjs`.
// Owner brief (2026-11-21): the script in script.md, "very ADHD fast-paced with lots of graphics, animation and SFX".
// Horror + Lines of Light, then Horror + GTA6 were rejected ("i dont like the theme at all"): now the Claude UI look of
// her reference reel (style/references/De13S4Gi8El: dark Claude-app field, ivory middle section, one line of caption at
// the top with the key word on a blue highlight, glowing app icon, app cards, comment panel to close). Base theme
// minimal (charcoal / claude modes) plus the Claude app kit (library/ui/claude) for the chat, terminal and work log.
// Every beat lands on a spoken word: w(shot, word) reads voice/voice.json (seconds from the shot start).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const voiceFile = join(dir, 'voice/voice.json');
const voice = existsSync(voiceFile) ? JSON.parse(readFileSync(voiceFile, 'utf8')) : null;
const LEAD = 0;      // storyboard "lead": 0, the cut lands on the first word (pipeline/timeline.js)
const bare = s => s.replace(/[^\p{L}\p{N}'+-]/gu, '').toLowerCase();
const lines = {};
function w(shot, word, {nth = 1, dt = 0} = {}) {
  const spoken = voice?.shots?.[shot];
  const tokens = spoken && spoken.text === lines[shot] ? spoken.words : null;
  const list = tokens ?? lines[shot].split(/\s+/).map((text, i) => ({text, start: i * .3}));
  let seen = 0;
  for (const tok of list) if (bare(tok.text) === bare(word) && ++seen === nth) return +(LEAD + tok.start + dt).toFixed(3);
  throw Error(`${shot}: no word "${word}" (#${nth}) in "${lines[shot]}"`);
}

const hold = {cta: 1.2};
const shots = [];
const KICK = {3: .9, 2: .55, 1: .3}, HIT = {3: ['thump', -15], 2: ['pop_hi', -20]};
const sfx = (name, at, gain = -16) => ({name, at: +at.toFixed(3), gain});
function thin(list, gap) { const out = []; for (const x of list) if (!out.some(y => Math.abs(y.at - x.at) < gap)) out.push(x); return out.sort((a, b) => a.at - b.at); }

const DARK = 'charcoal', LIGHT = 'claude';
/** A minimal-theme scene in `mode`. */
const S = (piece, props = {}, mode = DARK) => ({background: {piece: `scenes/${piece}`, props: {...props, mode}}});
/** A Claude app piece (library/ui/claude) on the shot's field. */
const UI = (piece, props = {}) => ({background: {piece: `overlays/${piece}`, theme: 'ui/claude', props}});
const T = (name, seconds = .25) => ({name, seconds});
const SHOT = 'projects/faceless-ai-voice/assets/storyboard-page.png', SHOT_ASPECT = 1280 / 1500;     // the real storyboard page (career-ops), 2026-11-21
const SPARK = ['#ff9a3d', '#f05a14'], SPARK_GLOW = 'rgba(255,122,26,.75)';

function shot(id, narration, {emphasis = {}, transition, tone, fx = () => []}, make) {
  lines[id] = narration;
  const candidates = make().map((c, i) => ({...c, status: i === 0 ? 'usable' : 'rejected'}));
  // the take has almost no pause between sentences, so a clip can end on its last word: the shot holds until that word
  // has ended (its audio starts LEAD in), so the caption never moves on while the word is still being said
  const spoken = voice?.shots?.[id], lastEnd = spoken?.words?.at(-1)?.end ?? 0;
  const duration = spoken?.text === narration ? +(Math.max(spoken.duration, lastEnd + LEAD + .04) + (hold[id] ?? 0)).toFixed(3) : undefined;
  const stressed = Object.entries(emphasis).flatMap(([word, level]) => { try { return [{at: w(id, word), level}]; } catch { return []; } });
  const kicks = thin(stressed.sort((a, b) => b.level - a.level).map(x => ({at: x.at, amp: KICK[x.level]})), .35);
  const sounds = thin([...fx(), ...stressed.filter(x => HIT[x.level]).map(x => sfx(HIT[x.level][0], x.at, HIT[x.level][1])),
    ...(shots.length ? [sfx('whoosh_fast', -.12, -16)] : [])], .25);
  shots.push({id, narration, ...(duration ? {duration} : {}), emphasis, tone: tone ?? DARK, ...(shots.length && transition ? {transition} : {}),
    camera: {push: .05, kicks}, sounds, candidates});
}
// Pace (owner, from her reference reel measured 2026-11-21: a new visual about every 1.1 s, mid-sentence, on the key
// word; something always moving; voice from frame 0): one scene per phrase, hard cuts inside a sentence (no
// transition), a short punch between sentences, and timed beats inside every scene (stamps, strikes, chips, ticks).
const CUT = undefined, PUNCH = T('punch_zoom', .2);

// ---- dark open (reference: dark field, glowing icon)
shot('hook', 'Claude can now edit all your videos for free.', {emphasis: {claude: 1, edit: 2, free: 3},
  fx: () => [sfx('whoosh_fast', 0, -14), sfx('impact', w('hook', 'edit'), -15), sfx('sparkle', w('hook', 'videos'), -18), sfx('stamp', w('hook', 'free'), -13), sfx('coin', w('hook', 'free', {dt: .25}), -16)]}, () => [
  S('real-wall', {clips: [0, 1, 2, 3, 4, 5].map(k => ({raw: `projects/faceless-ai-voice/assets/clips/${k}-raw.jpg`, edited: `projects/faceless-ai-voice/assets/clips/${k}-edited.jpg`})),
    clipW: 260, y: 100, editAt: .1, editDone: w('hook', 'videos', {dt: .3}), stamp: 'FREE', stampAt: w('hook', 'free'), popAt: 0}),
]);
shot('how', 'Here\'s exactly how I use it.', {emphasis: {exactly: 2, how: 3}, transition: PUNCH,
  fx: () => [sfx('swish', w('how', 'exactly'), -16), sfx('sparkle', w('how', 'use'), -18)]}, () => [
  S('before-after', {raw: 'projects/faceless-ai-voice/assets/clips/big-raw.jpg', edited: 'projects/faceless-ai-voice/assets/clips/big-edited.jpg', splitAt: w('how', 'exactly'), popAt: 0}),
]);
shot('skip', 'And the step that makes your videos look good?', {emphasis: {step: 1, good: 3}, transition: PUNCH,
  fx: () => [0, 1, 2, 3, 4].map(k => sfx('pop', [.05, .3, .55, .8, 1.05][k], -18))}, () => [
  S('step-rail', {title: '5 steps', steps: [{label: 'Install it', at: .05}, {label: 'Tell it', at: .3}, {label: 'It plans', at: .55}, {label: 'Preview it', at: .8}, {label: 'Make it', at: 1.05}], popAt: 0}),
]);
shot('skipped', 'It\'s the one almost everyone skips.', {emphasis: {everyone: 1, skips: 3}, transition: CUT,
  fx: () => [sfx('stamp', w('skipped', 'skips'), -14)]}, () => [
  S('step-rail', {title: '5 steps', steps: [{label: 'Install it', at: 0}, {label: 'Tell it', at: 0}, {label: 'It plans', at: 0}, {label: 'Preview it', at: 0}, {label: 'Make it', at: 0}], tagIndex: 3, tag: 'SKIPPED', tagAt: w('skipped', 'skips'), popAt: 0}),
]);
shot('one', 'Step one. Open Claude Code,', {emphasis: {one: 1, claude: 3}, transition: PUNCH,
  fx: () => [sfx('click', w('one', 'Open'), -15), sfx('pop_hi', w('one', 'Claude'), -18)]}, () => [
  S('glow-icon', {icon: '✳', tile: SPARK, glow: SPARK_GLOW, label: 'Claude Code', sub: 'step one', popAt: 0}),
]);
shot('chatgpt', 'or ChatGPT Work,', {emphasis: {chatgpt: 3}, transition: CUT,
  fx: () => [sfx('swish', w('chatgpt', 'ChatGPT', {dt: -.1}), -16), sfx('pop_hi', w('chatgpt', 'ChatGPT'), -17)]}, () => [
  S('app-pair', {a: {icon: '✳', tile: SPARK, label: 'Claude Code'}, b: {icon: 'icon:bolt', tile: ['#34d399', '#10a37f'], label: 'ChatGPT Work'}, inAt: w('chatgpt', 'ChatGPT', {dt: -.1})}),
]);
shot('type', 'and type: setup blotato contentskills.', {emphasis: {type: 1, setup: 3}, transition: CUT,
  fx: () => [sfx('key_run', w('type', 'setup', {dt: -.1}), -16), sfx('click', w('type', 'contentskills', {dt: .3}), -15)]}, () => [
  UI('terminal', {command: 'setup blotato contentskills', reply: 'Setting up Blotato content skills…', launchAt: 0, typeAt: w('type', 'type'), typeFor: 1.2, sendAt: w('type', 'contentskills', {dt: .3}), dropAt: 99, y: 440}),
]);
// ---- ivory middle (reference: the light section in the middle)
shot('install', 'It installs everything for you.', {emphasis: {installs: 1, everything: 3}, tone: 'light', transition: PUNCH,
  fx: () => ['installs', 'everything', 'you'].map(x => sfx('ding', w('install', x), -19))}, () => [
  S('check-rows', {title: 'Setting up', sub: 'contentskills · install', status: 'running', settle: .25, badge: null, popAt: 0, rows: [
    {icon: 'bolt', label: 'Video tools', chip: 'READY', tone: 'green', at: w('install', 'installs')},
    {icon: 'star', label: 'Themes and effects', chip: 'READY', tone: 'green', at: w('install', 'everything')},
    {icon: 'doc', label: 'Captions and voice', chip: 'READY', tone: 'green', at: w('install', 'you')}]}, LIGHT),
]);
shot('two', 'Step two. Tell it what you want.', {emphasis: {two: 1, tell: 2, want: 3}, transition: PUNCH,
  fx: () => [sfx('key_run', w('two', 'Tell'), -18), sfx('pop', w('two', 'want'), -16)]}, () => [
  UI('prompt', {text: 'Make a video about my app', typeAt: w('two', 'Step'), typeFor: .9, sendAt: w('two', 'want', {dt: .1}), y: 820}),
]);
shot('inputs', 'A topic, a script, or a clip of you', {emphasis: {topic: 1, script: 1, clip: 3}, tone: 'light', transition: PUNCH,
  fx: () => ['topic', 'script', 'clip'].map(x => sfx('pop', w('inputs', x), -15))}, () => [
  S('tile-pool', {title: 'Give it', sub: 'any one of these', cols: 3, popAt: 0, tiles: [
    {icon: 'icon:star', label: 'A topic', at: w('inputs', 'topic')}, {icon: 'icon:doc', label: 'A script', at: w('inputs', 'script')}, {icon: 'icon:user', label: 'A clip of you', at: w('inputs', 'clip')}]}, LIGHT),
]);
shot('phone', 'talking straight to your phone.', {emphasis: {talking: 1, phone: 3}, tone: 'light', transition: CUT,
  fx: () => [sfx('blip_up', .05, -18), sfx('pop', w('phone', 'phone'), -16)]}, () => [
  S('phone-talk', {chipText: 'That works too', chipAt: w('phone', 'phone'), popAt: 0}, LIGHT),
]);
shot('three', 'Step three. It plans your whole video,', {emphasis: {three: 1, plans: 2, whole: 3}, transition: PUNCH,
  fx: () => [sfx('key_run', w('three', 'plans'), -20), ...[1, 2, 3].map(k => sfx('tick', w('three', 'plans') + k * .25, -18))]}, () => [
  UI('worklog', {title: 'Planning your video...', label: 'STORYBOARD', doneAt: w('three', 'video', {dt: .3}), done: 'Ready', steps: [
    {label: 'Write the scenes', detail: '', at: w('three', 'Step')}, {label: 'Pick the graphics', detail: '', at: w('three', 'plans')},
    {label: 'Time them to your voice', detail: '', at: w('three', 'whole')}, {label: 'Add the captions', detail: '', at: w('three', 'video')}]}),
]);
shot('scenes', 'scene by scene,', {emphasis: {scene: 2}, tone: 'light', transition: CUT,
  fx: () => [0, 1, 2, 3].map(k => sfx('swish', .02 + k * .17, -18))}, () => [
  S('scene-deck', {cards: ['Hook', 'Step 1', 'Step 2', 'Ending'].map((label, i) => ({label, at: .02 + i * .17})), popAt: 0}, LIGHT),
]);
shot('extras', 'with animations, captions, music, and sound effects.', {emphasis: {animations: 1, captions: 1, music: 1, effects: 3}, tone: 'light', transition: CUT,
  fx: () => ['animations', 'captions', 'music', 'sound'].map(x => sfx('swish', w('extras', x), -18))}, () => [
  S('doc-burst', {source: 'Your video', popAt: 0, items: [
    {icon: 'star', title: 'Animations', sub: 'every scene', at: w('extras', 'animations')}, {icon: 'doc', title: 'Captions', sub: 'word by word', at: w('extras', 'captions')},
    {icon: 'bolt', title: 'Music', sub: 'under your voice', at: w('extras', 'music')}, {icon: 'send', title: 'Sound effects', sub: 'on every beat', at: w('extras', 'sound')}]}, LIGHT),
]);
shot('four', 'Step four. Open the preview,', {emphasis: {four: 1, preview: 3}, tone: 'light', transition: PUNCH,
  fx: () => [sfx('click', w('four', 'Open'), -15), sfx('whoosh_fast', w('four', 'preview'), -18)]}, () => [
  S('screenshot', {src: SHOT, aspect: SHOT_ASPECT, title: 'Your storyboard', height: 900, zoom: [1, 1.15], from: [0, 0], to: [0, .2], moveFor: 1.4,
    chips: [{text: 'Your storyboard', tone: 'blue', at: w('four', 'preview')}]}, LIGHT),
]);
shot('play', 'watch it play,', {emphasis: {play: 3}, transition: CUT,
  fx: () => [sfx('click', w('play', 'play', {dt: -.05}), -14), sfx('blip_up', w('play', 'play'), -18)]}, () => [
  S('player-scrub', {title: 'Preview', playAt: w('play', 'play', {dt: -.05}), total: 42, popAt: 0}),
]);
shot('change', 'and tap Change on any scene you don\'t like.', {emphasis: {tap: 1, change: 3, scene: 1}, tone: 'light', transition: CUT,
  fx: () => [sfx('click', w('change', 'Change'), -14), sfx('pop_hi', w('change', 'Change', {dt: .05}), -17)]}, () => [
  S('timeline-fix', {title: 'Your video', index: 1, markAt: w('change', 'Change'), popAt: 0}, LIGHT),
]);
shot('fixes', 'It fixes it in seconds.', {emphasis: {fixes: 2, seconds: 3}, tone: 'light', transition: CUT,
  fx: () => [sfx('key_run', w('fixes', 'fixes'), -19), sfx('ding', w('fixes', 'seconds'), -14)]}, () => [
  S('timeline-fix', {title: 'Your video', index: 1, markAt: -1, fixAt: w('fixes', 'fixes'), fixFor: .5, doneAt: w('fixes', 'seconds'), seconds: '3', popAt: -1}, LIGHT),
]);
shot('five', 'Step five. Hit Make my video.', {emphasis: {five: 1, hit: 2, video: 3}, tone: 'light', transition: PUNCH,
  fx: () => [sfx('click', w('five', 'video'), -14), sfx('win', w('five', 'video', {dt: .2}), -16)]}, () => [
  S('submit-button', {title: 'Your video', fields: ['Script', 'Voice', 'Scenes', 'Captions'], button: 'Make my video', done: 'Making it…', lock: 'Your call', ai: 'Claude', you: 'You',
    popAt: 0, fieldStep: .07, blockAt: w('five', 'five'), youAt: w('five', 'video')}, LIGHT),
]);
// ---- dark close
shot('face', 'It checks that no text covers your face.', {emphasis: {checks: 1, text: 1, face: 3}, transition: PUNCH,
  fx: () => [sfx('blip_up', w('face', 'checks'), -17), sfx('swish', w('face', 'face', {dt: -.1}), -16), sfx('ding', w('face', 'face'), -15)]}, () => [
  S('face-scan', {caption: 'BIG WORDS', scanAt: w('face', 'checks'), moveAt: w('face', 'face', {dt: -.1}), rows: [{label: 'Face found', at: w('face', 'text')}, {label: 'Text off face', at: w('face', 'face')}], popAt: 0}),
]);
shot('note', 'And if you want something different, just leave a note.', {emphasis: {different: 2, note: 3}, transition: PUNCH,
  fx: () => [sfx('key_run', w('note', 'want'), -18), sfx('whoosh', w('note', 'note', {dt: .2}), -17), sfx('ding', w('note', 'note', {dt: .8}), -17)]}, () => [
  S('note-fly', {text: 'make the hook faster', typeAt: w('note', 'want'), typeFor: .8, sendAt: w('note', 'note', {dt: .05}), target: 'Scene 1', done: 'Updated', popAt: 0}),
]);
shot('director', 'You\'re the director now.', {emphasis: {director: 3, now: 1}, transition: PUNCH,
  fx: () => [sfx('punch', w('director', 'director'), -14)]}, () => [
  S('clapper', {role: 'DIRECTOR', name: 'YOU', scene: 'SCENE 1', snapAt: w('director', 'director'), popAt: 0}),
]);
shot('editor', 'Not the editor.', {emphasis: {not: 1, editor: 3}, transition: CUT,
  fx: () => [sfx('glitch', w('editor', 'editor', {dt: -.05}), -16), sfx('thump', w('editor', 'editor', {dt: .45}), -16)]}, () => [
  S('timeline-kill', {title: 'Editing timeline', killAt: w('editor', 'editor', {dt: -.05}), popAt: 0}),
]);
shot('cta', 'Comment EDIT, and I\'ll send you the link!', {emphasis: {edit: 3, link: 1}, transition: PUNCH,
  fx: () => [sfx('key_run', w('cta', 'Comment'), -20), sfx('whoosh_fast', w('cta', 'and'), -17), sfx('ding', w('cta', 'send'), -15)]}, () => [
  S('comment-cta', {word: 'EDIT', popAt: 0, typeAt: w('cta', 'Comment'), sendAt: w('cta', 'and'), replyAt: w('cta', 'send')}),
]);

const storyboard = {
  title: 'Claude can now edit all your videos for free (contentskills how-to)',
  theme: 'minimal',
  format: {width: 1080, height: 1920, fps: 30},
  // the reference's captions: one line at the top, key words bold / serif / on a blue highlight (emphasis 1/2/3)
  captions: 'top-line',
  captionPlacement: 'fixed',
  lead: 0,
  // owner (2026-11-21): her mushroom mascot narrating from the bottom-left corner (library/_shared/presenters)
  presenter: {name: 'mushroom', x: 220, height: 460, bottom: -20, room: .8},
  // One ElevenLabs take in her voice (Sabrina Ramonov (Brand)), eleven_multilingual_v2 at speed 1.1, split per shot by split-voice.py.
  voice: {provider: 'recorded', speed: 1.1, model: 'eleven_multilingual_v2'},
  // no music bed ships with the project: add your own to library/_shared/music and name it here (music: {name, start})
  sections: [
    {id: 'hook', title: 'Hook', shots: ['hook', 'how', 'skip', 'skipped'], job: 'hook'},
    {id: 'steps', title: 'Five steps', shots: ['one', 'chatgpt', 'type', 'install', 'two', 'inputs', 'phone', 'three', 'scenes', 'extras', 'four', 'play', 'change', 'fixes', 'five', 'face', 'note'], job: 'demo'},
    {id: 'ask', title: 'Payoff and call to action', shots: ['director', 'editor', 'cta'], job: 'ask'},
  ],
  shots,
};
writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(storyboard, null, 1) + '\n');
console.log(`storyboard.json: ${shots.length} shots${voice ? ' (timed from voice/voice.json)' : ' (estimated timing)'}`);

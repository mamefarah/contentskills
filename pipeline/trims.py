"""Apply the editor's trims (edit/trims.json, written by pipeline/trim.mjs) to a storyboard built by a generator.
A project's build-storyboard.py writes its storyboard on the cut as it was before any trim; calling
    sys.path.insert(0, <repo>/pipeline); from trims import apply_trims; sb = apply_trims(sb, HERE)
just before writing storyboard.json moves every time onto the trimmed video, so re-running the generator keeps them.
Each round is a list of removed stretches [a, b] on the timeline left by the rounds before it. Same moves as
moveStoryboard in pipeline/trim.mjs.
"""
import json, os

def mover(ranges):
    def move(t):
        shift = 0
        for a, b in ranges:
            if t >= b: shift += b - a
            elif t > a: return round(a - shift, 3)
            else: break
        return round(t - shift, 3)
    return move

def move_storyboard(sb, move):
    span = lambda x: {**x, 'start': move(x['start']), 'end': move(x['end'])}
    for k in ('overlays', 'captionTrack', 'zooms'):
        if k in sb: sb[k] = [y for y in map(span, sb[k]) if y['end'] - y['start'] > .05]
    for k in ('layouts', 'transitions', 'sounds'):
        if k in sb: sb[k] = [{**x, 'at': move(x['at'])} for x in sb[k]]
    for x in sb.get('effects', []):
        a, b = move(x['at']), move(x['at'] + x['seconds']); x['at'], x['seconds'] = a, round(b - a, 3)
        if 'seconds' in x.get('props', {}): x['props']['seconds'] = x['seconds']
    sb['effects'] = [x for x in sb.get('effects', []) if x['seconds'] > .05]
    if 'sections' in sb: sb['sections'] = [y for y in map(span, sb['sections']) if y['end'] - y['start'] > .05]
    if sb.get('footage', {}).get('duration'): sb['footage']['duration'] = move(sb['footage']['duration'])
    m = sb.get('music')
    if m:      # the music's cue points move with the words they were set on
        if m.get('parts'): m['parts'] = [{**q, 'at': move(q['at'])} for q in m['parts']]
        if m.get('drops'): m['drops'] = [[move(a), move(b)] for a, b in m['drops'] if move(b) - move(a) > .05]
    return sb

def apply_trims(sb, project_dir):
    path = os.path.join(project_dir, 'edit', 'trims.json')
    if not os.path.exists(path): return sb
    for ranges in json.load(open(path))['rounds']: sb = move_storyboard(sb, mover(ranges))
    return sb

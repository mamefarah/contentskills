"""The user's settings: settings/defaults.json, overridden key by key by settings/user.json (git-ignored).
CONTENTSKILLS_SETTINGS=<path> points at another user file. Same merge as pipeline/settings.mjs."""
import json, os
from pathlib import Path
from functools import lru_cache

ROOT = str(Path(__file__).resolve().parents[1])


def _read(path):
    if not os.path.exists(path): return {}
    with open(path) as f:
        try: data = json.load(f)
        except ValueError as error: raise SystemExit(f'{path}: {error}')
    if not isinstance(data, dict): raise SystemExit(f'{path}: the file must hold one JSON object.')
    return data


def _merge(base, over):
    if not isinstance(base, dict) or not isinstance(over, dict): return base if over is None else over
    out = dict(base)
    for k, v in over.items(): out[k] = _merge(base.get(k), v)
    return {k: v for k, v in out.items() if not k.startswith('_')}   # "_about" notes are for people


@lru_cache(maxsize=1)
def settings():
    user = os.environ.get('CONTENTSKILLS_SETTINGS') or os.path.join(ROOT, 'settings', 'user.json')
    return _merge(_read(os.path.join(ROOT, 'settings', 'defaults.json')), _read(user))


@lru_cache(maxsize=1)
def safe_zone():
    """The app safe zone on a 1080x1920 frame (library/_shared/safe-zone.json, shared with placement.js)."""
    return _read(os.path.join(ROOT, 'library', '_shared', 'safe-zone.json'))

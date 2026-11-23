#!/usr/bin/env python3
"""Per-effect code fingerprints for the chunk cache (pipeline/combine.mjs).

    python pipeline/effect_stamps.py [<theme dir> ...]     -> JSON on stdout

A composited half-second chunk used to be keyed on the whole effects code (effects_engine.py, signature.py,
lighting.py, ...), so editing any one effect re-made every chunk of every video. Here each effect gets a fingerprint
of only the code it runs: its function and, followed name by name, every function, class and constant of ours it
reaches (through module globals, `module.name` attributes and dicts/lists of functions). An edit to the GTA poster
then re-makes only the chunks the poster is on.

Output: {"base": the compositor itself (pipeline/composite.py and the helpers it calls outside any effect),
         "builtin": the engine's own effects (vhs, grain, ...: one shared fingerprint, they live in one function chain),
         "effects": {name: fingerprint} for every effect registered by name (signature, lights, style grade, themes)}.
When in doubt it widens: code that looks names up at run time (globals(), getattr with a computed name, eval) counts its
whole file.
"""
import ast, hashlib, inspect, json, re, sys, textwrap, types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'library' / '_shared'))
import effects_engine as E                                   # noqa: E402  (registers signature, lights, style grade)
from lighting import person_mask                             # noqa: E402

for theme_dir in sys.argv[1:]: E.load_theme(theme_dir)       # theme effects, as pipeline/composite.py loads them

DYNAMIC = ('globals()', 'eval(', 'exec(', 'importlib', '__import__')


def _file(obj):
    try: f = inspect.getsourcefile(inspect.unwrap(obj))
    except (TypeError, ValueError): return None
    try: rel = str(Path(f).resolve().relative_to(ROOT)) if f else None
    except ValueError: return None                           # numpy, cv2, the standard library: not ours
    # the pipeline's own Python environment lives in the repo too (.tools/venv-*): installed packages are not ours either
    return None if rel is None or rel.startswith('.') or 'site-packages' in rel else rel


def _value(v, depth=0):
    """A constant's fingerprint text, and the functions inside it to follow."""
    if callable(v) or isinstance(v, type): return None, [v]
    if hasattr(v, 'tobytes') and hasattr(v, 'shape'): return hashlib.sha1(v.tobytes()).hexdigest() + str(v.shape), []
    if isinstance(v, (dict, list, tuple, set, frozenset)) and depth < 3:
        items = sorted(v.items(), key=lambda kv: repr(kv[0])) if isinstance(v, dict) else list(v) if not isinstance(v, (set, frozenset)) else sorted(v, key=repr)
        parts, fns = [], []
        for it in items:
            k, x = it if isinstance(v, dict) else (None, it)
            t, f = _value(x, depth + 1); parts.append(f'{k!r}:{t}'); fns += f
        return '[' + ','.join(parts) + ']', fns
    # an object's default repr carries its memory address, different on every run: keep only its type
    return re.sub(r' at 0x[0-9a-fA-F]+', '', repr(v))[:2000], []


def closure(roots, skip=()):
    """A fingerprint of everything of ours `roots` reach (objects in `skip` are not followed)."""
    skip = {id(x) for x in skip}
    parts, seen, stack, whole = set(), set(), list(roots), set()
    while stack:
        obj = inspect.unwrap(stack.pop())
        if id(obj) in seen: continue
        seen.add(id(obj))
        rel = _file(obj)
        if rel is None: continue
        try: src = textwrap.dedent(inspect.getsource(obj))
        except (OSError, TypeError): whole.add(rel); continue
        parts.add(f'{rel}:{getattr(obj, "__qualname__", "")}\n{src}')
        for i, cell in enumerate(getattr(obj, '__closure__', None) or ()):        # values a factory baked into this function
            try: text, fns = _value(cell.cell_contents)
            except ValueError: continue
            parts.add(f'{rel}:{getattr(obj, "__qualname__", "")}#cell{i}={text}'); stack += fns
        if any(d in src for d in DYNAMIC): whole.add(rel)
        g = getattr(obj, '__globals__', None) or vars(sys.modules.get(obj.__module__, types.SimpleNamespace()))
        try: tree = ast.parse(src)
        except SyntaxError: whole.add(rel); continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and getattr(node.func, 'id', None) == 'getattr' and len(node.args) > 1 and not isinstance(node.args[1], ast.Constant):
                whole.add(rel)
            if isinstance(node, ast.Name) and node.id in g: target = g[node.id]
            elif isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and isinstance(g.get(node.value.id), types.ModuleType):
                target = getattr(g[node.value.id], node.attr, None)
            else: continue
            if isinstance(target, types.ModuleType) or id(target) in skip: continue
            if callable(target) or isinstance(target, type): stack.append(target); continue
            text, fns = _value(target)
            parts.add(f'{rel}:{getattr(node, "id", getattr(node, "attr", ""))}={text}'); stack += fns
    for rel in whole: parts.add(f'{rel}=' + hashlib.sha1((ROOT / rel).read_bytes()).hexdigest())
    return hashlib.sha1('\n\0'.join(sorted(parts)).encode()).hexdigest()


# the name -> function dispatcher every effect passes through: its own text, not everything it can reach
dispatch = inspect.getsource(E.effect)
base = closure([E.smooth, person_mask])        # load_theme only reads files: each theme effect has its own fingerprint
base = hashlib.sha1((base + dispatch + (ROOT / 'pipeline' / 'composite.py').read_text()).encode()).hexdigest()
builtin = closure([E.effect], skip=[E._theme_effects])     # not through the registry: each registered effect has its own
effects = {name: hashlib.sha1((closure([fn]) + dispatch).encode()).hexdigest() for name, fn in sorted(E._theme_effects.items())}
json.dump({'base': base, 'builtin': builtin, 'effects': effects}, sys.stdout)

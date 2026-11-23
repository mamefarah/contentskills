# Templates

A **template** is a reusable video *structure*. A **theme** is a *style*. They are independent: a template says what happens and in what order, a theme says how it looks.

| Layer | What it is | Where |
|---|---|---|
| Piece | One animated element | `library/themes/<theme>/<category>/pieces/` |
| Theme | One visual style: pieces drawn alike | `library/themes/<theme>/` |
| **Template** | **A reusable structure: turns a short spec into a project** | **`templates/<name>/`** |
| Project | One video | `projects/<name>/` |

```sh
npm run template                                   # list the templates
npm run template <template> <spec.json> <project>  # build projects/<project>/ from a spec
npm run make <project> -- --scale 1                # render it (storyboard templates)
```

Start a spec by copying the template's `example.json`. Paths in a spec are relative to the spec file.

## The templates

| Template | Kind | What it makes |
|---|---|---|
| [compare](compare/) | direct | 2 to 4 videos side by side with labels (1080x960 for two, 1620x960 for three). |

## Making a template

A template is a folder in `templates/` with:

- `template.json`: `id`, `title`, `kind`, `summary`, `inputs` (what the spec takes) and `uses` (pieces, layouts, sounds it relies on).
- `build.mjs`: `export default async function build(ctx)`. `ctx` has `spec`, `resolve(path)` (relative to the spec), `dir` (the project folder), `project`, `root`, `templateDir`, `run(cmd, args, label)` and `python()` (the effects Python).
- `example.json` and `README.md`.

Two kinds:

- **storyboard**: `build` writes `projects/<project>/storyboard.json` (plus footage via `pipeline/footage.mjs`) and `npm run make` renders it. Everything the pipeline has works: themes, layouts, captions, sounds, the quality check. Prefer this kind.
- **direct**: `build` renders `projects/<project>/out/cut.mp4` itself, for outputs the 9:16 pipeline cannot make (a landscape comparison, say).

UI a template needs goes into a UI kit in `library/ui/<name>/` as pieces (the effects showcase draws the Claude app with `library/ui/claude/`, named `"theme": "ui/claude"` in a storyboard), never into the template folder, so other storyboards can use it too. A UI kit has the same folder layout as a theme but is not a style.

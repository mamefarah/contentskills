# Third-party notices

The project's own code is licensed under AGPL-3.0-only (see `LICENSE`). The files below come from other projects and
keep their own licences. Each licence text sits beside the file it covers.

| What | Where | Licence file |
| --- | --- | --- |
| D3 7.9.2 | `library/_shared/vendor/d3-7.9.2.min.js` | `library/_shared/vendor/D3-LICENSE` |
| three.js 0.160.1 | `library/_shared/vendor/three-0.160.1.min.js` | `library/_shared/vendor/three-LICENSE.txt` |
| lottie-web 5.12.2 | `library/_shared/vendor/lottie-5.12.2.min.js` | `library/_shared/vendor/lottie-LICENSE.md` |
| YuNet face detector | `library/models/yunet/` | `library/models/yunet/YUNET-LICENSE` |
| PP-HumanSeg person segmentation | `library/models/pphumanseg/` | `library/models/pphumanseg/LICENSE` |
| Fonts | `library/**/fonts/` | `<family>-LICENSE.txt` next to each font file |
| Shader transitions adapted from other authors | `library/_shared/shader_transitions.py` | `library/_shared/shader_transitions-NOTICES.md` |

Not bundled, downloaded by `npm run setup` into `.tools/` (git-ignored): the Kokoro voice model, the Whisper speech
model, a headless Chrome, and the Python packages named in `pipeline/requirements-*.txt`. Each is used under its own
licence.

## Sound and music

Every sound effect in `library/_shared/sfx/` is synthesized by this project's own code
(`library/_shared/sfx/generate.py`, `generate_extra.py`) and is covered by the project licence. No music ships.

## Example and gallery media

The videos in `gallery/` and `examples/` show the project's author, who chose to include them. They are examples, not
stock footage: the code licence does not give a right to reuse a person's likeness or voice. Product names and looks
shown in the UI kits (`library/ui/`) belong to their owners and are used to depict those products.

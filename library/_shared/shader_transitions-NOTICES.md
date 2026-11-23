# Third-party notices for shader_transitions.py

Seventeen of the twenty transitions are original work. Three fragment shaders are adapted from
**gl-transitions** (https://github.com/gl-transitions/gl-transitions), which is MIT licensed. The
adapted shaders carry a source and licence comment above them in `shader_transitions.py`.

| Transition here | Adapted from | Author | What changed |
| --- | --- | --- | --- |
| `rgb_glitch` | `transitions/GlitchMemories.glsl` | Gunnar Roth, based on work from natewave | Blocks sized from the frame and re-rolled 12 times, row tears, per-block staggered switch, cyan bars |
| `warp_wipe` | `transitions/DirectionalWarp.glsl` | pschroen | Wider band, cyan/magenta glow along the edge |
| `zoom_through` | `transitions/CrossZoom.glsl` | rectalogic (ported by gre; zoom blur after evanw's glfx.js) | Fixed centre, both pictures scale so the camera flies through, hashed sample offset, cyan flash |

Transitions a theme ships in its own `library/themes/<theme>/transitions/theme_transitions.py` are original work, with one
exception: the lifestyle theme's `cream_zoom` is built on `zoom_through` above, so it derives from the same
`transitions/CrossZoom.glsl` by rectalogic (smaller zoom and blur, no flash, a cream light leak added) and is
covered by the same licence.

The integer hash uses the "lowbias32" constants published by Chris Wellons into the public domain
(https://nullprogram.com/blog/2018/07/31/).

## MIT License (gl-transitions)

Copyright (c) 2017-present gl-transitions contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

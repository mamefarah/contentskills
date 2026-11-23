// Where a theme lives. Shared by the browser pages and the Node pipeline (no imports).
//
// A theme is one visual style (fonts, captions, effects, pieces) in library/themes/<name>/.
// A UI kit is on-screen app UI that templates need (library/ui/<name>/), with the same folder layout;
// a storyboard names one as "ui/<name>", e.g. {"piece": "overlays/composer", "theme": "ui/claude"}.

/** Folder of a theme or UI kit, relative to library/: "futuristic" -> "themes/futuristic", "ui/claude" -> "ui/claude". */
export const themePath = name => String(name).startsWith('ui/') ? String(name) : `themes/${name}`;


// Shared pieces (library/_shared/common/<category>/pieces/<name>.js, same layout as a theme) are drawn once and worn by
// every theme: a piece the theme lacks is looked up here, and draws with the theme's `look` (theme.json). A theme's own
// piece of the same name wins. Theme-only pieces (gta6 panels, the futuristic HUD) stay in their theme.
export const COMMON = '_shared/common';

// The user's settings in the browser (settings/defaults.json + settings/user.json, merged by the server: GET /api/settings).
// Pieces write `{me.handle}`-style placeholders in their defaults; library/_shared/loader.js fills them from `me`.
export const settings = await fetch('/api/settings').then(r => r.ok ? r.json() : {}).catch(() => ({}));
if (settings.error) console.warn(`Settings: ${settings.error} Using the defaults.`);
export const me = settings.me ?? {};

/** Replace `{me.x}` placeholders in string values of a defaults object. Unknown keys become ''. */
export function fillMe(defaults) {
  if (!defaults) return defaults;
  const out = {};
  for (const [k, v] of Object.entries(defaults)) out[k] = typeof v === 'string' && v.includes('{me.') ? v.replace(/\{me\.(\w+)\}/g, (_, key) => me[key] ?? '') : v;
  return out;
}

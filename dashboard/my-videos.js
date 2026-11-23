// "My videos": every project, newest first, one click back to where they left off. Loaded on its own so it shows before
// the piece library finishes loading. In the sidebar (#mine with data-limit) it shows the newest few and a "See all"
// link (#see-all); on /dashboard/videos.html (no limit) it lists them all, with the examples folded away underneath.
(async function myVideos() {
  const list = document.getElementById('mine'); if (!list) return;
  const limit = Number(list.dataset.limit) || 0, seeAll = document.getElementById('see-all');
  const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  try {
    const projects = (await (await fetch('/api/projects')).json()).filter(p => !p.error).sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));
    const row = p => {
      const ready = p.review?.video, open = p.review?.open ?? 0, final = Boolean(p.review?.final) && !open;
      const where = ready ? `/pipeline/review/?project=${p.name}` : `/pipeline/storyboard/?project=${p.name}`;
      // parts of the video Claude is changing right now (one per section, several at once: npm run patch)
      const working = p.review?.working ?? [], failed = p.review?.failed ?? 0;
      const state = working.length ? `Claude is changing ${working.length} part${working.length > 1 ? 's' : ''}…` : failed ? `${failed} change${failed > 1 ? 's' : ''} failed` : open ? `${open} change${open > 1 ? 's' : ''} asked` : final ? 'Final ✓' : ready ? 'Ready to watch' : 'Storyboard';
      // The whole row is the link (an arrow shows on hover); the status has a coloured dot, the age sits on the right.
      return `<li data-status="${final ? 'final' : 'wip'}"><a class="vid ${working.length ? 'working' : failed ? 'failed' : open ? 'ask' : final ? 'final' : ready ? 'done' : 'draft'}" href="${where}" title="${esc(p.title || p.name)}"><b>${esc(p.title || p.name)}</b><small><span class="st"><i></i>${state}</span>${p.modified ? `<time>${ago(p.modified)}</time>` : ''}</small></a></li>`;
    };
    // The user's own videos first; the theme demos and examples fold away underneath (full list only).
    const example = p => p.archived || /-(demo|example)$/.test(p.name);      // archived: projects/<name>/archived.json
    const own = projects.filter(p => !example(p)), demos = projects.filter(example);
    if (limit) {
      list.innerHTML = own.length ? own.slice(0, limit).map(row).join('') : '<li class="empty">No videos yet. Ask Claude to make one.</li>';
      if (seeAll && own.length > limit) { seeAll.textContent = `See all ${own.length}`; seeAll.hidden = false; }
      return;
    }
    list.innerHTML = (own.length ? own.map(row).join('') : '<li class="empty">No videos yet. Ask Claude to make one.</li>')
      + (demos.length ? `<li><details class="demos"><summary>Examples and tests (${demos.length})</summary><ol>${demos.map(row).join('')}</ol></details></li>` : '');
    const finals = own.filter(p => p.review?.final && !p.review?.open).length;
    const tally = document.getElementById('tally'); if (tally) tally.textContent = `${own.length} of yours: ${finals} final, ${own.length - finals} in progress${demos.length ? ` · ${demos.length} examples` : ''}.`;
    // the full list can show only what is still in progress, or only the finished ones
    const filter = document.getElementById('status-filter');
    if (filter && !filter.dataset.wired) {
      filter.dataset.wired = '1';
      filter.hidden = false;
      filter.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        for (const x of filter.children) x.setAttribute('aria-pressed', String(x === b));
        for (const li of list.querySelectorAll(':scope > li[data-status]')) li.hidden = b.dataset.show !== 'all' && li.dataset.status !== b.dataset.show;
      });
    }
    // while Claude is changing parts of a video, keep the statuses current
    if (projects.some(p => p.review?.working?.length)) setTimeout(myVideos, 4000);
  } catch { list.innerHTML = '<li class="empty">Could not load your videos.</li>'; }
})();

/* ==========================================================================
   VedicAstro — My Kundlis history page
   ========================================================================== */
(function(){
  const grid = document.getElementById('kundliListGrid');
  const signedOutNotice = document.getElementById('signedOutNotice');
  const loadingNotice = document.getElementById('loadingNotice');
  const errorNotice = document.getElementById('errorNotice');
  const emptyNotice = document.getElementById('emptyNotice');
  if(!grid) return;

  function showOnly(el){
    [signedOutNotice, loadingNotice, errorNotice, emptyNotice].forEach(n => n.style.display = (n === el ? 'block' : 'none'));
    grid.style.display = 'none';
  }

  function fmtDate(d){
    if(!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
  }
  // Birth dates are plain "YYYY-MM-DD" strings with no time/timezone. Parsing
  // those with `new Date(str)` treats them as UTC midnight, which can roll
  // back a day once rendered in a timezone behind UTC. Parsing the parts
  // directly and building a LOCAL date avoids that entirely.
  function fmtDateOnly(dateStr){
    if(!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
  }
  function fmtTime(timeStr){
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = ((hour + 11) % 12) + 1;
    return `${h12}:${m} ${ampm}`;
  }

  async function loadKundlis(){
    const token = localStorage.getItem('vedicastro_token');
    if(!token){
      showOnly(signedOutNotice);
      return;
    }

    showOnly(loadingNotice);
    try {
      const resp = await fetch('/api/kundli?action=list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json().catch(() => ({}));
      if(!resp.ok) throw new Error(data.error || 'Could not load your saved charts.');

      if(!data.kundlis || !data.kundlis.length){
        showOnly(emptyNotice);
        return;
      }

      // Fetch the plan directly rather than trusting the localStorage cache
      // that app.js updates independently and asynchronously — reading that
      // cache here could race against app.js's own update and see a stale
      // value right after a plan change (e.g. just after upgrading).
      let isUltimate = false;
      try {
        const meResp = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        const meData = await meResp.json().catch(() => ({}));
        isUltimate = meResp.ok && meData.user && meData.user.plan === 'ultimate';
      } catch { /* non-fatal — just falls back to showing the upgrade prompt */ }

      grid.innerHTML = data.kundlis.map(k => `
        <div class="kundli-list-card card reveal">
          <div class="kundli-list-card__head">
            <h3>${k.name || 'Untitled'}</h3>
            <span class="kundli-list-card__date">${fmtDate(k.createdAt)}</span>
          </div>
          <p class="kundli-list-card__meta">${fmtDateOnly(k.dob)} · ${fmtTime(k.tob)} · ${k.pob || ''}</p>
          <div class="kundli-list-card__badges">
            ${k.lagna ? `<span class="chip" style="pointer-events:none;">Lagna: ${k.lagna}</span>` : ''}
            ${k.moonSign ? `<span class="chip" style="pointer-events:none;">Moon: ${k.moonSign}</span>` : ''}
          </div>
          <a href="kundli.html?id=${encodeURIComponent(k.id)}" class="btn btn--gold btn--block" style="margin-top:18px;">View Full Chart</a>
          ${isUltimate
            ? `<button type="button" class="btn btn--ghost btn--block pdf-download-btn" data-id="${k.id}" style="margin-top:10px;">Download PDF Report</button>`
            : `<a href="pricing.html" class="btn btn--ghost btn--block" style="margin-top:10px; font-size:.8rem;">Upgrade to Ultimate for a PDF Report</a>`}
        </div>`).join('');
      grid.style.display = 'grid';
      [signedOutNotice, loadingNotice, errorNotice, emptyNotice].forEach(n => n.style.display = 'none');

      // re-run the site-wide scroll reveal for the newly injected cards
      document.querySelectorAll('#kundliListGrid .reveal').forEach(el => el.classList.add('is-visible'));
    } catch (err) {
      errorNotice.textContent = err.message === 'Failed to fetch'
        ? "Couldn't reach the server — if you're previewing this as a static file, the backend isn't deployed yet."
        : err.message;
      showOnly(errorNotice);
    }
  }

  grid.addEventListener('click', async (e)=>{
    const btn = e.target.closest('.pdf-download-btn');
    if(!btn) return;

    const id = btn.dataset.id;
    const token = localStorage.getItem('vedicastro_token');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating…';

    try {
      const resp = await fetch(`/api/kundli?action=pdf&id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if(!resp.ok){
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Could not generate the PDF report.');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'VedicAstro-Report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message === 'Failed to fetch' ? "Couldn't reach the server." : err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  loadKundlis();
})();

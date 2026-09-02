/* ==========================================================================
   VedicAstro — real compatibility matching (Ashtakoot Milan)
   Calls /api/matching/generate — the real 8-factor classical system, using
   the same tested astronomy engine as Kundli generation. Signed-in users
   get 1 free check enforced server-side (can't be bypassed). Anonymous
   visitors get a soft client-side limit — no durable server identity to
   enforce against without an account, same honest tradeoff as the AI
   assistant's question limit.
   ========================================================================== */
(function(){
  const form = document.getElementById('matchForm');
  const resultEl = document.getElementById('matchResult');
  if(!form) return;

  const CIRCUMFERENCE = 2 * Math.PI * 52;
  const submitBtn = document.querySelector('.match-submit button');
  const errorEl = document.getElementById('matchFormError');
  const doshaWarningEl = document.getElementById('doshaWarning');

  function fmtDate(d){
    // Birth dates are plain "YYYY-MM-DD" strings with no time/timezone.
    // Parsing with `new Date(str)` treats it as UTC midnight, which can roll
    // back a day once rendered in a timezone behind UTC — parse the parts
    // directly and build a LOCAL date instead to avoid that entirely.
    if(!d) return '';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { day:'2-digit', month:'short', year:'numeric' });
  }

  function showError(msg){
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
  function clearError(){
    errorEl.style.display = 'none';
  }

  function hasUsedFreeCheckAnonymously(){
    try { return localStorage.getItem('vedicastro_match_used') === '1'; } catch { return false; }
  }
  function markFreeCheckUsedAnonymously(){
    try { localStorage.setItem('vedicastro_match_used', '1'); } catch {}
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    clearError();

    const token = localStorage.getItem('vedicastro_token');
    if(!token && hasUsedFreeCheckAnonymously()){
      showError("You've already used your free compatibility check on this device. Sign in and it'll travel with your account, or upgrade for unlimited checks.");
      return;
    }

    const person1 = {
      name: document.getElementById('p1name').value.trim() || 'You',
      dob: document.getElementById('p1dob').value, tob: document.getElementById('p1tob').value,
      pob: document.getElementById('p1pob').value.trim(),
    };
    const person2 = {
      name: document.getElementById('p2name').value.trim() || 'Partner',
      dob: document.getElementById('p2dob').value, tob: document.getElementById('p2tob').value,
      pob: document.getElementById('p2pob').value.trim(),
    };

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Calculating…';

    try {
      const headers = { 'Content-Type': 'application/json' };
      if(token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch('/api/matching/generate', {
        method: 'POST', headers,
        body: JSON.stringify({ person1, person2 }),
      });
      const data = await resp.json().catch(() => ({}));
      if(!resp.ok) throw new Error(data.error || 'Could not calculate compatibility.');

      renderResult(person1, person2, data);
      if(!token) markFreeCheckUsedAnonymously();
    } catch (err) {
      showError(err.message === 'Failed to fetch' ? "Couldn't reach the server." : err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  function renderResult(person1, person2, data){
    const { result } = data;

    document.getElementById('rp1name').textContent = data.person1.name;
    document.getElementById('rp1meta').textContent = `${fmtDate(person1.dob)} · Moon in ${data.person1.moonSign}`;
    document.getElementById('rp2name').textContent = data.person2.name;
    document.getElementById('rp2meta').textContent = `${fmtDate(person2.dob)} · Moon in ${data.person2.moonSign}`;

    document.getElementById('verdict').textContent = result.verdict;
    document.getElementById('scoreNum').textContent = `${result.total}/${result.maxTotal}`;

    const fg = document.getElementById('scoreFg');
    const pct = result.total / result.maxTotal;
    const offset = CIRCUMFERENCE * (1 - pct);
    fg.style.strokeDasharray = CIRCUMFERENCE.toFixed(1);
    fg.style.strokeDashoffset = CIRCUMFERENCE.toFixed(1);

    const KOOTA_LABELS = {
      varna: 'Varna', vashya: 'Vashya', tara: 'Tara', yoni: 'Yoni',
      grahaMaitri: 'Graha Maitri', gana: 'Gana', bhakoot: 'Bhakoot', nadi: 'Nadi',
    };
    document.getElementById('matchBars').innerHTML = Object.entries(result.kootas).map(([key, k]) => `
      <div class="bar-row">
        <div class="lbl"><span>${KOOTA_LABELS[key]}</span><span>${k.score}/${k.max}</span></div>
        <div class="track"><div class="fill" data-target="${(k.score / k.max) * 100}"></div></div>
      </div>`).join('');

    const doshaMessages = [];
    if(result.doshas.nadiDosha) doshaMessages.push('Nadi Dosha — traditionally considered the most significant factor to weigh carefully.');
    if(result.doshas.bhakootDosha) doshaMessages.push('Bhakoot Dosha — the Moon signs fall in a traditionally challenging position from each other.');
    if(doshaMessages.length){
      doshaWarningEl.innerHTML = `<strong>Worth knowing:</strong> ${doshaMessages.join(' ')}`;
      doshaWarningEl.style.display = 'block';
    } else {
      doshaWarningEl.style.display = 'none';
    }

    resultEl.classList.add('is-active');
    resultEl.scrollIntoView({ behavior:'smooth', block:'start' });

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        fg.style.strokeDashoffset = offset.toFixed(1);
        document.querySelectorAll('#matchBars .fill').forEach(f=>{
          f.style.width = f.dataset.target + '%';
        });
      });
    });
  }
})();

/* ==========================================================================
   VedicAstro — Kundli form & result rendering
   ========================================================================== */
(function(){
  const form = document.getElementById('kundliForm');
  const loading = document.getElementById('kundliLoading');
  const result = document.getElementById('kundliResult');
  if(!form) return;

  // gender pill toggle
  document.querySelectorAll('#genderGroup .pill-choice').forEach(label=>{
    label.addEventListener('click', ()=>{
      document.querySelectorAll('#genderGroup .pill-choice').forEach(l=>l.classList.remove('is-active'));
      label.classList.add('is-active');
    });
  });

  let currentData = null;

  function fmtDeg(d){
    const deg = Math.floor(d);
    const min = Math.round((d - deg) * 60);
    return `${deg}° ${min}'`;
  }

  function renderChart(kind){
    const wrap = document.getElementById('chartWrap');
    let houses = currentData.houses;
    if(kind === 'moon'){
      const lagnaIdx = currentData.lagna.i;
      const moonIdx = currentData.moonSign.i;
      const shift = (moonIdx - lagnaIdx + 12) % 12;
      houses = deriveVariantHouses(currentData.houses, shift || 3);
    } else if(kind === 'navamsa'){
      houses = deriveVariantHouses(currentData.houses, (currentData.nakPada * 2 + 1) % 12 || 5);
    }
    wrap.innerHTML = chartSVG(houses);
  }

  function renderResult(data){
    currentData = data;
    document.getElementById('resultName').textContent = data.name ? `${data.name}'s Kundli` : 'Here is your personalised birth chart';
    document.getElementById('resultMeta').textContent =
      `Lagna: ${data.lagna.name} · Moon Sign: ${data.moonSign.name} · Nakshatra: ${data.nakshatra} (Pada ${data.nakPada})`;

    const warningEl = document.getElementById('kundliPlaceWarning');
    if(data.place && data.place.resolved === false){
      warningEl.style.display = 'block';
      warningEl.textContent = `⚠ "${data.pob}" wasn't recognised — this chart used New Delhi's coordinates as a placeholder, so it will not be accurate for your actual birth location. Try entering a major nearby city instead.`;
    } else {
      warningEl.style.display = 'none';
    }

    renderChart('lagna');
    document.querySelectorAll('.chart-tabs button').forEach(b=>b.classList.remove('is-active'));
    document.querySelector('.chart-tabs button[data-chart="lagna"]').classList.add('is-active');

    const tbody = document.getElementById('planetTableBody');
    tbody.innerHTML = data.planets.map(p => `
      <tr>
        <td class="pname"><i>${p.glyph}</i>${p.name}</td>
        <td>${p.sign.name}</td>
        <td>${fmtDeg(p.deg)}</td>
      </tr>`).join('');

    document.getElementById('insightList').innerHTML = data.insights.map(txt => `
      <li><i>✦</i><span>${txt}</span></li>`).join('');

    document.getElementById('dashaLord').textContent = `${data.dasha.lord} Dasha`;
    document.getElementById('dashaRange').textContent = `${data.dasha.startLabel} – ${data.dasha.endLabel}`;
  }

  // Converts the real /api/kundli/generate response into the shape the
  // rendering code above expects (glyphs/full names come from the local
  // PLANETS/SIGNS metadata in data.js; the actual positions are all real).
  function adaptApiChart(api){
    const planets = api.planets.map(p => {
      const meta = PLANETS.find(m => m.key === p.key);
      return { key: p.key, glyph: meta.glyph, name: meta.name, sign: { name: p.signName }, deg: p.degInSign, house: p.house };
    });
    const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
    const seed = `${api.name}|${api.dob}|${api.tob}|${api.pob}`;
    const rand = makeRand(seed);
    const insights = [1, 10, 7, 5, 2].map(num => {
      const bank = INSIGHT_BANK['house' + num];
      return bank[Math.floor(rand() * bank.length)];
    });
    return {
      name: api.name,
      pob: api.pob,
      lagna: { i: api.lagna.signIdx, name: api.lagna.signName },
      moonSign: { i: api.moonSign.signIdx, name: api.moonSign.signName },
      nakshatra: api.nakshatra.name,
      nakPada: api.nakshatra.pada,
      planets,
      houses: api.houses,
      dasha: { lord: api.dasha.lord, startLabel: fmtDate(api.dasha.start), endLabel: fmtDate(api.dasha.end) },
      insights,
      place: api.place,
    };
  }

  function showFormError(message){
    let el = document.getElementById('kundliFormError');
    if(!el){
      el = document.createElement('p');
      el.id = 'kundliFormError';
      el.style.cssText = 'text-align:center; font-size:.85rem; color:var(--rose); margin-top:14px;';
      form.appendChild(el);
    }
    el.textContent = message;
  }

  document.addEventListener('click', (e)=>{
    const tab = e.target.closest('.chart-tabs button');
    if(!tab) return;
    document.querySelectorAll('.chart-tabs button').forEach(b=>b.classList.remove('is-active'));
    tab.classList.add('is-active');
    renderChart(tab.dataset.chart);
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('fullName').value.trim();
    const gender = form.querySelector('input[name="gender"]:checked').value;
    const dob = document.getElementById('dob').value;
    const tob = document.getElementById('tob').value;
    const pob = document.getElementById('pob').value.trim();
    if(!dob || !tob || !pob){ return; }

    form.style.display = 'none';
    loading.classList.add('is-active');

    try {
      const token = localStorage.getItem('vedicastro_token');
      const headers = { 'Content-Type': 'application/json' };
      if(token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch('/api/kundli/generate', {
        method: 'POST', headers, body: JSON.stringify({ name, gender, dob, tob, pob }),
      });
      const apiData = await resp.json().catch(() => ({}));
      if(!resp.ok) throw new Error(apiData.error || 'Could not generate your chart.');

      // Stash the raw chart so the AI Assistant page can answer questions
      // grounded in it, even for people who aren't signed in / didn't save it.
      try { localStorage.setItem('vedicastro_last_chart', JSON.stringify(apiData)); } catch {}

      const data = adaptApiChart(apiData);
      renderResult(data);
      loading.classList.remove('is-active');
      result.classList.add('is-active');
      result.scrollIntoView({ behavior:'smooth', block:'start' });
    } catch (err) {
      loading.classList.remove('is-active');
      form.style.display = '';
      showFormError(
        err.message === 'Failed to fetch'
          ? "Couldn't reach the server — if you're previewing this as a static file, the backend isn't deployed yet."
          : err.message
      );
    }
  });
})();

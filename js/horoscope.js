/* ==========================================================================
   VedicAstro — horoscope page logic
   All 4 periods (daily/weekly/monthly/yearly) are real AI content now,
   each fetched ONCE per period from /api/horoscope?type=X (itself cached
   server-side for the whole period — a day, a week, a month, or a year).
   Switching between signs or periods reads from already-fetched data where
   possible — switching signs within a period makes zero network requests.
   ========================================================================== */
(function(){
  const grid = document.getElementById('signGrid');
  if(!grid) return;

  let currentSign = 'Leo';
  let currentPeriod = 'daily';
  const periodData = {};   // { daily: {Aries:{...}, ...}, weekly: {...}, ... } — fetched once per period
  const periodLabel = {};  // { weekly: "Aug 31 – Sep 6, 2026", ... }
  const fetchPromises = {};

  grid.innerHTML = SIGNS.map(s => `
    <button class="sign-chip${s.name===currentSign?' is-active':''}" data-sign="${s.name}" type="button">
      <span class="g">${s.sym}</span><span>${s.name}</span>
    </button>`).join('');

  function renderFields(h){
    document.getElementById('horoGeneral').textContent = h.general;
    document.getElementById('catGeneral').textContent = h.general;
    document.getElementById('catLove').textContent = h.love;
    document.getElementById('catCareer').textContent = h.career;
    document.getElementById('catFinance').textContent = h.finance;
    document.getElementById('catHealth').textContent = h.health;
  }

  function setLoading(){
    document.getElementById('horoGeneral').textContent = 'Reading the stars…';
    ['catGeneral','catLove','catCareer','catFinance','catHealth'].forEach(id => {
      document.getElementById(id).textContent = '…';
    });
  }

  // Fetches all 12 signs for a period exactly once, no matter how many times
  // it's called — later calls just await the same in-flight/completed request.
  function ensurePeriodLoaded(period){
    if(fetchPromises[period]) return fetchPromises[period];
    fetchPromises[period] = fetch(`/api/horoscope?type=${period}`)
      .then(resp => resp.json().then(data => ({ ok: resp.ok, data })))
      .then(({ ok, data }) => {
        if(!ok) throw new Error(data.error || `Could not load the ${period} horoscope.`);
        periodData[period] = data.horoscopes;
        periodLabel[period] = data.label;
        return periodData[period];
      });
    return fetchPromises[period];
  }

  function updatePeriodLabel(){
    const labelEl = document.getElementById('periodLabel');
    if(!labelEl) return;
    labelEl.textContent = periodLabel[currentPeriod] || '';
  }

  async function render(){
    const sign = SIGNS.find(s => s.name === currentSign);
    document.getElementById('signGlyph').textContent = sign.sym;
    document.getElementById('signName').textContent = sign.name;
    document.getElementById('signRange').textContent = sign.range;

    if(periodData[currentPeriod] && periodData[currentPeriod][currentSign]){
      renderFields(periodData[currentPeriod][currentSign]); // already have it — instant, no request
      updatePeriodLabel();
      return;
    }

    setLoading();
    try {
      const all = await ensurePeriodLoaded(currentPeriod);
      renderFields(all[currentSign] || getHoroscope(currentSign, currentPeriod));
      updatePeriodLabel();
    } catch (err) {
      renderFields(getHoroscope(currentSign, currentPeriod)); // graceful fallback, page never breaks
    }
  }

  grid.addEventListener('click', (e)=>{
    const chip = e.target.closest('.sign-chip');
    if(!chip) return;
    currentSign = chip.dataset.sign;
    grid.querySelectorAll('.sign-chip').forEach(c=>c.classList.remove('is-active'));
    chip.classList.add('is-active');
    render();
  });

  document.getElementById('periodTabs').addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    currentPeriod = btn.dataset.period;
    document.querySelectorAll('#periodTabs button').forEach(b=>b.classList.remove('is-active'));
    btn.classList.add('is-active');
    render();
  });

  render();
})();

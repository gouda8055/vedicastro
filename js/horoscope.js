/* ==========================================================================
   VedicAstro — horoscope page logic
   ========================================================================== */
(function(){
  const grid = document.getElementById('signGrid');
  if(!grid) return;

  let currentSign = 'Leo';
  let currentPeriod = 'daily';

  grid.innerHTML = SIGNS.map(s => `
    <button class="sign-chip${s.name===currentSign?' is-active':''}" data-sign="${s.name}" type="button">
      <span class="g">${s.sym}</span><span>${s.name}</span>
    </button>`).join('');

  function render(){
    const sign = SIGNS.find(s => s.name === currentSign);
    document.getElementById('signGlyph').textContent = sign.sym;
    document.getElementById('signName').textContent = sign.name;
    document.getElementById('signRange').textContent = sign.range;

    const h = getHoroscope(currentSign, currentPeriod);
    document.getElementById('horoGeneral').textContent = h.general;
    document.getElementById('catGeneral').textContent = h.general;
    document.getElementById('catLove').textContent = h.love;
    document.getElementById('catCareer').textContent = h.career;
    document.getElementById('catFinance').textContent = h.finance;
    document.getElementById('catHealth').textContent = h.health;
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

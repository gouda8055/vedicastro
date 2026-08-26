/* ==========================================================================
   VedicAstro — compatibility matching logic
   ========================================================================== */
(function(){
  const form = document.getElementById('matchForm');
  const resultEl = document.getElementById('matchResult');
  if(!form) return;

  const CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.7

  const BAR_LABELS = [
    { key:'overall',   label:'Overall Compatibility' },
    { key:'emotional',label:'Emotional Compatibility' },
    { key:'mental',   label:'Mental Compatibility' },
    { key:'physical', label:'Physical Compatibility' },
    { key:'financial',label:'Financial Compatibility' },
    { key:'spiritual',label:'Spiritual Compatibility' },
  ];

  function fmtDate(d){
    if(!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { day:'2-digit', month:'short', year:'numeric' });
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const p1 = {
      name: document.getElementById('p1name').value.trim() || 'You',
      dob: document.getElementById('p1dob').value, tob: document.getElementById('p1tob').value,
      pob: document.getElementById('p1pob').value.trim(),
    };
    const p2 = {
      name: document.getElementById('p2name').value.trim() || 'Partner',
      dob: document.getElementById('p2dob').value, tob: document.getElementById('p2tob').value,
      pob: document.getElementById('p2pob').value.trim(),
    };

    const result = computeCompatibility(p1, p2);
    const scores = { overall: result.overall, ...result.scores };

    document.getElementById('rp1name').textContent = p1.name;
    document.getElementById('rp1meta').textContent = `${fmtDate(p1.dob)}${p1.pob ? ' · ' + p1.pob : ''}`;
    document.getElementById('rp2name').textContent = p2.name;
    document.getElementById('rp2meta').textContent = `${fmtDate(p2.dob)}${p2.pob ? ' · ' + p2.pob : ''}`;

    document.getElementById('verdict').textContent = result.verdict;
    document.getElementById('scoreNum').textContent = result.overall + '%';

    const fg = document.getElementById('scoreFg');
    const offset = CIRCUMFERENCE * (1 - result.overall/100);
    fg.style.strokeDasharray = CIRCUMFERENCE.toFixed(1);
    fg.style.strokeDashoffset = CIRCUMFERENCE.toFixed(1);

    document.getElementById('matchBars').innerHTML = BAR_LABELS.map(b => `
      <div class="bar-row">
        <div class="lbl"><span>${b.label}</span><span>${scores[b.key]}%</span></div>
        <div class="track"><div class="fill" data-target="${scores[b.key]}"></div></div>
      </div>`).join('');

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
  });
})();

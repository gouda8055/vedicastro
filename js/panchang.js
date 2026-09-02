(function(){
  const loading = document.getElementById('panchangLoading');
  const errorEl = document.getElementById('panchangError');
  const content = document.getElementById('panchangContent');
  if(!content) return;

  function fmtDateHeading(dateStr){
    const [y,m,d] = dateStr.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  fetch('/api/horoscope?type=panchang')
    .then(resp => resp.json().then(data => ({ ok: resp.ok, data })))
    .then(({ ok, data }) => {
      if(!ok) throw new Error(data.error || "Could not load today's Panchang.");

      document.getElementById('panchangDateHeading').textContent = fmtDateHeading(data.date);
      document.getElementById('panchangOverview').textContent = data.overview;
      document.getElementById('pTithi').textContent = `${data.tithi} (${data.paksha})`;
      document.getElementById('pNakshatra').textContent = data.nakshatra;
      document.getElementById('pYoga').textContent = data.yoga;
      document.getElementById('pKarana').textContent = data.karana;
      document.getElementById('pSunrise').textContent = data.sunrise;
      document.getElementById('pSunset').textContent = data.sunset;
      document.getElementById('pAbhijit').textContent = data.abhijitMuhurat;
      document.getElementById('pRahu').textContent = data.rahuKaal;
      document.getElementById('pGulika').textContent = data.gulikaKaal;
      document.getElementById('pYamaganda').textContent = data.yamagandaKaal;

      loading.style.display = 'none';
      content.style.display = 'block';
    })
    .catch(err => {
      loading.style.display = 'none';
      errorEl.textContent = err.message === 'Failed to fetch' ? "Couldn't reach the server." : err.message;
      errorEl.style.display = 'block';
    });
})();

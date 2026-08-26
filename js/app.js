/* ==========================================================================
   VedicAstro — shared site behaviour
   ========================================================================== */

// ---- inject starfield (once per page) ----
(function starfield(){
  const el = document.createElement('div');
  el.className = 'stars';
  el.innerHTML = '<div class="layer layer--1"></div><div class="layer layer--2"></div>';
  document.body.prepend(el);

  function dots(n, maxOpacity){
    let shadow = [];
    for(let i=0;i<n;i++){
      const x = Math.round(Math.random()*2000);
      const y = Math.round(Math.random()*2000);
      const o = (Math.random()*maxOpacity + 0.15).toFixed(2);
      shadow.push(`${x}px ${y}px 0 rgba(244,240,230,${o})`);
    }
    return shadow.join(',');
  }
  const l1 = el.querySelector('.layer--1');
  const l2 = el.querySelector('.layer--2');
  l1.style.boxShadow = dots(140, 0.7);
  l2.style.boxShadow = dots(90, 0.4);
})();

// ---- celestial instrument ring: reusable zodiac dial ----
function buildZodiacRing(el){
  const radius = parseInt(el.dataset.radius, 10) || 200;
  const size = radius * 2 + 56;
  const c = size / 2;
  const glyphs = ['♈\uFE0E','♉\uFE0E','♊\uFE0E','♋\uFE0E','♌\uFE0E','♍\uFE0E','♎\uFE0E','♏\uFE0E','♐\uFE0E','♑\uFE0E','♒\uFE0E','♓\uFE0E'];

  let ticks = '';
  for(let j=0;j<60;j++){
    const a = (j*6) * Math.PI/180;
    const major = j % 5 === 0;
    const r1 = radius + 4, r2 = radius + (major ? 16 : 9);
    const x1 = c + r1*Math.cos(a), y1 = c + r1*Math.sin(a);
    const x2 = c + r2*Math.cos(a), y2 = c + r2*Math.sin(a);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${major ? 'zt-major' : 'zt-minor'}"/>`;
  }

  let glyphEls = '';
  glyphs.forEach((g,i)=>{
    const a = (i*30 - 90) * Math.PI/180;
    const x = c + (radius-22)*Math.cos(a);
    const y = c + (radius-22)*Math.sin(a);
    glyphEls += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" class="zg">${g}</text>`;
  });

  el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" class="zring-svg" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${radius}" class="zr-circle"/>
    <circle cx="${c}" cy="${c}" r="${radius-38}" class="zr-circle zr-circle--inner"/>
    <g class="zring-ticks">${ticks}</g>
    <g class="zring-glyphs">${glyphEls}</g>
  </svg>`;
}

// ---- session-aware nav ----
function applySessionToNav(){
  const token = localStorage.getItem('vedicastro_token');
  const cachedUser = localStorage.getItem('vedicastro_user');
  const signInLink = document.querySelector('.nav__cta a[href="signin.html"], .nav__cta a[href$="signin.html"]');
  if(!token || !signInLink) return;

  // show cached name immediately (no flash of "Sign In"), then verify in the background
  if(cachedUser){
    try { renderSignedIn(signInLink, JSON.parse(cachedUser).name); } catch {}
  }

  fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(({ user }) => {
      localStorage.setItem('vedicastro_user', JSON.stringify(user));
      renderSignedIn(signInLink, user.name);
    })
    .catch(() => {
      // token invalid/expired, or API not deployed yet — fall back to signed-out state
      localStorage.removeItem('vedicastro_token');
      localStorage.removeItem('vedicastro_user');
    });
}

function renderSignedIn(anchorEl, name){
  const firstName = (name || 'Account').split(' ')[0];
  anchorEl.textContent = `Hi, ${firstName}`;
  anchorEl.setAttribute('href', '#');
  anchorEl.title = 'Click to sign out';
  anchorEl.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('vedicastro_token');
    localStorage.removeItem('vedicastro_user');
    window.location.href = 'index.html';
  }, { once: true });
}

// ---- mobile nav toggle ----
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav__toggle');
  const links = document.querySelector('.nav__links');
  if(toggle && links){
    toggle.addEventListener('click', () => {
      links.classList.toggle('is-open');
      toggle.textContent = links.classList.contains('is-open') ? '✕' : '☰';
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      links.classList.remove('is-open');
      toggle.textContent = '☰';
    }));
  }

  // mark active nav link
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__links a').forEach(a=>{
    const href = a.getAttribute('href');
    if(href === here) a.classList.add('is-active');
  });

  // footer year
  document.querySelectorAll('[data-year]').forEach(n => n.textContent = new Date().getFullYear());

  // session-aware nav: if signed in, swap the "Sign In" pill for the user's name + sign out
  applySessionToNav();

  // scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && revealEls.length){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el=>io.observe(el));
  } else {
    revealEls.forEach(el=>el.classList.add('is-visible'));
  }

  // celestial instrument ring (signature decorative element)
  document.querySelectorAll('.zodiac-ring').forEach(buildZodiacRing);

  // animated counters
  document.querySelectorAll('[data-count]').forEach(el=>{
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    let started = false;
    const run = () => {
      if(started) return; started = true;
      const t0 = performance.now();
      function step(t){
        const p = Math.min(1, (t - t0)/dur);
        const eased = 1 - Math.pow(1-p, 3);
        const val = target * eased;
        el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
        if(p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };
    if('IntersectionObserver' in window){
      const io2 = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{ if(e.isIntersecting) run(); });
      }, { threshold: 0.4 });
      io2.observe(el);
    } else run();
  });
});

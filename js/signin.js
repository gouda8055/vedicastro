/* ==========================================================================
   VedicAstro — Sign In / Create Account
   Calls the real /api/auth/signup and /api/auth/login endpoints. Requires
   DATABASE_URL and AUTH_SECRET to be set on the deployment — see .env.example.
   ========================================================================== */
(function(){
  const tabs = document.getElementById('authTabs');
  const form = document.getElementById('authForm');
  if(!form) return;

  const title = document.getElementById('authTitle');
  const sub = document.getElementById('authSub');
  const submitBtn = document.getElementById('authSubmit');
  const note = document.getElementById('authNote');
  const switchCopy = document.getElementById('authSwitchCopy');
  const switchLink = document.getElementById('authSwitchLink');
  const signupOnly = document.querySelectorAll('[data-signup-only]');
  const signinOnly = document.querySelectorAll('[data-signin-only]');
  const nameInput = document.getElementById('authName');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');

  function setMode(mode){
    document.querySelectorAll('#authTabs button').forEach(b=>b.classList.toggle('is-active', b.dataset.mode===mode));
    note.textContent = '';
    note.classList.remove('is-active', 'is-error');
    if(mode === 'signup'){
      title.textContent = 'Create your VedicAstro account';
      sub.textContent = 'Save your Kundli, chat history and reports in one place.';
      submitBtn.textContent = 'Create Account';
      signupOnly.forEach(el=>el.style.display = 'block');
      signinOnly.forEach(el=>el.style.display = 'none');
      nameInput.required = true;
      switchCopy.textContent = 'Already have an account?';
      switchLink.textContent = 'Sign in';
    } else {
      title.textContent = 'Sign in to VedicAstro';
      sub.textContent = 'Access your saved Kundli, chat history and reports.';
      submitBtn.textContent = 'Sign In';
      signupOnly.forEach(el=>el.style.display = 'none');
      signinOnly.forEach(el=>el.style.display = 'flex');
      nameInput.required = false;
      switchCopy.textContent = 'New to VedicAstro?';
      switchLink.textContent = 'Create an account';
    }
  }

  tabs.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    setMode(btn.dataset.mode);
  });

  switchLink.addEventListener('click', (e)=>{
    e.preventDefault();
    const current = document.querySelector('#authTabs button.is-active').dataset.mode;
    setMode(current === 'signin' ? 'signup' : 'signin');
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const mode = document.querySelector('#authTabs button.is-active').dataset.mode;
    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const payload = mode === 'signup'
      ? { name: nameInput.value.trim(), email: emailInput.value.trim(), password: passwordInput.value }
      : { email: emailInput.value.trim(), password: passwordInput.value };

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';
    note.textContent = '';
    note.classList.remove('is-active', 'is-error');

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));

      if(!resp.ok){
        note.textContent = data.error || 'Something went wrong. Please try again.';
        note.classList.add('is-error');
        return;
      }

      // success — store the session and go to the homepage
      localStorage.setItem('vedicastro_token', data.token);
      localStorage.setItem('vedicastro_user', JSON.stringify(data.user));
      note.textContent = mode === 'signup' ? 'Account created! Redirecting…' : 'Signed in! Redirecting…';
      note.classList.add('is-active');
      setTimeout(() => { window.location.href = 'index.html'; }, 700);
    } catch (err) {
      // Most likely cause during local static preview: no backend deployed yet.
      note.textContent = "Couldn't reach the server. If you're previewing this as a static file, the API isn't deployed yet — this will work once it's live on Vercel with a database connected.";
      note.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  setMode('signin');
})();


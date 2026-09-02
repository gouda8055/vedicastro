(function(){
  const form = document.getElementById('forgotForm');
  const note = document.getElementById('forgotNote');
  const submitBtn = document.getElementById('forgotSubmit');
  if(!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';
    note.textContent = '';
    note.classList.remove('is-active', 'is-error');

    try {
      const resp = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot', email }),
      });
      const data = await resp.json().catch(() => ({}));
      if(!resp.ok) throw new Error(data.error || 'Something went wrong.');

      note.textContent = data.message || "If an account exists for that email, we've sent a reset link.";
      note.classList.add('is-active');
      form.querySelector('input, button').disabled = true;
      document.getElementById('forgotEmail').disabled = true;
    } catch (err) {
      note.textContent = err.message === 'Failed to fetch' ? "Couldn't reach the server." : err.message;
      note.classList.add('is-error');
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
})();

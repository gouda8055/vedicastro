(function(){
  const form = document.getElementById('resetForm');
  const note = document.getElementById('resetNote');
  const sub = document.getElementById('resetSub');
  const submitBtn = document.getElementById('resetSubmit');
  const switchLink = document.getElementById('resetSwitch');
  if(!form) return;

  const token = new URLSearchParams(location.search).get('token');
  if(!token){
    sub.textContent = 'This link is missing its reset code.';
    form.style.display = 'none';
    note.textContent = 'Please use the link from your email, or request a new one.';
    note.classList.add('is-error');
    switchLink.style.display = 'block';
    switchLink.innerHTML = '<a href="forgot-password.html">Request a new reset link →</a>';
    return;
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    note.textContent = '';
    note.classList.remove('is-active', 'is-error');

    if(newPassword.length < 8){
      note.textContent = 'Password must be at least 8 characters.';
      note.classList.add('is-error');
      return;
    }
    if(newPassword !== confirmPassword){
      note.textContent = "Passwords don't match.";
      note.classList.add('is-error');
      return;
    }

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Resetting…';

    try {
      const resp = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', token, newPassword }),
      });
      const data = await resp.json().catch(() => ({}));
      if(!resp.ok) throw new Error(data.error || 'Could not reset your password.');

      note.textContent = data.message || 'Your password has been reset.';
      note.classList.add('is-active');
      form.style.display = 'none';
      switchLink.style.display = 'block';
    } catch (err) {
      note.textContent = err.message === 'Failed to fetch' ? "Couldn't reach the server." : err.message;
      note.classList.add('is-error');
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
})();

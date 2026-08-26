/* ==========================================================================
   VedicAstro — AI Assistant chat
   Calls the real /api/assistant/chat endpoint (Grok). If the person is
   signed in and has a saved Kundli, answers are grounded in their real
   chart automatically — this file doesn't need to know that's happening.
   Requires GROK_API_KEY to be set on the deployment — see .env.example.
   ========================================================================== */
(function(){
  const body = document.getElementById('chatBody');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const suggestWrap = document.getElementById('chatSuggest');
  if(!form) return;

  // running conversation history, sent with each request so Grok has context
  const history = [];

  function scrollToEnd(){ body.scrollTop = body.scrollHeight; }

  function addMessage(text, who){
    const div = document.createElement('div');
    div.className = `msg msg--${who}`;
    div.textContent = text;
    body.appendChild(div);
    scrollToEnd();
    return div;
  }

  function addTyping(){
    const typing = document.createElement('div');
    typing.className = 'msg msg--bot msg--typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(typing);
    scrollToEnd();
    return typing;
  }

  async function getReply(question){
    const token = localStorage.getItem('vedicastro_token');
    const headers = { 'Content-Type': 'application/json' };
    if(token) headers.Authorization = `Bearer ${token}`;

    let chart = null;
    try {
      const raw = localStorage.getItem('vedicastro_last_chart');
      if(raw) chart = JSON.parse(raw);
    } catch {}

    const resp = await fetch('/api/assistant/chat', {
      method: 'POST', headers,
      body: JSON.stringify({ message: question, history, chart }),
    });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok) throw new Error(data.error || 'The assistant is temporarily unavailable.');
    return data;
  }

  async function sendQuestion(q){
    const question = q.trim();
    if(!question) return;

    addMessage(question, 'user');
    history.push({ role: 'user', content: question });
    input.disabled = true;

    const typing = addTyping();
    try {
      const data = await getReply(question);
      typing.remove();
      addMessage(data.reply, 'bot');
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      typing.remove();
      const isNetworkIssue = err.message === 'Failed to fetch';
      addMessage(
        isNetworkIssue
          ? "Couldn't reach the assistant — if you're previewing this as a static file, the backend isn't deployed yet."
          : err.message,
        'bot'
      );
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const v = input.value;
    input.value = '';
    sendQuestion(v);
  });

  suggestWrap.addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip');
    if(!chip) return;
    sendQuestion(chip.textContent);
  });

  // let the person know up front whether the AI actually has their chart to work from
  (function showGroundedStatus(){
    const statusEl = document.getElementById('chatStatus');
    if(!statusEl) return;
    try {
      if(localStorage.getItem('vedicastro_last_chart')){
        statusEl.textContent = 'Answering from your Kundli';
      }
    } catch {}
  })();

  // opening greeting (not sent to the API, just a local UI message)
  addMessage("Namaste! I'm your AI astrology guide. Ask me about your career, relationships, finances or growth — I'll explain what your chart suggests in plain language.", 'bot');
})();

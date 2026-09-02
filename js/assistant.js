/* ==========================================================================
   VedicAstro — AI Assistant chat
   Calls the real /api/assistant/chat endpoint (Grok). If the person is
   signed in and has a saved Kundli, answers are grounded in their real
   chart automatically — this file doesn't need to know that's happening.

   Question limit: signed-in users with a saved Kundli are enforced
   server-side (can't be bypassed). Anonymous users are limited here on the
   client as a soft guide — there's no durable server-side identity to
   enforce against without an account, so this could technically be cleared,
   but it correctly guides normal usage.

   Requires GROK_API_KEY to be set on the deployment — see .env.example.
   ========================================================================== */
(function(){
  const body = document.getElementById('chatBody');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const suggestWrap = document.getElementById('chatSuggest');
  if(!form) return;

  const CHART_QUESTION_LIMIT = 3; // mirrors QUESTION_LIMIT_PER_KUNDLI on the server
  const history = []; // running conversation history, sent with each request

  // authoritative usage as last reported by the server (signed-in + saved chart case)
  let serverQuestionsUsed = null;
  let serverQuestionLimit = null;

  function getStashedChart(){
    try {
      const raw = localStorage.getItem('vedicastro_last_chart');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function getLocalQuestionCount(chartId){
    try {
      const map = JSON.parse(localStorage.getItem('vedicastro_question_counts') || '{}');
      return map[chartId] || 0;
    } catch { return 0; }
  }

  function bumpLocalQuestionCount(chartId){
    try {
      const map = JSON.parse(localStorage.getItem('vedicastro_question_counts') || '{}');
      map[chartId] = (map[chartId] || 0) + 1;
      localStorage.setItem('vedicastro_question_counts', JSON.stringify(map));
    } catch {}
  }

  function currentUsage(){
    const chartId = getStashedChart() && getStashedChart().chartId;
    if(serverQuestionsUsed !== null) return { used: serverQuestionsUsed, limit: serverQuestionLimit, chartId };
    if(chartId) return { used: getLocalQuestionCount(chartId), limit: CHART_QUESTION_LIMIT, chartId };
    return { used: 0, limit: CHART_QUESTION_LIMIT, chartId: null };
  }

  function updateStatus(){
    const statusEl = document.getElementById('chatStatus');
    if(!statusEl) return;
    const chart = getStashedChart();
    if(!chart){ statusEl.textContent = 'Online now'; return; }
    const { used, limit } = currentUsage();
    statusEl.textContent = `Answering from your Kundli · ${used} of ${limit} questions used`;
  }

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

  async function getReply(question, chart){
    const token = localStorage.getItem('vedicastro_token');
    const headers = { 'Content-Type': 'application/json' };
    if(token) headers.Authorization = `Bearer ${token}`;

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

    const { used, limit, chartId } = currentUsage();
    if(chartId && used >= limit){
      addMessage(question, 'user');
      addMessage(`You've reached the ${limit}-question limit for this Kundli. Generate a new chart to keep asking, or upgrade your plan for unlimited questions.`, 'bot');
      return;
    }

    addMessage(question, 'user');
    history.push({ role: 'user', content: question });
    input.disabled = true;

    const typing = addTyping();
    try {
      const chart = getStashedChart();
      const data = await getReply(question, chart);
      typing.remove();
      addMessage(data.reply, 'bot');
      history.push({ role: 'assistant', content: data.reply });

      if(typeof data.questionsUsed === 'number' && typeof data.questionLimit === 'number'){
        serverQuestionsUsed = data.questionsUsed;
        serverQuestionLimit = data.questionLimit;
      } else if(chartId){
        bumpLocalQuestionCount(chartId);
      }
      updateStatus();
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

  updateStatus();

  // opening greeting (not sent to the API, just a local UI message)
  addMessage("Namaste! I'm your AI astrology guide. Ask me about your career, relationships, finances or growth — I'll explain what your chart suggests in plain language.", 'bot');
})();

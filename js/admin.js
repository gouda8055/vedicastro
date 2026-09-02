/* ==========================================================================
   VedicAstro — Admin dashboard
   Every request here carries the person's own session token; the actual
   security boundary is entirely server-side (requireAdmin on every admin
   endpoint) — this page just reacts to a 403 by showing "access denied"
   rather than assuming anything about who's allowed to see it.
   ========================================================================== */
(function(){
  const deniedNotice = document.getElementById('deniedNotice');
  const deniedReason = document.getElementById('deniedReason');
  const loadingNotice = document.getElementById('loadingNotice');
  const adminContent = document.getElementById('adminContent');
  if(!adminContent) return;

  const token = localStorage.getItem('vedicastro_token');

  function deny(reason){
    loadingNotice.style.display = 'none';
    adminContent.style.display = 'none';
    deniedReason.textContent = reason;
    deniedNotice.style.display = 'block';
  }

  function authedFetch(url){
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  function fmtDate(d){
    if(!d) return '';
    return new Date(d).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
  }
  // Birth dates (unlike createdAt timestamps) are plain "YYYY-MM-DD" strings
  // with no time/timezone. Parsing those with `new Date(str)` treats them as
  // UTC midnight, which can roll back a day in a timezone behind UTC — parse
  // the parts directly and build a LOCAL date instead.
  function fmtDateOnly(dateStr){
    if(!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
  }

  async function loadStats(){
    const resp = await authedFetch('/api/admin?resource=stats');
    if(!resp.ok) throw new Error(resp.status === 403 ? 'forbidden' : 'error');
    const s = await resp.json();
    document.getElementById('statUsers').textContent = s.totalUsers;
    document.getElementById('statKundlis').textContent = s.totalKundlis;
    document.getElementById('statMatches').textContent = s.totalCompatibilityReports;
    document.getElementById('statMessages').textContent = s.totalChatMessages;
    document.getElementById('statUsersToday').textContent = s.newUsersToday;
    document.getElementById('statKundlisToday').textContent = s.kundlisToday;
  }

  const TABS = {
    users: {
      url: '/api/admin?resource=users',
      head: ['Name', 'Email', 'Plan', 'Admin', 'Joined'],
      rows: (data) => data.users.map(u => [u.name, u.email, u.plan, u.isAdmin ? 'Yes' : '', fmtDate(u.createdAt)]),
    },
    kundlis: {
      url: '/api/admin?resource=kundlis',
      head: ['Chart Name', 'Owner', 'Owner Email', 'DOB', 'Birth Place', 'Generated'],
      rows: (data) => data.kundlis.map(k => [k.name, k.ownerName, k.ownerEmail, fmtDateOnly(k.dob), k.pob, fmtDate(k.createdAt)]),
    },
    matching: {
      url: '/api/admin?resource=matching',
      head: ['Person 1', 'Person 2', 'Owner', 'Score', 'Verdict', 'Checked'],
      rows: (data) => data.reports.map(r => [r.person1Name, r.person2Name, r.ownerEmail, r.totalPoints != null ? `${r.totalPoints}/36` : '–', r.verdict || '–', fmtDate(r.createdAt)]),
    },
  };

  async function loadTab(tabKey){
    const tab = TABS[tabKey];
    const tableHead = document.getElementById('adminTableHead');
    const tableBody = document.getElementById('adminTableBody');
    const tableLoading = document.getElementById('tableLoading');
    const tableEmpty = document.getElementById('tableEmpty');
    const table = document.getElementById('adminTable');

    table.style.display = 'none';
    tableEmpty.style.display = 'none';
    tableLoading.style.display = 'block';

    try {
      const resp = await authedFetch(tab.url);
      if(!resp.ok) throw new Error('load failed');
      const data = await resp.json();
      const rows = tab.rows(data);

      tableHead.innerHTML = tab.head.map(h => `<th>${h}</th>`).join('');
      tableBody.innerHTML = rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('');

      tableLoading.style.display = 'none';
      if(rows.length === 0){
        tableEmpty.style.display = 'block';
      } else {
        table.style.display = 'table';
      }
    } catch {
      tableLoading.style.display = 'none';
      tableEmpty.textContent = 'Could not load this data.';
      tableEmpty.style.display = 'block';
    }
  }

  document.getElementById('adminTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if(!btn) return;
    document.querySelectorAll('#adminTabs button').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    loadTab(btn.dataset.tab);
  });

  (async function init(){
    if(!token){
      deny('You need to sign in with an admin account to view this page.');
      return;
    }
    try {
      await loadStats();
      loadingNotice.style.display = 'none';
      adminContent.style.display = 'block';
      loadTab('users');
    } catch (err) {
      deny(err.message === 'forbidden'
        ? "Your account doesn't have admin access."
        : "Couldn't reach the server — if you're previewing this as a static file, the backend isn't deployed yet.");
    }
  })();
})();

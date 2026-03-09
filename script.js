// ===== STATE =====
const PASSWORD = '123';
let certificates = [];
let meetings = [];
let currentImg = '';
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
let notifInterval = null;

// ===== STORAGE =====
function saveData() {
  try {
    localStorage.setItem('cm_certificates', JSON.stringify(certificates));
    localStorage.setItem('cm_meetings',     JSON.stringify(meetings));
  } catch(e) { console.warn('Storage save failed', e); }
}

function loadData() {
  try {
    const c = localStorage.getItem('cm_certificates');
    const m = localStorage.getItem('cm_meetings');
    if (c) certificates = JSON.parse(c);
    if (m) meetings     = JSON.parse(m);
  } catch(e) { console.warn('Storage load failed', e); }
}

function resetData() {
  if (!confirm('âš ï¸ This will permanently delete ALL certificates and meetings. Are you sure?')) return;
  if (!confirm('Last chance â€” this cannot be undone. Reset everything?')) return;
  certificates = [];
  meetings     = [];
  localStorage.removeItem('cm_certificates');
  localStorage.removeItem('cm_meetings');
  renderTable();
  renderMeetingsTable();
  updateStats();
  if (document.getElementById('page-calendar').classList.contains('active')) renderCalendar();
  showToast('All data has been reset!', 'error');
}

// ===== AUTH =====
function login() {
  if (document.getElementById('passwordInput').value === PASSWORD) {
    loadData();
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainPage').style.display = 'block';
    document.getElementById('issuedDate').valueAsDate = new Date();
    calYear  = new Date().getFullYear();
    calMonth = new Date().getMonth();
    renderTable();
    renderMeetingsTable();
    updateStats();
    requestNotifPermission();
    startNotifChecker();
  } else {
    document.getElementById('loginError').textContent = 'Wrong password!';
  }
}

function logout() {
  if (confirm('Logout?')) {
    document.getElementById('mainPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('passwordInput').value = '';
    if (notifInterval) clearInterval(notifInterval);
  }
}

// ===== PAGE SWITCHING =====
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'calendar') renderCalendar();
  if (name === 'meetings') renderMeetingsTable();
}

// ===== IMAGE PREVIEW =====
function previewImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { showToast('File too large! Max 5MB', 'error'); e.target.value = ''; return; }
  document.getElementById('fileLabel').textContent = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('previewImg').src = ev.target.result;
    document.getElementById('imagePreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function clearPreview() {
  document.getElementById('certFile').value = '';
  document.getElementById('fileLabel').textContent = 'Upload Certificate Image';
  document.getElementById('imagePreview').style.display = 'none';
}

// ===== ADD CERTIFICATE =====
function addCertificate() {
  const certNumber = document.getElementById('certNumber').value.trim();
  const supplier   = document.getElementById('supplier').value.trim();
  const issuedDate = document.getElementById('issuedDate').value;
  const expiryDate = document.getElementById('expiryDate').value;
  const file       = document.getElementById('certFile').files[0];

  if (!certNumber) { showToast('Please enter a certificate number!', 'error'); return; }
  if (!supplier)   { showToast('Please enter a supplier name!', 'error'); return; }
  if (!issuedDate) { showToast('Please select an issued date!', 'error'); return; }
  if (!expiryDate) { showToast('Please select an expiry date!', 'error'); return; }

  const doSave = (imageData) => {
    certificates.push({ id: Date.now(), certNumber, supplier, issuedDate, expiryDate, image: imageData, notified: false });
    saveData();
    renderTable();
    updateStats();
    document.getElementById('certNumber').value = '';
    document.getElementById('supplier').value   = '';
    document.getElementById('issuedDate').valueAsDate = new Date();
    document.getElementById('expiryDate').value = '';
    clearPreview();
    showToast('Certificate added!', 'success');
    if (document.getElementById('page-calendar').classList.contains('active')) renderCalendar();
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = ev => doSave(ev.target.result);
    reader.readAsDataURL(file);
  } else {
    doSave('');
  }
}

// ===== RENDER TABLE =====
function renderTable() {
  const tbody = document.querySelector('#certTable tbody');
  const empty  = document.getElementById('emptyState');
  tbody.innerHTML = '';
  if (certificates.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  certificates.forEach(cert => {
    const s = getStatus(cert.expiryDate);
    const row = tbody.insertRow();
    row.className = s.cls;
    row.innerHTML = `
      <td><strong>${cert.certNumber}</strong></td>
      <td>${cert.supplier}</td>
      <td>${formatDate(cert.issuedDate)}</td>
      <td>${formatDate(cert.expiryDate)}</td>
      <td><span class="status-badge status-${s.cls}">${s.text}</span></td>
      <td><img src="${cert.image}" class="certificate-img" onclick="viewCert(${cert.id})"></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn btn-view" onclick="viewCert(${cert.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="action-btn btn-delete" onclick="deleteCert(${cert.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            </svg>
          </button>
        </div>
      </td>`;
  });
}

// ===== STATUS =====
function getStatus(expiryDate) {
  const today  = new Date(); today.setHours(0,0,0,0);
  const expiry = new Date(expiryDate); expiry.setHours(0,0,0,0);
  const diff   = expiry - today;
  const month  = 30*24*60*60*1000;
  if (expiry < today) return { text:'Expired',       cls:'expired' };
  if (diff <= month)  return { text:'Expiring Soon', cls:'expiring' };
  return                     { text:'Valid',          cls:'valid' };
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}
function formatDateTime(d) {
  return new Date(d).toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ===== STATS =====
function updateStats() {
  let valid=0, expiring=0, expired=0;
  certificates.forEach(c => {
    const s = getStatus(c.expiryDate);
    if (s.cls==='valid') valid++;
    else if (s.cls==='expiring') expiring++;
    else expired++;
  });
  document.getElementById('totalCount').textContent    = certificates.length;
  document.getElementById('validCount').textContent    = valid;
  document.getElementById('expiringCount').textContent = expiring;
  document.getElementById('expiredCount').textContent  = expired;

  const now = new Date();
  const todayMeetings = meetings.filter(m => new Date(m.datetime).toDateString() === now.toDateString());
  document.getElementById('meetingsTodayCount').textContent = todayMeetings.length;

  const upcoming = meetings.filter(m => { const mt=new Date(m.datetime); return mt>now && (mt-now)<=24*60*60*1000; });
  const count = expiring + expired + upcoming.length;
  const badge = document.getElementById('reminderBadge');
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ===== VIEW / DELETE CERT =====
function viewCert(id) {
  const cert = certificates.find(c => c.id === id);
  if (cert) {
    currentImg = cert.image;
    document.getElementById('viewCertImage').src = cert.image;
    document.getElementById('viewCertModal').style.display = 'block';
  }
}
function deleteCert(id) {
  if (confirm('Delete this certificate?')) {
    certificates = certificates.filter(c => c.id !== id);
    saveData();
    renderTable(); updateStats();
    if (document.getElementById('page-calendar').classList.contains('active')) renderCalendar();
    showToast('Deleted!', 'success');
  }
}
function downloadCert() {
  if (currentImg) { const a=document.createElement('a'); a.href=currentImg; a.download='cert_'+Date.now()+'.jpg'; a.click(); }
}

// ===== MEETINGS =====
function addMeeting() {
  const title    = document.getElementById('meetingTitle').value.trim();
  const datetime = document.getElementById('meetingDatetime').value;
  const location = document.getElementById('meetingLocation').value.trim();
  const notes    = document.getElementById('meetingNotes').value.trim();
  const color    = document.getElementById('meetingColor').value;

  if (!title)    { showToast('Please enter a meeting title!', 'error'); return; }
  if (!datetime) { showToast('Please select a date and time!', 'error'); return; }

  meetings.push({ id:Date.now(), title, datetime, location, notes, color, notified:false });
  saveData();
  renderMeetingsTable();
  updateStats();
  document.getElementById('meetingTitle').value    = '';
  document.getElementById('meetingDatetime').value = '';
  document.getElementById('meetingLocation').value = '';
  document.getElementById('meetingNotes').value    = '';
  document.getElementById('meetingColor').value    = '#3B82F6';
  showToast('Meeting added!', 'success');
  if (document.getElementById('page-calendar').classList.contains('active')) renderCalendar();
}

function renderMeetingsTable() {
  const tbody = document.querySelector('#meetingsTable tbody');
  const empty  = document.getElementById('meetingsEmptyState');
  tbody.innerHTML = '';
  const sorted = [...meetings].sort((a,b) => new Date(a.datetime)-new Date(b.datetime));
  if (sorted.length === 0) { empty.style.display='block'; return; }
  empty.style.display = 'none';
  const now = new Date();
  sorted.forEach(m => {
    const mt     = new Date(m.datetime);
    const isPast = mt < now;
    const isToday = mt.toDateString() === now.toDateString();
    const isSoon  = !isPast && (mt-now) <= 24*60*60*1000;
    let badge = isPast   ? '<span class="status-badge status-expired">Past</span>'
              : isToday  ? '<span class="status-badge status-expiring">Today</span>'
              : isSoon   ? '<span class="status-badge status-expiring">Tomorrow</span>'
              :            '<span class="status-badge status-valid">Upcoming</span>';
    const row = tbody.insertRow();
    row.style.opacity = isPast ? '0.55' : '1';
    row.innerHTML = `
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:14px;height:14px;border-radius:50%;background:${m.color};flex-shrink:0"></div>
        <strong>${m.title}</strong>
      </div></td>
      <td>${formatDateTime(m.datetime)}</td>
      <td>${badge}</td>
      <td>${m.location||'<span style="color:var(--color-text-tertiary)">â€”</span>'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.notes||'<span style="color:var(--color-text-tertiary)">â€”</span>'}</td>
      <td><button class="action-btn btn-delete" onclick="deleteMeeting(${m.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
        </svg>
      </button></td>`;
  });
}

function deleteMeeting(id) {
  if (confirm('Delete this meeting?')) {
    meetings = meetings.filter(m => m.id !== id);
    saveData();
    renderMeetingsTable(); updateStats();
    if (document.getElementById('page-calendar').classList.contains('active')) renderCalendar();
    showToast('Meeting deleted!', 'success');
  }
}

// ===== REMINDERS MODAL =====
function viewReminders() {
  const now = new Date();
  let html = '';
  const certAlerts = certificates.filter(c => getStatus(c.expiryDate).cls !== 'valid');
  if (certAlerts.length) {
    html += '<div class="reminder-section-label">ðŸ“„ Certificate Alerts</div>';
    html += certAlerts.map(c => {
      const s = getStatus(c.expiryDate);
      return `<div class="reminder-item reminder-${s.cls}"><strong>${c.certNumber}</strong><span>${c.supplier} â€” Expires: ${formatDate(c.expiryDate)}</span></div>`;
    }).join('');
  }
  const upcoming = meetings
    .filter(m => { const mt=new Date(m.datetime); return mt>=now && (mt-now)<=7*24*60*60*1000; })
    .sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
  if (upcoming.length) {
    html += `<div class="reminder-section-label" style="margin-top:${certAlerts.length?'20px':'0'}">ðŸ—“ Upcoming Meetings (Next 7 Days)</div>`;
    html += upcoming.map(m => `<div class="reminder-item reminder-meeting" style="border-left-color:${m.color};background:${m.color}18">
      <strong style="color:${m.color}">${m.title}</strong>
      <span>${formatDateTime(m.datetime)}${m.location?' Â· ðŸ“ '+m.location:''}</span>
    </div>`).join('');
  }
  if (!html) html = '<p style="text-align:center;padding:40px;color:var(--color-text-secondary)">All clear! âœ…</p>';
  document.getElementById('reminderContent').innerHTML = html;
  document.getElementById('reminderModal').style.display = 'block';
}

// ===== NOTIFICATIONS =====
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}
function startNotifChecker() {
  checkNotifications();
  notifInterval = setInterval(checkNotifications, 60000);
}
function checkNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  meetings.forEach(m => {
    if (m.notified) return;
    const diff = new Date(m.datetime) - now;
    if (diff > 0 && diff <= 15*60*1000) {
      new Notification('ðŸ—“ Meeting Starting Soon', { body: `"${m.title}" starts in ~${Math.round(diff/60000)} min${m.location?'\nðŸ“ '+m.location:''}` });
      m.notified = true;
    }
  });
  certificates.forEach(c => {
    if (c.notified) return;
    const expiry = new Date(c.expiryDate); expiry.setHours(0,0,0,0);
    const today  = new Date(); today.setHours(0,0,0,0);
    if (expiry.getTime() === today.getTime()) {
      new Notification('âš ï¸ Certificate Expiring Today', { body: `${c.certNumber} (${c.supplier}) expires today!` });
      c.notified = true;
    }
  });
  updateStats();
}

// ===== FILTER =====
function filterTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  document.querySelectorAll('#certTable tbody tr').forEach(row => {
    const ok = row.textContent.toLowerCase().includes(search) && (status==='all'||row.classList.contains(status));
    row.style.display = ok ? '' : 'none';
  });
}
function filterMeetings() {
  const search = document.getElementById('meetingSearch').value.toLowerCase();
  document.querySelectorAll('#meetingsTable tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
  });
}

// ===== EXPORT =====
function exportData() {
  if (!certificates.length && !meetings.length) { alert('No data to export'); return; }
  const blob = new Blob([JSON.stringify({ certificates, meetings }, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='cert_manager_'+Date.now()+'.json'; a.click();
  showToast('Exported!', 'success');
}

// ===== MODAL / TOAST =====
function closeModal(id) { document.getElementById(id).style.display='none'; }
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast '+type+' show';
  setTimeout(() => t.className='toast', 3000);
}

// ===== CALENDAR =====
function changeCalMonth(dir) {
  calMonth += dir;
  if (calMonth>11){calMonth=0;calYear++;}
  if (calMonth<0) {calMonth=11;calYear--;}
  renderCalendar(); closeCalDetail();
}
function goToday() {
  calYear=new Date().getFullYear(); calMonth=new Date().getMonth();
  renderCalendar(); closeCalDetail();
}

function renderCalendar() {
  const monthNames=['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
  document.getElementById('calMonthYear').textContent = monthNames[calMonth]+' '+calYear;

  const today       = new Date(); today.setHours(0,0,0,0);
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();

  // Build date map
  const map = {};
  const add = (ds, type, item) => {
    if (!map[ds]) map[ds] = { meetings:[], issued:[], expiry:[] };
    map[ds][type].push(item);
  };
  certificates.forEach(c => { add(c.issuedDate,'issued',c); add(c.expiryDate,'expiry',c); });
  meetings.forEach(m => {
    const d = new Date(m.datetime);
    add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, 'meetings', m);
  });

  const container = document.getElementById('calendarDays');
  container.innerHTML = '';
  const total = Math.ceil((firstDay+daysInMonth)/7)*7;

  for (let i=0; i<total; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    let day, mon, yr, isOther=false;

    if (i < firstDay) {
      day=daysInPrev-firstDay+i+1; mon=calMonth-1; yr=calYear;
      if(mon<0){mon=11;yr--;} isOther=true;
    } else if (i-firstDay >= daysInMonth) {
      day=i-firstDay-daysInMonth+1; mon=calMonth+1; yr=calYear;
      if(mon>11){mon=0;yr++;} isOther=true;
    } else {
      day=i-firstDay+1; mon=calMonth; yr=calYear;
    }

    const ds = `${yr}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = new Date(yr,mon,day).getTime() === today.getTime();

    if (isOther) cell.classList.add('other-month');
    if (isToday)  cell.classList.add('today');

    const dn = document.createElement('div');
    dn.className = 'day-number';
    dn.textContent = day;
    cell.appendChild(dn);

    const data = map[ds];
    if (data) {
      cell.classList.add('has-events');
      const dots = document.createElement('div');
      dots.className = 'day-dots';
      const pills = [];
      data.meetings.forEach(m => pills.push({type:'meeting',item:m}));
      data.issued.forEach(c  => pills.push({type:'issued', item:c}));
      data.expiry.forEach(c  => { const s=getStatus(c.expiryDate); pills.push({type:'expiry',item:c,cls:s.cls}); });

      pills.slice(0,3).forEach(p => {
        const pill = document.createElement('div');
        pill.className = 'day-pill';
        if (p.type==='meeting') {
          pill.style.cssText=`background:${p.item.color}22;color:${p.item.color};border:1px solid ${p.item.color}55`;
          pill.textContent = 'ðŸ—“ '+p.item.title;
        } else if (p.type==='issued') {
          pill.classList.add('pill-issued');
          pill.textContent = 'â†‘ '+p.item.certNumber;
        } else {
          pill.classList.add('pill-'+p.cls);
          pill.textContent = 'âœ• '+p.item.certNumber;
        }
        dots.appendChild(pill);
      });
      if (pills.length>3) {
        const more=document.createElement('div');
        more.className='more-certs';
        more.textContent='+'+(pills.length-3)+' more';
        dots.appendChild(more);
      }
      cell.appendChild(dots);
      cell.addEventListener('click', () => openCalDetail(ds, data));
    }
    container.appendChild(cell);
  }
}

function openCalDetail(ds, data) {
  document.getElementById('calDetailDate').textContent = 'Events on '+formatDate(ds);
  const grid = document.getElementById('calDetailItems');
  grid.innerHTML = '';

  data.meetings.forEach(m => {
    const c=document.createElement('div');
    c.className='detail-card issued-card';
    c.style.borderLeftColor=m.color;
    c.innerHTML=`<div class="detail-type" style="color:${m.color}">ðŸ—“ Meeting</div>
      <div class="detail-num">${m.title}</div>
      <div class="detail-sub">${formatDateTime(m.datetime)}</div>
      ${m.location?`<div class="detail-meta">ðŸ“ ${m.location}</div>`:''}
      ${m.notes?`<div class="detail-meta">ðŸ“ ${m.notes}</div>`:''}`;
    grid.appendChild(c);
  });
  data.issued.forEach(cert => {
    const c=document.createElement('div');
    c.className='detail-card issued-card';
    c.innerHTML=`<div class="detail-type" style="color:var(--color-accent)">ðŸ“„ Issued</div>
      <div class="detail-num">${cert.certNumber}</div>
      <div class="detail-sub">${cert.supplier}</div>
      <div class="detail-meta">Expires: ${formatDate(cert.expiryDate)}</div>
      ${cert.image?`<img src="${cert.image}" class="detail-img" onclick="viewCert(${cert.id})">`:''}`;
    c.addEventListener('click',e=>{if(e.target.tagName!=='IMG')viewCert(cert.id);});
    grid.appendChild(c);
  });
  data.expiry.forEach(cert => {
    const s=getStatus(cert.expiryDate);
    const icons={valid:'âœ…',expiring:'âš ï¸',expired:'âŒ'};
    const c=document.createElement('div');
    c.className=`detail-card expiry-card ${s.cls}`;
    c.innerHTML=`<div class="detail-type">${icons[s.cls]} Expiry â€” <span class="status-badge status-${s.cls}" style="font-size:10px;padding:2px 8px">${s.text}</span></div>
      <div class="detail-num">${cert.certNumber}</div>
      <div class="detail-sub">${cert.supplier}</div>
      <div class="detail-meta">Issued: ${formatDate(cert.issuedDate)}</div>
      ${cert.image?`<img src="${cert.image}" class="detail-img" onclick="viewCert(${cert.id})">`:''}`;
    c.addEventListener('click',e=>{if(e.target.tagName!=='IMG')viewCert(cert.id);});
    grid.appendChild(c);
  });

  document.getElementById('calDetailPanel').classList.add('show');
  document.getElementById('calDetailPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function closeCalDetail() { document.getElementById('calDetailPanel').classList.remove('show'); }

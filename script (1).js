// ===== STATE =====
const PASSWORD = "123";
let certificates = [];
let currentImg = '';
let calYear, calMonth;

// ===== AUTH =====
function login() {
  const pass = document.getElementById('passwordInput').value;
  if (pass === PASSWORD) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainPage').style.display = 'block';
    updateStats();
    initCalendar();
  } else {
    document.getElementById('loginError').textContent = 'Wrong password!';
  }
}

function logout() {
  if (confirm('Logout?')) {
    document.getElementById('mainPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('passwordInput').value = '';
  }
}

// ===== PAGE SWITCHING =====
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'calendar') renderCalendar();
}

// ===== IMAGE PREVIEW =====
function previewImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('File too large! Max 5MB');
    e.target.value = '';
    return;
  }
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
function addCertificate(e) {
  e.preventDefault();
  const certNumber = document.getElementById('certNumber').value;
  const supplier   = document.getElementById('supplier').value;
  const issuedDate = document.getElementById('issuedDate').value;
  const expiryDate = document.getElementById('expiryDate').value;
  const file = document.getElementById('certFile').files[0];

  if (!file) { alert('Please upload an image'); return; }

  const reader = new FileReader();
  reader.onload = ev => {
    certificates.push({
      id: Date.now(),
      certNumber,
      supplier,
      issuedDate,
      expiryDate,
      image: ev.target.result
    });
    renderTable();
    updateStats();
    document.getElementById('certForm').reset();
    clearPreview();
    showToast('Certificate added!', 'success');
    if (document.getElementById('page-calendar').classList.contains('active')) {
      renderCalendar();
    }
  };
  reader.readAsDataURL(file);
}

// ===== RENDER TABLE =====
function renderTable() {
  const tbody = document.querySelector('#certTable tbody');
  const empty  = document.getElementById('emptyState');
  tbody.innerHTML = '';

  if (certificates.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  certificates.forEach(cert => {
    const status = getStatus(cert.expiryDate);
    const row = tbody.insertRow();
    row.className = status.class;
    row.innerHTML = `
      <td><strong>${cert.certNumber}</strong></td>
      <td>${cert.supplier}</td>
      <td>${formatDate(cert.issuedDate)}</td>
      <td>${formatDate(cert.expiryDate)}</td>
      <td><span class="status-badge status-${status.class}">${status.text}</span></td>
      <td><img src="${cert.image}" class="certificate-img" onclick="viewCert(${cert.id})"></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn btn-view" onclick="viewCert(${cert.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="action-btn btn-delete" onclick="deleteCert(${cert.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            </svg>
          </button>
        </div>
      </td>
    `;
  });
}

// ===== STATUS =====
function getStatus(expiryDate) {
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  const diff   = expiry - today;
  const month  = 30 * 24 * 60 * 60 * 1000;

  if (expiry < today)  return { text: 'Expired',       class: 'expired' };
  if (diff <= month)   return { text: 'Expiring Soon', class: 'expiring' };
  return                      { text: 'Valid',          class: 'valid' };
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ===== STATS =====
function updateStats() {
  let valid = 0, expiring = 0, expired = 0;
  certificates.forEach(cert => {
    const s = getStatus(cert.expiryDate);
    if (s.class === 'valid')         valid++;
    else if (s.class === 'expiring') expiring++;
    else                             expired++;
  });

  document.getElementById('totalCount').textContent    = certificates.length;
  document.getElementById('validCount').textContent    = valid;
  document.getElementById('expiringCount').textContent = expiring;
  document.getElementById('expiredCount').textContent  = expired;

  const badge = document.getElementById('reminderBadge');
  const count = expiring + expired;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ===== VIEW / DELETE =====
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
    renderTable();
    updateStats();
    if (document.getElementById('page-calendar').classList.contains('active')) {
      renderCalendar();
    }
    showToast('Deleted!', 'success');
  }
}

function downloadCert() {
  if (currentImg) {
    const a = document.createElement('a');
    a.href = currentImg;
    a.download = 'certificate_' + Date.now() + '.jpg';
    a.click();
  }
}

// ===== REMINDERS =====
function viewReminders() {
  const content = document.getElementById('reminderContent');
  const reminders = certificates.filter(cert => getStatus(cert.expiryDate).class !== 'valid');

  if (reminders.length === 0) {
    content.innerHTML = '<p style="text-align:center;padding:40px;color:var(--color-text-secondary);">All clear! ✅</p>';
  } else {
    content.innerHTML = reminders.map(cert => {
      const s = getStatus(cert.expiryDate);
      return `<div class="reminder-item reminder-${s.class}">
        <strong>${cert.certNumber}</strong>
        <span>${cert.supplier} — Expires: ${formatDate(cert.expiryDate)}</span>
      </div>`;
    }).join('');
  }
  document.getElementById('reminderModal').style.display = 'block';
}

// ===== FILTER =====
function filterTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;

  document.querySelectorAll('#certTable tbody tr').forEach(row => {
    const matchSearch = row.textContent.toLowerCase().includes(search);
    const matchStatus = status === 'all' || row.classList.contains(status);
    row.style.display = matchSearch && matchStatus ? '' : 'none';
  });
}

// ===== EXPORT =====
function exportData() {
  if (certificates.length === 0) { alert('No data to export'); return; }
  const blob = new Blob([JSON.stringify(certificates, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'certificates_' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported!', 'success');
}

// ===== MODAL =====
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ===== TOAST =====
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.className = 'toast', 3000);
}

// ===== CALENDAR =====
function initCalendar() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
}

function changeCalMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
  closeCalDetail();
}

function goToday() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
  closeCalDetail();
}

function renderCalendar() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  document.getElementById('calMonthYear').textContent = monthNames[calMonth] + ' ' + calYear;

  const today       = new Date(); today.setHours(0, 0, 0, 0);
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();

  // Build date map: dateStr -> { issued: [], expiry: [] }
  const dateMap = {};
  const addToMap = (dateStr, type, cert) => {
    if (!dateMap[dateStr]) dateMap[dateStr] = { issued: [], expiry: [] };
    dateMap[dateStr][type].push(cert);
  };
  certificates.forEach(cert => {
    addToMap(cert.issuedDate, 'issued', cert);
    addToMap(cert.expiryDate, 'expiry', cert);
  });

  const container  = document.getElementById('calendarDays');
  container.innerHTML = '';
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    let day, month, year, isOther = false;

    if (i < firstDay) {
      day = daysInPrev - firstDay + i + 1;
      month = calMonth - 1; year = calYear;
      if (month < 0) { month = 11; year--; }
      isOther = true;
    } else if (i - firstDay >= daysInMonth) {
      day = i - firstDay - daysInMonth + 1;
      month = calMonth + 1; year = calYear;
      if (month > 11) { month = 0; year++; }
      isOther = true;
    } else {
      day = i - firstDay + 1;
      month = calMonth; year = calYear;
    }

    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cellDate = new Date(year, month, day);
    const isToday  = cellDate.getTime() === today.getTime();

    if (isOther) cell.classList.add('other-month');
    if (isToday)  cell.classList.add('today');

    // Day number
    const dayNum = document.createElement('div');
    dayNum.className = 'day-number';
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    // Certificate pills
    const data = dateMap[dateStr];
    if (data) {
      cell.classList.add('has-certs');
      const dots = document.createElement('div');
      dots.className = 'day-dots';

      const MAX_SHOW = 2;
      let shown = 0;
      const allPills = [];

      data.issued.forEach(cert => allPills.push({ cert, type: 'issued' }));
      data.expiry.forEach(cert => {
        const s = getStatus(cert.expiryDate);
        allPills.push({ cert, type: 'expiry', statusClass: s.class });
      });

      allPills.forEach(item => {
        if (shown < MAX_SHOW) {
          const pill = document.createElement('div');
          pill.className = 'day-cert-pill';
          if (item.type === 'issued') {
            pill.classList.add('pill-issued');
            pill.textContent = '↑ ' + item.cert.certNumber;
          } else {
            pill.classList.add('pill-' + item.statusClass);
            pill.textContent = '✕ ' + item.cert.certNumber;
          }
          pill.title = item.cert.supplier;
          dots.appendChild(pill);
          shown++;
        }
      });

      if (allPills.length > MAX_SHOW) {
        const more = document.createElement('div');
        more.className = 'more-certs';
        more.textContent = '+' + (allPills.length - MAX_SHOW) + ' more';
        dots.appendChild(more);
      }

      cell.appendChild(dots);
      cell.addEventListener('click', () => openCalDetail(dateStr, data));
    }

    container.appendChild(cell);
  }
}

function openCalDetail(dateStr, data) {
  const panel = document.getElementById('calDetailPanel');
  document.getElementById('calDetailDate').textContent = 'Certificates on ' + formatDate(dateStr);
  const grid = document.getElementById('calDetailCerts');
  grid.innerHTML = '';

  // Issued cards
  data.issued.forEach(cert => {
    const card = document.createElement('div');
    card.className = 'detail-cert-card issued-card';
    card.innerHTML = `
      <div class="detail-cert-type" style="color:var(--color-accent);">📅 Issued Date</div>
      <div class="detail-cert-num">${cert.certNumber}</div>
      <div class="detail-cert-sup">${cert.supplier}</div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;">Expires: ${formatDate(cert.expiryDate)}</div>
      ${cert.image ? `<img src="${cert.image}" class="detail-cert-img" onclick="viewCert(${cert.id})">` : ''}
    `;
    card.addEventListener('click', e => { if (e.target.tagName !== 'IMG') viewCert(cert.id); });
    grid.appendChild(card);
  });

  // Expiry cards
  data.expiry.forEach(cert => {
    const s = getStatus(cert.expiryDate);
    const card = document.createElement('div');
    card.className = `detail-cert-card expiry-card ${s.class}`;
    const icons = { valid: '✅', expiring: '⚠️', expired: '❌' };
    card.innerHTML = `
      <div class="detail-cert-type">${icons[s.class]} Expiry Date — <span class="status-badge status-${s.class}" style="font-size:10px;padding:2px 8px;">${s.text}</span></div>
      <div class="detail-cert-num">${cert.certNumber}</div>
      <div class="detail-cert-sup">${cert.supplier}</div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;">Issued: ${formatDate(cert.issuedDate)}</div>
      ${cert.image ? `<img src="${cert.image}" class="detail-cert-img" onclick="viewCert(${cert.id})">` : ''}
    `;
    card.addEventListener('click', e => { if (e.target.tagName !== 'IMG') viewCert(cert.id); });
    grid.appendChild(card);
  });

  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeCalDetail() {
  document.getElementById('calDetailPanel').classList.remove('show');
}

// ===== INIT =====
document.getElementById('issuedDate').valueAsDate = new Date();
initCalendar();

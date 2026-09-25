/* ============================================================
   BOOTH MONITORING DASHBOARD - IIHE 2026
   Simple vanilla JS. Data model lives in localStorage.
   ============================================================ */

const STORAGE_KEY = 'iihe2026_data';
const DEMO_FLAG_KEY = 'iihe2026_isDemo';

const DAYS = [
  { id: 'day1', label: 'DAY 1', date: '2026-10-07', dateLabel: '7 OCTOBER 2026' },
  { id: 'day2', label: 'DAY 2', date: '2026-10-08', dateLabel: '8 OCTOBER 2026' },
  { id: 'day3', label: 'DAY 3', date: '2026-10-09', dateLabel: '9 OCTOBER 2026' },
  { id: 'day4', label: 'DAY 4', date: '2026-10-10', dateLabel: '10 OCTOBER 2026' },
];

const FIELDS = [
  { key: 'visitor',   label: 'Booth Visitor' },
  { key: 'ig',        label: 'Instagram' },
  { key: 'tiktok',    label: 'TikTok' },
  { key: 'fb',         label: 'Facebook' },
  { key: 'buyer',     label: 'Serious Buyer' },
  { key: 'challenge', label: 'Challenge Story' },
];

const DEMO_DATA = {
  day1: { visitor: 89,  ig: 12, tiktok: 8,  fb: 4, buyer: 7,  challenge: 23 },
  day2: { visitor: 110, ig: 15, tiktok: 10, fb: 5, buyer: 9,  challenge: 31 },
  day3: { visitor: 135, ig: 20, tiktok: 14, fb: 7, buyer: 12, challenge: 40 },
  day4: { visitor: 120, ig: 18, tiktok: 11, fb: 6, buyer: 10, challenge: 35 },
};

let charts = {}; // holds Chart.js instances so we can destroy/update

// Whether Chart.js + datalabels plugin actually loaded successfully.
// Both libraries are now inlined directly in index.html (no separate
// vendor/ folder, no CDN) so this should always be true — but we still
// check, in case index.html was edited/corrupted, so the app degrades
// gracefully instead of throwing.
const LIBS_OK = (typeof Chart !== 'undefined');

if (LIBS_OK && typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

const COLOR_VISITOR = '#1565c0';
const COLOR_BUYER = '#00a99d';
const COLOR_CHALLENGE = '#0f2942';
const COLOR_IG = '#c2185b';
const COLOR_TIKTOK = '#0f2942';
const COLOR_FB = '#1565c0';
const COLOR_TODAY = '#00a99d';
const COLOR_PREV = '#c9d6e0';

/* ---------------- CLOUDINARY (photo upload) ----------------
   Isi 2 nilai di bawah ini dengan punya kamu sendiri:
   1. Buka https://cloudinary.com -> Settings -> Upload -> Upload Presets
   2. Buat preset baru, set Signing Mode = "Unsigned"
   3. Isi CLOUD_NAME (nama akun Cloudinary) dan UPLOAD_PRESET (nama preset)
   Tidak butuh backend/API secret sama sekali untuk upload (unsigned). */
const CLOUDINARY_CLOUD_NAME = 'dr9ub0xal';
const CLOUDINARY_UPLOAD_PRESET = 'booth_photos';
const CLOUDINARY_FOLDER = 'iihe2026-booth-photos';

/* ---------------- FIREBASE (Firestore) — hanya untuk sinkronisasi URL foto ----------------
   Dashboard ini TIDAK memakai Firebase Auth — semua data angka (visitor, buyer, dst)
   tetap di localStorage seperti sebelumnya. Firestore di sini hanya menyimpan URL foto
   Cloudinary per Day, supaya foto yang diupload dari 1 device muncul juga di device lain.
   Isi firebaseConfig dengan punya kamu sendiri:
   Firebase Console -> Project Settings -> Your Apps -> SDK setup and configuration */
const firebaseConfig = {
  apiKey:            "AIzaSyAnVNWQW3dxEJZlQVmprtBt2_Kc6IXu9HM",
  authDomain:        "hospitalexpo2026.firebaseapp.com",
  projectId:         "hospitalexpo2026",
  storageBucket:     "hospitalexpo2026.firebasestorage.app",
  messagingSenderId: "176852630651",
  appId:             "1:176852630651:web:7ef750c5c5d8872cfa36de"
};

const FIREBASE_OK = (typeof firebase !== 'undefined') &&
  firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';

let db = null;
if (FIREBASE_OK) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
}

const PHOTOS_COLLECTION = 'BOOTH_PHOTOS'; // 1 doc per day, doc id = dayId, field: photos: [url|null, url|null, url|null]

/** Pulls saved photo URLs from Firestore into DATA[*].photos (called once on boot). */
async function loadPhotosFromFirestore() {
  if (!FIREBASE_OK) return;
  try {
    const snap = await db.collection(PHOTOS_COLLECTION).get();
    snap.forEach(doc => {
      const dayId = doc.id;
      const photos = doc.data().photos;
      if (DATA[dayId] && Array.isArray(photos)) DATA[dayId].photos = photos;
    });
  } catch (err) {
    console.error('Gagal memuat foto dari Firestore:', err);
  }
}

/** Pushes DATA[dayId].photos to Firestore so other devices see it too. */
async function savePhotosToFirestore(dayId) {
  if (!FIREBASE_OK) return;
  try {
    const photos = (DATA[dayId] && DATA[dayId].photos) || [null, null, null];
    await db.collection(PHOTOS_COLLECTION).doc(dayId).set({ photos }, { merge: true });
  } catch (err) {
    console.error('Gagal menyimpan foto ke Firestore:', err);
    showToast('Foto tersimpan lokal, tapi gagal sync ke Firestore');
  }
}

/* ---------------- DATA LAYER ---------------- */

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through to seed */ }
  }
  // first run: seed with demo data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_DATA));
  localStorage.setItem(DEMO_FLAG_KEY, 'true');
  return JSON.parse(JSON.stringify(DEMO_DATA));
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isDemoMode() {
  return localStorage.getItem(DEMO_FLAG_KEY) === 'true';
}

function clearDemoFlag() {
  localStorage.removeItem(DEMO_FLAG_KEY);
}

let DATA = loadData();

function totalFollower(day) {
  return (day.ig || 0) + (day.tiktok || 0) + (day.fb || 0);
}

/* ---------------- DATE / TODAY HELPERS ---------------- */

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getActiveDayInfo() {
  const today = todayISO();
  const match = DAYS.find(d => d.date === today);
  if (match) return { day: match, status: 'active' };
  if (today < DAYS[0].date) return { day: DAYS[0], status: 'before' };
  return { day: DAYS[DAYS.length - 1], status: 'after' };
}

/* ---------------- SMALL SUPPORTING NUMBERS (not the main focus) ---------------- */

function metricStripHtml(record, dayLabel) {
  if (!record) return '';
  const dayTag = dayLabel ? `<div class="metric-day">${dayLabel}</div>` : '';
  return `
    <div class="metric-strip">
      <div class="metric-card">
        <div class="metric-label">Booth Visitor</div>
        <div class="metric-value">${record.visitor}</div>
        ${dayTag}
      </div>
      <div class="metric-card">
        <div class="metric-label">Follower Up</div>
        <div class="follower-list">
          <div class="follower-row"><span>Instagram</span><span>${record.ig}</span></div>
          <div class="follower-row"><span>TikTok</span><span>${record.tiktok}</span></div>
          <div class="follower-row"><span>Facebook</span><span>${record.fb}</span></div>
          <div class="follower-row total"><span>Total</span><span>${totalFollower(record)}</span></div>
        </div>
        ${dayTag}
      </div>
      <div class="metric-card">
        <div class="metric-label">Serious Buyer</div>
        <div class="metric-value">${record.buyer}</div>
        ${dayTag}
      </div>
      <div class="metric-card">
        <div class="metric-label">Challenge Story</div>
        <div class="metric-value">${record.challenge}</div>
        ${dayTag}
      </div>
    </div>`;
}

/* ---------------- PHOTO STRIP (Cloudinary upload) ---------------- */

/** Uploads a File to Cloudinary using an unsigned upload preset and returns its secure_url. */
async function uploadImageToCloudinary(file) {
  if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME' ||
      !CLOUDINARY_UPLOAD_PRESET || CLOUDINARY_UPLOAD_PRESET === 'YOUR_UPLOAD_PRESET') {
    throw new Error('Cloudinary belum dikonfigurasi. Isi CLOUDINARY_CLOUD_NAME dan CLOUDINARY_UPLOAD_PRESET di script.js');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', CLOUDINARY_FOLDER);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST', body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Upload gagal (${res.status})`);
  }
  const data = await res.json();
  return data.secure_url;
}

/** 3 photo slots shown right below the metric strip for a given day. */
function photoStripHtml(dayId, record) {
  if (!record) return '';
  const photos = record.photos || [null, null, null];
  return `
    <div class="photo-strip" id="${dayId}-photo-strip">
      ${[0, 1, 2].map(i => photoSlotHtml(dayId, i, photos[i])).join('')}
    </div>`;
}

function photoSlotHtml(dayId, idx, url) {
  return `
    <div class="photo-slot" id="${dayId}-photo-${idx}">
      ${url ? `
        <img src="${url}" alt="Foto ${idx + 1}" class="photo-thumb" onclick="window.open('${url}','_blank')">
        <button type="button" class="photo-remove" title="Hapus foto" onclick="removePhoto('${dayId}', ${idx})">✕</button>
      ` : `
        <label class="photo-upload-btn">
          📷 Upload Foto ${idx + 1}
          <input type="file" accept="image/*" style="display:none" onchange="handlePhotoUpload(event, '${dayId}', ${idx})">
        </label>
      `}
    </div>`;
}

async function handlePhotoUpload(event, dayId, idx) {
  const file = event.target.files[0];
  if (!file) return;
  const slotEl = document.getElementById(`${dayId}-photo-${idx}`);
  if (slotEl) slotEl.innerHTML = `<div class="photo-uploading">⏳ Uploading...</div>`;

  try {
    const url = await uploadImageToCloudinary(file);
    if (!DATA[dayId]) DATA[dayId] = {};
    if (!DATA[dayId].photos) DATA[dayId].photos = [null, null, null];
    DATA[dayId].photos[idx] = url;
    saveData(DATA);
    savePhotosToFirestore(dayId);
    if (slotEl) slotEl.outerHTML = photoSlotHtml(dayId, idx, url);
    showToast('Foto berhasil diupload');
  } catch (err) {
    showToast(err.message || 'Upload foto gagal');
    if (slotEl) slotEl.outerHTML = photoSlotHtml(dayId, idx, null);
  }
}

function removePhoto(dayId, idx) {
  if (!confirm('Hapus foto ini?')) return;
  if (DATA[dayId] && DATA[dayId].photos) {
    DATA[dayId].photos[idx] = null;
    saveData(DATA);
    savePhotosToFirestore(dayId);
  }
  const slotEl = document.getElementById(`${dayId}-photo-${idx}`);
  if (slotEl) slotEl.outerHTML = photoSlotHtml(dayId, idx, null);
}

/* ---------------- RENDER: TODAY (chart-first) ---------------- */

function renderToday() {
  const { day, status } = getActiveDayInfo();
  const record = DATA[day.id];
  const container = document.getElementById('todayContent');
  const dayIndex = DAYS.findIndex(d => d.id === day.id);
  const prevDay = dayIndex > 0 ? DAYS[dayIndex - 1] : null;
  const prevRecord = prevDay ? DATA[prevDay.id] : null;

  let statusNote = '';
  if (status === 'before') statusNote = `<p class="sub" style="text-align:center;color:var(--muted);margin-bottom:12px;">Event belum dimulai — menampilkan ${day.label}</p>`;
  if (status === 'after') statusNote = `<p class="sub" style="text-align:center;color:var(--muted);margin-bottom:12px;">Event telah selesai — menampilkan ${day.label}</p>`;

  const demoBadge = isDemoMode() && record ? `<span class="demo-badge">DEMO DATA</span>` : '';

  if (!record) {
    container.innerHTML = `
      <h2 class="panel-title" style="text-align:center;">TODAY — ${day.label}</h2>
      <p style="text-align:center;color:var(--muted);">${day.dateLabel}</p>
      ${statusNote}
      <div class="no-data">
        <p>No data entered yet</p>
        <button class="btn btn-primary" onclick="switchTab('${day.id}')">Input ${day.label} Data</button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="day-panel-header">
      <h2 class="panel-title" style="margin:0;">TODAY — ${day.label}</h2>
      <span style="color:var(--muted);font-size:13px;">${day.dateLabel}</span>
    </div>
    ${demoBadge}
    ${statusNote}

    <div class="chart-box chart-box-main">
      <h3>EVENT METRICS${prevRecord ? ` — ${prevDay.label} vs ${day.label}` : ''}</h3>
      <div class="chart-canvas-wrap chart-canvas-wrap-main"><canvas id="todayCombinedChart"></canvas></div>
    </div>

    ${metricStripHtml(record, day.label.toUpperCase())}
    ${photoStripHtml(day.id, record)}
  `;

  const cmpLabels = prevRecord ? [prevDay.label, day.label] : [day.label];

  destroyChart('todayCombined');
  charts.todayCombined = buildCombinedStackedChart('todayCombinedChart', cmpLabels, [
    { name: 'Booth Visitor', values: prevRecord ? [prevRecord.visitor, record.visitor] : [record.visitor], color: COLOR_VISITOR },
    { name: 'Serious Buyer', values: prevRecord ? [prevRecord.buyer, record.buyer] : [record.buyer], color: COLOR_BUYER },
    { name: 'Challenge Story', values: prevRecord ? [prevRecord.challenge, record.challenge] : [record.challenge], color: COLOR_CHALLENGE },
    { name: 'Follower IG', values: prevRecord ? [prevRecord.ig, record.ig] : [record.ig], color: COLOR_IG },
    { name: 'Follower TikTok', values: prevRecord ? [prevRecord.tiktok, record.tiktok] : [record.tiktok], color: COLOR_TIKTOK },
    { name: 'Follower FB', values: prevRecord ? [prevRecord.fb, record.fb] : [record.fb], color: COLOR_FB },
  ]);
}

/* ---------------- RENDER: DAY PANELS (chart-first + collapsible edit form) ---------------- */

function renderDayPanel(dayId) {
  const dayInfo = DAYS.find(d => d.id === dayId);
  const dayIndex = DAYS.findIndex(d => d.id === dayId);
  const record = DATA[dayId];
  const panel = document.getElementById(`panel-${dayId}`);

  // days to chart: Day 1 .. selected day, only those that already have data
  const visibleDays = DAYS.slice(0, dayIndex + 1).filter(d => DATA[d.id]);
  const chartLabels = visibleDays.map(d => d.label);
  const demoBadge = isDemoMode() && record ? `<span class="demo-badge">DEMO DATA</span>` : '';

  const chartsHtml = visibleDays.length > 0 ? `
    <div class="chart-box chart-box-main">
      <h3>EVENT METRICS</h3>
      <div class="chart-canvas-wrap chart-canvas-wrap-main"><canvas id="${dayId}CombinedChart"></canvas></div>
    </div>
  ` : `<div class="no-data-inline">Belum ada data untuk ditampilkan pada grafik. Isi form di bawah untuk memulai.</div>`;

  panel.innerHTML = `
    <div class="day-panel-header">
      <h2 class="panel-title" style="margin:0;">${dayInfo.label} — ${dayInfo.dateLabel}</h2>
      ${demoBadge}
    </div>

    ${chartsHtml}
    ${record ? metricStripHtml(record, dayInfo.label.toUpperCase()) : ''}
    ${record ? photoStripHtml(dayId, record) : ''}

    <details class="edit-panel" ${record ? '' : 'open'}>
      <summary>${record ? 'EDIT' : 'INPUT'} ${dayInfo.label} DATA</summary>
      <div class="form-box">
        <form id="form-${dayId}" novalidate>
          <div class="form-grid">
            ${FIELDS.map(f => fieldHtml(dayId, f, record)).join('')}
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">SAVE DATA</button>
          </div>
        </form>
      </div>
    </details>`;

  document.getElementById(`form-${dayId}`).addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave(dayId);
  });

  FIELDS.forEach(f => {
    const input = document.getElementById(`${dayId}-${f.key}`);
    input.addEventListener('input', () => validateField(input));
  });

  if (visibleDays.length > 0) {
    destroyChart(`${dayId}Combined`);
    charts[`${dayId}Combined`] = buildCombinedStackedChart(`${dayId}CombinedChart`, chartLabels, [
      { name: 'Booth Visitor', values: visibleDays.map(d => DATA[d.id].visitor), color: COLOR_VISITOR },
      { name: 'Serious Buyer', values: visibleDays.map(d => DATA[d.id].buyer), color: COLOR_BUYER },
      { name: 'Challenge Story', values: visibleDays.map(d => DATA[d.id].challenge), color: COLOR_CHALLENGE },
      { name: 'Follower IG', values: visibleDays.map(d => DATA[d.id].ig), color: COLOR_IG },
      { name: 'Follower TikTok', values: visibleDays.map(d => DATA[d.id].tiktok), color: COLOR_TIKTOK },
      { name: 'Follower FB', values: visibleDays.map(d => DATA[d.id].fb), color: COLOR_FB },
    ]);
  }
}

function fieldHtml(dayId, field, record) {
  const val = record ? record[field.key] : '';
  return `
    <div class="field">
      <label for="${dayId}-${field.key}">${field.label}</label>
      <input type="number" min="0" step="1" inputmode="numeric"
             id="${dayId}-${field.key}" value="${val}" placeholder="0">
      <span class="error" id="${dayId}-${field.key}-error"></span>
    </div>`;
}

function validateField(input) {
  const raw = input.value.trim();
  const errorEl = document.getElementById(`${input.id}-error`);
  let msg = '';

  if (raw !== '') {
    const num = Number(raw);
    if (!Number.isFinite(num)) msg = 'Harus berupa angka';
    else if (num < 0) msg = 'Tidak boleh negatif';
    else if (!Number.isInteger(num)) msg = 'Tidak boleh desimal';
  }

  input.classList.toggle('invalid', !!msg);
  errorEl.textContent = msg;
  return msg === '';
}

function handleSave(dayId) {
  let allValid = true;
  const record = {};

  FIELDS.forEach(f => {
    const input = document.getElementById(`${dayId}-${f.key}`);
    if (!validateField(input)) allValid = false;
    const raw = input.value.trim();
    record[f.key] = raw === '' ? 0 : Math.floor(Number(raw));
  });

  if (!allValid) {
    showToast('Perbaiki input yang tidak valid');
    return;
  }

  DATA[dayId] = record;
  clearDemoFlag();
  saveData(DATA);
  showToast(`${DAYS.find(d => d.id === dayId).label} data saved`);

  renderDayPanel(dayId);
  renderToday();
  renderSummary();
}

/* ---------------- RENDER: SUMMARY (chart-first) ---------------- */

function renderSummary() {
  const totals = { visitor: 0, ig: 0, tiktok: 0, fb: 0, buyer: 0, challenge: 0 };
  const present = daysWithData();

  present.forEach(d => {
    const r = DATA[d.id];
    totals.visitor += r.visitor;
    totals.ig += r.ig;
    totals.tiktok += r.tiktok;
    totals.fb += r.fb;
    totals.buyer += r.buyer;
    totals.challenge += r.challenge;
  });
  const totalFollowerAll = totals.ig + totals.tiktok + totals.fb;

  document.getElementById('summaryDemoBadge').innerHTML =
    isDemoMode() ? `<span class="demo-badge">DEMO DATA</span>` : '';

  document.getElementById('summaryNumbers').innerHTML = `
    <div class="metric-strip">
      <div class="metric-pill"><div class="pill-label">Total Booth Visitor</div><div class="pill-value">${totals.visitor}</div></div>
      <div class="metric-pill"><div class="pill-label">Total Follower Up</div><div class="pill-value">${totalFollowerAll}</div></div>
      <div class="metric-pill"><div class="pill-label">Total Serious Buyer</div><div class="pill-value">${totals.buyer}</div></div>
      <div class="metric-pill"><div class="pill-label">Total Challenge Story</div><div class="pill-value">${totals.challenge}</div></div>
    </div>`;

  const labels = present.map(d => d.label);

  destroyChart('visitor');
  destroyChart('follower');
  destroyChart('buyer');
  destroyChart('challenge');
  destroyChart('combined');
  destroyChart('totalPerformance');
  destroyChart('totalFollower');

  if (present.length === 0) return;

  charts.combined = buildCombinedStackedChart('chartCombined', labels, [
    { name: 'Booth Visitor', values: present.map(d => DATA[d.id].visitor), color: COLOR_VISITOR },
    { name: 'Serious Buyer', values: present.map(d => DATA[d.id].buyer), color: COLOR_BUYER },
    { name: 'Challenge Story', values: present.map(d => DATA[d.id].challenge), color: COLOR_CHALLENGE },
    { name: 'Follower IG', values: present.map(d => DATA[d.id].ig), color: COLOR_IG },
    { name: 'Follower TikTok', values: present.map(d => DATA[d.id].tiktok), color: COLOR_TIKTOK },
    { name: 'Follower FB', values: present.map(d => DATA[d.id].fb), color: COLOR_FB },
  ]);

  charts.totalPerformance = buildSingleMultiColorChart('chartTotalPerformance',
    ['Booth Visitor', 'Serious Buyer', 'Challenge Story'],
    [totals.visitor, totals.buyer, totals.challenge],
    [COLOR_VISITOR, COLOR_BUYER, COLOR_CHALLENGE]);

  charts.totalFollower = buildSingleMultiColorChart('chartTotalFollower',
    ['Instagram', 'TikTok', 'Facebook'],
    [totals.ig, totals.tiktok, totals.fb],
    [COLOR_IG, COLOR_TIKTOK, COLOR_FB]);
}

/* ---------------- CHART BUILDERS ---------------- */

function daysWithData() {
  return DAYS.filter(d => DATA[d.id]);
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function chartBaseOptions(extra) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 24 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end',
        align: 'top',
        color: '#1c2b36',
        font: { weight: '700', size: 12 },
        formatter: (v) => v,
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef1f4' } },
      x: { grid: { display: false } }
    }
  }, extra || {});
}

/** Single-series bar chart. barColor can be one color (applied to all bars)
 *  or an array of colors (one per bar). */
function buildSingleBarChart(canvasId, labels, values, barColor) {
  if (!LIBS_OK) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  return new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: barColor,
        borderRadius: 4,
        maxBarThickness: 70,
      }]
    },
    options: chartBaseOptions()
  });
}

/** Same as buildSingleBarChart but with a legend (used for "totals" comparison charts). */
function buildSingleMultiColorChart(canvasId, labels, values, colors) {
  if (!LIBS_OK) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  return new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderRadius: 4, maxBarThickness: 70 }]
    },
    options: chartBaseOptions()
  });
}

/** Turns a "#rrggbb" hex color into an rgba() string with the given alpha. */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Plugin: draws each bar's grand total above its topmost segment. Works for
 *  any number of bars (categories), not just a single one. */
const stackTotalPlugin = {
  id: 'stackTotalLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const nBars = (chart.data.labels || []).length;
    for (let idx = 0; idx < nBars; idx++) {
      const total = chart.data.datasets.reduce((sum, ds) => sum + (ds.data[idx] || 0), 0);
      let topMeta = chart.getDatasetMeta(0);
      for (let i = chart.data.datasets.length - 1; i >= 0; i--) {
        if (chart.data.datasets[i].data[idx] > 0) { topMeta = chart.getDatasetMeta(i); break; }
      }
      const bar = topMeta.data[idx];
      if (!bar) continue;
      ctx.save();
      ctx.font = '700 13px inherit, sans-serif';
      ctx.fillStyle = '#1c2b36';
      ctx.textAlign = 'center';
      ctx.fillText(`Total: ${total}`, bar.x, bar.y - 12);
      ctx.restore();
    }
  }
};

/** Combined chart: one bar per metric (e.g. Booth Visitor, Serious Buyer...),
 *  each bar split into a stacked segment per day, so different metrics sit
 *  side-by-side in a single chart instead of separate boxes. The x-axis tick
 *  under each bar names the metric it represents.
 *  metrics: [{ name, values: [dayIdx -> number], color: '#rrggbb' }] */
function buildCombinedStackedChart(canvasId, dayLabels, metrics) {
  if (!LIBS_OK) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const alphas = [1, 0.75, 0.55, 0.35];
  const datasets = dayLabels.map((label, dayIdx) => ({
    label,
    data: metrics.map(m => m.values[dayIdx] || 0),
    backgroundColor: metrics.map(m => hexToRgba(m.color, alphas[dayIdx % alphas.length])),
    borderRadius: dayIdx === dayLabels.length - 1 ? 4 : 0,
    maxBarThickness: 90,
    stack: 'total',
  }));
  return new Chart(el, {
    type: 'bar',
    data: { labels: metrics.map(m => m.name), datasets },
    options: chartBaseOptions({
      layout: { padding: { top: 32 } },
      plugins: {
        legend: { display: true, position: 'bottom' },
        datalabels: {
          color: (ctx) => (alphas[ctx.datasetIndex % alphas.length] > 0.6 ? '#fff' : '#1c2b36'),
          font: { weight: '700', size: 12 },
          formatter: (v) => v > 0 ? v : '',
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef1f4' } }
      }
    }),
    plugins: [stackTotalPlugin]
  });
}

/** Single stacked bar (one metric only): kept for cases with just one category. */
function buildStackedSingleBarChart(canvasId, dayLabels, values, baseColor) {
  return buildCombinedStackedChart(canvasId, dayLabels, [{ name: '', values, color: baseColor }]);
}

/** Grouped bar chart for follower up (Instagram / TikTok / Facebook) across a set of day records. */
function buildGroupedFollowerChart(canvasId, labels, records) {
  if (!LIBS_OK) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  return new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Instagram', data: records.map(r => r.ig), backgroundColor: COLOR_IG, borderRadius: 4, maxBarThickness: 34 },
        { label: 'TikTok', data: records.map(r => r.tiktok), backgroundColor: COLOR_TIKTOK, borderRadius: 4, maxBarThickness: 34 },
        { label: 'Facebook', data: records.map(r => r.fb), backgroundColor: COLOR_FB, borderRadius: 4, maxBarThickness: 34 },
      ]
    },
    options: chartBaseOptions({
      plugins: {
        legend: { display: true, position: 'bottom' },
        datalabels: {
          anchor: 'end', align: 'top', color: '#1c2b36',
          font: { weight: '700', size: 10 }, formatter: (v) => v,
        }
      }
    })
  });
}

/* ---------------- TABS / NAVIGATION ---------------- */

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
  // Re-render charts for the panel that just became visible. Chart.js sizes
  // a canvas based on its container's rendered size, so a chart built while
  // its panel was still display:none ends up 0x0 (invisible). Re-rendering
  // right when the tab becomes active guarantees a correct size.
  if (tabId === 'summary') {
    renderSummary();
  } else if (tabId === 'today') {
    renderToday();
  } else if (DAYS.some(d => d.id === tabId)) {
    renderDayPanel(tabId);
  }
  localStorage.setItem('iihe2026_lastTab', tabId);
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

/* ---------------- EXPORT / IMPORT / RESET ---------------- */

function buildExportRows() {
  return DAYS.map(d => {
    const r = DATA[d.id] || { visitor: '', ig: '', tiktok: '', fb: '', buyer: '', challenge: '' };
    return {
      Day: d.label,
      Date: d.dateLabel,
      BoothVisitor: r.visitor,
      Instagram: r.ig,
      TikTok: r.tiktok,
      Facebook: r.fb,
      TotalFollower: r.visitor === '' ? '' : totalFollower(r),
      SeriousBuyer: r.buyer,
      ChallengeStory: r.challenge,
    };
  });
}

function exportCSV() {
  const rows = buildExportRows();
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => r[h]).join(',')));
  downloadFile('iihe2026_booth_data.csv', lines.join('\n'), 'text/csv');
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      let imported;
      if (file.name.toLowerCase().endsWith('.json')) {
        imported = JSON.parse(text);
      } else {
        imported = parseCSV(text);
      }
      applyImportedData(imported);
    } catch (err) {
      showToast('Import gagal: format file tidak valid');
    }
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const result = {};
  const dayMap = { 'DAY 1': 'day1', 'DAY 2': 'day2', 'DAY 3': 'day3', 'DAY 4': 'day4' };

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    const row = {};
    headers.forEach((h, idx) => row[h] = cells[idx]);
    const dayId = dayMap[row.Day];
    if (!dayId || row.BoothVisitor === '' || row.BoothVisitor === undefined) continue;
    result[dayId] = {
      visitor: Number(row.BoothVisitor) || 0,
      ig: Number(row.Instagram) || 0,
      tiktok: Number(row.TikTok) || 0,
      fb: Number(row.Facebook) || 0,
      buyer: Number(row.SeriousBuyer) || 0,
      challenge: Number(row.ChallengeStory) || 0,
    };
  }
  return result;
}

function applyImportedData(imported) {
  const validDayIds = DAYS.map(d => d.id);
  let count = 0;
  validDayIds.forEach(id => {
    const r = imported[id];
    if (!r) return;
    const clean = {};
    FIELDS.forEach(f => {
      const num = Number(r[f.key]);
      clean[f.key] = Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
    });
    DATA[id] = clean;
    count++;
  });

  if (count === 0) {
    showToast('Tidak ada data valid untuk diimpor');
    return;
  }

  clearDemoFlag();
  saveData(DATA);
  renderAll();
  showToast(`Import berhasil (${count} hari)`);
}

function resetAllData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DEMO_FLAG_KEY);
  DATA = { day1: null, day2: null, day3: null, day4: null };
  saveData(DATA);
  renderAll();
  showToast('Semua data telah direset');
}

/* ---------------- TOAST ---------------- */

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- LIBRARY LOAD CHECK ---------------- */

function showLibWarningIfNeeded() {
  if (LIBS_OK) return;
  const banner = document.createElement('div');
  banner.style.cssText =
    'background:#fdecea;color:#c0392b;border:1px solid #f5c6cb;' +
    'padding:14px 16px;margin:0 0 16px;border-radius:8px;font-size:13px;' +
    'line-height:1.5;max-width:1000px;margin-left:auto;margin-right:auto;';
  banner.innerHTML =
    '<strong>⚠️ Grafik tidak bisa ditampilkan.</strong><br>' +
    'Library Chart.js gagal dimuat (kemungkinan file <code>index.html</code> yang ' +
    'terbuka bukan versi terbaru, atau ada error JavaScript sebelum baris ini — ' +
    'cek tab Console di DevTools browser). Coba download ulang file ' +
    '<code>index.html</code> dan pastikan tidak diedit ulang secara manual. Input ' +
    'data, edit, export/import, dan reset tetap berfungsi normal tanpa grafik.';
  document.body.insertBefore(banner, document.body.firstChild);
}

/* ---------------- INIT ---------------- */

function renderAll() {
  renderToday();
  DAYS.forEach(d => renderDayPanel(d.id));
  renderSummary();
}

async function init() {
  showLibWarningIfNeeded();
  setupTabs();
  await loadPhotosFromFirestore();
  renderAll();

  document.getElementById('btnExport').addEventListener('click', exportCSV);

  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importFromFile(file);
    e.target.value = '';
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('resetModal').classList.add('active');
  });
  document.getElementById('btnCancelReset').addEventListener('click', () => {
    document.getElementById('resetModal').classList.remove('active');
  });
  document.getElementById('btnConfirmReset').addEventListener('click', () => {
    document.getElementById('resetModal').classList.remove('active');
    resetAllData();
  });

  // default tab: TODAY if event ongoing/relevant, else last used tab
  const lastTab = localStorage.getItem('iihe2026_lastTab');
  switchTab(lastTab || 'today');
}

document.addEventListener('DOMContentLoaded', init);

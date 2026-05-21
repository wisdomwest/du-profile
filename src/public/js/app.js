/* ==========================================================================
   DU-Space Research Profile - Front-End Controller Script
   ========================================================================== */

let PUBS = [];
let sChart = null;
let tChart = null;
let dtInst = null;

// School definitions matching Daystar core brand identity & styling configurations
const SCHOOLS = [
  { code: "SSEH", name: "School of Science, Engineering & Health", cluster: "Faith, Ethics & AI", focus: "Computer science, AI, health informatics, nursing science, engineering.", tags: ["AI Hub", "Tech Security"], col: "#25AAE1" },
  { code: "SOC", name: "School of Communication", cluster: "Media & Democracy", focus: "Media studies, journalism, corporate communications, digital trust.", tags: ["Media Cluster", "Policy Briefs"], col: "#1D9E75" },
  { code: "SBE", name: "School of Business & Economics", cluster: "Law, Business & Innovation", focus: "Business administration, accounting, marketing, logistics, microfinance.", tags: ["Fintech Group", "Enterprise"], col: "#EF9F27" },
  { code: "SHSS", name: "School of Human & Social Sciences", cluster: "Community Health", focus: "Psychology, counselling, social work, developmental clusters.", tags: ["Counselling", "SDG 3·10"], col: "#E0606F" },
  { code: "SON", name: "School of Nursing", cluster: "Community Health", focus: "Nursing science, maternal care, community health informatics.", tags: ["Maternal Health", "SDG 3·5"], col: "#7C3AED" },
  { code: "SOL", name: "School of Law", cluster: "Law, Business & Innovation", focus: "Constitutional law, commercial law, human rights, intellectual property.", tags: ["IP Policy", "Legal Aid"], col: "#BA7517" },
  { code: "SASS", name: "School of Arts & Social Sciences", cluster: "Governance & Development", focus: "Humanities, international relations, philosophy, corporate governance.", tags: ["Governance", "Strategic"], col: "#64748B" },
  { code: "SMT", name: "School of Mission & Theology", cluster: "Faith, Ethics & AI", focus: "Theology, missiology, Christian ethics, faith-integrated science.", tags: ["Ethics Anchor", "Faith & AI"], col: "#639922" }
];

// Sustainable Development Goals definition & standard styling palettes
const SDGS = [
  { n: "SDG 1", l: "No poverty", c: "#EF4444" },
  { n: "SDG 2", l: "Zero hunger", c: "#F59E0B" },
  { n: "SDG 3", l: "Good health", c: "#10B981" },
  { n: "SDG 4", l: "Quality education", c: "#3B82F6" },
  { n: "SDG 5", l: "Gender equality", c: "#EC4899" },
  { n: "SDG 6", l: "Clean water", c: "#06B6D4" },
  { n: "SDG 7", l: "Clean energy", c: "#FBBF24" },
  { n: "SDG 8", l: "Decent work", c: "#B45309" },
  { n: "SDG 9", l: "Industry & innovation", c: "#D97706" },
  { n: "SDG 10", l: "Reduced inequalities", c: "#EF4444" },
  { n: "SDG 11", l: "Sustainable cities", c: "#F59E0B" },
  { n: "SDG 12", l: "Responsible consumption", c: "#10B981" },
  { n: "SDG 13", l: "Climate action", c: "#059669" },
  { n: "SDG 14", l: "Life below water", c: "#25AAE1" },
  { n: "SDG 15", l: "Life on land", c: "#10B981" },
  { n: "SDG 16", l: "Peace & justice", c: "#1E3A8A" },
  { n: "SDG 17", l: "Partnerships", c: "#1D4ED8" }
];

// Lookup tables mapping badge outputs
const TYPE_B = {
  "Journal Article": '<span class="badge bg">Journal Article</span>',
  "Conference Paper": '<span class="badge bp">Conference Paper</span>',
  "Book Chapter": '<span class="badge bb">Book Chapter</span>',
  "Thesis": '<span class="badge ba">Thesis</span>',
  "Other": '<span class="badge bgr">Other</span>'
};

const IDX_B = {
  "IEEE Indexed": '<span class="badge bg">IEEE</span>',
  "Indexed": '<span class="badge bb">Indexed</span>',
  "AJOL": '<span class="badge ba">AJOL</span>',
  "Verify": '<span class="badge bgr">Verify</span>'
};

const SC_BG = {
  SSEH: "#E0F2FE", SOC: "#D1FAE5", SBE: "#FEF3C7", SHSS: "#FCE7F3",
  SON: "#F3E8FF", SOL: "#FFEDD5", SASS: "#F1F5F9", SMT: "#ECFDF5"
};

const SC_TC = {
  SSEH: "#0369A1", SOC: "#047857", SBE: "#B45309", SHSS: "#BE185D",
  SON: "#6D28D9", SOL: "#C2410C", SASS: "#475569", SMT: "#047857"
};

/**
 * Returns formatted school badge component.
 */
function sb(schoolCode) {
  if (!schoolCode) return '<span class="badge bgr">&mdash;</span>';
  const bg = SC_BG[schoolCode] || '#F1F5F9';
  const tc = SC_TC[schoolCode] || '#475569';
  return `<span class="badge" style="background:${bg}; color:${tc}; border-color:rgba(0,0,0,0.05)">${schoolCode}</span>`;
}

/* ==========================================================================
   CHARTS MANAGEMENT
   ========================================================================== */

function buildCharts() {
  // 1. Destroy existing chart instances safely
  if (sChart) { sChart.destroy(); sChart = null; }
  if (tChart) { tChart.destroy(); tChart = null; }

  // 2. Build School Publication Distribution Chart
  const schoolCounts = SCHOOLS.map(s => PUBS.filter(p => p.school === s.code).length);
  const canvasSchool = document.getElementById('schoolChart');
  if (canvasSchool) {
    sChart = new Chart(canvasSchool, {
      type: 'bar',
      data: {
        labels: SCHOOLS.map(s => s.code),
        datasets: [{
          data: schoolCounts,
          backgroundColor: SCHOOLS.map(s => s.col),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: c => ` ${Math.round(c.parsed.x)} publications` }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { family: 'Inter', size: 10 } } },
          y: { ticks: { font: { family: 'Outfit', size: 11, weight: '600' } } }
        }
      }
    });
  }

  // 3. Build Yearly Trend Chart (2018–2026)
  const allYears = [...new Set(PUBS.map(p => String(p.year)).filter(y => y && y.length === 4))].sort();
  const years = allYears.length ? allYears : ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
  const canvasTrend = document.getElementById('trendChart');
  if (canvasTrend) {
    tChart = new Chart(canvasTrend, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          { label: 'Journal', data: years.map(y => PUBS.filter(p => String(p.year) === y && p.type === 'Journal Article').length), backgroundColor: '#25AAE1', borderRadius: 2 },
          { label: 'Conference', data: years.map(y => PUBS.filter(p => String(p.year) === y && p.type === 'Conference Paper').length), backgroundColor: '#7C3AED', borderRadius: 2 },
          { label: 'Book', data: years.map(y => PUBS.filter(p => String(p.year) === y && p.type === 'Book Chapter').length), backgroundColor: '#E0606F', borderRadius: 2 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true, ticks: { font: { family: 'Inter', size: 10 }, autoSkip: false, maxRotation: 0 } },
          y: { stacked: true, beginAtZero: true, ticks: { font: { family: 'Inter', size: 10 } } }
        }
      }
    });
  }
}

function filteredForChart() {
  const yr = document.getElementById('chart-yr').value;
  const tp = document.getElementById('chart-tp').value;
  return PUBS.filter(p => (yr === 'all' || String(p.year) === yr) && (tp === 'all' || p.type === tp));
}

function updateSchoolChart() {
  if (!sChart) return;
  sChart.data.datasets[0].data = SCHOOLS.map(s => filteredForChart().filter(p => p.school === s.code).length);
  sChart.update();
}

/* ==========================================================================
   DATATABLE RENDERER
   ========================================================================== */

function buildTable() {
  const tbody = document.getElementById('pub-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  PUBS.forEach(p => {
    const sdgStr = Array.isArray(p.sdgs) ? p.sdgs.join(', ') : p.sdgs || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a href="${p.url}" target="_blank" class="pub-title-link">${p.title || 'Untitled'}</a>
        <div class="pub-authors">${p.authors || ''}</div>
      </td>
      <td style="font-weight: 500">${p.year || '&mdash;'}</td>
      <td>${sb(p.school)}</td>
      <td>${TYPE_B[p.type] || `<span class="badge bgr">${p.type}</span>`}</td>
      <td style="font-size:11px; color:var(--text-muted)">${p.publisher || ''}</td>
      <td style="font-size:11px; color:var(--text-muted)">${sdgStr}</td>
      <td>${IDX_B[p.indexing] || `<span class="badge bgr">${p.indexing || '&mdash;'}</span>`}</td>
      <td>
        <a href="${p.url}" target="_blank" style="font-size:11px; color:var(--primary); font-weight:600; text-decoration:none">
          View &rarr;
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Re-initialise jQuery DataTables
  if (dtInst) { dtInst.destroy(); dtInst = null; }
  dtInst = $('#pubTable').DataTable({
    pageLength: 10,
    order: [[1, 'desc']],
    language: {
      search: "Search database:",
      lengthMenu: "Show _MENU_ records",
      info: "Showing _START_ to _END_ of _TOTAL_ entries",
      paginate: { next: "&rarr;", previous: "&larr;" }
    }
  });
}

/* ==========================================================================
   RECENT FEED TIMELINE
   ========================================================================== */

function buildFeed() {
  const container = document.getElementById('recent-feed');
  if (!container) return;
  container.innerHTML = '';

  const sorted = [...PUBS].sort((a, b) => b.year - a.year).slice(0, 10);
  if (!sorted.length) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:24px">No publications loaded yet.</div>';
    return;
  }

  sorted.forEach((p, idx) => {
    const listSDGs = Array.isArray(p.sdgs) ? p.sdgs : [];
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `
      <div class="feed-num">${idx + 1}</div>
      <div style="flex:1">
        <h4 class="feed-title">${p.title}</h4>
        <div class="feed-meta">
          <span style="font-size:11px; font-weight:600; color:var(--text-muted)">${p.year}</span>
          ${sb(p.school)}
          ${TYPE_B[p.type] || ''}
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px">${p.authors}</div>
        <div class="feed-abstract">${p.abstract || 'No abstract preview available.'}</div>
        <div style="margin-top:8px">
          ${listSDGs.map(s => `<span class="badge bgo" style="margin-right:4px">${s}</span>`).join('')}
        </div>
      </div>
      <div style="flex-shrink:0; padding-left:12px">
        <a href="${p.url}" target="_blank" style="font-size:11px; color:var(--primary); font-weight:600; text-decoration:none">
          DSpace &nearr;
        </a>
      </div>
    `;
    container.appendChild(item);
  });
}

/* ==========================================================================
   SDG CONTRIBUTION MATRIX
   ========================================================================== */

function buildSDG() {
  const container = document.getElementById('sdg-grid');
  if (!container) return;
  container.innerHTML = '';

  const allSDGs = PUBS.flatMap(p => Array.isArray(p.sdgs) ? p.sdgs : []);
  const activeSet = new Set(allSDGs);
  
  const counts = {};
  allSDGs.forEach(s => { counts[s] = (counts[s] || 0) + 1; });

  SDGS.forEach(sdg => {
    const isActive = activeSet.has(sdg.n);
    const count = counts[sdg.n] || 0;
    
    const card = document.createElement('div');
    card.className = 'sdg-card' + (isActive ? '' : ' off');
    
    if (isActive) {
      card.style.background = `${sdg.c}14`;
      card.style.borderColor = `${sdg.c}36`;
      card.style.boxShadow = `inset 0 0 0 1px ${sdg.c}12`;
    }
    
    card.title = isActive ? `${sdg.l}: ${count} publications` : `${sdg.l} — research opportunity`;
    
    card.innerHTML = `
      <div class="sdg-n" style="color:${isActive ? sdg.c : 'var(--text-muted)'}">${sdg.n}</div>
      <div class="sdg-l" style="color:${isActive ? 'var(--text-main)' : 'var(--text-light)'}">${sdg.l}</div>
      ${isActive ? `<div class="sdg-c" style="color:${sdg.c}">${count}</div>` : ''}
    `;
    container.appendChild(card);
  });
}

/* ==========================================================================
   SCHOOL PROFILES TILES
   ========================================================================== */

function buildSchools() {
  const container = document.getElementById('school-grid');
  if (!container) return;
  container.innerHTML = '';

  const counts = SCHOOLS.map(s => PUBS.filter(p => p.school === s.code).length);
  const maxVal = Math.max(1, ...counts);

  SCHOOLS.forEach((s, idx) => {
    const num = counts[idx];
    const percentage = Math.round((num / maxVal) * 100);
    const tile = document.createElement('div');
    tile.className = 'school-tile';
    tile.style.borderTopColor = s.col;
    tile.innerHTML = `
      <div class="st-code" style="color:${s.col}">${s.code}</div>
      <div class="st-name">${s.name}</div>
      <div class="st-n" style="color:${s.col}">${num}</div>
      <div class="st-nl">publications in DU-Space</div>
      <div class="st-focus">${s.focus}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:12px">DRICE Cluster: <strong>${s.cluster}</strong></div>
      <div class="st-bar">
        <div class="st-fill" style="width:${percentage}%; background:${s.col}"></div>
      </div>
      <div class="st-tags">
        ${s.tags.map(tag => `<span class="badge" style="background:${s.col}10; color:${s.col}; border-color:${s.col}24">${tag}</span>`).join('')}
      </div>
    `;
    container.appendChild(tile);
  });
}

/* ==========================================================================
   FACULTY SUMMARY CARDS
   ========================================================================== */

function buildFaculty() {
  const container = document.getElementById('faculty-cards');
  if (!container) return;
  container.innerHTML = '';

  // Calculate publication list per faculty author (at least 2 publications)
  const mapAuthors = {};
  PUBS.forEach(p => {
    (p.authors || '').split(/[;|]/).map(a => a.trim()).filter(a => a.length > 3).forEach(a => {
      if (!mapAuthors[a]) mapAuthors[a] = [];
      mapAuthors[a].push(p);
    });
  });

  const activeFaculty = Object.entries(mapAuthors)
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8);

  if (!activeFaculty.length) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding:24px; text-align:center; grid-column:span 2">Import data with publications to see active faculty profiles.</div>';
    return;
  }

  activeFaculty.forEach(([author, list]) => {
    const school = list[0].school || '';
    const initials = author.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
    const card = document.createElement('div');
    card.className = 'fp-card';
    card.innerHTML = `
      <div class="fp-header">
        <div class="fp-avatar">${initials}</div>
        <div>
          <h4 class="fp-name">${author}</h4>
          <div class="fp-role">Faculty &bull; School of ${school || 'Other'}</div>
          <div class="fp-badges">
            ${sb(school)}
            <span class="badge bg" style="font-size:9px">${list.length} Records</span>
          </div>
        </div>
      </div>
      <div class="fp-body">
        <div class="fp-metrics">
          <div class="fp-met"><div class="fp-met-v">${list.length}</div><div class="fp-met-l">Publications</div></div>
          <div class="fp-met"><div class="fp-met-v">${list.filter(p => p.type === 'Journal Article').length}</div><div class="fp-met-l">Journals</div></div>
          <div class="fp-met"><div class="fp-met-v">${list.filter(p => p.type === 'Conference Paper').length}</div><div class="fp-met-l">Conferences</div></div>
          <div class="fp-met"><div class="fp-met-v">${[...new Set(list.map(p => p.year))].length}</div><div class="fp-met-l">Active Years</div></div>
        </div>
        <div style="font-size:11px; font-weight:600; color:var(--text-main); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px">Publication highlights</div>
        ${list.slice(0, 4).map(p => `
          <div class="fp-pub">
            <div class="fp-pub-title">${p.title}</div>
            <div class="fp-pub-meta">
              <span style="font-size:10px; color:var(--text-muted)">${p.year}</span>
              ${TYPE_B[p.type] || ''}
              <span style="font-size:10px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px">${p.publisher}</span>
            </div>
          </div>
        `).join('')}
        <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border-color); display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn-import btn-primary-theme" style="padding:6px 12px; font-size:11px" onclick="aiInsight('Which international grant proposals should DRICE target for ${author.replace(/'/g, "\\'")} based on their DSpace research profiles?')">
            Find Grants &nearr;
          </button>
          <button class="btn-import btn-secondary-theme" style="padding:6px 12px; font-size:11px; color:var(--neutral-dark); border-color:var(--border-color)" onclick="aiInsight('Recommend the best Scopus indexed Q1/Q2 journals for ${author.replace(/'/g, "\\'")} based on their published outputs?')">
            Best Journals
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ==========================================================================
   METRICS & AUDIT LOGS DISPLAY
   ========================================================================== */

function updateStats(logData = []) {
  const total = PUBS.length;
  const totalCounter = document.getElementById('st-total');
  if (totalCounter) totalCounter.textContent = total;

  const allSDGs = new Set(PUBS.flatMap(p => Array.isArray(p.sdgs) ? p.sdgs : []));
  const sdgCounter = document.getElementById('st-sdg');
  if (sdgCounter) sdgCounter.textContent = allSDGs.size;

  const journalCounter = document.getElementById('st-journal');
  if (journalCounter) journalCounter.textContent = PUBS.filter(p => p.type === 'Journal Article').length;

  const indexedCounter = document.getElementById('st-indexed');
  if (indexedCounter) indexedCounter.textContent = PUBS.filter(p => p.indexing && p.indexing !== 'Verify').length;

  const yearsCounter = document.getElementById('st-years');
  const listYears = PUBS.map(p => p.year).filter(Boolean);
  if (yearsCounter && listYears.length) {
    yearsCounter.textContent = `${Math.min(...listYears)}–${Math.max(...listYears)}`;
  }

  const dbStatusText = document.getElementById('db-status');
  if (dbStatusText) {
    dbStatusText.textContent = total > 0 
      ? `${total} active publications in SQLite database` 
      : 'No database records found &bull; import publications above';
  }

}

/* ==========================================================================
   GLOBAL UPDATE SEQUENCE
   ========================================================================== */

function rebuildAll(logData = []) {
  updateStats(logData);
  buildCharts();
  buildTable();
  buildFeed();
  buildSDG();
  buildSchools();
  buildFaculty();
}

/**
 * Loads publications and logs simultaneously and updates UI.
 */
function fetchDataAndRebuild() {
  const dbStatus = document.getElementById('db-status');
  if (dbStatus) dbStatus.innerHTML = 'Updating dashboard outputs...';

  // Concurrent fetch using node endpoints
  Promise.all([
    fetch('/api/publications').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
  ])
  .then(([publications, statistics]) => {
    PUBS = publications;
    rebuildAll(statistics.log);
  })
  .catch(err => {
    console.error('[Client App] Initialization fetch failed:', err);
    if (dbStatus) dbStatus.innerHTML = '<span style="color:var(--secondary)">Database connection offline</span>';
  });
}

/* ==========================================================================
   NAVIGATION AND ACTIONS
   ========================================================================== */

function goTo(sectionId, btn) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('.mnb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Modal control routines
function openModal() {
  const modal = document.getElementById('import-modal');
  if (modal) modal.showModal();
}

function closeModal() {
  const modal = document.getElementById('import-modal');
  if (modal) modal.close();
}

/**
 * Handles CSV replacement.
 */
function importCSV() {
  const fileInput = document.getElementById('csv-file-input');
  if (!fileInput.files.length) {
    alert('Please select a valid CSV publications file first.');
    return;
  }
  
  const uploadBtn = document.getElementById('upload-btn');
  const originalText = uploadBtn.textContent;
  uploadBtn.textContent = 'Importing...';
  uploadBtn.disabled = true;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  fetch('/api/upload-csv', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
      if (data.error) {
        alert('Upload failed: ' + data.error);
        return;
      }
      closeModal();
      fetchDataAndRebuild();
    })
    .catch(err => {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
      alert('Network request failed: ' + err.message);
    });
}

function exportCSV() {
  window.location.href = '/api/export-csv';
}


/**
 * Triggers DSpace community live harvests.
 */
function harvestDUSpace() {
  const harvestBtn = document.getElementById('harvest-btn');
  const communitySelect = document.getElementById('harvest-community-select');
  
  const schoolCode = communitySelect.value;
  const originalText = harvestBtn.innerHTML;
  
  harvestBtn.innerHTML = 'Harvesting DSpace...';
  harvestBtn.disabled = true;

  fetch('/api/harvest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolCode })
  })
  .then(r => r.json())
  .then(data => {
    harvestBtn.innerHTML = originalText;
    harvestBtn.disabled = false;
    
    if (data.error) {
      alert('Harvest failure: ' + data.error);
      return;
    }
    alert(data.message || 'DSpace community harvested successfully.');
    fetchDataAndRebuild();
  })
  .catch(err => {
    harvestBtn.innerHTML = originalText;
    harvestBtn.disabled = false;
    alert('Harvest network connection failed: ' + err.message);
  });
}

/* ==========================================================================
   AI ASSISTANT AND SDG RE-ANALYZER
   ========================================================================== */

function aiInsight(promptText) {
  // Use standard gemini-key-input from the AI result dialog
  const apiKey = document.getElementById('gemini-key-input')?.value || '';
  
  showAIResult(promptText, 'Analyzing publications in database, generating AI strategic insights...');

  fetch('/api/ai-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptText, apiKey })
  })
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      showAIResult(promptText, `AI Request failed: ${data.error}`);
      return;
    }
    showAIResult(promptText, data.response);
  })
  .catch(err => {
    showAIResult(promptText, `Network error communicating with AI endpoint: ${err.message}`);
  });
}

function askAICustom() {
  const promptInput = document.getElementById('ai-custom-prompt');
  const text = promptInput?.value;
  if (!text) return;
  aiInsight(text);
}

function askAIDynamic(type) {
  const select = document.getElementById('harvest-community-select');
  const schoolName = select?.options[select.selectedIndex]?.text || 'Daystar University';
  
  let prompt = '';
  if (type === 'grant') {
    prompt = `Identify the top 5 international research grants (e.g. IDRC, USAID, Horizon, NRF) that fits well with faculty publications under "${schoolName}" at Daystar University. Align titles and abstract keywords.`;
  } else if (type === 'idrc') {
    prompt = `Evaluate publications data under "${schoolName}". Which specific researchers at Daystar University are the best candidates to lead an IDRC AI4D African digital health or AI innovation proposal? Detail exact publications evidence.`;
  } else if (type === 'journal') {
    prompt = `Detail a customized list of Scopus Q1/Q2 indexed journals targeting the research topics found under "${schoolName}" publications at Daystar University. Suggest suitable publishers and typical review times.`;
  }
  
  if (prompt) aiInsight(prompt);
}

function reanalyzeSDGs() {
  const btn = document.getElementById('reanalyze-sdg-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Batch AI Analysis (WAL mode enabled)...';
  btn.disabled = true;

  fetch('/api/reanalyze-sdgs', { method: 'POST' })
  .then(r => r.json())
  .then(data => {
    btn.textContent = originalText;
    btn.disabled = false;
    if (data.error) {
      alert('AI SDG Analysis failed: ' + data.error);
      return;
    }
    alert(data.message || 'AI Batch reanalysis successfully completed.');
    fetchDataAndRebuild();
  })
  .catch(err => {
    btn.textContent = originalText;
    btn.disabled = false;
    alert('AI SDG request failed: ' + err.message);
  });
}

/**
 * Creates or updates the AI dialogue window.
 */
function showAIResult(prompt, response) {
  let modal = document.getElementById('ai-result-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ai-result-modal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); z-index:600; padding:24px; align-items:center; justify-content:center';
    modal.innerHTML = `
      <div style="background:#FFFFFF; border-radius:18px; width:100%; max-width:680px; overflow:hidden; border:1px solid var(--border-color); box-shadow:var(--shadow-lg); animation:modalReveal 0.3s ease-out">
        <header class="modal-hdr">
          <div class="modal-hdr-title">🤖 AI Strategic Insight</div>
          <button class="modal-close" onclick="document.getElementById('ai-result-modal').style.display='none'">Close</button>
        </header>
        <div class="modal-body">
          <div id="ai-modal-prompt" class="ai-modal-prompt"></div>
          <div id="ai-modal-body" class="ai-modal-body"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('ai-modal-prompt').textContent = prompt;
  
  const bodyEl = document.getElementById('ai-modal-body');
  if (response.includes('Analyzing publications')) {
    bodyEl.innerHTML = `
      <div class="ai-thinking">
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
        <span style="margin-left:8px">${response}</span>
      </div>
    `;
  } else {
    bodyEl.textContent = response;
  }
  
  modal.style.display = 'flex';
}

/* ==========================================================================
   INITIALIZATION AND SCROLL EVENT HANDLERS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialise Dashboard records
  fetchDataAndRebuild();

  // 2. Fetch communities and populate the live harvest select menu
  fetch('/api/schools')
    .then(r => r.json())
    .then(schools => {
      const select = document.getElementById('harvest-community-select');
      if (select) {
        schools.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.code;
          opt.textContent = `${s.code} — ${s.name} ${s.hasIds ? '' : '(OAI only)'}`;
          select.appendChild(opt);
        });
      }
    })
    .catch(err => console.error('[Client Init] Schools list fetch failed:', err));
});

// Scroll Event sync to highlight tabs
window.addEventListener('scroll', () => {
  const sections = ['sec-charts', 'sec-pubs', 'sec-recent', 'sec-sdg', 'sec-schools', 'sec-faculty'];
  const tabs = document.querySelectorAll('.mnb');
  
  sections.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const rect = el.getBoundingClientRect();
    if (rect.top <= 140 && rect.bottom > 0) {
      tabs.forEach(t => t.classList.remove('active'));
      if (tabs[idx]) tabs[idx].classList.add('active');
    }
  });
});

/* ==========================================================================
   DU-Space Research Profile - Front-End Controller Script
   ========================================================================== */

let PUBS = [];
let ALL_PUBS = [];
let FACULTY_LIST = [];
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

function normalizeSchoolCode(school) {
  if (!school) return '';
  const s = school.trim().toLowerCase();
  if (s.includes('science') || s.includes('sseh')) return 'SSEH';
  if (s.includes('communication') || s.includes('soc')) return 'SOC';
  if (s.includes('business') || s.includes('economics') || s.includes('sbe')) return 'SBE';
  if (s.includes('human') || s.includes('shss')) return 'SHSS';
  if (s.includes('nursing') || s.includes('son')) return 'SON';
  if (s.includes('law') || s.includes('sol')) return 'SOL';
  if (s.includes('arts') || s.includes('sass')) return 'SASS';
  if (s.includes('theology') || s.includes('mission') || s.includes('smt')) return 'SMT';
  return school.toUpperCase(); // fallback
}

/**
 * Returns formatted school badge component.
 */
function sb(schoolCode) {
  const code = normalizeSchoolCode(schoolCode);
  if (!code) return '<span class="badge bgr">&mdash;</span>';
  const bg = SC_BG[code] || '#F1F5F9';
  const tc = SC_TC[code] || '#475569';
  return `<span class="badge" style="background:${bg}; color:${tc}; border-color:rgba(0,0,0,0.05)">${code}</span>`;
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
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const schoolCode = SCHOOLS[index].code;
            
            // 1. Update the filter dropdown
            const filterDropdown = document.getElementById('sc-filter');
            if (filterDropdown) {
              if (filterDropdown.value === schoolCode) {
                filterDropdown.value = 'all';
              } else {
                filterDropdown.value = schoolCode;
              }
              applyFilters();
            }
            
            // 2. Scroll to the Browse All publications section
            const targetSection = document.getElementById('sec-pubs');
            if (targetSection) {
              targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        },
        onHover: (event, chartElement) => {
          event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        },
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
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const year = tChart.data.labels[index];
            
            // 1. Update the filter dropdown
            const filterDropdown = document.getElementById('yr-filter');
            if (filterDropdown) {
              if (filterDropdown.value === year) {
                filterDropdown.value = 'all';
              } else {
                filterDropdown.value = year;
              }
              applyFilters();
            }
            
            // 2. Scroll to the Browse All publications section
            const targetSection = document.getElementById('sec-pubs');
            if (targetSection) {
              targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        },
        onHover: (event, chartElement) => {
          event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        },
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
    
    // Calculate 6-year publication trend (2021–2026) for the sparkline on the card
    const years = ['2021', '2022', '2023', '2024', '2025', '2026'];
    const counts = years.map(y => list.filter(p => String(p.year) === y).length);
    const maxVal = Math.max(1, ...counts);
    const sparklineHtml = counts.map((val, i) => {
      const pct = Math.max(10, Math.round((val / maxVal) * 100));
      const isLast = i === counts.length - 1;
      return `<div class="tc ${isLast ? 'r' : ''}" style="height:${pct}%; min-width:6px;" title="${years[i]}: ${val} pubs"></div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'fp-card';
    card.innerHTML = `
      <div class="fp-header" style="position:relative; width: 100%;">
        <div class="fp-avatar">${initials}</div>
        <div style="flex-grow:1; padding-right:80px;">
          <h4 class="fp-name">${author}</h4>
          <div class="fp-role">Faculty &bull; School of ${school || 'Other'}</div>
          <div class="fp-badges">
            ${sb(school)}
            <span class="badge bg" style="font-size:9px">${list.length} Records</span>
          </div>
        </div>
        <a href="/faculty/${slugify(author)}" target="_blank" style="position:absolute; top:16px; right:16px; font-size:11px; color:var(--primary); font-weight:700; text-decoration:none;">View profile &rarr;</a>
      </div>
      <div class="fp-body">
        <div class="fp-metrics">
          <div class="fp-met"><div class="fp-met-v">${list.length}</div><div class="fp-met-l">Publications</div></div>
          <div class="fp-met"><div class="fp-met-v">${list.filter(p => p.type === 'Journal Article').length}</div><div class="fp-met-l">Journals</div></div>
          <div class="fp-met"><div class="fp-met-v">${list.filter(p => p.type === 'Conference Paper').length}</div><div class="fp-met-l">Conferences</div></div>
          <div class="fp-met"><div class="fp-met-v">${[...new Set(list.map(p => p.year))].length}</div><div class="fp-met-l">Active Years</div></div>
        </div>
        
        <!-- Premium Publication Trend Sparkline Block -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; margin-bottom:14px; padding:10px 14px; background:var(--bg-app); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="font-size:9px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">6-Year Publication Trend</div>
            <div style="font-size:11px; color:var(--text-main); font-weight:500;">2021–2026 &bull; <span style="color:var(--teal); font-weight:600;">Active</span></div>
          </div>
          <div class="trend-wrap" style="height:28px; gap:2px; margin-bottom:0; width:60px; justify-content:flex-end;">
            ${sparklineHtml}
          </div>
        </div>

        <div style="font-size:11px; font-weight:600; color:var(--text-main); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px">Publication highlights</div>
        ${list.slice(0, 4).map(p => `
          <div class="fp-pub">
            <div class="fp-pub-title"><a href="${p.url}" target="_blank" style="color:inherit; text-decoration:none; transition:var(--transition-smooth);" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='inherit'">${p.title}</a></div>
            <div class="fp-pub-meta">
              <span style="font-size:10px; color:var(--text-muted)">${p.year}</span>
              ${TYPE_B[p.type] || ''}
              <a href="${p.url}" target="_blank" style="font-size:10px; color:var(--primary); text-decoration:none; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${p.publisher}</a>
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
      ? `${total} active publications in profile` 
      : 'No database records found • import publications above';
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
  drawNetwork();
  generateTeam();
}

/**
 * Filters publications by school and year dropdown menus.
 */
function applyFilters() {
  const school = document.getElementById('sc-filter').value;
  const year = document.getElementById('yr-filter').value;
  
  // Show or hide clear button based on active filters
  const clearBtn = document.getElementById('clear-table-filters');
  if (clearBtn) {
    if (school !== 'all' || year !== 'all') {
      clearBtn.style.display = 'inline-flex';
    } else {
      clearBtn.style.display = 'none';
    }
  }

  PUBS = ALL_PUBS.filter(p => {
    const pSchoolCode = normalizeSchoolCode(p.school);
    const matchSchool = (school === 'all' || pSchoolCode === school);
    const matchYear = (year === 'all' || String(p.year) === year);
    return matchSchool && matchYear;
  });
  rebuildAll([]);
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
    fetch('/api/stats').then(r => r.json()),
    fetch('/api/faculty').then(r => r.json())
  ])
  .then(([publications, statistics, faculty]) => {
    ALL_PUBS = publications;
    FACULTY_LIST = faculty;
    applyFilters();
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

function scrollSection(id, btn) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.anchor-link').forEach(a => a.classList.remove('here'));
  if (btn) btn.classList.add('here');
}

// Scroll Event sync to highlight tabs & sub-anchors
window.addEventListener('scroll', () => {
  const sections = ['sec-charts', 'sec-pubs', 'sec-recent', 'sec-sdg', 'sec-schools', 'sec-faculty', 'sec-network', 'sec-teambuilder'];
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

  // Dynamic sub-anchor scroll sync highlighting
  const subSections = [
    { id: 'sec-network', anchorId: 'anchor-net' },
    { id: 'sec-faculty', anchorId: 'anchor-profile' },
    { id: 'sec-teambuilder', anchorId: 'anchor-team' }
  ];
  let activeAnchor = null;
  for (const s of subSections) {
    const el = document.getElementById(s.id);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 180 && rect.bottom > 100) {
        activeAnchor = s.anchorId;
        break;
      }
    }
  }
  if (activeAnchor) {
    document.querySelectorAll('.anchor-link').forEach(a => {
      if (a.id === activeAnchor) {
        a.classList.add('here');
      } else {
        a.classList.remove('here');
      }
    });
  }
});

/* ==========================================================================
   PHASE 9: PREMIUM ACADEMIC ADDITIONS
   ========================================================================== */

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── COLLABORATION NETWORK MAP ── */
function drawNetwork() {
  const svg = document.getElementById('networkSVG');
  if (!svg) return;
  
  const W = svg.parentElement.offsetWidth || 800;
  const H = 600;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  
  const clusterFilter = document.getElementById('net-cluster-filter')?.value || 'all';
  const yearFilter = document.getElementById('net-year-filter')?.value || '2023-2026';
  const densityFilter = document.getElementById('net-density-filter')?.value || 'medium';
  
  const showInternal = document.getElementById('toggle-internal')?.classList.contains('on');
  const showExternal = document.getElementById('toggle-external')?.classList.contains('on');
  const showIsolated = document.getElementById('toggle-isolated')?.classList.contains('on');
  
  // 1. Filter publications by year range filter with highly robust date/year parsing
  let netPubs = ALL_PUBS;
  if (yearFilter !== 'all') {
    const [startYear, endYear] = yearFilter.split(/[-–]/).map(Number);
    netPubs = ALL_PUBS.filter(p => {
      if (!p.year) return false;
      const yr = parseInt(String(p.year).substring(0, 4), 10);
      return !isNaN(yr) && yr >= startYear && yr <= endYear;
    });
  }
  
  // 2. Count publication outputs per Daystar researcher within year range filter
  const authorPubs = {};
  netPubs.forEach(p => {
    const authorList = (p.authors || '').split(/[;|]/).map(a => a.trim()).filter(a => a.length > 3);
    authorList.forEach(a => {
      authorPubs[a] = (authorPubs[a] || 0) + 1;
    });
  });
  
  // 3. Keep Daystar researchers based on densityFilter thresholding
  let minPubs = 3; // 'medium'
  if (densityFilter === 'high') {
    minPubs = yearFilter !== 'all' ? 1 : 2;
  } else if (densityFilter === 'low') {
    minPubs = yearFilter !== 'all' ? 3 : 5;
  } else {
    minPubs = yearFilter !== 'all' ? 2 : 3; // 'medium'
  }
  const activeAuthors = Object.keys(authorPubs).filter(a => authorPubs[a] >= minPubs);
  const researcherNodes = [];
  const nameToNode = {};
  
  activeAuthors.forEach(author => {
    const myPubs = ALL_PUBS.filter(p => (p.authors || '').includes(author));
    const schoolCounts = {};
    myPubs.forEach(p => {
      if (p.school) schoolCounts[p.school] = (schoolCounts[p.school] || 0) + 1;
    });
    
    let primarySchool = 'Other';
    let maxSc = 0;
    Object.entries(schoolCounts).forEach(([sc, count]) => {
      if (count > maxSc) {
        maxSc = count;
        primarySchool = sc;
      }
    });
    
    // Apply clusterFilter
    if (clusterFilter !== 'all' && primarySchool !== clusterFilter) return;
    
    const initials = author.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
    
    const node = {
      id: author,
      label: author,
      initials,
      type: 'daystar',
      cluster: primarySchool,
      pubCount: authorPubs[author],
      r: Math.min(22, 10 + authorPubs[author] * 1.5)
    };
    
    researcherNodes.push(node);
    nameToNode[author] = node;
  });
  
  // 4. Detect external institutions based on keywords
  const extCounts = {};
  const researcherToExt = {};
  
  const extDef = [
    { key: 'KEMRI', name: 'KEMRI', match: /kemri|kenya medical research/i },
    { key: 'UON', name: 'Univ. of Nairobi', match: /nairobi|uon/i },
    { key: 'MOH', name: 'MOH Kenya', match: /moh|ministry of health/i },
    { key: 'Kenyatta', name: 'Kenyatta Univ.', match: /kenyatta/i },
    { key: 'Jkuat', name: 'JKUAT', match: /jkuat|jomo kenyatta/i },
    { key: 'WHO', name: 'WHO', match: /world health|who/i },
    { key: 'CDC', name: 'CDC', match: /cdc|centers for disease/i },
    { key: 'AMREF', name: 'AMREF', match: /amref/i },
    { key: 'IDRC', name: 'IDRC', match: /idrc/i },
    { key: 'Wellcome', name: 'Wellcome Trust', match: /wellcome/i }
  ];
  
  netPubs.forEach(p => {
    const textToMatch = `${p.publisher || ''} ${p.title || ''} ${p.abstract || ''} ${p.authors || ''}`;
    const matchedExts = [];
    extDef.forEach(ext => {
      if (ext.match.test(textToMatch)) matchedExts.push(ext.name);
    });
    
    const pubAuthors = (p.authors || '').split(/[;|]/).map(a => a.trim()).filter(a => a.length > 3);
    pubAuthors.forEach(a => {
      if (nameToNode[a]) {
        matchedExts.forEach(extName => {
          extCounts[extName] = (extCounts[extName] || 0) + 1;
          if (!researcherToExt[a]) researcherToExt[a] = {};
          researcherToExt[a][extName] = (researcherToExt[a][extName] || 0) + 1;
        });
      }
    });
  });
  
  const externalNodes = [];
  Object.keys(extCounts).forEach(extName => {
    const isConnected = researcherNodes.some(n => researcherToExt[n.id] && researcherToExt[n.id][extName]);
    if (isConnected) {
      externalNodes.push({
        id: extName,
        label: extName,
        type: 'ext',
        cluster: 'ext',
        pubCount: extCounts[extName],
        r: 10
      });
    }
  });
  
  // 5. Co-authorship weights (internal & external links)
  const coauthorshipWeights = {};
  netPubs.forEach(p => {
    const pubAuthors = (p.authors || '').split(/[;|]/).map(a => a.trim()).filter(a => a.length > 3);
    const visibleAuthors = pubAuthors.filter(a => nameToNode[a]);
    
    for (let i = 0; i < visibleAuthors.length; i++) {
      for (let j = i + 1; j < visibleAuthors.length; j++) {
        const u = visibleAuthors[i];
        const v = visibleAuthors[j];
        const key = u < v ? `${u}|||${v}` : `${v}|||${u}`;
        coauthorshipWeights[key] = (coauthorshipWeights[key] || 0) + 1;
      }
    }
  });
  
  const edges = [];
  if (showInternal) {
    Object.entries(coauthorshipWeights).forEach(([key, w]) => {
      const [u, v] = key.split('|||');
      edges.push({ s: u, t: v, w, type: 'internal' });
    });
  }
  
  if (showExternal) {
    Object.entries(researcherToExt).forEach(([author, exts]) => {
      if (nameToNode[author]) {
        Object.entries(exts).forEach(([extName, w]) => {
          edges.push({ s: author, t: extName, w, type: 'external' });
        });
      }
    });
  }
  
  // Filter out isolated nodes if filter disabled
  const nodeEdgeCounts = {};
  edges.forEach(e => {
    nodeEdgeCounts[e.s] = (nodeEdgeCounts[e.s] || 0) + 1;
    nodeEdgeCounts[e.t] = (nodeEdgeCounts[e.t] || 0) + 1;
  });
  
  const filterNodeList = (list) => {
    return list.filter(n => {
      const edgeCount = nodeEdgeCounts[n.id] || 0;
      return edgeCount > 0 || showIsolated;
    });
  };
  
  const shownResearchers = filterNodeList(researcherNodes);
  const shownExternals = showExternal ? filterNodeList(externalNodes) : [];
  const finalNodes = [...shownResearchers, ...shownExternals];
  
  // 6. Mathematical layout coordinate rendering
  const cx = W / 2;
  const cy = H / 2;
  
  const schoolList = ["SSEH", "SOC", "SBE", "SHSS", "SON", "SOL", "SASS", "SMT"];
  const schoolAngles = {};
  schoolList.forEach((code, idx) => {
    schoolAngles[code] = idx * (2 * Math.PI / 8) - Math.PI / 2;
  });
  
  // Spread out settings based on whether we filter by a single cluster or show all
  const isSingleCluster = clusterFilter !== 'all';
  const R_school = isSingleCluster ? 0 : 180; // Center if single school, else push out to 180px
  
  const researchersBySchool = {};
  shownResearchers.forEach(node => {
    if (!researchersBySchool[node.cluster]) researchersBySchool[node.cluster] = [];
    researchersBySchool[node.cluster].push(node);
  });
  
  Object.entries(researchersBySchool).forEach(([schoolCode, list]) => {
    // If showing only one school, center the school cluster
    const angle_s = schoolAngles[schoolCode] !== undefined ? schoolAngles[schoolCode] : 0;
    const ccx = isSingleCluster ? cx : cx + R_school * Math.cos(angle_s);
    const ccy = isSingleCluster ? cy : cy + R_school * Math.sin(angle_s);
    
    const N_sc = list.length;
    // Determine cluster spread radius
    const r_res = isSingleCluster 
      ? Math.min(220, 90 + N_sc * 4) // Much wider circle for single cluster view
      : Math.min(100, 35 + N_sc * 3); // Spaced out sub-circles in multi-cluster view
      
    list.forEach((node, idx) => {
      if (N_sc === 1) {
        node.x = ccx;
        node.y = ccy;
      } else {
        // Stagger nodes in concentric rings for large clusters to prevent overlaps
        let current_r = r_res;
        if (N_sc > 6) {
          current_r = (idx % 2 === 0) ? r_res * 0.78 : r_res * 1.22;
        }
        const angle_r = (idx * 2 * Math.PI / N_sc);
        node.x = ccx + current_r * Math.cos(angle_r);
        node.y = ccy + current_r * Math.sin(angle_r);
      }
    });
  });
  
  const N_ext = shownExternals.length;
  // If single school, push external partners to outer circle of 275px, else 260px
  const R_ext = isSingleCluster ? 275 : 260;
  shownExternals.forEach((node, idx) => {
    const angle_e = (idx * 2 * Math.PI / N_ext) + Math.PI / 8;
    node.x = cx + R_ext * Math.cos(angle_e);
    node.y = cy + R_ext * Math.sin(angle_e);
  });
  
  const nodeMap = {};
  finalNodes.forEach(n => { nodeMap[n.id] = n; });
  
  // Spring-force layout physics simulation (150 iterations) to dynamically spread nodes and prevent overlaps
  const iterations = 150;
  const idealLength = 65; // Ideal spring length between connected nodes
  for (let step = 0; step < iterations; step++) {
    // 1. Repulsion force between all node pairs to prevent overlaps
    for (let i = 0; i < finalNodes.length; i++) {
      const n1 = finalNodes[i];
      for (let j = i + 1; j < finalNodes.length; j++) {
        const n2 = finalNodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Repulsion threshold dynamically scales with node size
        const minDistance = n1.r + n2.r + 42;
        if (dist < minDistance) {
          const force = (minDistance - dist) * 0.12;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          n1.x -= fx;
          n1.y -= fy;
          n2.x += fx;
          n2.y += fy;
        }
      }
    }
    
    // 2. Attraction force along co-authorship connections
    edges.forEach(e => {
      const sNode = nodeMap[e.s];
      const tNode = nodeMap[e.t];
      if (!sNode || !tNode) return;
      
      const dx = tNode.x - sNode.x;
      const dy = tNode.y - sNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      
      if (dist > idealLength) {
        const force = (dist - idealLength) * 0.035;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        sNode.x += fx;
        sNode.y += fy;
        tNode.x -= fx;
        tNode.y -= fy;
      }
    });
    
    // 3. Central gravity attraction to keep the graph centered on the canvas
    finalNodes.forEach(n => {
      const dx = cx - n.x;
      const dy = cy - n.y;
      n.x += dx * 0.008;
      n.y += dy * 0.008;
    });
  }
  
  // 4. Force strict boundaries to keep nodes inside the SVG viewport
  finalNodes.forEach(n => {
    n.x = Math.max(n.r + 25, Math.min(W - n.r - 25, n.x));
    n.y = Math.max(n.r + 25, Math.min(H - n.r - 25, n.y));
  });
  
  const schoolColors = {
    SSEH: '#25AAE1', SOC: '#1D9E75', SBE: '#EF9F27', SHSS: '#E0606F',
    SON: '#7C3AED', SOL: '#BA7517', SASS: '#64748B', SMT: '#639922',
    ext: '#888780'
  };
  
  let drawHtml = '';
  edges.forEach(e => {
    const sNode = nodeMap[e.s];
    const tNode = nodeMap[e.t];
    if (!sNode || !tNode) return;
    
    const sw = e.type === 'internal' 
      ? (e.w >= 3 ? 3.0 : e.w === 2 ? 1.8 : 0.8) 
      : 1.0;
    const op = e.type === 'internal' 
      ? (e.w >= 3 ? 0.7 : 0.4) 
      : 0.25;
    const strokeColor = e.type === 'internal' ? '#02AEEE' : '#888780';
    const strokeDash = e.type === 'external' ? '3,3' : 'none';
    
    drawHtml += `<line x1="${sNode.x}" y1="${sNode.y}" x2="${tNode.x}" y2="${tNode.y}" stroke="${strokeColor}" stroke-width="${sw}" stroke-opacity="${op}" stroke-dasharray="${strokeDash}"/>`;
  });
  
  finalNodes.forEach((n, idx) => {
    const col = schoolColors[n.cluster] || '#888780';
    const stroke = n.type === 'daystar' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.15)';
    const strokeWidth = n.type === 'daystar' ? 1.5 : 1.0;
    const initials = n.initials || '';
    
    // Stagger labels vertically to prevent horizontal overlaps
    const labelYOffset = n.type === 'daystar' 
      ? n.r + (idx % 2 === 0 ? 12 : 23) 
      : n.r + 12;
      
    drawHtml += `
      <g class="net-node" style="cursor:pointer;" onclick="if('${n.type}'==='daystar'){showResearcherDetailsModal('${n.id.replace(/'/g, "\\'")}')}" onmouseenter="showTT(event, '${n.id}', '${n.label.replace(/'/g, "\\'")}', '${n.cluster}')" onmouseleave="hideTT()">
        <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${col}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${n.type==='daystar'?1:0.8}"/>
        ${n.type === 'daystar' && n.r > 12 ? `<text x="${n.x}" y="${n.y+4}" fill="#FFF" font-family="'Outfit', sans-serif" font-size="9px" font-weight="700" text-anchor="middle" pointer-events="none">${initials}</text>` : ''}
        <text class="node-label" x="${n.x}" y="${n.y+labelYOffset}" text-anchor="middle" fill="#2d3748" font-family="'Inter', sans-serif" font-size="9px" font-weight="600" style="text-shadow: 0 1px 2px rgba(255,255,255,0.8);">${n.label.split(',')[0]}</text>
      </g>
    `;
  });
  
  svg.innerHTML = drawHtml;
  
  const totalExt = shownExternals.length;
  const totalIsolated = finalNodes.filter(n => (nodeEdgeCounts[n.id] || 0) === 0).length;
  
  document.getElementById('stat-nodes').textContent = shownResearchers.length;
  document.getElementById('stat-edges').textContent = edges.length;
  document.getElementById('stat-ext').textContent = totalExt;
  document.getElementById('stat-isolated').textContent = totalIsolated;
}

function showTT(e, id, label, cluster) {
  const tt = document.getElementById('netTooltip');
  const canvas = document.getElementById('netCanvas');
  if (!tt || !canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  
  tt.style.left = (cx + 14) + 'px';
  tt.style.top = (cy - 20) + 'px';
  
  document.getElementById('tt-name').textContent = label;
  
  const sub = document.getElementById('tt-sub');
  const tags = document.getElementById('tt-tags');
  
  if (cluster === 'ext') {
    sub.textContent = 'External institution collaborator';
    tags.innerHTML = `<span class="badge bgr">External Partner</span>`;
  } else {
    sub.textContent = `School of ${cluster}`;
    const researcher = FACULTY_LIST.find(f => f.name === id);
    const pubCount = researcher ? researcher.pubCount : 2;
    tags.innerHTML = `
      <span class="badge bg" style="margin-right:4px;">${pubCount} Publications</span>
      ${sb(cluster)}
    `;
  }
  
  tt.classList.add('show');
}

function hideTT() {
  const tt = document.getElementById('netTooltip');
  if (tt) tt.classList.remove('show');
}

function filterNetwork(v) {
  drawNetwork();
}

window.addEventListener('resize', () => {
  const svg = document.getElementById('networkSVG');
  if (svg && svg.getBoundingClientRect().height > 0) {
    drawNetwork();
  }
});

/* ── CONSORTIUM TEAM BUILDER ── */
function generateTeam() {
  const container = document.getElementById('team-results-container');
  if (!container) return;
  
  const selectedClusters = Array.from(document.querySelectorAll('#tb-cluster-picker .cluster-option.selected'))
    .map(el => el.getAttribute('data-cluster'));
    
  const selectedSDGs = Array.from(document.querySelectorAll('#tb-sdg-picker .sdg-btn.on'))
    .map(el => el.getAttribute('data-sdg'));
    
  const filterGrant = document.getElementById('tb-filter-grant')?.checked;
  const filterActive = document.getElementById('tb-filter-active')?.checked;
  const filterExternal = document.getElementById('tb-filter-external')?.checked;
  const filterOneSchool = document.getElementById('tb-filter-oneschool')?.checked;
  
  if (selectedClusters.length < 2) {
    container.innerHTML = `
      <div style="background:rgba(239,68,68,0.06); border:1px dashed rgba(239,68,68,0.2); border-radius:8px; padding:20px; text-align:center; color:#DC2626; font-size:13px; font-weight:600;">
        ⚠️ Please select at least two target research clusters (schools) to form a consortium.
      </div>
    `;
    return;
  }
  
  const getGrants = (f) => {
    const grants = [];
    // NRF Kenya is broadly available to active researchers in all academic disciplines
    if (f.pubCount >= 4) grants.push('NRF');
    // IDRC covers social, development, legal policy, mission/theology, and communication fields
    if (f.pubCount >= 3 && ['SOC', 'SBE', 'SASS', 'SHSS', 'SOL', 'SMT'].includes(f.school)) grants.push('IDRC');
    // Wellcome Trust covers health, sciences, nursing, human science, and ethics/law fields
    if (f.pubCount >= 3 && ['SSEH', 'SON', 'SHSS', 'SOL'].includes(f.school)) grants.push('Wellcome');
    return grants;
  };
  
  const hasExtCollab = (f) => {
    const myPubs = ALL_PUBS.filter(p => (p.authors || '').includes(f.name));
    const extRegex = /kemri|nairobi|moh|ministry of health|kenyatta|jkuat|who|world health|cdc|amref|idrc|wellcome/i;
    return myPubs.some(p => extRegex.test(`${p.publisher || ''} ${p.title || ''} ${p.abstract || ''}`));
  };
  
  const chosenTeam = [];
  const usedSchools = new Set();
  
  selectedClusters.forEach(clusterCode => {
    let candidates = FACULTY_LIST.filter(f => f.school === clusterCode);
    
    if (filterGrant) {
      candidates = candidates.filter(f => getGrants(f).length > 0);
    }
    if (filterActive) {
      candidates = candidates.filter(f => f.lastActive >= 2023);
    }
    if (filterExternal) {
      candidates = candidates.filter(f => hasExtCollab(f));
    }
    if (filterOneSchool) {
      candidates = candidates.filter(f => !usedSchools.has(f.school));
    }
    
    const scored = candidates.map(f => {
      const matchingSDGs = f.sdgs.filter(s => selectedSDGs.includes(s));
      const score = f.pubCount * 2 + f.indexingCount * 3 + (matchingSDGs.length * 10);
      return { f, score, matchingSDGs };
    });
    
    scored.sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      const best = scored[0];
      chosenTeam.push(best);
      usedSchools.add(best.f.school);
    }
  });
  
  if (chosenTeam.length === 0) {
    container.innerHTML = `
      <div style="background:var(--bg-card-alt); border:1px dashed var(--border-color); border-radius:8px; padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
        No researchers matched the configured criteria for the selected clusters. Try disabling some filters or adding more publications.
      </div>
    `;
    return;
  }
  
  let resultsHtml = `
    <div class="tb-results-title" id="team-title">Suggested team — ${chosenTeam.length} researchers across ${new Set(chosenTeam.map(c => c.f.school)).size} clusters</div>
    <div class="tb-results-sub">Best-matched active researchers for a multi-disciplinary grant application. Based on publication record, SDG alignment, and grant eligibility. Click any researcher to view their full profile.</div>
  `;
  
  const schoolColors = {
    SSEH: '#25AAE1', SOC: '#1D9E75', SBE: '#EF9F27', SHSS: '#E0606F',
    SON: '#7C3AED', SOL: '#BA7517', SASS: '#64748B', SMT: '#639922'
  };
  
  chosenTeam.forEach(item => {
    const f = item.f;
    const initials = f.name.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
    const col = schoolColors[f.school] || '#888780';
    const grants = getGrants(f);
    const grantBadges = grants.map(g => `<span class="badge b-grant" style="margin-left:4px; background:#FCE7F3; color:#BE185D; border: 1px solid rgba(0,0,0,0.05);">${g} eligible</span>`).join('');
    
    const myPubs = ALL_PUBS.filter(p => (p.authors || '').includes(f.name));
    const textCorpus = myPubs.map(p => `${p.title} ${p.abstract}`).join(' ').toLowerCase();
    let method = 'Secondary research';
    if (textCorpus.includes('model') || textCorpus.includes('statistical') || textCorpus.includes('regression') || textCorpus.includes('quantitative')) {
      method = 'Quantitative';
    } else if (textCorpus.includes('survey') || textCorpus.includes('interview') || textCorpus.includes('mixed')) {
      method = 'Mixed methods';
    } else if (textCorpus.includes('qualitative') || textCorpus.includes('focus group')) {
      method = 'Qualitative';
    }
    
    const matchesStr = item.matchingSDGs.length > 0 
      ? `Matches: ${item.matchingSDGs.map(s => `${s} ✓`).join(' ')}`
      : 'No target SDG matches';
      
    resultsHtml += `
      <div class="team-card">
        <div class="tc-header">
          <div class="tc-av" style="background:${col};">${initials}</div>
          <div>
            <div class="tc-name">${f.name}</div>
            <div class="tc-sub">Faculty · ${f.school} · ${f.pubCount} pubs · Last active ${f.lastActive}</div>
          </div>
          <div style="margin-left:auto; display:flex; gap:6px; align-items:center;">
            ${grantBadges}
            <a href="/faculty/${f.slug}" target="_blank" style="font-size:12px; color:var(--primary); font-weight:700; text-decoration:none;">View profile &rarr;</a>
          </div>
        </div>
        <div class="tc-body">
          <span class="badge b-cluster" style="background:${col}14; color:${col}; border: 1px solid rgba(0,0,0,0.02);">${f.school} Cluster</span>
          <span class="badge b-method" style="background:#F1F5F9; color:#475569;">${method}</span>
          ${f.sdgs.slice(0, 3).map(s => `<span class="badge b-sdg" style="background:#E1F5EE; color:#085041;">${s}</span>`).join('')}
          <span style="font-size:11px; color:var(--text-muted); margin-left:4px;">${matchesStr}</span>
          <button class="btn-import btn-primary-theme" style="padding:4px 8px; font-size:10px; margin-left:auto;" onclick="openContactModal('${f.name.replace(/'/g, "\\'")}', 'faculty.${f.slug}@daystar.ac.ke', '${f.school} research')">Contact &rarr;</button>
        </div>
      </div>
    `;
  });
  
  const unionSDGs = [...new Set(chosenTeam.flatMap(item => item.f.sdgs))];
  const schoolsCovered = [...new Set(chosenTeam.map(item => item.f.school))];
  const totalPubs = chosenTeam.reduce((sum, item) => sum + item.f.pubCount, 0);
  const eligibleGrants = [...new Set(chosenTeam.flatMap(item => getGrants(item.f)))];
  
  resultsHtml += `
    <div class="overlap-section">
      <div class="overlap-title">Team overlap analysis</div>
      <div class="overlap-row">
        <span class="overlap-lbl">Shared SDGs</span>
        <div class="overlap-tags">
          ${unionSDGs.slice(0, 6).map(s => `<span class="badge b-sdg" style="background:#E1F5EE; color:#085041;">${s}</span>`).join('')}
          ${unionSDGs.length > 6 ? `<span style="font-size:11px; color:var(--text-muted); align-self:center;">+${unionSDGs.length - 6} more</span>` : ''}
        </div>
      </div>
      <div class="overlap-row">
        <span class="overlap-lbl">Schools covered</span>
        <div class="overlap-tags">
          ${schoolsCovered.map(sc => `<span class="badge b-collab" style="background:${schoolColors[sc]}20; color:${schoolColors[sc]};">${sc}</span>`).join('')}
        </div>
      </div>
      <div class="overlap-row">
        <span class="overlap-lbl">Combined pubs</span>
        <div class="overlap-tags">
          <span style="font-size:13px; font-weight:700; color:var(--neutral-dark);">${totalPubs} publications</span>
          <span style="font-size:11px; color:var(--text-muted); align-self:center;">across ${chosenTeam.length} researchers</span>
        </div>
      </div>
      <div class="overlap-row">
        <span class="overlap-lbl">Grant fit</span>
        <div class="overlap-tags">
          ${eligibleGrants.map(g => `<span class="badge b-grant" style="background:#FCE7F3; color:#BE185D; border: 1px solid rgba(0,0,0,0.05);">${g}</span>`).join('')}
          <span style="font-size:11px; color:var(--text-muted); align-self:center;">— team covered by eligibility</span>
        </div>
      </div>
    </div>
    
    <div class="export-row">
      <button class="btn-outline" onclick="regenerateTeamWithUI()">↺ Regenerate</button>
      <button class="btn-outline" onclick="saveSuggestedTeam()">Save team</button>
      <button class="btn-primary-sm" onclick="emailTeamSuggestionToDRICE()">Email team suggestion to DRICE &rarr;</button>
    </div>
  `;
  
  container.innerHTML = resultsHtml;
}

/* ── CONTACT MODAL CONTROL ── */
function openContactModal(name, email, cluster) {
  const surname = name.split(',')[0].trim().split(' ')[0];
  document.getElementById('m-to').textContent = email;
  document.getElementById('m-surname').textContent = surname;
  document.getElementById('m-cluster').textContent = cluster;
  document.getElementById('m-send').onclick = () => {
    const subj = encodeURIComponent('DRICE Fellowship — Mentorship enquiry');
    const body = encodeURIComponent('Dear Dr. ' + surname + ',\n\nI am a DRICE Research Fellow (Pilot Cohort 1, May Semester 2026) and found your profile through the Daystar expertise map. My proposed paper is in the area of ' + cluster + '.\n\n[Describe your paper and why this mentor is a good fit]\n\nKind regards,\n[Your name]\nDRICE Pilot Cohort 1 · Daystar University');
    window.location.href = 'mailto:' + email + '?cc=drice@daystar.ac.ke&subject=' + subj + '&body=' + body;
    closeContactModal();
  };
  document.getElementById('contactModal').classList.add('open');
}

function closeContactModal() {
  document.getElementById('contactModal').classList.remove('open');
}

// Modal overlay click close hook
document.addEventListener('DOMContentLoaded', () => {
  const cm = document.getElementById('contactModal');
  if (cm) {
    cm.addEventListener('click', (e) => {
      if (e.target === cm) closeContactModal();
    });
  }
});

/* ── ADDITIONAL DU-SPACE PREMIUM UTILITIES ── */

function clearAllFilters() {
  const scFilter = document.getElementById('sc-filter');
  const yrFilter = document.getElementById('yr-filter');
  if (scFilter) scFilter.value = 'all';
  if (yrFilter) yrFilter.value = 'all';
  applyFilters();
}

function exportChartImage(chart, filename) {
  if (!chart) {
    alert("Chart instance not loaded.");
    return;
  }
  const link = document.createElement('a');
  link.href = chart.toBase64Image();
  link.download = filename || 'chart.png';
  link.click();
  showToastNotification(`Successfully exported chart as ${filename || 'chart.png'}`);
}

function exportNetworkSVG() {
  const svgEl = document.getElementById('networkSVG');
  if (!svgEl) {
    alert("Network SVG element not found.");
    return;
  }
  
  // 1. Serialize SVG XML string
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgEl);
  
  // Add XML declaration if not present
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  
  // Add custom styling rules inside SVG so fonts render correctly
  const styleString = `
    <style type="text/css">
      .node-label { font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 600; }
      text { font-family: sans-serif; }
    </style>
  `;
  source = source.replace(/>/, `>${styleString}`);
  
  // 2. Trigger download
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = 'coauthorship_collaboration_network.svg';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  
  showToastNotification("Successfully exported collaboration map as SVG!");
}

function showResearcherDetailsModal(id) {
  // 1. Gather researcher details
  const myPubs = ALL_PUBS.filter(p => (p.authors || '').includes(id));
  if (!myPubs.length) {
    alert("No publications data found for " + id);
    return;
  }
  
  const schoolCounts = {};
  myPubs.forEach(p => {
    if (p.school) schoolCounts[p.school] = (schoolCounts[p.school] || 0) + 1;
  });
  let school = 'Other';
  let maxSc = 0;
  Object.entries(schoolCounts).forEach(([sc, count]) => {
    if (count > maxSc) {
      maxSc = count;
      school = sc;
    }
  });
  
  const fProfile = FACULTY_LIST.find(f => f.name === id);
  const slug = fProfile ? fProfile.slug : slugify(id);
  const lastActive = fProfile ? fProfile.lastActive : Math.max(...myPubs.map(p => p.year || 2026));
  const activeYears = fProfile ? fProfile.activeYears : (myPubs.length ? `${Math.min(...myPubs.map(p => p.year || 2026))}–${lastActive}` : 'Unknown');
  const sdgs = [...new Set(myPubs.flatMap(p => p.sdgs ? p.sdgs.split('|').map(s => s.trim()).filter(Boolean) : []))];
  const verifiedCount = myPubs.filter(p => p.indexing && p.indexing !== 'Verify').length;
  
  // School colors mapping
  const schoolColors = {
    SSEH: '#25AAE1', SOC: '#1D9E75', SBE: '#EF9F27', SHSS: '#E0606F',
    SON: '#7C3AED', SOL: '#BA7517', SASS: '#64748B', SMT: '#639922'
  };
  const col = schoolColors[school] || '#888780';
  const initials = id.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
  
  // Highlight list
  const pubHighlightsHtml = myPubs.slice(0, 4).map(p => `
    <div style="padding: 10px 14px; background: var(--bg-app); border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 8px; text-align:left;">
      <a href="${p.url}" target="_blank" style="font-family:'Outfit', sans-serif; font-size:13px; font-weight:600; color:var(--primary); text-decoration:none; display:block; margin-bottom:4px; line-height:1.4;">${p.title}</a>
      <div style="font-size:10.5px; color:var(--text-muted); display:flex; gap:8px; align-items:center;">
        <span class="badge bgr" style="font-size:9px; padding:1px 5px;">${p.year}</span>
        <span style="background:${p.type==='Journal Article'?'#E6F1FB':p.type==='Conference Paper'?'#EEEDFE':'#FAECE7'}; color:${p.type==='Journal Article'?'#0C447C':p.type==='Conference Paper'?'#3C3489':'#993C1D'}; border:1px solid rgba(0,0,0,0.03); font-size:9px; padding:1px 5px;" class="badge">${p.type}</span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:260px;">${p.publisher}</span>
      </div>
    </div>
  `).join('');
  
  const sdgBadges = sdgs.slice(0, 6).map(s => `<span class="badge b-sdg" style="background:#E1F5EE; color:#085041; margin-right:4px; margin-bottom:4px;">${s}</span>`).join('');
  
  // Create details modal markup
  let modal = document.getElementById('researcher-details-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'researcher-details-modal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.65); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); z-index:700; padding:24px; align-items:center; justify-content:center';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div style="background:#FFFFFF; border-radius:18px; width:100%; max-width:680px; overflow:hidden; border:1px solid var(--border-color); box-shadow:var(--shadow-lg); animation:modalReveal 0.3s ease-out">
      <header class="modal-hdr" style="background:${col}; color:#FFFFFF; border-bottom:none; padding:18px 24px; display:flex; align-items:center;">
        <div style="display:flex; align-items:center; gap:14px; width:100%;">
          <div style="width:46px; height:46px; border-radius:50%; background:rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; font-family:'Outfit', sans-serif; font-size:16px; font-weight:800; color:#FFFFFF; border:1.5px solid rgba(255,255,255,0.85); flex-shrink:0;">${initials}</div>
          <div style="text-align:left;">
            <h3 style="font-size:18px; font-weight:700; color:#FFFFFF; margin:0; font-family:'Outfit',sans-serif;">${id}</h3>
            <div style="font-size:12px; color:rgba(255,255,255,0.85); margin-top:2px;">Faculty &bull; School of ${school} &bull; Active ${activeYears}</div>
          </div>
          <button class="modal-close" onclick="document.getElementById('researcher-details-modal').style.display='none'" style="margin-left:auto; color:#FFFFFF; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-size:14px; cursor:pointer;">✕</button>
        </div>
      </header>
      
      <div class="modal-body" style="padding:24px;">
        <!-- Metrics Cards Row -->
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px;">
          <div style="background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px; text-align:center;">
            <div style="font-family:'Outfit', sans-serif; font-size:22px; font-weight:700; color:var(--neutral-dark);">${myPubs.length}</div>
            <div style="font-size:9px; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-top:2px;">Publications</div>
          </div>
          <div style="background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px; text-align:center;">
            <div style="font-family:'Outfit', sans-serif; font-size:22px; font-weight:700; color:var(--neutral-dark);">${myPubs.filter(p => p.type === 'Journal Article').length}</div>
            <div style="font-size:9px; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-top:2px;">Journals</div>
          </div>
          <div style="background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px; text-align:center;">
            <div style="font-family:'Outfit', sans-serif; font-size:22px; font-weight:700; color:var(--neutral-dark);">${verifiedCount}</div>
            <div style="font-size:9px; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-top:2px;">Indexed (Scopus)</div>
          </div>
          <div style="background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px; text-align:center;">
            <div style="font-family:'Outfit', sans-serif; font-size:22px; font-weight:700; color:var(--neutral-dark);">${lastActive}</div>
            <div style="font-size:9px; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-top:2px;">Last Active</div>
          </div>
        </div>
        
        <!-- SDGs Covered -->
        ${sdgBadges ? `
        <div style="margin-bottom:20px; text-align:left;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Target SDGs Cover</div>
          <div style="display:flex; flex-wrap:wrap;">${sdgBadges}</div>
        </div>` : ''}
        
        <!-- Publication Highlights Section -->
        <div style="margin-bottom:20px; text-align:left;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Publication Highlights</div>
          <div style="max-height:180px; overflow-y:auto; padding-right:4px;">
            ${pubHighlightsHtml}
          </div>
        </div>
        
        <!-- Footer Navigation Options -->
        <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end; gap:10px;">
          <a href="/faculty/${slug}" target="_blank" class="btn-import btn-secondary-theme" style="color:var(--neutral-dark); border-color:var(--border-color); text-decoration:none; padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">View Full Profile &nearr;</a>
          <button class="btn-import btn-primary-theme" onclick="document.getElementById('researcher-details-modal').style.display='none'; openContactModal('${id.replace(/'/g, "\\'")}', 'faculty.${slug}@daystar.ac.ke', 'School of ${school} collaborative research');" style="padding:8px 16px; font-size:12px; background:${col}; border-color:${col};">Contact Researcher &rarr;</button>
        </div>
      </div>
    </div>
  `;
  
  // Close modal when clicking on background overlay
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };
  
  modal.style.display = 'flex';
}

function regenerateTeamWithUI() {
  const container = document.getElementById('team-results-container');
  if (!container) return;
  
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 24px; gap:16px; width:100%;">
      <div style="width:36px; height:36px; border:3.5px solid var(--border-color); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
      <span style="font-size:12px; color:var(--text-muted); font-weight:600; letter-spacing:0.5px;">Re-evaluating researcher profiles...</span>
    </div>
  `;
  
  setTimeout(() => {
    generateTeam();
  }, 550);
}

function saveSuggestedTeam() {
  const selectedClusters = Array.from(document.querySelectorAll('#tb-cluster-picker .cluster-option.selected'))
    .map(el => el.getAttribute('data-cluster'));
  const selectedSDGs = Array.from(document.querySelectorAll('#tb-sdg-picker .sdg-btn.on'))
    .map(el => el.getAttribute('data-sdg'));
    
  const savedConsortium = {
    timestamp: new Date().toLocaleString(),
    schools: selectedClusters,
    sdgs: selectedSDGs,
    memberCount: document.querySelectorAll('.team-card').length
  };
  
  localStorage.setItem('saved_consortium_team', JSON.stringify(savedConsortium));
  showToastNotification('Consortium team configuration successfully saved to your session!');
}

function emailTeamSuggestionToDRICE() {
  const cards = document.querySelectorAll('.team-card');
  if (!cards.length) {
    alert("No team suggestions are currently available. Please configure the team first.");
    return;
  }
  
  const members = [];
  cards.forEach(card => {
    const name = card.querySelector('.tc-name')?.textContent || '';
    const sub = card.querySelector('.tc-sub')?.textContent || '';
    members.push(`- ${name} (${sub})`);
  });
  
  const selectedSDGs = Array.from(document.querySelectorAll('#tb-sdg-picker .sdg-btn.on'))
    .map(el => el.getAttribute('data-sdg')).join(', ');
    
  const subject = encodeURIComponent('Suggested Research Consortium Proposal - DU-Space');
  const body = encodeURIComponent(`Dear DRICE Research Office,

Based on the DU-Space Grant Consortium builder, I would like to propose the following multidisciplinary research team suggestion for our next collaborative grant application:

${members.join('\n')}

Shared SDG alignment: ${selectedSDGs || 'General'}
Consortium size: ${members.length} active researchers

I would welcome a brief discussion on pursuing this opportunity.

Kind regards,
[Your name]
DU-Space Grant Builder`);

  window.location.href = `mailto:drice@daystar.ac.ke?subject=${subject}&body=${body}`;
}

function showToastNotification(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#0F172A; color:#FFFFFF; padding:12px 24px; border-radius:var(--radius-md); font-family:var(--font); font-size:12px; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:var(--shadow-lg); z-index:9999; transform:translateY(100px); opacity:0; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border:1px solid rgba(255,255,255,0.08);';
    document.body.appendChild(toast);
  }
  
  toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.transform = 'translateY(100px)';
    toast.style.opacity = '0';
  }, 3000);
}

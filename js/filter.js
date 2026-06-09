// ============================================================
// Part List Database — filter.js
// ============================================================

// ─── FILTER ───────────────────────────────────────────────────────────────────
function getFilteredParts() {
  const s  = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const cat= (document.getElementById('categoryInput')?.value||'').toLowerCase();
  const m  = (document.getElementById('matInput')?.value||'').toLowerCase();
  const dl = (document.getElementById('dimL')?.value||'').toLowerCase();
  const dw = (document.getElementById('dimW')?.value||'').toLowerCase();
  const dh = (document.getElementById('dimH')?.value||'').toLowerCase();
  return parts.filter(p =>
    (!s   || [p.name,p.code,p.model||'',String(p.displayId)].some(v=>v.toLowerCase().includes(s))) &&
    (!cat || (p.category||'').toLowerCase().includes(cat)) &&
    (!m   || (p.material||'').toLowerCase().includes(m)) &&
    (!dl  || String(p.dim_l).includes(dl)) &&
    (!dw  || String(p.dim_w).includes(dw)) &&
    (!dh  || String(p.dim_h).includes(dh))
  );
}

function resetFilters() {
  ['searchInput','categoryInput','matInput','dimL','dimW','dimH'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  closeSearchDropdown();
  closeCategoryDropdown();
  renderParts();
}

// ─── 검색 자동완성 ─────────────────────────────────────────────
function onSearchInput() {
  renderParts();
  showSearchDropdown();
}

function showSearchDropdown() {
  const input = document.getElementById('searchInput');
  const q = (input?.value || '').trim().toLowerCase();
  let dropdown = document.getElementById('searchDropdown');

  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'searchDropdown';
    dropdown.className = 'search-dropdown';
    input.parentNode.appendChild(dropdown);
  }

  // 후보 수집: 모델명, 품명, CODE NO.
  const seen = new Set();
  const candidates = [];

  parts.forEach(p => {
    [
      { label: p.model,   type: '모델' },
      { label: p.name,    type: '품명' },
      { label: p.code,    type: 'CODE' },
    ].forEach(({ label, type }) => {
      if (!label) return;
      const key = type + '|' + label;
      if (!seen.has(key) && (q === '' || label.toLowerCase().includes(q))) {
        seen.add(key);
        candidates.push({ label, type });
      }
    });
  });

  // 빈 검색어면 모델명만 표시
  const filtered = q === ''
    ? candidates.filter(c => c.type === '모델')
    : candidates;

  if (filtered.length === 0) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = filtered.slice(0, 12).map(c => `
    <div class="search-dropdown-item" onmousedown="selectSearchItem('${escHtml(c.label)}')">
      <span class="search-dropdown-type">${c.type}</span>
      <span class="search-dropdown-label">${escHtml(c.label)}</span>
    </div>`).join('');
  dropdown.style.display = 'block';
}

function selectSearchItem(value) {
  const input = document.getElementById('searchInput');
  if (input) { input.value = value; renderParts(); }
  closeSearchDropdown();
}

function closeSearchDropdown() {
  const d = document.getElementById('searchDropdown');
  if (d) { d.innerHTML = ''; d.style.display = 'none'; }
}

// ─── 아이템군 자동완성 ────────────────────────────────────────
function onCategoryInput() {
  renderParts();
  showCategoryDropdown();
}

function showCategoryDropdown() {
  const input = document.getElementById('categoryInput');
  const q = (input?.value || '').trim().toLowerCase();
  let dropdown = document.getElementById('categoryDropdown');

  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'categoryDropdown';
    dropdown.className = 'search-dropdown';
    input.parentNode.appendChild(dropdown);
  }

  const seen = new Set();
  const candidates = [];
  parts.forEach(p => {
    const cat = (p.category || '').trim();
    if (!cat || cat === '-') return;
    if (!seen.has(cat) && (q === '' || cat.toLowerCase().includes(q))) {
      seen.add(cat);
      candidates.push(cat);
    }
  });

  if (candidates.length === 0) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = candidates.slice(0, 12).map(cat => `
    <div class="search-dropdown-item" onmousedown="selectCategoryItem('${escHtml(cat)}')">
      <span class="search-dropdown-type">구분</span>
      <span class="search-dropdown-label">${escHtml(cat)}</span>
    </div>`).join('');
  dropdown.style.display = 'block';
}

function selectCategoryItem(value) {
  const input = document.getElementById('categoryInput');
  if (input) { input.value = value; renderParts(); }
  closeCategoryDropdown();
}

function closeCategoryDropdown() {
  const d = document.getElementById('categoryDropdown');
  if (d) { d.innerHTML = ''; d.style.display = 'none'; }
}

// ─── 원소재 자동완성 ──────────────────────────────────────────
function onMatInput() {
  renderParts();
  showMatDropdown();
}

function showMatDropdown() {
  const input = document.getElementById('matInput');
  const q = (input?.value || '').trim().toLowerCase();
  let dropdown = document.getElementById('matDropdown');

  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'matDropdown';
    dropdown.className = 'search-dropdown';
    input.parentNode.appendChild(dropdown);
  }

  const seen = new Set();
  const candidates = [];
  parts.forEach(p => {
    const mat = (p.material || '').trim();
    if (!mat || mat === '-') return;
    if (!seen.has(mat) && (q === '' || mat.toLowerCase().includes(q))) {
      seen.add(mat);
      candidates.push(mat);
    }
  });

  if (candidates.length === 0) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = candidates.slice(0, 12).map(mat => `
    <div class="search-dropdown-item" onmousedown="selectMatItem('${escHtml(mat)}')">
      <span class="search-dropdown-type">소재</span>
      <span class="search-dropdown-label">${escHtml(mat)}</span>
    </div>`).join('');
  dropdown.style.display = 'block';
}

function selectMatItem(value) {
  const input = document.getElementById('matInput');
  if (input) { input.value = value; renderParts(); }
  closeMatDropdown();
}

function closeMatDropdown() {
  const d = document.getElementById('matDropdown');
  if (d) { d.innerHTML = ''; d.style.display = 'none'; }
}

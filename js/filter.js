// ============================================================
// Part List Database — filter.js
// ============================================================

// ─── FILTER ───────────────────────────────────────────────────────────────────
function getFilteredParts() {
  const s  = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const m  = (document.getElementById('matInput')?.value||'').toLowerCase();
  const dl = (document.getElementById('dimL')?.value||'').toLowerCase();
  const dw = (document.getElementById('dimW')?.value||'').toLowerCase();
  const dh = (document.getElementById('dimH')?.value||'').toLowerCase();
  return parts.filter(p =>
    (!s || [p.name,p.code,p.model||'',p.approvalDate||'',String(p.displayId),p.category||''].some(v=>v.toLowerCase().includes(s))) &&
    (!m  || (p.material||'').toLowerCase().includes(m)) &&
    (!dl || String(p.dim_l).includes(dl)) &&
    (!dw || String(p.dim_w).includes(dw)) &&
    (!dh || String(p.dim_h).includes(dh))
  );
}

function resetFilters() {
  ['searchInput','matInput','dimL','dimW','dimH'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  closeSearchDropdown();
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

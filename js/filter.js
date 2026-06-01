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
  renderParts();
}

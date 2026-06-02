// ============================================================
// Part List Database — render.js
// ============================================================

// ─── RENDER PARTS ─────────────────────────────────────────────────────────────
function categoryEmoji(cls) {
  if (cls === 'category-brk') return '🔩';
  if (cls === 'category-sub') return '🧩';
  if (cls === 'category-pkg') return '📦';
  return '⚙️';
}

function renderParts() {
  const filtered = getFilteredParts();
  const countEl = document.getElementById('partsCount');
  const grid = document.getElementById('partsGrid');
  if (!grid) return;

  const assemblyCount = filtered.filter(p => p.isAssembly).length;
  const subCount = filtered.filter(p => p.isSub).length;
  countEl.innerHTML = `<span>${filtered.length}</span> / ${parts.length} 개 항목 &nbsp;·&nbsp; 완제품 <span>${assemblyCount}</span> &nbsp;·&nbsp; 하위자재 <span>${subCount}</span>`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <h3>${parts.length === 0 ? '데이터가 없습니다' : '검색 결과가 없습니다'}</h3>
      <p>${parts.length === 0 ? '엑셀 파일을 업로드하면 부품 리스트가 표시됩니다.' : '다른 검색어나 필터를 시도해 보세요.'}</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isAssy = p.isAssembly;
    const isSub  = p.isSub;
    const cardClass = `part-card${isAssy ? ' is-assembly' : ''}${isSub ? ' is-sub' : ''}`;
    const catCls = p.categoryClass || 'category-other';
    const catLabel = p.category || '–';
    const noValClass = isAssy ? 'part-no-val assy-no' : 'part-no-val';
    const isBobbin = (p.name||'').toUpperCase().includes('BOBBIN');
    const trayLabel = isBobbin ? '릴 업체명' : 'TRAY입수';
    const trayFontSize = String(p.tray_qty||'').length > 5 ? '8px' : '11px';
    const setFontSize = String(p.set_qty).length > 4 ? '9px' : '13px';
    const weightVal = p.weight_g != null && p.weight_g !== '-' ? p.weight_g : '–';

    return `
    <div class="${cardClass}" id="card_${p.id}">
      <button class="btn-delete" onclick="askDelete('${p.id}')" title="삭제">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>

      <div class="part-no">
        <div class="part-no-label">전체</div>
        <div class="part-no-val" style="font-size:26px;color:var(--text);">${p.globalNo}</div>
        <div class="part-no-divider"></div>
        <div class="part-no-label" style="margin-top:5px;">NO</div>
        <div class="${noValClass}">${escHtml(String(p.displayId))}</div>
        ${isAssy ? '<div class="assy-badge">ASSY<br>완제품</div>' : ''}
      </div>

      ${isSub ? '' : `<div class="part-img-col">
        ${p.imageUrl
          ? `<div class="part-img-wrap">
              <img src="${p.imageUrl}" alt="${escHtml(p.name)}" onclick="openZoom('${p.id}')" />
              <div class="img-zoom-icon">🔍</div>
              <button class="img-remove" onclick="removeImage('${p.id}')" title="이미지 삭제">✕</button>
            </div>`
          : `<label class="img-upload-label" ondragover="event.preventDefault()" ondrop="handleImgDrop(event,'${p.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>Drag or Click</span>
              <input type="file" accept="image/*" style="display:none" onchange="handleImgFile(event,'${p.id}')" />
            </label>`
        }
      </div>`}

      <div class="part-info">
        ${p.model ? `<div class="part-model-label">${escHtml(p.model)}</div>` : ''}
        <div class="part-tags">
          <span class="tag ${catCls}">${categoryEmoji(catCls)} ${escHtml(catLabel)}</span>
          <span class="tag date" onclick="startEdit('${p.id}','approvalDate')" title="클릭하여 편집">
            📅 <span id="field_${p.id}_approvalDate">${escHtml(p.approvalDate||'–')}</span>
          </span>
        </div>
        <div class="part-name" onclick="startEdit('${p.id}','name')">
          <span id="field_${p.id}_name">${escHtml(p.name)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div class="part-code"># ${escHtml(p.code)}</div>
        <div class="part-specs">
          <div class="spec-group">
            <div class="spec-label">원소재</div>
            <div class="spec-val">${escHtml(String(p.material||'–'))}</div>
          </div>
          <div class="spec-group">
            <div class="spec-label">규격</div>
            <div class="spec-val">T:${p.thickness} / W:${p.width_raw} / P:${p.pitch}</div>
          </div>
        </div>
        <div class="spec-dims">
          ${['l','w','h'].map(d=>`
            <div class="dim-box">
              <div class="dim-box-label">${d==='l'?'가로':d==='w'?'세로':'높이'}</div>
              <div class="dim-box-val">${p['dim_'+d]}</div>
            </div>`).join('')}
          <div class="dim-box dim-box-accent">
            <div class="dim-box-label">CAV</div>
            <div class="dim-box-val">${p.cav != null && p.cav !== '-' ? escHtml(String(p.cav)) : '-'}</div>
          </div>
          <div class="dim-box dim-box-accent">
            <div class="dim-box-label">SET소요</div>
            <div class="dim-box-val" style="font-size:${setFontSize}">${p.set_qty != null && p.set_qty !== '-' ? escHtml(typeof p.set_qty === 'number' && p.set_qty < 1 ? p.set_qty.toFixed(5) : String(p.set_qty)) : '-'}</div>
          </div>
          ${p.tray_qty != null ? `
          <div class="dim-box dim-box-pkg">
            <div class="dim-box-label">${trayLabel}</div>
            <div class="dim-box-val" style="font-size:${trayFontSize}">${escHtml(String(p.tray_qty))}</div>
          </div>` : ''}
          <div class="dim-box dim-box-weight">
            <div class="dim-box-label">Weight</div>
            <div class="dim-box-val">${escHtml(String(weightVal))}<span style="font-size:9px;font-weight:600;opacity:0.7"> g</span></div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

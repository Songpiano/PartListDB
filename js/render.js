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
  // 손상/유령 데이터(이름은 있으나 코드·모델·NO가 모두 비어있는 항목) 제거
  const isGhost = (p) => {
    const noCode = !p.code || !String(p.code).trim();
    const noModel = !p.model || !String(p.model).trim() || String(p.model).trim() === '-';
    const noDisplay = !p.displayId || !String(p.displayId).trim() || String(p.displayId).trim() === '-';
    return noCode && noModel && noDisplay;
  };
  const filtered = getFilteredParts().filter(p => !isGhost(p) && ((p.name && p.name.trim()) || (p.code && p.code.trim())));
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

  // ASSY별 하위 항목 부모 ID 매핑 + 하위코드 보유 여부 집계
  let currentAssyId = null;
  const assyHasSubs = new Set();
  filtered.forEach(p => {
    if (p.isAssembly) currentAssyId = p.id;
    else if (p.isSub) {
      p._assyParentId = currentAssyId;
      if (currentAssyId) assyHasSubs.add(currentAssyId);
    }
  });

  let gridHtml = '';
  let inSubGroup = false;
  filtered.forEach(p => {
    const isAssy = p.isAssembly;
    const isSub  = p.isSub;
    const hasSubs = isAssy && assyHasSubs.has(p.id);
    const cardClass = isSub ? 'sub-row' : `part-card${isAssy ? ' is-assembly' : ''}`;
    const catCls = p.categoryClass || 'category-other';
    const catLabel = p.category || '–';
    const noValClass = isAssy ? 'part-no-val assy-no' : 'part-no-val';
    const isBobbin = (p.name||'').toUpperCase().includes('BOBBIN');
    const trayLabel = isBobbin ? '릴 업체명' : 'TRAY입수';
    const trayFontSize = String(p.tray_qty||'').length > 5 ? '8px' : '11px';
    const setFontSize = String(p.set_qty).length > 4 ? '9px' : '13px';
    const weightVal = p.weight_g != null && p.weight_g !== '-' ? p.weight_g : '–';
    const assyAttr  = isAssy ? `data-assy-id="${p.id}"` : '';
    const subAttr   = (isSub && p._assyParentId) ? `data-parent-assy="${p._assyParentId}"` : '';

    // 하위코드(2-1, 2-2, 2-3...)는 개별 카드 대신 하나의 그룹 박스 안에
    // 행(row) 형태로 묶어서 시인성을 높임
    if (isSub && !inSubGroup) { gridHtml += '<div class="sub-group">'; inSubGroup = true; }
    if (!isSub && inSubGroup) { gridHtml += '</div>'; inSubGroup = false; }

    // ── SUB 항목: 상위카드 컬럼 너비 그대로 맞춤 ───────────────
    if (isSub) {
      gridHtml += `
      <div class="sub-row" id="card_${p.id}" ${subAttr}>
        <button class="btn-delete" onclick="askDelete('${p.id}')" title="삭제">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>

        <div class="part-no">
          <div class="part-no-label">NO</div>
          <div class="part-no-val">${escHtml(String(p.displayId))}</div>
        </div>

        <div class="sub-img-spacer"></div>

        <div class="part-info">
          <div class="part-main">
            <div class="part-tags">
              <span class="tag ${catCls}">${categoryEmoji(catCls)} ${escHtml(catLabel)}</span>
            </div>
            <div class="part-name"><span id="field_${p.id}_name">${escHtml(p.name)}</span></div>
            <div class="part-code">CODE: ${escHtml(p.code)}</div>
          </div>
          <div class="part-specs-right">
            <div class="spec-inline-group spec-material">
              <div class="spec-label">원소재</div>
              <div class="spec-val">${escHtml(String(p.material||'–'))}</div>
            </div>
            <div class="spec-inline-group spec-dimension">
              <div class="spec-label">규격</div>
              <div class="spec-val">T:${p.thickness} / W:${p.width_raw} / P:${p.pitch}</div>
            </div>
            <div class="spec-divider"></div>
            ${['l','w','h'].map(d=>`
              <div class="dim-box">
                <div class="dim-box-label">${d==='l'?'가로':d==='w'?'세로':'높이'}</div>
                <div class="dim-box-val">${p['dim_'+d]}</div>
              </div>`).join('')}
            <div class="dim-box dim-box-mold">
              <div class="dim-box-label">금형TYPE</div>
              <div class="dim-box-val">${p.moldType && p.moldType !== '-' ? escHtml(p.moldType) : '-'}</div>
            </div>
            <div class="dim-box dim-box-accent">
              <div class="dim-box-label">CAV</div>
              <div class="dim-box-val">${p.cav != null && p.cav !== '-' ? escHtml(String(p.cav)) : '-'}</div>
            </div>
            <div class="dim-box dim-box-accent">
              <div class="dim-box-label">SET소요</div>
              <div class="dim-box-val" style="font-size:${setFontSize}">${p.set_qty != null && p.set_qty !== '-' ? (() => { const v = parseFloat(p.set_qty); return isNaN(v) ? String(p.set_qty) : (v < 1 ? v.toFixed(4) : String(p.set_qty)); })() : '-'}</div>
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
      return;
    }

    // ── ASSY / 일반 카드 ─────────────────────────────────────
    gridHtml += `
    <div class="${cardClass}" id="card_${p.id}" ${assyAttr} ${subAttr}
      ${hasSubs ? `onclick="toggleSubParts('${p.id}', event)" style="cursor:pointer;"` : ''}>
      <button class="btn-delete" onclick="askDelete('${p.id}')" title="삭제">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>

      <div class="part-no">
        <div class="part-no-model"><span class="part-field-label">모델명 :</span> ${escHtml(p.model||'–')}</div>
        <div class="part-no-divider"></div>
        <div class="part-no-label" style="margin-top:5px;">NO</div>
        <div class="${noValClass}">${escHtml(String(p.displayId))}</div>
        ${isAssy ? `<div class="assy-badge">ASSY<br>완제품</div>
        <div class="assy-toggle-wrap${hasSubs ? '' : ' is-hidden'}">
          <div class="assy-toggle-arrow" id="arrow_${p.id}">▾</div>
          <div class="assy-toggle-label" id="arrowLabel_${p.id}">하위코드 숨김</div>
        </div>` : ''}
      </div>

      <div class="part-img-col">
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
      </div>

      <div class="part-info">
        <div class="part-main">
          <div class="part-tags">
            <span class="tag ${catCls}">${categoryEmoji(catCls)} ${escHtml(catLabel)}</span>
            <span class="tag date">
              📅 승인 일자 <span id="field_${p.id}_approvalDate">${escHtml(p.approvalDate||'–')}</span>
            </span>
          </div>
          <div class="part-name">
            <span class="part-field-label">품명 :</span> <span id="field_${p.id}_name">${escHtml(p.name)}</span>
          </div>
          <div class="part-code">CODE: ${escHtml(p.code)}</div>
        </div>
        <div class="part-specs-right">
          <div class="spec-inline-group spec-material">
            <div class="spec-label">원소재</div>
            <div class="spec-val">${escHtml(String(p.material||'–'))}</div>
          </div>
          <div class="spec-inline-group spec-dimension">
            <div class="spec-label">규격</div>
            <div class="spec-val">T:${p.thickness} / W:${p.width_raw} / P:${p.pitch}</div>
          </div>
          <div class="spec-divider"></div>
          ${['l','w','h'].map(d=>`
            <div class="dim-box">
              <div class="dim-box-label">${d==='l'?'가로':d==='w'?'세로':'높이'}</div>
              <div class="dim-box-val">${p['dim_'+d]}</div>
            </div>`).join('')}
          <div class="dim-box dim-box-mold">
            <div class="dim-box-label">금형TYPE</div>
            <div class="dim-box-val">${p.moldType && p.moldType !== '-' ? escHtml(p.moldType) : '-'}</div>
          </div>
          <div class="dim-box dim-box-accent">
            <div class="dim-box-label">CAV</div>
            <div class="dim-box-val">${p.cav != null && p.cav !== '-' ? escHtml(String(p.cav)) : '-'}</div>
          </div>
          <div class="dim-box dim-box-accent">
            <div class="dim-box-label">SET소요</div>
            <div class="dim-box-val" style="font-size:${setFontSize}">${p.set_qty != null && p.set_qty !== '-' ? (() => { const v = parseFloat(p.set_qty); return isNaN(v) ? String(p.set_qty) : (v < 1 ? v.toFixed(4) : String(p.set_qty)); })() : '-'}</div>
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
      <div class="part-manager-col">
        <div class="part-manager-label">담당자</div>
        <div class="part-manager-name"><span id="field_${p.id}_manager">${escHtml(p.manager||'–')}</span></div>
      </div>
    </div>`;
  });
  if (inSubGroup) gridHtml += '</div>';
  grid.innerHTML = gridHtml;
}

// ─── ASSY 하위 토글 ───────────────────────────────────────────
function toggleSubParts(assyId, e) {
  // 삭제 버튼·편집 클릭은 무시
  if (e && e.target.closest('.btn-delete, .part-name, .part-code, .tag.date, .inline-edit')) return;
  const subs  = document.querySelectorAll(`[data-parent-assy="${assyId}"]`);
  if (!subs.length) return;
  const arrow = document.getElementById('arrow_' + assyId);
  const label = document.getElementById('arrowLabel_' + assyId);
  const isHidden = subs[0].style.display === 'none';
  subs.forEach(el => { el.style.display = isHidden ? '' : 'none'; });
  if (arrow) arrow.textContent = isHidden ? '▾' : '▸';
  if (label) label.textContent = isHidden ? '하위코드 숨김' : '하위코드 표시';
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── RENDER STATUS ────────────────────────────────────────────────────────────
function renderStatus() {
  const container = document.getElementById('timelineGrid');
  if (!container) return;

  const yearMap = {};
  parts.forEach(p => {
    const raw   = String(p.approvalDate || '').trim();
    const sp    = raw.split('.');
    const year  = sp[0] || '미지정';
    const month = sp[1] ? sp[1].padStart(2,'0') : '00';
    const model = p.model || '미지정';

    if (!yearMap[year]) yearMap[year] = { year, models: {}, totalParts: 0 };
    if (!yearMap[year].models[model]) yearMap[year].models[model] = { parts: [], months: new Set(), cats: {} };

    const md = yearMap[year].models[model];
    md.parts.push(p);
    if (month !== '00') md.months.add(month);
    const cat = p.category || '기타';
    md.cats[cat] = (md.cats[cat] || 0) + 1;
    yearMap[year].totalParts++;
  });

  const MONTH_KO = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const years = Object.values(yearMap).sort((a,b) => b.year.localeCompare(a.year));

  if (years.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <h3>데이터를 업로드하면 연간 현황이 생성됩니다.</h3>
    </div>`;
    return;
  }

  container.innerHTML = years.map((yg, yi) => {
    const isOpen = yi === 0;
    // 빠른 월 기준 정렬 (같은 월이면 모델명 순)
    const modelList = Object.entries(yg.models).sort((a,b) => {
      const minA = [...a[1].months].sort()[0] || '99';
      const minB = [...b[1].months].sort()[0] || '99';
      return minA !== minB ? minA.localeCompare(minB) : a[0].localeCompare(b[0]);
    });

    // Total 집계
    const totalAssyCount = modelList.reduce((s,[,md]) => s + md.parts.filter(p=>p.isAssembly).length, 0);
    const totalSubCount  = modelList.reduce((s,[,md]) => s + md.parts.filter(p=>p.isSub).length, 0);
    const totalPartCount = totalAssyCount + totalSubCount;

    const tableRows = modelList.map(([model, md]) => {
      const assyCount = md.parts.filter(p => p.isAssembly).length;
      const subCount  = md.parts.filter(p => p.isSub).length;
      const monthsSorted = [...md.months].sort();
      const approvalStr = monthsSorted.map(m => MONTH_KO[parseInt(m)] || m+'월').join(', ') || '미지정';
      const catStr = Object.entries(md.cats).map(([c,n]) => `<span class="status-cat-badge">${escHtml(c)} <strong>${n}</strong></span>`).join('');
      const imgs = md.parts.filter(p => p.imageUrl).slice(0,1);

      return `<tr class="status-model-row" onclick="navigateToModel('${escHtml(model)}')" title="부품 리스트 보기">
        <td class="status-td-model">
          <div class="status-model-name">
            ${imgs.length ? `<img class="status-model-thumb" src="${imgs[0].imageUrl}" />` : '<div class="status-model-icon">📱</div>'}
            <span>${escHtml(model)}</span>
          </div>
        </td>
        <td class="status-td-cat">${catStr}</td>
        <td class="status-td-num"><span class="status-num assy">${assyCount}</span></td>
        <td class="status-td-num"><span class="status-num sub">${subCount}</span></td>
        <td class="status-td-approval">${escHtml(approvalStr)}</td>
        <td class="status-td-goto">
          <span class="status-goto-btn">보기 →</span>
          <span class="status-dl-btn" onclick="event.stopPropagation();downloadModelXlsx('${escHtml(model)}')" title="파트리스트 엑셀 다운로드"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 다운로드</span>
<span class="status-del-btn" onclick="event.stopPropagation();askDeleteModel('${escHtml(model)}')" title="모델 삭제"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> 삭제</span>
        </td>
      </tr>`;
    }).join('');

    return `<div class="year-block ${isOpen ? 'open' : ''}">
      <button class="year-accordion" onclick="toggleYear(this)">
        <div class="year-accordion-left">
          <div class="year-accordion-dot"></div>
          <div>
            <div class="year-label">${yg.year} YEAR</div>
            <div class="year-title">${yg.year}년 개발 내역</div>
          </div>
        </div>
        <div class="year-accordion-right">
          <div class="year-stats">
            <div class="stat-pill"><div class="stat-pill-label">Models</div><div class="stat-pill-val">${modelList.length}</div></div>
            <div class="stat-pill"><div class="stat-pill-label">Parts</div><div class="stat-pill-val">${yg.totalParts}</div></div>
          </div>
          <div class="year-chevron">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </button>
      <div class="year-body">
        <div class="year-group">
          <table class="status-table">
            <thead><tr>
              <th>모델명</th><th>품목별</th><th>ASSY PART</th><th>하위품 PART</th><th>승인시점</th><th></th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr class="status-total-row">
                <td class="status-td-model status-total-label">
                  <div class="status-total-model-wrap">
                    <div class="status-total-models-label">승인 모델</div>
                    <span class="status-num assy status-total-num">${modelList.length}</span>
                    <div class="status-total-models-unit">개</div>
                  </div>
                </td>
                <td class="status-td-cat"></td>
                <td class="status-td-num"><span class="status-num assy status-total-num">${totalAssyCount}</span></td>
                <td class="status-td-num"><span class="status-num sub status-total-num">${totalSubCount}</span></td>
                <td class="status-td-approval status-total-sum">총 코드 <strong>${totalPartCount}</strong>개</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 월별 승인 모델 그래프 -->
        <div class="monthly-chart">
          <div class="monthly-chart-title">📅 월별 승인 현황 <span class="monthly-chart-total">총 ${modelList.length}개 모델 승인완료</span></div>
          ${(()=>{
            const months = Array.from({length:12},(_,i)=>{
              const m = String(i+1).padStart(2,'0');
              return modelList.filter(([,md])=>md.months.has(m));
            });
            const maxCount = Math.max(...months.map(m=>m.length), 1);
            const W = 780, H = 110, padL = 28, padR = 12, padT = 12, padB = 0;
            const cols = 12;
            const xStep = (W - padL - padR) / (cols - 1);
            const points = months.map((m,i)=>{
              const x = padL + i * xStep;
              const y = padT + (1 - m.length / maxCount) * (H - padT - padB);
              return {x, y, models: m, count: m.length};
            });
            const polyline = points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const area = `${points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} ${points[11].x.toFixed(1)},${H} ${points[0].x.toFixed(1)},${H}`;
            const dots = points.map((p,i)=>`
              <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.count?5:3}" fill="${p.count?'var(--accent)':'var(--border2)'}" stroke="var(--surface2)" stroke-width="2" class="monthly-dot" data-month="${i+1}" style="cursor:${p.count?'pointer':'default'}"/>
              ${p.count?`<text x="${p.x.toFixed(1)}" y="${(p.y-9).toFixed(1)}" text-anchor="middle" class="monthly-dot-label">${p.count}</text>`:''}
            `).join('');
            const xLabels = points.map((p,i)=>`<text x="${p.x.toFixed(1)}" y="${H+14}" text-anchor="middle" class="monthly-x-label">${i+1}월</text>`).join('');
            const modelTags = months.map((m,i)=>
              m.length ? `<div class="monthly-month-tags" data-month="${i+1}">
                ${m.map(([model])=>`<div class="monthly-model-tag" onclick="navigateToModel('${escHtml(model)}')">${escHtml(model)}</div>`).join('')}
              </div>` : `<div class="monthly-month-tags monthly-month-tags-empty" data-month="${i+1}"><span class="monthly-none">-</span></div>`
            ).join('');
            return `
            <div class="monthly-line-wrap">
              <svg viewBox="0 0 ${W} ${H+20}" class="monthly-line-svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
                  </linearGradient>
                </defs>
                <polygon points="${area}" fill="url(#lineAreaGrad)"/>
                <polyline points="${polyline}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
                ${dots}
                ${xLabels}
              </svg>
            </div>
            <div class="monthly-tags-row">${modelTags}</div>`;
          })()}
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleYear(btn) {
  const block = btn.closest('.year-block');
  block.classList.toggle('open');
}

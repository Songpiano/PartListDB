// ============================================================
// Part List Database — sheets.js
// Google Sheets 연동 (GAS API)
// ============================================================

// ─── GOOGLE SHEETS 연동 ───────────────────────────────────────────────────────
const GAS_URL_KEY = 'partlist_gas_url';
const GAS_DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbxe5tE07aIlsZMj2E1zNx5Hd_7zrxHbDLCjWdvwWecZepi0-AowjiaQaoEkYW1UpTh2nA/exec';
let gasUrl    = localStorage.getItem(GAS_URL_KEY) || GAS_DEFAULT_URL;
// 기본 URL을 localStorage에 저장
if (!localStorage.getItem(GAS_URL_KEY)) localStorage.setItem(GAS_URL_KEY, GAS_DEFAULT_URL);
let gasSyncing = false;

function initGasBadge() {
  const badge = document.getElementById('gasSyncBadge');
  if (!badge) return;
  if (gasUrl) {
    badge.style.display = 'flex';
    badge.className = 'gas-sync-badge active';
    badge.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:var(--green);flex-shrink:0;animation:pulse 2s infinite;"></span> Sheets 연동중';
  } else {
    badge.style.display = 'none';
  }
}

function openGasModal() {
  document.getElementById('gasUrlInput').value = gasUrl;
  document.getElementById('gasStatusDot').className  = 'gas-status-dot connected';
  document.getElementById('gasStatusText').textContent = gasUrl ? '✓ URL이 설정되어 있습니다.' : 'URL을 입력 후 연결 테스트를 해주세요.';
  document.getElementById('gasStatusText').style.color = gasUrl ? 'var(--green)' : '';
  document.getElementById('gasModal').classList.add('open');
}
function closeGasModal() { document.getElementById('gasModal').classList.remove('open'); }

async function testGasConnection() {
  const url = document.getElementById('gasUrlInput').value.trim();
  if (!url) return;
  const dot  = document.getElementById('gasStatusDot');
  const text = document.getElementById('gasStatusText');
  dot.className    = 'gas-status-dot';
  text.textContent = '연결 테스트 중...';
  text.style.color = '';
  try {
    const json = await gasJsonp({ action: 'getAll' }, url);
    dot.className    = 'gas-status-dot connected';
    text.textContent = `✓ 연결 성공! 저장된 항목: ${(json.parts||[]).length}개`;
    text.style.color = 'var(--green)';
  } catch(e) {
    dot.className    = 'gas-status-dot error';
    text.textContent = '✗ 연결 실패 — Apps Script 코드를 새 버전으로 재배포했는지 확인하세요.';
    text.style.color = 'var(--rose)';
  }
}

async function saveGasUrl() {
  const url = document.getElementById('gasUrlInput').value.trim();
  if (!url) return;
  gasUrl = url;
  localStorage.setItem(GAS_URL_KEY, gasUrl);
  closeGasModal();
  initGasBadge();
  await syncToSheets();
}

function disconnectGas() {
  gasUrl = '';
  localStorage.removeItem(GAS_URL_KEY);
  closeGasModal();
  initGasBadge();
  showSyncStatus('Sheets 연동 해제됨', 'info');
}

// ── JSONP 요청 (CORS 우회) ────────────────────────────────────
function gasJsonp(params, overrideUrl) {
  return new Promise((resolve, reject) => {
    const cbName = 'gasCb_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    const url    = new URL(overrideUrl || gasUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v ?? '')));
    url.searchParams.set('callback', cbName);

    const timer = setTimeout(() => {
      delete window[cbName];
      script.remove();
      reject(new Error('JSONP timeout'));
    }, 10000);

    window[cbName] = (data) => {
      clearTimeout(timer);
      delete window[cbName];
      script.remove();
      try { resolve(typeof data === 'string' ? JSON.parse(data) : data); }
      catch(e) { reject(e); }
    };

    const script = document.createElement('script');
    script.src    = url.toString();
    script.onerror = () => { clearTimeout(timer); delete window[cbName]; reject(new Error('Script load error')); };
    document.head.appendChild(script);
  });
}

// ── 전체 동기화 (JSONP, 항목별 upsert) ───────────────────────
async function syncToSheets() {
  if (!gasUrl || gasSyncing) return;
  gasSyncing = true;
  showSyncStatus('Sheets 동기화 중...', 'info');
  try {
    const partsData = parts.map(p => ({ ...p, imageUrl: null }));

    await gasJsonp({ action: 'clearAll' });

    for (let i = 0; i < partsData.length; i++) {
      await gasJsonp({ action: 'upsert', part: JSON.stringify(partsData[i]) });
      if (i % 5 === 0) showSyncStatus(`저장 중... (${i+1}/${partsData.length})`, 'info');
    }

    showSyncStatus(`Sheets 저장 완료 (${partsData.length}건)`, 'success');
  } catch(e) {
    showSyncStatus('Sheets 저장 실패: ' + e.message, 'error');
    console.error('syncToSheets:', e);
  } finally { gasSyncing = false; }
}

async function loadFromSheets() {
  if (!gasUrl) return false;
  showSyncStatus('Sheets에서 불러오는 중...', 'info');
  try {
    const json = await gasJsonp({ action: 'getAll' });
    if (json.ok && json.parts && json.parts.length > 0) {
      parts = json.parts;
      parts.forEach((p, i) => { p.globalNo = i + 1; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
      showSyncStatus(`Sheets에서 ${parts.length}건 불러옴`, 'success');
      return true;
    }
    showSyncStatus('로컬 저장됨', 'success');
    return false;
  } catch(e) {
    showSyncStatus('Sheets 불러오기 실패', 'error');
    return false;
  }
}

async function updateImageOnSheets(id, imageUrl) {
  if (!gasUrl) return;
  try { await gasJsonp({ action: 'updateImage', id, imageUrl: imageUrl || '' }); }
  catch(e) { console.warn('이미지 Sheets 업데이트 실패:', e); }
}

async function updateFieldOnSheets(id, field, value) {
  if (!gasUrl) return;
  try { await gasJsonp({ action: 'updateField', id, field, value }); }
  catch(e) { console.warn('필드 Sheets 업데이트 실패:', e); }
}

let bulkQueue = []; // [{ file, dataUrl, partId, partName, matched }]

function openBulkModal() {
  bulkQueue = [];
  document.getElementById('bulkResults').innerHTML = '';
  document.getElementById('bulkSummary').innerHTML = '';
  document.getElementById('bulkApplyBtn').disabled = true;
  document.getElementById('bulkFileInput').value = '';
  document.getElementById('bulkImgModal').classList.add('open');
}
function closeBulkModal() {
  document.getElementById('bulkImgModal').classList.remove('open');
  bulkQueue = [];
}
function bulkDragOver(e) { e.preventDefault(); document.getElementById('bulkDropZone').classList.add('drag-over'); }
function bulkDragLeave(e) { document.getElementById('bulkDropZone').classList.remove('drag-over'); }
function bulkDrop(e) {
  e.preventDefault();
  document.getElementById('bulkDropZone').classList.remove('drag-over');
  processBulkFiles([...e.dataTransfer.files]);
}
function bulkFileSelect(e) { processBulkFiles([...e.target.files]); }

function matchPartByFilename(filename) {
  // 확장자 제거
  const base = filename.replace(/\.[^.]+$/, '').trim();
  const baseUp = base.toUpperCase();

  // 1순위: CODE NO. 완전 일치
  let found = parts.find(p => p.code && p.code.toUpperCase() === baseUp);
  if (found) return found;

  // 2순위: CODE NO. 포함
  found = parts.find(p => p.code && baseUp.includes(p.code.toUpperCase()));
  if (found) return found;

  // 3순위: 파일명이 CODE NO.를 포함
  found = parts.find(p => p.code && p.code.toUpperCase().includes(baseUp));
  if (found) return found;

  // 4순위: 품명 포함 (공백 제거 비교)
  const baseClean = baseUp.replace(/[\s\-_]/g,'');
  found = parts.find(p => {
    const nameClean = (p.name||'').toUpperCase().replace(/[\s\-_]/g,'');
    return nameClean && (baseClean.includes(nameClean) || nameClean.includes(baseClean));
  });
  return found || null;
}

function processBulkFiles(files) {
  const imgFiles = files.filter(f => f.type.startsWith('image/'));
  if (!imgFiles.length) return;

  bulkQueue = [];
  let loaded = 0;

  imgFiles.forEach(file => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const matchedPart = matchPartByFilename(file.name);
      bulkQueue.push({
        file,
        dataUrl: reader.result,
        partId:   matchedPart ? matchedPart.id   : null,
        partName: matchedPart ? matchedPart.name : null,
        partCode: matchedPart ? matchedPart.code : null,
        matched:  !!matchedPart
      });
      loaded++;
      if (loaded === imgFiles.length) renderBulkResults();
    };
    reader.readAsDataURL(file);
  });
}

function renderBulkResults() {
  const matchedCount   = bulkQueue.filter(q => q.matched).length;
  const unmatchedCount = bulkQueue.length - matchedCount;

  const resultsEl = document.getElementById('bulkResults');
  resultsEl.innerHTML = bulkQueue.map((q, i) => `
    <div class="bulk-result-row ${q.matched ? 'matched' : 'unmatched'}">
      <img class="bulk-result-thumb" src="${q.dataUrl}" />
      <div class="bulk-result-fname" title="${escHtml(q.file.name)}">${escHtml(q.file.name)}</div>
      ${q.matched
        ? `<div class="bulk-result-partname" title="${escHtml(q.partName||'')}">${escHtml(q.partCode||'')} ${escHtml(q.partName||'')}</div>
           <div class="bulk-result-match ok">✓ 매칭</div>`
        : `<div class="bulk-result-match ng">✗ 미매칭</div>`
      }
    </div>
  `).join('');

  document.getElementById('bulkSummary').innerHTML =
    `총 ${bulkQueue.length}개 &nbsp;·&nbsp; <strong>${matchedCount}개 매칭</strong>${unmatchedCount > 0 ? ` &nbsp;·&nbsp; <span class="ng">${unmatchedCount}개 미매칭</span>` : ''}`;

  document.getElementById('bulkApplyBtn').disabled = matchedCount === 0;
}

function bulkApply() {
  const toApply = bulkQueue.filter(q => q.matched);
  if (!toApply.length) return;

  toApply.forEach(q => {
    const part = parts.find(p => p.id === q.partId);
    if (part) part.imageUrl = q.dataUrl;
  });

  saveParts();
  renderParts();
  closeBulkModal();
  showSyncStatus(`이미지 ${toApply.length}개 저장됨`, 'success');
}
function navigateToModel(model) {
  switchTab('list');
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = model;
    // 살짝 딜레이 후 하이라이트 애니메이션
    setTimeout(() => {
      input.focus();
      input.select();
    }, 200);
  }
  renderParts();

  // 리스트 상단으로 스크롤
  setTimeout(() => {
    const grid = document.getElementById('partsGrid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}
function renderStatus() {
  const container = document.getElementById('timelineGrid');
  if (!container) return;

  // ── 데이터 집계: 년도 → 월 → 모델 ──
  const yearMap = {};
  parts.forEach(p => {
    const raw = (p.approvalDate || '').trim();
    const parts2 = raw.split('.');
    const year  = parts2[0] || '미지정';
    const month = parts2[1] ? parts2[1].padStart(2,'0') : '00';
    const model = p.model || '미지정';

    if (!yearMap[year]) yearMap[year] = { year, months: {}, totalParts: 0, totalModels: new Set() };
    if (!yearMap[year].months[month]) yearMap[year].months[month] = { month, models: {}, totalParts: 0 };
    if (!yearMap[year].months[month].models[model]) yearMap[year].months[month].models[model] = { parts: [] };
    yearMap[year].months[month].models[model].parts.push(p);
    yearMap[year].months[month].totalParts++;
    yearMap[year].totalParts++;
    yearMap[year].totalModels.add(model);
  });

  const years = Object.values(yearMap).sort((a,b) => b.year.localeCompare(a.year));

  if (years.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <h3>데이터를 업로드하면 연간 현황이 생성됩니다.</h3>
    </div>`;
    return;
  }

  const MONTH_KO = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  container.innerHTML = years.map((yg, yi) => {
    const isOpen = yi === 0; // 가장 최신 년도만 기본 열림
    const monthsSorted = Object.entries(yg.months).sort((a,b) => a[0].localeCompare(b[0]));

    const monthsHtml = monthsSorted.map(([month, mg]) => {
      const monthLabel = month === '00' ? '월 미지정' : (MONTH_KO[parseInt(month)] || month+'월');
      const modelCards = Object.entries(mg.models).map(([model, md]) => {
        const imgs      = md.parts.filter(p=>p.imageUrl).slice(0,4);
        const extra     = md.parts.filter(p=>p.imageUrl).length - 4;
        const assyCount = md.parts.filter(p=>p.isAssembly).length;
        const subCount  = md.parts.filter(p=>p.isSub).length;
        return `<div class="model-card" onclick="navigateToModel('${escHtml(model)}')" title="${escHtml(model)} 부품 리스트 보기">
          <div class="model-card-top">
            <div class="model-icon">📱</div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px;color:var(--text3)"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="model-name">${escHtml(model)}</div>
          <div class="model-parts-count">Parts <strong style="color:var(--text)">${md.parts.length}</strong> Items</div>
          <div class="model-parts-detail">
            ${assyCount > 0 ? `<span class="mpd-badge assy">완제품 ${assyCount}</span>` : ''}
            ${subCount  > 0 ? `<span class="mpd-badge sub">하위 ${subCount}</span>`  : ''}
          </div>
          ${imgs.length > 0 ? `<div class="model-imgs">
            ${imgs.map(p=>`<div class="model-img-thumb"><img src="${p.imageUrl}" /></div>`).join('')}
            ${extra > 0 ? `<div class="model-img-more">+${extra}</div>` : ''}
          </div>` : ''}
          <div class="model-card-goto">부품 리스트 보기 →</div>
        </div>`;
      }).join('');

      return `<div class="month-group">
        <div class="month-head">
          <div class="month-dot"></div>
          <div class="month-label-wrap">
            <span class="month-label">${monthLabel}</span>
            <span class="month-stats">${Object.keys(mg.models).length}개 모델 · ${mg.totalParts}개 부품</span>
          </div>
        </div>
        <div class="models-grid">${modelCards}</div>
      </div>`;
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
            <div class="stat-pill"><div class="stat-pill-label">월</div><div class="stat-pill-val">${Object.keys(yg.months).length}</div></div>
            <div class="stat-pill"><div class="stat-pill-label">Models</div><div class="stat-pill-val">${yg.totalModels.size}</div></div>
            <div class="stat-pill"><div class="stat-pill-label">Parts</div><div class="stat-pill-val">${yg.totalParts}</div></div>
          </div>
          <div class="year-chevron">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </button>
      <div class="year-body">
        <div class="year-group">
          <div class="months-container">${monthsHtml}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleYear(btn) {
  const block = btn.closest('.year-block');
  block.classList.toggle('open');
}

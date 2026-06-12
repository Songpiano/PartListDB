// ============================================================
// Part List Database — sheets.js
// Google Sheets 연동 (GAS API)
// ============================================================

// ─── GOOGLE SHEETS 연동 ───────────────────────────────────────────────────────
const GAS_URL_KEY = 'partlist_gas_url';
const GAS_DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbw23LS1mGOh27Nm51WKS_bzdX2os2EPigpZyBgbKcQR03RT1ipKHFXdKRKz68iCZ0sS/exec';
let gasUrl    = localStorage.getItem(GAS_URL_KEY) || GAS_DEFAULT_URL;
// 기본 URL을 localStorage에 저장
if (!localStorage.getItem(GAS_URL_KEY)) localStorage.setItem(GAS_URL_KEY, GAS_DEFAULT_URL);
let gasSyncing = false;

// ── moldType/manager 등 Sheets 스키마에 없는 필드를 imageUrl 컬럼에 함께 인코딩 ──
// (Sheets에 컬럼을 추가하지 않고도 금형TYPE/담당자를 다른 PC와 동기화하기 위함)
const META_DELIM = '@@META@@';
function encodeMetaIntoImage(p, maxLen) {
  const img = (typeof p.imageUrl === 'string') ? p.imageUrl : '';
  const meta = {};
  if (p.moldType && p.moldType !== '-') meta.moldType = p.moldType;
  if (p.manager) meta.manager = p.manager;
  const metaStr = Object.keys(meta).length ? META_DELIM + JSON.stringify(meta) : '';
  let combined = img + metaStr;
  if (combined.length > maxLen) combined = metaStr; // 용량 초과 시 이미지 제외, 메타만 우선
  return combined.length > 0 ? combined : null;
}
function decodeMetaFromImage(p) {
  const raw = p.imageUrl;
  if (typeof raw !== 'string') return;
  const idx = raw.indexOf(META_DELIM);
  if (idx < 0) return;
  const imgPart  = raw.slice(0, idx);
  const metaStr  = raw.slice(idx + META_DELIM.length);
  try {
    const meta = JSON.parse(metaStr);
    if (meta.moldType) p.moldType = meta.moldType;
    if (meta.manager)  p.manager  = meta.manager;
  } catch(e) { /* ignore */ }
  p.imageUrl = imgPart || null;
}

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
    }, 20000);

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

let pendingSync = false; // 동기화 대기 플래그

// ── JSONP 재시도 래퍼 ─────────────────────────────────────────
async function gasJsonpRetry(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await gasJsonp(params);
    } catch(e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1))); // 점진적 대기
    }
  }
}

// ── 전체 동기화 (JSONP, 항목별 upsert, 재시도 포함) ──────────
async function syncToSheets() {
  if (!gasUrl) return;
  if (gasSyncing) { pendingSync = true; return; } // 진행 중이면 대기 등록
  gasSyncing = true;
  pendingSync = false;
  showSyncStatus('Sheets 동기화 중...', 'info');
  try {
    // Sheets 셀/URL 길이 제한(약 50,000자)을 넘는 이미지만 제외하고 나머지는 그대로 동기화
    // (이전에는 imageUrl을 항상 null로 보내서, 전체 동기화 시마다 Sheets에 저장된
    //  이미지가 매번 삭제되어 다른 PC에서 이미지가 사라지는 문제가 있었음)
    const MAX_IMG_LEN = 8000;
    const partsData = parts.map(p => ({ ...p, imageUrl: encodeMetaIntoImage(p, MAX_IMG_LEN) }));
    let failed = 0;

    await gasJsonpRetry({ action: 'clearAll' });

    // clearAll 이후 순차적으로 재업서트 (동시 요청은 Apps Script 실행 충돌/지연으로
    // 일부 항목이 실패하면 clearAll 이후 영구적으로 데이터가 사라질 수 있어 위험함)
    const CONCURRENCY = 1;
    let completed = 0;
    const failedParts = [];
    for (let i = 0; i < partsData.length; i += CONCURRENCY) {
      const batch = partsData.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (p) => {
        try {
          await gasJsonpRetry({ action: 'upsert', part: JSON.stringify(p) });
        } catch(e) {
          failedParts.push(p);
          console.warn(`upsert 실패 (${p.name}):`, e.message);
        }
        completed++;
      }));
      showSyncStatus(`저장 중... (${Math.min(completed, partsData.length)}/${partsData.length})`, 'info');
    }

    // clearAll 직후 실패한 항목은 데이터 영구 손실로 이어지므로 한 번 더 재시도
    if (failedParts.length > 0) {
      showSyncStatus(`실패 항목 재시도 중... (${failedParts.length}건)`, 'info');
      for (let i = failedParts.length - 1; i >= 0; i--) {
        const p = failedParts[i];
        try {
          await gasJsonpRetry({ action: 'upsert', part: JSON.stringify(p) }, 5);
          failedParts.splice(i, 1);
        } catch(e) {
          console.warn(`upsert 재시도 실패 (${p.name}):`, e.message);
        }
      }
    }
    failed = failedParts.length;

    if (failed > 0) {
      showSyncStatus(`저장 완료 (${partsData.length - failed}건 성공, ${failed}건 실패)`, 'error');
    } else {
      showSyncStatus(`Sheets 저장 완료 (${partsData.length}건)`, 'success');
    }
  } catch(e) {
    showSyncStatus('Sheets 저장 실패: ' + e.message, 'error');
    console.error('syncToSheets:', e);
  } finally {
    gasSyncing = false;
    if (pendingSync) { pendingSync = false; setTimeout(syncToSheets, 500); } // 대기 중 요청 처리
  }
}

async function loadFromSheets(retry = true) {
  if (!gasUrl) return false;
  showSyncStatus('Sheets에서 불러오는 중...', 'info');
  try {
    const json = await gasJsonp({ action: 'getAll' });
    // Sheets가 동기화(clearAll→재upsert) 도중이라 일시적으로 비어있을 수 있음 — 잠시 후 한 번 재시도
    if (json.ok && (!json.parts || json.parts.length === 0) && retry) {
      await new Promise(r => setTimeout(r, 1500));
      return loadFromSheets(false);
    }
    if (json.ok && json.parts && json.parts.length > 0) {
      // 모든 필드를 안전하게 문자열/숫자 변환
      json.parts.forEach(p => {
        p.approvalDate = String(p.approvalDate || '');
        p.displayId    = String(p.displayId || '');
        p.isAssembly   = p.isAssembly === true || p.isAssembly === 'true';
        p.isSub        = p.isSub === true || p.isSub === 'true';
        decodeMetaFromImage(p); // imageUrl에 인코딩된 moldType/manager 분리
      });
      // 날짜 변환 오염 감지 — displayId가 ISO 날짜 형식이면 로컬 데이터 유지
      const isCorrupted = json.parts.some(p =>
        /^\d{4}-\d{2}-\d{2}T/.test(p.displayId)
      );
      if (isCorrupted) {
        showSyncStatus('Sheets 데이터 오류 감지 — 로컬 데이터 사용', 'error');
        // 오염된 시트를 로컬 데이터로 즉시 덮어씌움
        if (parts.length > 0) syncToSheets();
        return false;
      }
      // 로컬에 저장된 imageUrl / moldType / manager 보존 (Sheets 스키마에 없는 필드는 응답에서 누락됨)
      // ID 기반 + (model|name|code) 정규화 키 기반 이중 매칭
      // CODE가 있으면 모델+CODE, 없으면 모델+품명으로 동일 부품 판정
      // (같은 부품을 다른 파일로 재업로드하면 품명에 "(일관 2열)" 등 표기 차이가
      //  생길 수 있으나 CODE NO.는 동일하므로 이를 기준으로 중복을 잡아냄)
      const normKey = (p) => {
        const model = String(p.model||'').trim().toUpperCase();
        const code = String(p.code||'').trim().toUpperCase();
        if (code) return `${model}|${code}`;
        return `${model}|${String(p.name||'').trim().replace(/\s+/g,' ').toUpperCase()}`;
      };
      const PRESERVE_FIELDS = ['imageUrl', 'moldType', 'manager'];
      const localById = {};
      const localByKey = {};
      const oldParts = parts;
      oldParts.forEach(p => {
        localById[p.id] = p;
        localByKey[normKey(p)] = p;
      });

      // Sheets 응답에 없는 로컬 전용 항목(아직 동기화 안 된 모델 등)은 유지
      const sheetIds  = new Set(json.parts.map(p => p.id));
      const sheetKeys = new Set(json.parts.map(p => normKey(p)));
      const localOnlyParts = oldParts.filter(p => !sheetIds.has(p.id) && !sheetKeys.has(normKey(p)));

      parts = json.parts;
      parts.forEach((p, i) => {
        const localP = localById[p.id] || localByKey[normKey(p)];
        if (!localP) return;
        PRESERVE_FIELDS.forEach(f => {
          const isEmpty = (v) => v === undefined || v === null || v === '' || v === '-';
          if (isEmpty(p[f]) && !isEmpty(localP[f])) p[f] = localP[f];
        });
      });
      if (localOnlyParts.length > 0) {
        parts = parts.concat(localOnlyParts);
        console.log('[sheets] Sheets에 없는 로컬 전용 항목 보존:', localOnlyParts.length, '건');
      }
      // 동기화 과정에서 생긴 중복 항목 제거 (model|code 또는 model|name 기준, 먼저 등장한 것 유지)
      let dedupRemoved = 0;
      {
        const seenKeys = new Set();
        const beforeLen = parts.length;
        parts = parts.filter(p => {
          const key = normKey(p);
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });
        dedupRemoved = beforeLen - parts.length;
        if (dedupRemoved > 0) {
          console.log('[sheets] 중복 항목 제거:', dedupRemoved, '건');
        }
      }
      // Sheets 저장 순서가 뒤틀릴 수 있으므로 uploadBatch → rowIndex 기준으로 재정렬
      parts.sort((a, b) => {
        const bA = Number(a.uploadBatch) || 0, bB = Number(b.uploadBatch) || 0;
        if (bA !== bB) return bA - bB;
        return (Number(a.rowIndex) || 0) - (Number(b.rowIndex) || 0);
      });
      parts.forEach((p, i) => { p.globalNo = i + 1; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
      showSyncStatus(`Sheets에서 ${parts.length}건 불러옴`, 'success');
      // 로컬 전용 항목(Sheets에서 누락된 데이터)이 있다면 Sheets에 복원
      // (중복 제거만 발생한 경우는 별도 동기화를 트리거하지 않음 — clearAll 이후
      //  일부 upsert가 실패하면 데이터가 영구 손실될 수 있어, 불필요한 재동기화는 피함)
      if (localOnlyParts.length > 0) syncToSheets();
      return true;
    }
    if (parts.length === 0) return await loadFromStaticFallback();
    showSyncStatus('로컬 저장됨', 'success');
    return false;
  } catch(e) {
    console.warn('loadFromSheets 실패:', e.message);
    // 네트워크/방화벽 등으로 Sheets 연동 자체가 막힌 PC 대비: 1회 재시도 후 정적 백업 데이터 사용
    if (retry) {
      await new Promise(r => setTimeout(r, 1500));
      return loadFromSheets(false);
    }
    if (parts.length === 0) return await loadFromStaticFallback();
    showSyncStatus('Sheets 불러오기 실패', 'error');
    return false;
  }
}

// ── 현재 전체 데이터(이미지/금형TYPE/담당자 포함)를 data/parts.json 형식으로 내보내기 ──
// 다른 PC에서 Sheets 연동이 실패했을 때 사용되는 정적 백업 파일을 최신화하기 위함.
// 다운로드된 parts.json 파일을 프로젝트의 data/parts.json 으로 교체 후 배포하면 됩니다.
function exportBackupSnapshot() {
  const json = JSON.stringify({ ok: true, parts }, null, 0);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'parts.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showSyncStatus('parts.json 다운로드됨 (data/parts.json으로 교체해주세요)', 'info');
}

// ── Sheets 연동이 실패하고 로컬 데이터도 없는 신규 사용자를 위한 정적 백업 데이터 ──
// (data/parts.json은 마지막으로 동기화된 데이터의 스냅샷이며, 새 사용자의 첫 화면을
//  비어있지 않게 보여주기 위한 안전망입니다. 실시간 데이터는 Sheets 연동이 정상이면
//  계속 갱신됩니다.)
async function loadFromStaticFallback() {
  try {
    const res = await fetch('data/parts.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('status ' + res.status);
    const json = await res.json();
    if (!json.parts || json.parts.length === 0) {
      showSyncStatus('Sheets 불러오기 실패', 'error');
      return false;
    }
    json.parts.forEach(p => {
      p.approvalDate = String(p.approvalDate || '');
      p.displayId    = String(p.displayId || '');
      p.isAssembly   = p.isAssembly === true || p.isAssembly === 'true';
      p.isSub        = p.isSub === true || p.isSub === 'true';
      decodeMetaFromImage(p);
    });
    parts = json.parts;
    // 중복 항목 제거 (model|name|code 기준)
    {
      // CODE가 있으면 모델+CODE, 없으면 모델+품명으로 동일 부품 판정
      // (같은 부품을 다른 파일로 재업로드하면 품명에 "(일관 2열)" 등 표기 차이가
      //  생길 수 있으나 CODE NO.는 동일하므로 이를 기준으로 중복을 잡아냄)
      const normKey = (p) => {
        const model = String(p.model||'').trim().toUpperCase();
        const code = String(p.code||'').trim().toUpperCase();
        if (code) return `${model}|${code}`;
        return `${model}|${String(p.name||'').trim().replace(/\s+/g,' ').toUpperCase()}`;
      };
      const seenKeys = new Set();
      parts = parts.filter(p => {
        const key = normKey(p);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });
    }
    parts.sort((a, b) => {
      const bA = Number(a.uploadBatch) || 0, bB = Number(b.uploadBatch) || 0;
      if (bA !== bB) return bA - bB;
      return (Number(a.rowIndex) || 0) - (Number(b.rowIndex) || 0);
    });
    parts.forEach((p, i) => { p.globalNo = i + 1; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
    showSyncStatus(`백업 데이터 ${parts.length}건 불러옴 (Sheets 연동 확인 필요)`, 'info');
    return true;
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
// renderStatus, toggleYear → render.js로 이동

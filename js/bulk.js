// ============================================================
// Part List Database — bulk.js
// 일괄 이미지 업로드, 연간 현황, 네비게이션
// ============================================================

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

async function bulkApply() {
  const toApply = bulkQueue.filter(q => q.matched);
  if (!toApply.length) return;

  // 즉시 미리보기 (base64)
  toApply.forEach(q => {
    const part = parts.find(p => p.id === q.partId);
    if (part) part.imageUrl = q.dataUrl;
  });
  renderParts();
  closeBulkModal();

  if (gasUrl) {
    // Google Drive에 순차 업로드하여 영구 링크로 교체 (모든 PC에서 보이도록)
    showSyncStatus(`이미지 ${toApply.length}개 업로드 중...`, 'info');
    let uploaded = 0, failed = 0;
    for (const q of toApply) {
      const part = parts.find(p => p.id === q.partId);
      if (!part) continue;
      const driveUrl = await uploadImageToDrive(q.partId, q.dataUrl);
      if (driveUrl) { part.imageUrl = driveUrl; uploaded++; }
      else failed++;
    }
    renderParts();
  }

  saveParts();
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

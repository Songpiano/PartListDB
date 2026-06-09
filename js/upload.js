// ============================================================
// Part List Database — upload.js
// ============================================================

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !window.XLSX) { showSyncStatus('라이브러리 로딩 중...', 'info'); return; }
  showSyncStatus('파일 처리 중...', 'info');
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // ── 엑셀 내장 이미지 추출 + 도형 텍스트에서 담당자 추출 ──
      const xlsxImgMap = {};
      const [, shapeManager] = await Promise.all([
        extractXlsxImages(data, xlsxImgMap),
        extractManagerFromShapes(data)
      ]);
      if (Object.keys(xlsxImgMap).length > 0)
        console.log(`이미지 ${Object.keys(xlsxImgMap).length}개 추출 완료`, Object.keys(xlsxImgMap));
      if (shapeManager) console.log('[upload] 도형에서 담당자 감지:', shapeManager);

      // ── 승인일자 감지 ──
      let approvalDate = new Date().getFullYear() + '.' + String(new Date().getMonth()+1).padStart(2,'0');
      for (let r = 0; r < Math.min(12, rows.length); r++) {
        if (!rows[r]) continue;
        const found4 = rows[r].find(c => /^\d{4}\.\d{1,2}\.\d{1,2}$/.test(String(c||'').trim()));
        if (found4) { const sp = String(found4).trim().split('.'); approvalDate = sp[0]+'.'+sp[1].padStart(2,'0'); break; }
        const found2 = rows[r].find(c => /^\d{2}\.\d{2}\.\d{2}$/.test(String(c||'').trim()));
        if (found2) { const sp = String(found2).trim().split('.'); approvalDate = '20'+sp[0]+'.'+sp[1]; break; }
      }

      // ── 담당자 감지 (결재란 전수 스캔) ──
      // 직급: 책임/이사/과장/부장/차장/대리/팀장/수석/선임/주임
      const TITLE_LIST = ['책임','이사','과장','부장','차장','대리','팀장','수석','선임','주임'];
      const TITLE_PAT  = new RegExp(TITLE_LIST.join('|'));
      const NAME_PAT   = /^[가-힣]{2,5}$/;
      let headerManager = '';

      // 상위 20행 × 전체 컬럼 스캔
      const headerRows = rows.slice(0, Math.min(20, rows.length));
      // 모든 셀값 수집 (빈 셀 제외)
      const allCells = [];
      headerRows.forEach((row, ri) => {
        if (!row) return;
        row.forEach((cell, ci) => {
          const s = String(cell||'').trim().replace(/\s+/g,' ');
          if (s) allCells.push({ s, ri, ci });
        });
      });

      // 패스1: "이름 직급" 또는 "이름\n직급" 같은 셀
      for (const { s } of allCells) {
        const m = s.match(/^([가-힣]{2,5})\s*(책임|이사|과장|부장|차장|대리|팀장|수석|선임|주임)/);
        if (m) { headerManager = m[1] + ' ' + m[2]; break; }
      }

      // 패스2: "직급" 셀 인근(같은 행/인접 행)에서 이름 탐색
      if (!headerManager) {
        outer2: for (const { s, ri, ci } of allCells) {
          if (!TITLE_PAT.test(s) || s.length > 6) continue;
          const title = s.match(TITLE_PAT)?.[0];
          if (!title) continue;
          // 같은 행 인접 셀
          for (const nc of [ci-1, ci+1, ci-2, ci+2]) {
            if (nc < 0) continue;
            const ns = String((headerRows[ri]||[])[nc]||'').trim();
            if (NAME_PAT.test(ns)) { headerManager = ns + ' ' + title; break outer2; }
          }
          // 아래/위 행 같은 열
          for (const nr of [ri+1, ri+2, ri-1]) {
            if (nr < 0 || nr >= headerRows.length) continue;
            const ns = String((headerRows[nr]||[])[ci]||'').trim();
            if (NAME_PAT.test(ns)) { headerManager = ns + ' ' + title; break outer2; }
          }
        }
      }
      // 도형 텍스트 결과가 있으면 우선 사용
      if (shapeManager) headerManager = shapeManager;
      console.log('[upload] 담당자 최종:', headerManager, '(도형:', shapeManager, '| 셀 스캔 수:', allCells.length, ')');

      // ── 모델명 감지 ──
      let modelName = '';
      for (let r = 0; r < Math.min(10, rows.length); r++) {
        if (!rows[r]) continue;
        const modelCell = rows[r].find(c => /MODEL\s*:/i.test(String(c||'')));
        if (modelCell) {
          const m = String(modelCell).match(/MODEL\s*:\s*(\S+)/i);
          if (m) { modelName = m[1].trim(); break; }
        }
      }

      // ── CAV / SET 컬럼 인덱스 탐지 ──
      let cavIdx = 16, setIdx = 17, managerIdx = -1, deliverIdx = -1;
      for (let r = 0; r < Math.min(15, rows.length); r++) {
        if (!rows[r]) continue;
        rows[r].forEach((cell, ci) => {
          const s = String(cell||'').replace(/[\s\n\r\t]/g,'').toUpperCase();
          if (s === 'CAV') cavIdx = ci;
          if (s.includes('SET') && s.includes('소요')) setIdx = ci;
          if (s.includes('담당자')) managerIdx = ci;
          if (s.includes('납품처') || s.includes('납품')) deliverIdx = ci;
        });
      }
      if (managerIdx === -1 && deliverIdx >= 0) managerIdx = deliverIdx + 1;
      if (managerIdx === -1) managerIdx = setIdx + 4;

      // ── 기존 모델 존재 시 교체/추가 선택 모달 ──
      const existingCount = parts.filter(p => p.model === modelName).length;
      const existingManager = parts.find(p => p.model === modelName && p.manager)?.manager || '';
      const resolvedManager = headerManager || existingManager;

      if (modelName && existingCount > 0) {
        document.getElementById('replaceModalBody').innerHTML =
          `<strong>${modelName}</strong> 모델의 기존 파트 <strong>${existingCount}개</strong>가 있습니다.<br>어떻게 처리하시겠습니까?`;
        document.getElementById('replaceBtn').onclick = () => {
          closeReplaceModal();
          processUpload(rows, modelName, resolvedManager, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, true);
        };
        document.getElementById('appendBtn').onclick = () => {
          closeReplaceModal();
          processUpload(rows, modelName, resolvedManager, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, false);
        };
        document.getElementById('replaceModal').classList.add('open');
        return;
      }

      processUpload(rows, modelName, resolvedManager, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, false);

    } catch(err) {
      console.error(err);
      showSyncStatus('처리 오류', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';
}

// ─── CORE UPLOAD PROCESSING ───────────────────────────────────────────────────
function processUpload(rows, modelName, headerManager, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, replace) {
  // 교체 전 기존 담당자 이름 보존 (감지 실패 대비)
  let preservedManager = headerManager;
  if (!preservedManager && modelName) {
    const existing = parts.find(p => p.model === modelName && p.manager);
    if (existing) preservedManager = existing.manager;
  }

  // 교체 모드: 기존 모델 파트 전체 삭제
  if (replace && modelName) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].model === modelName) parts.splice(i, 1);
    }
  }

  // 담당자 업데이트 (기존 파트 중 manager 비어있거나 "-"인 것)
  const isEmptyManager = (v) => !v || /^[-–—]+$/.test(v);
  if (preservedManager && !replace) {
    parts.forEach(p => { if (p.model === modelName && isEmptyManager(p.manager)) p.manager = preservedManager; });
  }

  const isHeaderRow = (row) => {
    if (!row || row.length < 3) return true;
    const no = String(row[0]||'').trim();
    return !/^\d+$/.test(no) && !/^\d+-\d+$/.test(no);
  };

  const parseNo = (val) => {
    const s = String(val||'').trim();
    if (/^\d+$/.test(s))   return { raw: s, isAssembly: true,  isSub: false };
    if (/^\d+-\d+$/.test(s)) return { raw: s, isAssembly: false, isSub: true  };
    return null;
  };

  const categoryClass = (cat) => {
    const c = String(cat||'').trim();
    if (c.includes('BRK') || c.includes('brk')) return 'category-brk';
    if (c.includes('부자재')) return 'category-sub';
    if (c.includes('포장'))   return 'category-pkg';
    return 'category-other';
  };

  const existKeys = new Set(parts.map(p => normalizeKey(p.model, p.name, p.code)));
  const uploadBatch = Date.now();
  let rowIndex = 0, addCount = 0;

  rows.forEach(row => {
    if (isHeaderRow(row)) return;
    const noInfo = parseNo(row[0]);
    if (!noInfo) return;

    const category = String(row[1]||'').trim();
    const isPkg    = category.includes('포장');
    const name     = String(row[2]||'').replace(/\n/g,' ').trim();
    const code     = String(row[3]||'').trim();
    if (!name && !code) return;

    const model = modelName || String(row[1]||'').trim();
    const key   = normalizeKey(model, name, code);
    if (existKeys.has(key)) return;

    const trayQtyRaw = row[setIdx + 1];
    const trayQty   = isPkg && trayQtyRaw != null && trayQtyRaw !== '' ? trayQtyRaw : null;
    const colManagerRaw = managerIdx >= 0 && row[managerIdx] != null ? String(row[managerIdx]).trim() : '';
    const colManagerVal = /^[-–—]+$/.test(colManagerRaw) ? '' : colManagerRaw;

    parts.push({
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      displayId: noInfo.raw,
      globalNo: 0,
      isAssembly: noInfo.isAssembly,
      isSub: noInfo.isSub,
      category,
      categoryClass: categoryClass(category),
      model: modelName,
      name,
      code,
      material:  String(row[4]||'-').trim(),
      thickness: row[5]  != null ? row[5]  : '-',
      width_raw: row[6]  != null ? row[6]  : '-',
      pitch:     row[7]  != null ? row[7]  : '-',
      dim_l:     row[10] != null ? row[10] : '-',
      dim_w:     row[11] != null ? row[11] : '-',
      dim_h:     row[12] != null ? row[12] : '-',
      weight_g:  row[13] != null ? row[13] : '-',
      cav:       (row[cavIdx] != null && row[cavIdx] !== '') ? row[cavIdx] : '-',
      set_qty:   (row[setIdx] != null && row[setIdx] !== '') ? row[setIdx] : '-',
      tray_qty:  trayQty,
      manager:   colManagerVal || preservedManager,
      approvalDate,
      uploadBatch,
      rowIndex: rowIndex++,
      imageUrl: null,
      createdAt: Date.now()
    });
    existKeys.add(key);
    addCount++;
  });

  // ── 정렬 ──
  parts.sort((a, b) => {
    const bA = a.uploadBatch || a.createdAt || 0;
    const bB = b.uploadBatch || b.createdAt || 0;
    if (bA !== bB) return bA - bB;
    return (a.rowIndex || 0) - (b.rowIndex || 0);
  });
  parts.forEach((p, i) => { p.globalNo = i + 1; });

  // ── 이미지 자동 적용 ──
  if (Object.keys(xlsxImgMap).length > 0) {
    let imgApplied = 0;
    parts.forEach(p => {
      if (!p.isAssembly || p.imageUrl) return;
      const noKey = `__NO__${p.displayId}`;
      if (xlsxImgMap[noKey]) { p.imageUrl = xlsxImgMap[noKey]; imgApplied++; return; }
      const nameKey = normalizeImgKey(p.name);
      if (xlsxImgMap[nameKey]) { p.imageUrl = xlsxImgMap[nameKey]; imgApplied++; return; }
      for (const [k, url] of Object.entries(xlsxImgMap)) {
        if (k.startsWith('__NO__')) continue;
        if (nameKey.includes(k) || k.includes(nameKey)) { p.imageUrl = url; imgApplied++; return; }
      }
    });
    if (imgApplied > 0) showSyncStatus(`이미지 ${imgApplied}개 자동 적용`, 'success');
  }

  // 감지된 담당자로 해당 모델의 ASSY 파트 전체 강제 갱신 (기존 데이터 포함)
  if (preservedManager && modelName) {
    parts.forEach(p => {
      if (p.model === modelName && p.isAssembly && isEmptyManager(p.manager))
        p.manager = preservedManager;
    });
  }

  if (addCount > 0 || replace) {
    saveParts();
    renderParts();
    renderStatus();
    const msg = replace ? `${modelName} 교체 완료 (${addCount}건)` : `${addCount}건 추가됨`;
    showSyncStatus(msg, 'success');
  } else {
    showSyncStatus('새 항목 없음', 'info');
  }
}

function closeReplaceModal() {
  document.getElementById('replaceModal').classList.remove('open');
}

function normalizeKey(model, name, code) {
  return `${String(model||'').trim()}|${String(name||'').trim().replace(/\s+/g,' ')}|${String(code||'').trim()}`.toUpperCase();
}

function downloadModelXlsx(modelName) {
  if (!window.XLSX) { alert('XLSX 라이브러리가 로드되지 않았습니다.'); return; }
  const modelParts = parts.filter(p => p.model === modelName);
  if (!modelParts.length) { alert('해당 모델의 파트가 없습니다.'); return; }

  const headers = ['NO', '제품구분', '품명', 'CODE NO.', '재질', '두께(T)', '폭(W)', '피치(P)', '밀도', '무게(kg)',
    '가로', '세로', '높이', '무게(g)', '공정1', '공정2', 'CAV', 'SET당소요량', 'TRAY포장수량', '승인일자'];

  const dataRows = modelParts.map(p => [
    p.displayId, p.category, p.name, p.code, p.material,
    p.thickness, p.width_raw, p.pitch, p.density ?? '-', p.weight_raw ?? '-',
    p.dim_l, p.dim_w, p.dim_h, p.weight_g,
    p.process1 ?? '-', p.process2 ?? '-',
    p.cav, p.set_qty, p.tray_qty ?? '-', p.approvalDate ?? '-'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...dataRows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 30) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, modelName.slice(0, 31));
  XLSX.writeFile(wb, `${modelName}_PartList.xlsx`);
}

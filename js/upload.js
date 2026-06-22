// ============================================================
// Part List Database — upload.js
// ============================================================

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
function handleFileUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length || !window.XLSX) { showSyncStatus('라이브러리 로딩 중...', 'info'); return; }
  e.target.value = '';
  const summary = { total: files.length, done: 0, added: 0 };
  processFileQueue(files, 0, summary);
}

// 여러 파일을 순차적으로 처리 (모델 중복 시 모달 응답을 기다린 뒤 다음 파일 진행)
function processFileQueue(files, index, summary) {
  if (index >= files.length) {
    if (summary.total > 1) {
      showSyncStatus(`파일 ${summary.total}개 처리 완료 (총 ${summary.added}건 추가)`, 'success');
    }
    return;
  }
  const file = files[index];
  const next = () => processFileQueue(files, index + 1, summary);
  showSyncStatus(`(${index + 1}/${summary.total}) ${file.name} 처리 중...`, 'info');
  processSingleFile(file, summary, next);
}

// ── 업로드 데이터 검증: NO 순서 / 아이템군 분류 규칙 ──────────────────────────
const VALID_MOLD_TYPES = [
  '범용(일반)',
  '일관',
  '60톤',
  '80톤',
  '110톤',
  '일관 (속건성+열풍)',
  '60톤 (속건성+열풍)',
  '80톤 (속건성+열풍)',
  '110톤 (속건성+열풍)'
];

const VALID_CATEGORIES = [
  'SMD SHIELD CAN류 완제품',
  'SMD SHIELD CAN류 반제품',
  'BRK류 완제품',
  'BRK류 반제품',
  'SMD PLATE류 완제품',
  'SMD PLATE류 반제품',
  'CAM DECO류 완제품',
  'CAM DECO류 반제품',
  '부자재',
  '포장재'
];

function isUploadHeaderRow(row) {
  if (!row || row.length < 3) return true;
  const no = String(row[0]||'').trim();
  return !/^\d+$/.test(no) && !/^\d+-\d+$/.test(no);
}

// 규칙 1: 상위코드(1,2,3...)와 하위코드(1-1,1-2,1-3...)가 빠짐없이 순서대로 이어지는지 검증
function validateNoSequence(rows) {
  const mains = [];
  const subsByMain = {};
  rows.forEach(row => {
    if (isUploadHeaderRow(row)) return;
    const no = String(row[0]).trim();
    const name = String(row[2]||'').trim();
    const code = String(row[3]||'').trim();
    if (!name && !code) return;
    const m1 = no.match(/^(\d+)$/);
    const m2 = no.match(/^(\d+)-(\d+)$/);
    if (m1) {
      mains.push(parseInt(m1[1], 10));
    } else if (m2) {
      const main = parseInt(m2[1], 10), sub = parseInt(m2[2], 10);
      (subsByMain[main] = subsByMain[main] || []).push(sub);
    }
  });

  const sortedMains = [...new Set(mains)].sort((a,b) => a - b);
  for (let i = 0; i < sortedMains.length; i++) {
    if (sortedMains[i] !== i + 1) {
      return { valid: false, message:
        `상위 코드(NO)의 순서가 1, 2, 3... 순서로 빠짐없이 이어지지 않습니다.\n` +
        `(감지된 NO: ${sortedMains.join(', ') || '없음'})` };
    }
  }
  for (const main of Object.keys(subsByMain)) {
    const subs = [...new Set(subsByMain[main])].sort((a,b) => a - b);
    for (let i = 0; i < subs.length; i++) {
      if (subs[i] !== i + 1) {
        return { valid: false, message:
          `${main}번 항목의 하위 코드(NO)가 ${main}-1, ${main}-2... 순서로 빠짐없이 이어지지 않습니다.\n` +
          `(감지된 하위 NO: ${subs.map(s => main + '-' + s).join(', ')})` };
      }
    }
  }
  return { valid: true };
}

// 규칙 2: 아이템군(제품구분) 분류가 정해진 목록에 속하는지 검증
function validateCategories(rows) {
  const invalid = new Set();
  rows.forEach(row => {
    if (isUploadHeaderRow(row)) return;
    const name = String(row[2]||'').trim();
    const code = String(row[3]||'').trim();
    if (!name && !code) return;
    const category = String(row[1]||'').trim();
    if (!VALID_CATEGORIES.includes(category)) {
      invalid.add(`NO ${String(row[0]).trim()}: "${category || '(빈칸)'}"`);
    }
  });
  if (invalid.size > 0) {
    return { valid: false, message:
      `아이템군(제품구분) 분류가 올바르지 않은 항목이 있습니다:\n${[...invalid].join('\n')}\n\n` +
      `허용되는 분류:\n${VALID_CATEGORIES.join(', ')}` };
  }
  return { valid: true };
}

// 규칙 3: 금형TYPE이 허용 목록에 속하는지 검증 (빈칸·대시는 허용)
function validateMoldTypes(rows, moldIdx) {
  if (moldIdx < 0) return { valid: true }; // 금형TYPE 컬럼 없으면 검증 생략
  const invalid = new Set();
  rows.forEach(row => {
    if (isUploadHeaderRow(row)) return;
    const name = String(row[2]||'').trim();
    const code = String(row[3]||'').trim();
    if (!name && !code) return;
    const raw = row[moldIdx] != null ? String(row[moldIdx]).replace(/\n/g,' ').trim() : '';
    if (!raw || /^[-–—\s]+$/.test(raw)) return; // 빈칸·대시 허용
    if (!VALID_MOLD_TYPES.includes(raw)) {
      invalid.add(`NO ${String(row[0]).trim()}: "${raw}"`);
    }
  });
  if (invalid.size > 0) {
    return { valid: false, message:
      `금형TYPE이 올바르지 않은 항목이 있습니다:\n${[...invalid].join('\n')}\n\n` +
      `허용되는 금형TYPE:\n${VALID_MOLD_TYPES.join(', ')}` };
  }
  return { valid: true };
}

function processSingleFile(file, summary, next) {
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // ── 등록 규칙 검증: 위반 시 등록 불가 처리 ──
      const noCheck = validateNoSequence(rows);
      if (!noCheck.valid) {
        alert(`[${file.name}] 파트리스트 오류로 등록할 수 없습니다.\n\n${noCheck.message}`);
        showSyncStatus(`등록 불가: ${file.name} (NO 순서 오류)`, 'error');
        next();
        return;
      }
      const catCheck = validateCategories(rows);
      if (!catCheck.valid) {
        alert(`[${file.name}] 파트리스트 품명을 확인해주세요. 등록할 수 없습니다.\n\n${catCheck.message}`);
        showSyncStatus(`등록 불가: ${file.name} (아이템군 분류 오류)`, 'error');
        next();
        return;
      }

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

      // ── 결재란(작성자 영역)에서 담당자 이름 감지 ──
      // 상단 결재란의 "작성" 라벨 셀 근처에서 한글 이름을 탐색
      let approvalManager = '';
      for (let r = 0; r < Math.min(10, rows.length) && !approvalManager; r++) {
        if (!rows[r]) continue;
        rows[r].forEach((cell, ci) => {
          if (approvalManager) return;
          const s = String(cell||'').replace(/\s/g,'');
          if (s === '작성' || s.startsWith('작성:') || s === '담당자') {
            // 같은 행 및 바로 아래 1~2행에서 한글 이름 탐색
            for (let r2 = r; r2 <= r + 2 && r2 < rows.length; r2++) {
              if (!rows[r2] || approvalManager) continue;
              const startCi = r2 === r ? ci : Math.max(0, ci - 1);
              for (let c2 = startCi; c2 <= ci + 4 && c2 < rows[r2].length; c2++) {
                const v = String(rows[r2][c2]||'').trim();
                const m = v.match(/^([가-힣]{2,5})/);
                if (m) { approvalManager = m[1]; break; }
              }
            }
          }
        });
      }
      if (approvalManager) console.log('[upload] 결재란에서 담당자 감지:', approvalManager);

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

      // ── CAV가 있는 실제 표 헤더 행을 먼저 찾음 (결재란 등 상단 타이틀 영역의 "담당자" 라벨과 혼동 방지) ──
      let cavIdx = 16, setIdx = 17, managerIdx = -1, deliverIdx = -1, moldIdx = -1, headerRowIdx = -1;
      for (let r = 0; r < Math.min(15, rows.length); r++) {
        if (!rows[r]) continue;
        rows[r].forEach((cell, ci) => {
          const s = String(cell||'').replace(/[\s\n\r\t]/g,'').toUpperCase();
          if (s === 'CAV') { cavIdx = ci; headerRowIdx = r; }
        });
      }
      // 표 헤더 행(다단 헤더 대비 위/아래 1행 포함)에서만 컬럼 라벨 탐지
      const headerRowsToScan = headerRowIdx >= 0
        ? [headerRowIdx - 1, headerRowIdx, headerRowIdx + 1].filter(r => r >= 0 && r < rows.length && rows[r])
        : rows.slice(0, 15).map((_, i) => i).filter(r => rows[r]); // CAV 못찾으면 기존 방식(상단 15행 전체) 대비
      headerRowsToScan.forEach(r => {
        rows[r].forEach((cell, ci) => {
          const s = String(cell||'').replace(/[\s\n\r\t]/g,'').toUpperCase();
          if (s.includes('SET') && s.includes('소요')) setIdx = ci;
          if (s.includes('담당자')) managerIdx = ci;
          if (s === '비고') managerIdx = ci;           // 비고 컬럼 명시 감지
          if (s.includes('납품처') || s.includes('납품')) deliverIdx = ci;
          if (s.includes('금형')) moldIdx = ci;        // 금형TYPE 컬럼 감지
        });
      });
      // 비고 컬럼 미감지 시 납품처 다음 컬럼으로 추정
      if (managerIdx === -1 && deliverIdx >= 0) managerIdx = deliverIdx + 1;
      if (managerIdx === -1) managerIdx = setIdx + 4;
      console.log('[upload] headerRowIdx:', headerRowIdx, 'cavIdx:', cavIdx, 'setIdx:', setIdx, 'managerIdx:', managerIdx, '(deliverIdx:', deliverIdx, ') moldIdx:', moldIdx);

      // ── 금형TYPE 검증 ──
      const moldCheck = validateMoldTypes(rows, moldIdx);
      if (!moldCheck.valid) {
        alert(`[${file.name}] 금형TYPE 오류로 등록할 수 없습니다.\n\n${moldCheck.message}`);
        showSyncStatus(`등록 불가: ${file.name} (금형TYPE 오류)`, 'error');
        next();
        return;
      }

      // ── 기존 모델 존재 시 교체/추가 선택 모달 ──
      const existingCount = parts.filter(p => p.model === modelName).length;

      if (modelName && existingCount > 0) {
        document.getElementById('replaceModalBody').innerHTML =
          `<strong>${modelName}</strong> 모델의 기존 파트 <strong>${existingCount}개</strong>가 있습니다.<br>어떻게 처리하시겠습니까?`;
        document.getElementById('replaceBtn').onclick = () => {
          closeReplaceModal();
          summary.added += processUpload(rows, modelName, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, moldIdx, true, approvalManager);
          next();
        };
        document.getElementById('appendBtn').onclick = () => {
          closeReplaceModal();
          summary.added += processUpload(rows, modelName, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, moldIdx, false, approvalManager);
          next();
        };
        document.getElementById('replaceModal').classList.add('open');
        return;
      }

      summary.added += processUpload(rows, modelName, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, moldIdx, false, approvalManager);
      next();

    } catch(err) {
      console.error(err);
      showSyncStatus('처리 오류', 'error');
      next();
    }
  };
  reader.readAsArrayBuffer(file);
}

// ─── CORE UPLOAD PROCESSING ───────────────────────────────────────────────────
function processUpload(rows, modelName, xlsxImgMap, approvalDate, cavIdx, setIdx, managerIdx, moldIdx, replace, approvalManager) {
  const isEmptyManager = (v) => !v || /^[-–—\s]+$/.test(v);

  // 교체 모드: 기존 모델 파트 전체 삭제
  if (replace && modelName) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].model === modelName) parts.splice(i, 1);
    }
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
    // 순수 한글 이름(2~5자)인 경우만 유효한 담당자로 인정 (긴 텍스트·영문 혼용 등 차단)
    const NAME_PAT = /^[가-힣]{2,5}$/;
    let colManagerVal = NAME_PAT.test(colManagerRaw) ? colManagerRaw : '';
    // 컬럼 인덱스가 빗나간 경우 대비: managerIdx 주변 ~ 행 끝까지 순수 한글 이름(2~5자) 탐색
    if (!colManagerVal) {
      for (let ci = row.length - 1; ci >= Math.max(0, managerIdx - 2); ci--) {
        const v = String(row[ci]||'').trim();
        if (NAME_PAT.test(v)) { colManagerVal = v; break; }
      }
    }

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
      moldType:  moldIdx >= 0 && row[moldIdx] != null && String(row[moldIdx]).trim() !== '' ? String(row[moldIdx]).replace(/\n/g,' ').trim() : '-',
      manager:   colManagerVal,
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

  // ── ASSY 담당자 전파: 비어있는 ASSY → ①하위행 한글이름 탐색 → ②결재란 담당자 폴백 ──
  const NAME_PAT_KO = /^[가-힣]{2,5}$/;
  const batchParts = parts.filter(p => p.uploadBatch === uploadBatch);
  batchParts.forEach(assy => {
    if (!assy.isAssembly || !isEmptyManager(assy.manager)) return;
    // ① 하위행 중 순수 한글 이름(2~5자)이 있는 행에서 전파
    const subs = batchParts.filter(s => s.isSub && s.displayId.startsWith(assy.displayId + '-'));
    const found = subs.find(s => !isEmptyManager(s.manager) && NAME_PAT_KO.test(s.manager));
    if (found) { assy.manager = found.manager; return; }
    // ② 결재란에서 감지한 담당자로 폴백
    if (approvalManager) assy.manager = approvalManager;
  });

  const logManagers = batchParts.filter(p => p.isAssembly).map(p => `${p.displayId}:${p.manager||'(없음)'}`);
  console.log('[upload] ASSY 담당자:', logManagers);

  if (addCount > 0 || replace) {
    saveParts();
    renderParts();
    renderStatus();
    const msg = replace ? `${modelName} 교체 완료 (${addCount}건)` : `${addCount}건 추가됨`;
    showSyncStatus(msg, 'success');
  } else {
    showSyncStatus('새 항목 없음', 'info');
  }
  return addCount;
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
    '가로', '세로', '높이', '무게(g)', '공정1', '공정2', '금형TYPE', 'CAV', 'SET당소요량', 'TRAY포장수량', '승인일자'];

  const dataRows = modelParts.map(p => [
    p.displayId, p.category, p.name, p.code, p.material,
    p.thickness, p.width_raw, p.pitch, p.density ?? '-', p.weight_raw ?? '-',
    p.dim_l, p.dim_w, p.dim_h, p.weight_g,
    p.process1 ?? '-', p.process2 ?? '-',
    p.moldType ?? '-',
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

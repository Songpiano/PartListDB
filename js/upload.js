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

      // ── 엑셀 내장 이미지 추출 및 완제품에 자동 적용 ──
      const xlsxImgMap = {};
      await extractXlsxImages(data, xlsxImgMap);
      const imgMapSize = Object.keys(xlsxImgMap).length;
      if (imgMapSize > 0) console.log(`이미지 ${imgMapSize}개 추출 완료`, Object.keys(xlsxImgMap));

      // 승인일자 자동 감지 (상단 10행 내 YYYY.MM.DD 형식)
      let approvalDate = new Date().getFullYear() + '.' + String(new Date().getMonth()+1).padStart(2,'0');
      // 승인일자 감지: YYYY.M.D / YYYY.MM.DD / YY.MM.DD 형식
      for (let r = 0; r < Math.min(12, rows.length); r++) {
        if (!rows[r]) continue;
        // YYYY.M.D 또는 YYYY.MM.DD (4자리 연도)
        const found4 = rows[r].find(c => /^\d{4}\.\d{1,2}\.\d{1,2}$/.test(String(c||'').trim()));
        if (found4) {
          const sp = String(found4).trim().split('.');
          approvalDate = sp[0] + '.' + sp[1].padStart(2,'0');
          break;
        }
        // YY.MM.DD (2자리 연도)
        const found2 = rows[r].find(c => /^\d{2}\.\d{2}\.\d{2}$/.test(String(c||'').trim()));
        if (found2) {
          const sp = String(found2).trim().split('.');
          approvalDate = '20' + sp[0] + '.' + sp[1];
          break;
        }
      }

      // 모델명 감지 (MODEL : SM-XXXXX 패턴)
      let modelName = '';
      for (let r = 0; r < Math.min(10, rows.length); r++) {
        if (!rows[r]) continue;
        const modelCell = rows[r].find(c => /MODEL\s*:/i.test(String(c||'')));
        if (modelCell) {
          const m = String(modelCell).match(/MODEL\s*:\s*(\S+)/i);
          if (m) { modelName = m[1].trim(); break; }
        }
      }

      const existKeys = new Set(parts.map(p => normalizeKey(p.model, p.name, p.code)));
      let addCount = 0;

      // 헤더/메타 행 판별: row[0]이 유효한 NO 형식(숫자 or "숫자-숫자")이 아니면 건너뜀
      // 키워드 기반 필터는 "무게" 등의 단어가 데이터에 포함될 때 오필터 발생 → 제거
      const isHeaderRow = (row) => {
        if (!row || row.length < 3) return true;
        const no = String(row[0]||'').trim();
        // NO 컬럼이 순수 정수 또는 "숫자-숫자" 형태가 아니면 헤더/메타 행
        return !/^\d+$/.test(no) && !/^\d+-\d+$/.test(no);
      };

      // NO 형식 판별: "2", "2-1", "2-2" 등
      const parseNo = (val) => {
        const s = String(val||'').trim();
        if (!s) return null;
        // 순수 정수 → 완제품
        if (/^\d+$/.test(s)) return { raw: s, isAssembly: true, isSub: false };
        // 정수-정수 형식 → 하위자재
        if (/^\d+-\d+$/.test(s)) return { raw: s, isAssembly: false, isSub: true };
        return null;
      };

      // 제품구분 → CSS 클래스 매핑
      const categoryClass = (cat) => {
        const c = String(cat||'').trim();
        if (c.includes('BRK') || c.includes('brk')) return 'category-brk';
        if (c.includes('부자재')) return 'category-sub';
        if (c.includes('포장')) return 'category-pkg';
        return 'category-other';
      };

      // ── CAV / SET당 소요량 컬럼 인덱스 동적 탐지 ──
      // 헤더 행을 스캔해서 'CAV', 'SET' 키워드가 있는 컬럼 인덱스를 찾음
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
      // 담당자 헤더 못 찾은 경우 폴백 순서:
      // 1) 납품처 다음 컬럼
      // 2) setIdx + 4 (setIdx 이후 4번째: SET→TRAY→양산처→납품처→담당자)
      if (managerIdx === -1 && deliverIdx >= 0) managerIdx = deliverIdx + 1;
      if (managerIdx === -1) managerIdx = setIdx + 4;

      const uploadBatch = Date.now();
      let rowIndex = 0;

      rows.forEach(row => {
        if (isHeaderRow(row)) return;

        // 새 양식 컬럼 구조:
        // [0]=NO, [1]=제품구분, [2]=품명, [3]=CODE NO., [4]=재질,
        // [5]=두께(T), [6]=폭(W), [7]=피치(P), [8]=밀도, [9]=무게(kg원자재)
        // [10]=가로, [11]=세로, [12]=높이, [13]=무게(g)
        // [14]=공정1, [15]=공정2, [16]=CAV, [17]=SET당소요량, [18]=TRAY포장수량(포장재전용)
        const noInfo = parseNo(row[0]); // isHeaderRow 통과 시 항상 유효

        const category = String(row[1]||'').trim();
        const isPkg    = category.includes('포장');
        const name     = String(row[2]||'').replace(/\n/g,' ').trim();
        const code     = String(row[3]||'').trim();
        if (!name && !code) return;

        const model = modelName || String(row[1]||'').trim();
        const key   = normalizeKey(model, name, code);
        if (existKeys.has(key)) return;

        // 포장재는 SET당소요량 자리에 tray수량이 오는 구조
        // [17]=SET당소요량(소수), [18]=TRAY포장수량(정수)
        const trayQtyRaw = row[setIdx + 1];
        const trayQty   = isPkg && trayQtyRaw != null && trayQtyRaw !== '' ? trayQtyRaw : null;

        parts.push({
          id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          displayId: noInfo.raw,          // "1", "2", "2-1" 형태 그대로 저장
          globalNo: 0,                    // 전체 일련번호 (정렬 후 재계산)
          isAssembly: noInfo.isAssembly,
          isSub: noInfo.isSub,
          category,
          categoryClass: categoryClass(category),
          model: modelName,
          name,
          code,
          material:  String(row[4]||'-').trim(),
          thickness: row[5] != null ? row[5] : '-',
          width_raw: row[6] != null ? row[6] : '-',
          pitch:     row[7] != null ? row[7] : '-',
          dim_l:     row[10] != null ? row[10] : '-',
          dim_w:     row[11] != null ? row[11] : '-',
          dim_h:     row[12] != null ? row[12] : '-',
          weight_g:  row[13] != null ? row[13] : '-',
          cav:       (row[cavIdx] != null && row[cavIdx] !== '') ? row[cavIdx] : '-',
          set_qty:   (row[setIdx] != null && row[setIdx] !== '') ? row[setIdx] : '-',
          tray_qty:  trayQty,
          manager:   managerIdx >= 0 && row[managerIdx] != null ? String(row[managerIdx]).trim() : '',
          approvalDate,
          uploadBatch,                    // 파일 단위 묶음 키
          rowIndex: rowIndex++,           // 엑셀 행 순서
          imageUrl: null,
          createdAt: Date.now()
        });
        existKeys.add(key);
        addCount++;
      });

      // ── 정렬: 업로드 배치(파일 단위) → 모델 내 NO 순서 유지 ──
      // 같은 배치(uploadBatch) 안에서는 엑셀 행 순서(rowIndex) 그대로
      parts.sort((a, b) => {
        // 1) 배치 시간 기준 (다른 파일끼리)
        const batchA = a.uploadBatch || a.createdAt || 0;
        const batchB = b.uploadBatch || b.createdAt || 0;
        if (batchA !== batchB) return batchA - batchB;
        // 2) 같은 배치 안에서는 rowIndex 순서
        return (a.rowIndex || 0) - (b.rowIndex || 0);
      });

      // ── globalNo 재계산: 전체 순번 부여 ──
      parts.forEach((p, i) => { p.globalNo = i + 1; });

      // ── 추출된 이미지를 완제품(isAssembly)에만 품목명/NO로 매칭해 자동 적용 ──
      if (Object.keys(xlsxImgMap).length > 0) {
        let imgApplied = 0;
        parts.forEach(p => {
          if (!p.isAssembly) return;   // 완제품만
          if (p.imageUrl) return;      // 이미 이미지 있으면 건너뜀

          // 1순위: 텍스트박스 NO = 완제품 displayId 직접 매칭
          const noKey = `__NO__${p.displayId}`;
          if (xlsxImgMap[noKey]) { p.imageUrl = xlsxImgMap[noKey]; imgApplied++; return; }

          // 2순위: 품목명 정규화 완전일치
          const nameKey = normalizeImgKey(p.name);
          if (xlsxImgMap[nameKey]) { p.imageUrl = xlsxImgMap[nameKey]; imgApplied++; return; }

          // 3순위: 부분일치
          for (const [k, url] of Object.entries(xlsxImgMap)) {
            if (k.startsWith('__NO__')) continue; // NO키 제외
            if (nameKey.includes(k) || k.includes(nameKey)) {
              p.imageUrl = url; imgApplied++; return;
            }
          }
        });
        if (imgApplied > 0) showSyncStatus(`이미지 ${imgApplied}개 자동 적용`, 'success');
      }

      if (addCount > 0) {
        saveParts();
        renderParts();
        showSyncStatus(`${addCount}건 추가됨`, 'success');
      } else {
        showSyncStatus('새 항목 없음', 'error');
      }
    } catch(err) {
      console.error(err);
      showSyncStatus('처리 오류', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';
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

  const rows = modelParts.map(p => [
    p.displayId, p.category, p.name, p.code, p.material,
    p.thickness, p.width_raw, p.pitch, p.density ?? '-', p.weight_raw ?? '-',
    p.dim_l, p.dim_w, p.dim_h, p.weight_g,
    p.process1 ?? '-', p.process2 ?? '-',
    p.cav, p.set_qty, p.tray_qty ?? '-', p.approvalDate ?? '-'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // 컬럼 너비 자동 조정
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 30) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, modelName.slice(0, 31));
  XLSX.writeFile(wb, `${modelName}_PartList.xlsx`);
}

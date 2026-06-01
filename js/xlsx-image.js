// ============================================================
// Part List Database — xlsx-image.js
// ============================================================

// ─── XLSX 내장 이미지 추출 (SheetJS 내부 파싱 결과 활용) ─────────────────────
function normalizeImgKey(s) {
  return String(s||'').toUpperCase().replace(/[\s\-_\/\(\)\.\,]/g,'');
}

async function extractXlsxImages(uint8arr, resultMap) {
  try {
    const wb2 = XLSX.read(uint8arr, { type:'array' });
    let drawingXml = '', relsXml = '';

    // 방법1: wb2.xl.drawings
    try {
      const dr = wb2.xl && wb2.xl.drawings;
      if (dr) {
        const xk = Object.keys(dr).find(k => k.endsWith('.xml') && !k.includes('rels'));
        if (xk) { const v=dr[xk]; drawingXml=(typeof v==='string')?v:(v&&v.raw)?v.raw:(v&&v.body)?v.body:''; }
        const rn = dr['_rels'];
        if (rn) { const rk=Object.keys(rn)[0]; const rv=rn[rk]; relsXml=(typeof rv==='string')?rv:(rv&&rv.raw)?rv.raw:(rv&&rv.body)?rv.body:''; }
      }
    } catch(_) {}

    // 방법2: 플랫 경로
    if (!drawingXml) { const v=wb2['xl/drawings/drawing1.xml']; if(typeof v==='string') drawingXml=v; }
    if (!relsXml)    { const v=wb2['xl/drawings/_rels/drawing1.xml.rels']; if(typeof v==='string') relsXml=v; }

    // 방법3: wb2.zip
    if (!drawingXml) {
      try {
        const dec2=new TextDecoder('utf-8'), zip=wb2.zip;
        if (zip&&zip.files) {
          const dk=Object.keys(zip.files).find(k=>k.includes('drawings/')&&k.endsWith('.xml')&&!k.includes('_rels'));
          const rk=Object.keys(zip.files).find(k=>k.includes('drawings/_rels'));
          if (dk) drawingXml=zip.files[dk].asText?zip.files[dk].asText():dec2.decode(zip.files[dk]._data||zip.files[dk].data||new Uint8Array());
          if (rk) relsXml=zip.files[rk].asText?zip.files[rk].asText():'';
        }
      } catch(_) {}
    }

    // 방법4: ZIP 직접 파싱 + DecompressionStream (async deflate inflate)
    if (!drawingXml || !relsXml) {
      const xmlResult = await _readZipDeflated(uint8arr, [
        'xl/drawings/drawing1.xml',
        'xl/drawings/_rels/drawing1.xml.rels'
      ]);
      if (!drawingXml && xmlResult['xl/drawings/drawing1.xml'])               drawingXml = xmlResult['xl/drawings/drawing1.xml'];
      if (!relsXml    && xmlResult['xl/drawings/_rels/drawing1.xml.rels']) relsXml    = xmlResult['xl/drawings/_rels/drawing1.xml.rels'];
    }

    if (!drawingXml || !relsXml) { console.warn('drawing XML/rels 추출 실패'); return; }
    _parseDrawingAndMatch(drawingXml, relsXml, uint8arr, wb2, resultMap);

  } catch(err) { console.warn('extractXlsxImages 오류:', err); }
}

// ZIP에서 deflate 파일을 비동기로 읽기
async function _readZipDeflated(uint8arr, targets) {
  const out = {};
  try {
    const u8   = uint8arr instanceof Uint8Array ? uint8arr : new Uint8Array(uint8arr);
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const dec  = new TextDecoder('utf-8');

    let eocd = -1;
    for (let i=u8.length-22; i>=0; i--) { if(view.getUint32(i,true)===0x06054B50){eocd=i;break;} }
    if (eocd<0) return out;

    const cdN=view.getUint16(eocd+8,true), cdOff=view.getUint32(eocd+16,true);
    let pos=cdOff;
    const entries={};
    for (let i=0; i<cdN; i++) {
      if(view.getUint32(pos,true)!==0x02014B50) break;
      const method=view.getUint16(pos+10,true), compSize=view.getUint32(pos+20,true);
      const fnLen=view.getUint16(pos+28,true), exLen=view.getUint16(pos+30,true), cmLen=view.getUint16(pos+32,true);
      const localOff=view.getUint32(pos+42,true);
      const fname=dec.decode(u8.subarray(pos+46,pos+46+fnLen));
      if(targets.includes(fname)) entries[fname]={method,compSize,localOff};
      pos+=46+fnLen+exLen+cmLen;
    }

    for (const [fname,e] of Object.entries(entries)) {
      const lp=e.localOff;
      if(view.getUint32(lp,true)!==0x04034B50) continue;
      const lfLen=view.getUint16(lp+26,true), leLen=view.getUint16(lp+28,true);
      const raw=u8.slice(lp+30+lfLen+leLen, lp+30+lfLen+leLen+e.compSize);
      if (e.method===0) { out[fname]=dec.decode(raw); continue; }
      if (e.method===8) {
        try {
          const ds=new DecompressionStream('deflate-raw');
          const writer=ds.writable.getWriter(), reader=ds.readable.getReader();
          writer.write(raw); writer.close();
          const chunks=[]; let total=0;
          while(true){const{done,value}=await reader.read(); if(done)break; chunks.push(value); total+=value.length;}
          const combined=new Uint8Array(total); let off=0;
          for(const c of chunks){combined.set(c,off);off+=c.length;}
          out[fname]=dec.decode(combined);
        } catch(ie){console.warn('inflate 실패:',fname,ie);}
      }
    }
  } catch(e){console.warn('_readZipDeflated 오류:',e);}
  return out;
}

// ─── drawing XML 파싱 + 이미지-품목 매칭 ─────────────────────────────────────
function _parseDrawingAndMatch(drawingXml, relsXml, uint8arr, wb2, resultMap) {
  try {
    // rels: rId → 파일명
    const relMap = {};
    for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g))
      relMap[m[1]] = m[2].split('/').pop();

    // anchor 파싱 → 이미지 / 텍스트박스 분류
    const imgE = [], lblE = [];
    for (const am of drawingXml.matchAll(/<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g)) {
      const b   = am[0];
      const frR = (b.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/) || [])[1];
      const frC = (b.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/) || [])[1];
      const toC = (b.match(/<xdr:to>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/)   || [])[1];
      const fr  = parseInt(frR||'0'), fc = parseInt(frC||'0'), tc = parseInt(toC||String(fc));
      const emb = b.match(/r:embed="(rId\d+)"/);
      const txt = [...b.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map(m=>m[1]).join(' ').trim();
      if (emb) imgE.push({ fr, fc, tc, file: relMap[emb[1]] || '' });
      else if (txt) lblE.push({ fr, fc, tc, text: txt });
    }

    // 미디어 바이트 읽기 (ZIP stored 방식 — 미디어는 compress=0)
    const getMediaBytes = (filename) => {
      // 방법A: wb2.xl.media 배열
      try {
        const media = wb2 && wb2.xl && wb2.xl.media;
        if (Array.isArray(media)) {
          const m = media.find(x => (x.name||x.n||'') === filename);
          if (m) {
            const d = m.data || m;
            if (d instanceof Uint8Array) return d;
            if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
          }
        }
      } catch(_) {}
      // 방법B: ZIP 직접 파싱 (stored 전용)
      try {
        const u8   = uint8arr instanceof Uint8Array ? uint8arr : new Uint8Array(uint8arr);
        const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        const dec  = new TextDecoder('utf-8');
        let eocd = -1;
        for (let i=u8.length-22; i>=0; i--) { if(view.getUint32(i,true)===0x06054B50){eocd=i;break;} }
        if (eocd<0) return null;
        const cdN=view.getUint16(eocd+8,true), cdOff=view.getUint32(eocd+16,true);
        let pos=cdOff;
        for (let i=0; i<cdN; i++) {
          if(view.getUint32(pos,true)!==0x02014B50) break;
          const method=view.getUint16(pos+10,true), compSize=view.getUint32(pos+20,true);
          const fnLen=view.getUint16(pos+28,true), exLen=view.getUint16(pos+30,true), cmLen=view.getUint16(pos+32,true);
          const localOff=view.getUint32(pos+42,true);
          const fname=dec.decode(u8.subarray(pos+46,pos+46+fnLen));
          pos+=46+fnLen+exLen+cmLen;
          if (fname===`xl/media/${filename}` && method===0) {
            const lp=localOff;
            if(view.getUint32(lp,true)!==0x04034B50) continue;
            const lfL=view.getUint16(lp+26,true), leL=view.getUint16(lp+28,true);
            return u8.subarray(lp+30+lfL+leL, lp+30+lfL+leL+compSize);
          }
        }
      } catch(_) {}
      return null;
    };

    // bytes → base64 data URL
    const toDataUrl = (bytes, filename) => {
      const ext  = filename.split('.').pop().toLowerCase();
      const mime = ext==='png'?'image/png':ext==='gif'?'image/gif':'image/jpeg';
      let bin='';
      for (let i=0; i<bytes.length; i+=8192)
        bin+=String.fromCharCode(...bytes.subarray(i,Math.min(i+8192,bytes.length)));
      return `data:${mime};base64,${btoa(bin)}`;
    };

    // ── 매칭 전략 ──
    // 우선순위1: 텍스트박스 맨 앞 숫자 = 완제품 NO(displayId)로 직접 매칭
    // 우선순위2: 품목명 텍스트 유사도로 매칭 (기존 방식)
    const used = new Set();

    for (const lbl of lblE) {
      const lblCenter = (lbl.fc + lbl.tc) / 2;
      const rawText   = lbl.text.trim();

      // 맨 앞 숫자 추출 (NO 기반 매칭)
      const noMatch = rawText.match(/^(\d+)\s+/);
      const labelNo = noMatch ? noMatch[1] : null;

      // 품목명 추출 (숫자 제거 후 "전용" 이전까지)
      const partName = rawText
        .replace(/^\d+\s+/, '')       // 앞 번호 제거
        .replace(/전용[\s\S]*/i, '')  // "전용..." 이후 제거
        .replace(/\s+/g, ' ').trim();

      // 이미지 후보: 텍스트박스보다 위에 있는 이미지
      const cands = imgE.filter(i => i.fr < lbl.fr && !used.has(i.file) && i.file);
      if (!cands.length) continue;
      const best = cands.reduce((a,b) =>
        Math.abs((a.fc+a.tc)/2-lblCenter) <= Math.abs((b.fc+b.tc)/2-lblCenter) ? a : b
      );
      used.add(best.file);

      // 이미지 바이트 읽기
      const imgBytes = getMediaBytes(best.file);
      if (!imgBytes || !imgBytes.length) { console.warn(`미디어 읽기 실패: ${best.file}`); continue; }

      const dataUrl = toDataUrl(imgBytes, best.file);

      // resultMap에 저장: NO키 + 품목명키 모두 저장해 매칭률 극대화
      if (labelNo) {
        resultMap[`__NO__${labelNo}`] = dataUrl;
        console.log(`✓ NO=${labelNo} "${partName}" ← ${best.file}`);
      }
      resultMap[normalizeImgKey(partName)] = dataUrl;
    }
  } catch(err) {
    console.warn('_parseDrawingAndMatch 오류:', err);
  }
}

const SHEET_NAME = 'Parts';
const IMAGE_FOLDER_NAME = 'PartListDB_Images';
const HEADERS = [
  'id','displayId','globalNo','isAssembly','isSub',
  'category','categoryClass','model','name','code',
  'material','thickness','width_raw','pitch',
  'dim_l','dim_w','dim_h','weight_g',
  'cav','set_qty','tray_qty','manager',
  'approvalDate','uploadBatch','rowIndex','createdAt','imageUrl'
];

// ── 요청 게시판(Q&A) 시트 ──
const QNA_SHEET_NAME = 'QnA';
const QNA_HEADERS = [
  'id','title','content','author','status','answer','createdAt','answeredAt'
];

function doGet(e) {
  const action   = e.parameter.action;
  const callback = e.parameter.callback;
  let result;
  try {
    if      (action === 'getAll')      result = getAllParts();
    else if (action === 'clearAll')    result = clearAll();
    else if (action === 'upsert')      result = upsert(e.parameter);
    else if (action === 'updateImage') result = updateField(e.parameter.id, 'imageUrl', e.parameter.imageUrl);
    else if (action === 'updateField') result = updateField(e.parameter.id, e.parameter.field, e.parameter.value);
    else if (action === 'uploadImage') result = uploadImageToDrive(e.parameter.id, e.parameter.imageData);
    else if (action === 'deleteImage') result = deleteImageFromDrive(e.parameter.id);
    else if (action === 'getQna')      result = getAllQna();
    else if (action === 'addQna')      result = addQna(e.parameter);
    else if (action === 'answerQna')   result = answerQna(e.parameter);
    else if (action === 'deleteQna')   result = deleteQna(e.parameter.id);
    else result = { ok: false, error: 'unknown action' };
  } catch(err) {
    result = { ok: false, error: err.message };
  }
  const json = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST 요청 처리 (이미지 업로드 등 대용량 데이터 전송용) ──
function doPost(e) {
  const action = e.parameter.action;
  let result;
  try {
    if      (action === 'uploadImage') result = uploadImageToDrive(e.parameter.id, e.parameter.imageData);
    else if (action === 'deleteImage') result = deleteImageFromDrive(e.parameter.id);
    else if (action === 'upsert')      result = upsert(e.parameter);
    else if (action === 'getQna')      result = getAllQna();
    else if (action === 'addQna')      result = addQna(e.parameter);
    else if (action === 'answerQna')   result = answerQna(e.parameter);
    else if (action === 'deleteQna')   result = deleteQna(e.parameter.id);
    else result = { ok: false, error: 'unknown action' };
  } catch(err) {
    result = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 전체 시트를 텍스트 형식으로 설정 (날짜 자동변환 방지)
    sheet.getRange(1, 1, 1000, HEADERS.length).setNumberFormat('@');
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function setTextFormat(sheet) {
  // displayId 컬럼 전체를 텍스트 형식 강제 적용
  const dIdx = HEADERS.indexOf('displayId') + 1;
  sheet.getRange(1, dIdx, 1000, 1).setNumberFormat('@');
}

function getAllParts() {
  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, parts: [] };
  const headers = rows[0];
  const parts = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      // Date 객체가 들어온 경우 문자열 변환
      obj[h] = v instanceof Date ? v.toISOString() : v;
    });
    obj.isAssembly = obj.isAssembly === true || obj.isAssembly === 'true';
    obj.isSub      = obj.isSub === true || obj.isSub === 'true';
    return obj;
  });
  return { ok: true, parts };
}

function clearAll() {
  const sheet = getSheet();
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  // clearAll 후 displayId 컬럼 텍스트 형식 강제 (upsert 전에 실행됨)
  setTextFormat(sheet);
  return { ok: true };
}

function upsert(params) {
  const part    = JSON.parse(params.part || '{}');
  const sheet   = getSheet();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');

  // 모든 값을 문자열로 변환
  const toRow = () => headers.map(h => {
    const v = part[h];
    if (v === undefined || v === null) return '';
    return String(v);
  });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(part.id)) {
      // appendRow 대신 setValues 사용
      sheet.getRange(i+1, 1, 1, headers.length).setValues([toRow()]);
      return { ok: true };
    }
  }
  // 새 행 추가 시 appendRow 대신 setValues 사용
  const newRowIdx = sheet.getLastRow() + 1;
  sheet.getRange(newRowIdx, 1, 1, headers.length).setValues([toRow()]);
  return { ok: true };
}

function updateField(id, field, value) {
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();
  const idCol  = data[0].indexOf('id');
  const fldCol = data[0].indexOf(field);
  if (fldCol === -1) return { ok: false, error: 'field not found' };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.getRange(i+1, fldCol+1).setValue(String(value || ''));
      return { ok: true };
    }
  }
  return { ok: false, error: 'not found' };
}

// ── 이미지를 Google Drive에 저장하고, 공개 보기 링크를 시트의 imageUrl에 저장 ──
function getImageFolder() {
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(IMAGE_FOLDER_NAME);
}

function uploadImageToDrive(id, dataUrl) {
  if (!id)      return { ok: false, error: 'no id' };
  if (!dataUrl) return { ok: false, error: 'no image data' };

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) return { ok: false, error: 'invalid data url' };

  const mimeType = match[1];
  const base64   = match[2];
  const ext      = mimeType.split('/')[1].split('+')[0] || 'png';
  const bytes    = Utilities.base64Decode(base64);

  const folder = getImageFolder();

  // 기존 이미지 파일이 있으면 삭제 후 재업로드 (확장자가 다를 수 있으므로 prefix로 검색)
  const existing = folder.getFiles();
  while (existing.hasNext()) {
    const f = existing.next();
    if (f.getName().indexOf(id + '.') === 0) f.setTrashed(true);
  }

  const blob = Utilities.newBlob(bytes, mimeType, id + '.' + ext);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const url = 'https://lh3.googleusercontent.com/d/' + file.getId();

  // 시트의 imageUrl 컬럼도 함께 업데이트
  updateField(id, 'imageUrl', url);

  return { ok: true, url: url };
}

function deleteImageFromDrive(id) {
  if (!id) return { ok: false, error: 'no id' };
  const folder = getImageFolder();
  const files = folder.getFiles();
  let found = false;
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().indexOf(id + '.') === 0) { f.setTrashed(true); found = true; }
  }
  updateField(id, 'imageUrl', '');
  return { ok: true, found };
}

// ── 요청 게시판(Q&A) ──────────────────────────────────────────
function getQnaSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(QNA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(QNA_SHEET_NAME);
    sheet.getRange(1, 1, 1, QNA_HEADERS.length).setValues([QNA_HEADERS]);
  }
  return sheet;
}

function getAllQna() {
  const sheet = getQnaSheet();
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, qna: [] };
  const headers = rows[0];
  const qna = rows.slice(1)
    .filter(row => row[headers.indexOf('id')]) // 빈 행 제외
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const v = row[i];
        obj[h] = v instanceof Date ? v.toISOString() : v;
      });
      return obj;
    });
  return { ok: true, qna };
}

function addQna(params) {
  const post  = JSON.parse(params.post || '{}');
  const sheet = getQnaSheet();
  const row = QNA_HEADERS.map(h => {
    const v = post[h];
    if (v === undefined || v === null) return '';
    return String(v);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, QNA_HEADERS.length).setValues([row]);
  return { ok: true };
}

function answerQna(params) {
  const sheet   = getQnaSheet();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol     = headers.indexOf('id');
  const answerCol = headers.indexOf('answer');
  const statusCol = headers.indexOf('status');
  const answeredAtCol = headers.indexOf('answeredAt');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(params.id)) {
      sheet.getRange(i+1, answerCol+1).setValue(String(params.answer || ''));
      sheet.getRange(i+1, statusCol+1).setValue(String(params.status || '대기'));
      sheet.getRange(i+1, answeredAtCol+1).setValue(String(params.answeredAt || ''));
      return { ok: true };
    }
  }
  return { ok: false, error: 'not found' };
}

function deleteQna(id) {
  const sheet   = getQnaSheet();
  const data    = sheet.getDataRange().getValues();
  const idCol   = data[0].indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i+1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'not found' };
}

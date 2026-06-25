// ============================================================
// Part List Database — core.js
// ============================================================

// ─── THEME ───────────────────────────────────────────────────────────────────
const THEME_KEY = 'shieldcan_theme';
let currentTheme = localStorage.getItem(THEME_KEY) || 'dark';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// Apply saved theme immediately on load
applyTheme(currentTheme);

// ─── STATE ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'shieldcan_parts_v1';
let parts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

// ── 중복 판정 키: CODE가 있으면 모델+CODE, 없으면 모델+품명 ──
// (같은 부품을 다른 파일로 재업로드할 때 품명에 "(일관 2열)" 등 줄바꿈/표기 차이가
//  있어도 CODE NO.가 같으면 동일 부품으로 간주하여 중복 제거)
function partDedupKey(p) {
  const model = String(p.model||'').trim().toUpperCase();
  const code = String(p.code||'').trim().toUpperCase();
  if (code) return `${model}|${code}`;
  return `${model}|${String(p.name||'').trim().replace(/\s+/g,' ').toUpperCase()}`;
}

// ── displayId("1", "1-1", "2-3" 등)를 [메인번호, 서브번호]로 분해 ──
function parseDisplayId(displayId) {
  const s = String(displayId||'').trim();
  const m = s.match(/^(\d+)(?:-(\d+))?/);
  if (!m) return [999999, 0];
  return [parseInt(m[1], 10) || 0, m[2] ? (parseInt(m[2], 10) || 0) : 0];
}

// ── 중복 제거(부족한 필드 보완) + 모델별 그룹화 + NO 순서 정렬 ──
// 여러 번 업로드된 동일 부품(CODE 동일)이 서로 다른 정보(이미지/금형TYPE/담당자 등)를
// 갖고 있을 경우 병합하고, 같은 모델의 항목들이 다른 모델 항목과 섞이지 않도록
// 모델 단위로 묶은 뒤 NO(1, 1-1, 1-2, 2, 2-1...) 순서로 정렬한다.
function dedupAndSortParts(arr) {
  const isEmpty = (v) => v === undefined || v === null || v === '' || v === '-';
  const map = new Map();
  arr.forEach(p => {
    const key = partDedupKey(p);
    const existing = map.get(key);
    if (!existing) { map.set(key, p); return; }
    // 기존 항목에 비어있는 필드는 새 항목의 값으로 보완
    ['imageUrl', 'moldType', 'manager', 'category', 'categoryClass'].forEach(f => {
      if (isEmpty(existing[f]) && !isEmpty(p[f])) existing[f] = p[f];
    });
  });
  let result = Array.from(map.values());
  // 모델이 처음 등장하는 시점(uploadBatch/createdAt 최소값) 기준으로 모델 그룹 순서 결정
  const modelOrder = new Map();
  result.forEach(p => {
    const model = String(p.model||'').trim();
    const ts = Number(p.uploadBatch) || Number(p.createdAt) || 0;
    if (!modelOrder.has(model) || ts < modelOrder.get(model)) modelOrder.set(model, ts);
  });
  result.sort((a, b) => {
    const ma = String(a.model||'').trim(), mb = String(b.model||'').trim();
    if (ma !== mb) return (modelOrder.get(ma)||0) - (modelOrder.get(mb)||0);
    const [aMain, aSub] = parseDisplayId(a.displayId);
    const [bMain, bSub] = parseDisplayId(b.displayId);
    if (aMain !== bMain) return aMain - bMain;
    return aSub - bSub;
  });
  result.forEach((p, i) => { p.globalNo = i + 1; });
  return result;
}

// ── 손상/유령/테스트 데이터 정리 (이름은 있으나 코드·모델·NO가 모두 비어있는 항목 제거 + 중복 제거) ──
(function cleanupGhostParts() {
  const isGhost = (p) => {
    const noCode = !p.code || !String(p.code).trim();
    const noModel = !p.model || !String(p.model).trim() || String(p.model).trim() === '-';
    const noDisplay = !p.displayId || !String(p.displayId).trim() || String(p.displayId).trim() === '-';
    return noCode && noModel && noDisplay;
  };
  // Sheets 연동 점검 중 잘못 들어간 테스트 레코드 제거
  const isTestRecord = (p) => p.id === '__test_img__' || p.model === 'TESTMODEL' || p.code === 'TESTCODE';
  parts = parts.filter(p => !isGhost(p) && !isTestRecord(p));
  parts = dedupAndSortParts(parts);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
  // 주의: 여기서 자동으로 syncToSheets()를 호출하지 않음.
  // 페이지 로드 시점의 localStorage는 Sheets의 최신 데이터를 반영하기 전이므로,
  // 이 시점에 clearAll+재업서트를 하면 오래된 로컬 스냅샷으로 Sheets를 덮어써
  // 중복/누락 데이터가 발생함. 정리는 로컬에서만 수행하고, 실제 동기화는
  // loadFromSheets() 이후 사용자가 데이터를 변경할 때(saveParts) 이루어짐.
})();

// 초기 로드 시 globalNo 재계산
parts.forEach((p, i) => { p.globalNo = i + 1; });
let currentTab = 'status';
let pendingAction = null;

function saveParts() {
  parts.forEach((p, i) => { p.globalNo = i + 1; });
  // base64 이미지는 localStorage에 저장하지 않음 (5MB 한도 초과 방지)
  // Drive URL은 그대로 저장, base64는 null로 교체 후 저장
  const forStorage = parts.map(p => ({
    ...p,
    imageUrl: (p.imageUrl && p.imageUrl.startsWith('data:')) ? null : p.imageUrl
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forStorage));
    showSyncStatus('로컬 저장됨', 'success');
  } catch(e) {
    // 그래도 넘치면 이미지 전체 제외 후 재시도
    const minimal = parts.map(p => ({ ...p, imageUrl: null }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    showSyncStatus('로컬 저장됨 (이미지 제외)', 'success');
  }
  // Google Sheets 동기화 (연동 설정 시)
  if (gasUrl) syncToSheets();
}

// ─── LOCK ─────────────────────────────────────────────────────────────────────
function tryUnlock(e) {
  e.preventDefault();
  const pw = document.getElementById('pwInput').value;
  if (pw === '1234') {
    document.getElementById('lockScreen').style.display = 'none';
    const app = document.getElementById('app');
    app.classList.add('visible');
    initGasBadge();
    // 로컬 데이터 즉시 렌더링
    renderParts();
    renderStatus();
    renderQna();
    // Sheets 연동 시 최신 데이터로 갱신
    if (gasUrl) {
      loadFromSheets().then(loaded => {
        if (loaded) {
          renderParts();
          renderStatus();
        }
      });
      loadQnaFromSheets();
    }
  } else {
    const inp = document.getElementById('pwInput');
    inp.classList.add('error');
    inp.value = '';
    document.getElementById('pwHint').textContent = '비밀번호가 일치하지 않습니다.';
    document.getElementById('pwHint').className = 'pw-hint err-msg';
    setTimeout(() => {
      inp.classList.remove('error');
      document.getElementById('pwHint').textContent = '';
      document.getElementById('pwHint').className = 'pw-hint';
    }, 1500);
  }
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('panelList').style.display = tab === 'list' ? '' : 'none';
  document.getElementById('panelStatus').style.display = tab === 'status' ? '' : 'none';
  document.getElementById('panelQna').style.display = tab === 'qna' ? '' : 'none';
  document.getElementById('tabList').className = 'tab-btn' + (tab === 'list' ? ' active' : '');
  document.getElementById('tabStatus').className = 'tab-btn' + (tab === 'status' ? ' active' : '');
  document.getElementById('tabQna').className = 'tab-btn' + (tab === 'qna' ? ' active' : '');
  if (tab === 'status') renderStatus();
  if (tab === 'qna') renderQna();
}

// ─── SYNC STATUS ──────────────────────────────────────────────────────────────
function showSyncStatus(msg, type) {
  const el = document.getElementById('syncStatus');
  el.className = 'status-badge ' + type;
  el.innerHTML = `<div class="pulse" style="background:${type==='success'?'var(--green)':type==='error'?'var(--rose)':'var(--accent2)'}"></div><span>${msg}</span>`;
}

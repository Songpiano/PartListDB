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
  const seen = new Set();
  const before = parts.length;
  parts = parts.filter(p => {
    if (isGhost(p) || isTestRecord(p)) return false;
    const key = `${String(p.model||'').trim()}|${String(p.name||'').trim().replace(/\s+/g,' ')}|${String(p.code||'').trim()}`.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // 정렬 복원: uploadBatch → rowIndex 순 (Sheets 동기화로 순서가 뒤틀린 경우 대비)
  parts.sort((a, b) => {
    const bA = Number(a.uploadBatch) || 0, bB = Number(b.uploadBatch) || 0;
    if (bA !== bB) return bA - bB;
    return (Number(a.rowIndex) || 0) - (Number(b.rowIndex) || 0);
  });
  parts.forEach((p, i) => { p.globalNo = i + 1; });
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
  showSyncStatus('로컬 저장됨', 'success');
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
    // Sheets 연동 시 최신 데이터로 갱신
    if (gasUrl) {
      loadFromSheets().then(loaded => {
        if (loaded) {
          renderParts();
          renderStatus();
        }
      });
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
  document.getElementById('tabList').className = 'tab-btn' + (tab === 'list' ? ' active' : '');
  document.getElementById('tabStatus').className = 'tab-btn' + (tab === 'status' ? ' active' : '');
  if (tab === 'status') renderStatus();
}

// ─── SYNC STATUS ──────────────────────────────────────────────────────────────
function showSyncStatus(msg, type) {
  const el = document.getElementById('syncStatus');
  el.className = 'status-badge ' + type;
  el.innerHTML = `<div class="pulse" style="background:${type==='success'?'var(--green)':type==='error'?'var(--rose)':'var(--accent2)'}"></div><span>${msg}</span>`;
}

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
    // Sheets 연동 시 최신 데이터 불러오기
    if (gasUrl) {
      loadFromSheets().then(() => {
        renderParts();
        renderStatus();
      });
    } else {
      renderParts();
      renderStatus();
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

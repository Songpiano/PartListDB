/* ================================================================
   Part List Database — demo.js
   대시보드 자동 소개 영상 시연 스크립트
   버전: 20260622a
================================================================ */

(function () {
  'use strict';

  /* ── 시연 시퀀스 정의 ─────────────────────────────────────────
     각 스텝: { time(ms), action(), title, desc, highlight(selector) }
  ─────────────────────────────────────────────────────────────── */
  const STEPS = [
    // 0: 인트로
    {
      time: 0,
      title: '📱 Part List Database',
      desc: '승인 모델 파트리스트 취합 · 조회 통합 관리 시스템',
      highlight: '.header-brand',
      action: () => { switchTab('status'); }
    },
    // 1: 연간 현황 소개
    {
      time: 4500,
      title: '📊 연간 모델 개발 현황',
      desc: '승인일자 기준으로 연도별 프로젝트 현황을 한눈에 파악합니다',
      highlight: '#panelStatus',
      action: () => {}
    },
    // 2: 타임라인 카드 설명
    {
      time: 10000,
      title: '📅 타임라인 카드',
      desc: '각 연도별 승인 모델 수 · 부품 수 · 담당자를 타임라인으로 확인합니다',
      highlight: '.timeline',
      action: () => {
        const tl = document.getElementById('timelineGrid');
        if (tl) tl.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    // 3: 연간 현황 스크롤
    {
      time: 16500,
      title: '📈 연도별 상세 정보',
      desc: '모델별 사양, 규격, 담당 인원을 한 화면에서 비교할 수 있습니다',
      highlight: '.timeline',
      action: () => {
        window.scrollTo({ top: 400, behavior: 'smooth' });
      }
    },
    // 4: 부품 리스트 탭 전환
    {
      time: 22000,
      title: '📋 부품 리스트 탭 이동',
      desc: '부품 리스트 탭으로 이동하여 상세 파트 정보를 확인합니다',
      highlight: '#tabList',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => switchTab('list'), 800);
      }
    },
    // 5: 부품 리스트 전체 뷰
    {
      time: 28000,
      title: '🗂️ 부품 리스트',
      desc: '모델별 ASSY 코드와 하위 파트를 카드 형태로 깔끔하게 정리했습니다',
      highlight: '.parts-grid',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    // 6: 검색 기능
    {
      time: 34500,
      title: '🔍 실시간 통합 검색',
      desc: '품명 · 코드 · 모델명으로 즉시 검색 — ESC 키로 빠르게 초기화됩니다',
      highlight: '.search-wrap',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const inp = document.getElementById('searchInput');
        if (inp) {
          inp.focus();
          demoTypeText(inp, 'BRK', 80, () => {});
        }
      }
    },
    // 7: 검색 결과 표시
    {
      time: 41000,
      title: '✨ 검색 결과 하이라이트',
      desc: '검색어와 일치하는 부품이 즉시 필터링되어 표시됩니다',
      highlight: '.parts-grid',
      action: () => {}
    },
    // 8: 검색 초기화 (ESC)
    {
      time: 47000,
      title: '⌨️ ESC 키로 즉시 초기화',
      desc: 'ESC를 누르면 검색어와 필터가 모두 초기화됩니다',
      highlight: '.search-wrap',
      action: () => {
        const inp = document.getElementById('searchInput');
        if (inp) {
          inp.value = '';
          if (typeof onSearchInput === 'function') onSearchInput();
          inp.blur();
        }
      }
    },
    // 9: 필터 기능
    {
      time: 52500,
      title: '🔧 다중 필터 조합',
      desc: '아이템군 · 원소재 · 가로/세로/높이 치수 필터를 조합해 정밀 검색합니다',
      highlight: '.filter-bar',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    // 10: 하위코드 펼치기
    {
      time: 59000,
      title: '📂 하위 파트 코드 펼치기',
      desc: 'ASSY 카드를 클릭하면 하위 파트 코드 목록이 펼쳐집니다',
      highlight: '.parts-grid',
      action: () => {
        window.scrollTo({ top: 200, behavior: 'smooth' });
        setTimeout(() => {
          const toggleBtn = document.querySelector('.part-card .toggle-btn, .part-card .sub-toggle');
          if (toggleBtn) toggleBtn.click();
        }, 600);
      }
    },
    // 11: 하위코드 상세
    {
      time: 65000,
      title: '🔩 하위 파트 상세 정보',
      desc: '원소재 · 치수(가로×세로×높이) · 무게 · 금형 Type · 담당자를 한눈에 확인합니다',
      highlight: '.parts-grid',
      action: () => {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
    },
    // 12: 데이터 추가 버튼
    {
      time: 71500,
      title: '📁 엑셀 데이터 추가',
      desc: '여러 개의 파트리스트 엑셀 파일을 한 번에 업로드할 수 있습니다',
      highlight: '.header-actions .btn:first-child, [data-action="upload"], #uploadBtn',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        switchTab('list');
      }
    },
    // 13: 데이터 추가 오류 시연
    {
      time: 78000,
      title: '⚠️ 데이터 형식 오류 안내',
      desc: '잘못된 형식의 파일 업로드 시 항목별 오류 메시지로 원인을 즉시 안내합니다',
      highlight: '#syncStatus',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // 오류 메시지 시뮬레이션 - NO 순서 오류
        if (typeof showSyncStatus === 'function') {
          showSyncStatus('등록 불가: 파일명.xlsx (NO 순서 오류)', 'error');
        }
        // 커스텀 오류 배너 표시
        const banner = document.createElement('div');
        banner.id = 'demo-error-banner';
        banner.style.cssText = `
          position:fixed; top:80px; left:50%; transform:translateX(-50%);
          z-index:99998; background:rgba(220,53,69,0.95);
          color:#fff; font-size:14px; font-weight:700;
          padding:14px 28px; border-radius:10px;
          box-shadow:0 8px 32px rgba(220,53,69,0.5);
          font-family:'Pretendard','Noto Sans KR',sans-serif;
          max-width:520px; text-align:center; line-height:1.6;
          backdrop-filter:blur(8px);
          animation: demoFadeIn 0.3s ease;
        `;
        if (!document.getElementById('demo-error-anim')) {
          const style = document.createElement('style');
          style.id = 'demo-error-anim';
          style.textContent = '@keyframes demoFadeIn { from{opacity:0;transform:translateX(-50%) translateY(-10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }';
          document.head.appendChild(style);
        }
        banner.innerHTML = `
          <div style="font-size:18px;margin-bottom:4px;">⚠️ 파트리스트 오류로 등록할 수 없습니다</div>
          <div style="font-weight:400;opacity:0.9;">파일명.xlsx — NO 순서 오류<br><span style="font-size:12px;opacity:0.75;">항목 순서를 확인하고 다시 업로드해주세요</span></div>
        `;
        document.body.appendChild(banner);
        setTimeout(() => { if (banner.parentNode) banner.remove(); }, 6000);
      }
    },
    // 14: 금형 TYPE 오류 예시
    {
      time: 85000,
      title: '🔴 금형 TYPE 오류',
      desc: '금형 TYPE 값이 올바르지 않을 때도 파일명과 함께 정확한 오류 원인을 표시합니다',
      highlight: '#syncStatus',
      action: () => {
        if (typeof showSyncStatus === 'function') {
          showSyncStatus('등록 불가: 파일명.xlsx (금형TYPE 오류)', 'error');
        }
        const banner = document.createElement('div');
        banner.id = 'demo-error-banner2';
        banner.style.cssText = `
          position:fixed; top:80px; left:50%; transform:translateX(-50%);
          z-index:99998; background:rgba(220,53,69,0.95);
          color:#fff; font-size:14px; font-weight:700;
          padding:14px 28px; border-radius:10px;
          box-shadow:0 8px 32px rgba(220,53,69,0.5);
          font-family:'Pretendard','Noto Sans KR',sans-serif;
          max-width:520px; text-align:center; line-height:1.6;
          backdrop-filter:blur(8px);
          animation: demoFadeIn 0.3s ease;
        `;
        banner.innerHTML = `
          <div style="font-size:18px;margin-bottom:4px;">⚠️ 금형TYPE 오류로 등록할 수 없습니다</div>
          <div style="font-weight:400;opacity:0.9;">파일명.xlsx — 금형TYPE 오류<br><span style="font-size:12px;opacity:0.75;">허용된 금형 TYPE 값을 사용하고 다시 업로드해주세요</span></div>
        `;
        document.body.appendChild(banner);
        setTimeout(() => { if (banner.parentNode) banner.remove(); }, 5500);
      }
    },
    // 15: Q&A 탭
    {
      time: 92000,
      title: '💬 요청 게시판',
      desc: '기능 요청, 데이터 수정 등을 자유롭게 남길 수 있는 게시판입니다',
      highlight: '#tabQna',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => switchTab('qna'), 800);
      }
    },
    // 16: Q&A 리스트
    {
      time: 98500,
      title: '📋 요청 · 답변 현황',
      desc: '작성된 요청과 답변 상태(대기중 · 완료)를 한눈에 확인합니다',
      highlight: '#qnaList',
      action: () => {}
    },
    // 17: 테마 전환
    {
      time: 104500,
      title: '🌙 라이트 / 다크 테마',
      desc: '눈이 편한 다크 모드와 명확한 라이트 모드를 자유롭게 전환합니다',
      highlight: '#themeToggle',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        switchTab('status');
        setTimeout(() => {
          if (typeof toggleTheme === 'function') toggleTheme();
        }, 600);
      }
    },
    // 18: 라이트 테마 상태
    {
      time: 110000,
      title: '☀️ 라이트 테마 적용',
      desc: '라이트 모드에서도 모든 정보가 선명하게 표시됩니다',
      highlight: '#panelStatus',
      action: () => {}
    },
    // 19: 다크 테마로 복귀
    {
      time: 115500,
      title: '🌙 다크 테마로 복귀',
      desc: '다시 다크 모드로 전환합니다',
      highlight: '#themeToggle',
      action: () => {
        setTimeout(() => {
          if (typeof toggleTheme === 'function') toggleTheme();
        }, 400);
      }
    },
    // 20: 아웃트로
    {
      time: 120500,
      title: '✅ Part List Database',
      desc: '파트리스트 취합 · 검색 · 현황 분석을 하나의 대시보드에서 — 지금 바로 사용해보세요',
      highlight: '.header-brand',
      action: () => {
        switchTab('status');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    // 21: 종료
    { time: 127000, title: '', desc: '', highlight: null, action: () => { stopDemo(); } }
  ];

  /* ── 상태 ─────────────────────────────────────────────────────── */
  let demoRunning = false;
  let demoPaused = false;
  let demoTimers = [];
  let demoStartedAt = 0;   // Date.now() 기준 시작 시각
  let pausedElapsed = 0;   // 일시정지 시점까지 경과한 ms
  let spotlightEl = null;
  let subtitleEl = null;
  let progressEl = null;
  let overlayEl = null;
  let launchBtn = null;
  let stopBtn = null;
  let pauseBtn = null;
  let highlightBox = null;

  const TOTAL_DURATION = 127000;

  /* ── 유틸 ─────────────────────────────────────────────────────── */
  function demoTypeText(input, text, speed, cb) {
    let i = 0;
    input.value = '';
    if (typeof onSearchInput === 'function') onSearchInput();
    const iv = setInterval(() => {
      if (i < text.length) {
        input.value += text[i++];
        if (typeof onSearchInput === 'function') onSearchInput();
      } else {
        clearInterval(iv);
        if (cb) cb();
      }
    }, speed);
    demoTimers.push({ clear: () => clearInterval(iv) });
  }

  /* ── DOM 생성 ─────────────────────────────────────────────────── */
  function buildUI() {
    // 전체 오버레이 (배경 어둡게 – 클릭 막기용 투명 레이어)
    overlayEl = document.createElement('div');
    overlayEl.id = 'demo-overlay';
    overlayEl.style.cssText = `
      position:fixed; inset:0; z-index:89990; pointer-events:none;
    `;
    document.body.appendChild(overlayEl);

    // 하이라이트 박스
    highlightBox = document.createElement('div');
    highlightBox.id = 'demo-highlight';
    highlightBox.style.cssText = `
      position:fixed; z-index:89995; pointer-events:none;
      border-radius:10px; transition: all 0.6s cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 0 0 4px rgba(99,179,237,0.8), 0 0 0 8px rgba(99,179,237,0.25), 0 0 60px rgba(99,179,237,0.4);
      opacity:0;
    `;
    document.body.appendChild(highlightBox);

    // 하단 자막 바
    subtitleEl = document.createElement('div');
    subtitleEl.id = 'demo-subtitle';
    subtitleEl.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; z-index:90000;
      background: linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.92) 70%, transparent 100%);
      padding: 36px 60px 32px 60px;
      pointer-events:none;
      transition: opacity 0.4s ease;
    `;
    subtitleEl.innerHTML = `
      <div id="demo-progress-wrap" style="
        width:100%; height:5px; background:rgba(255,255,255,0.15); border-radius:999px;
        margin-bottom:20px; overflow:visible; position:relative;
        cursor:pointer; pointer-events:auto;
        transition: height 0.15s ease;
      ">
        <div id="demo-progress-bar" style="
          height:100%; width:0%; background:linear-gradient(90deg,#63b3ed,#9f7aea);
          border-radius:999px; transition:width 0.5s linear; pointer-events:none;
        "></div>
        <div id="demo-progress-thumb" style="
          position:absolute; top:50%; right:auto; width:13px; height:13px;
          background:#fff; border-radius:50%; transform:translate(-50%,-50%);
          pointer-events:none; opacity:0;
          box-shadow:0 0 0 3px rgba(99,179,237,0.6);
          transition: opacity 0.15s ease, left 0.5s linear;
        "></div>
        <div id="demo-progress-tooltip" style="
          position:absolute; bottom:18px; transform:translateX(-50%);
          background:rgba(0,0,0,0.85); color:#fff; font-size:11px; font-weight:700;
          padding:3px 8px; border-radius:6px; pointer-events:none; opacity:0;
          font-family:'JetBrains Mono',monospace; white-space:nowrap;
          transition: opacity 0.1s ease;
        "></div>
      </div>
      <div id="demo-badge" style="
        display:inline-block; background:rgba(99,179,237,0.2); border:1px solid rgba(99,179,237,0.5);
        color:#63b3ed; font-size:11px; font-weight:700; letter-spacing:0.12em;
        padding:3px 10px; border-radius:999px; margin-bottom:10px;
        font-family:'JetBrains Mono',monospace; text-transform:uppercase;
      ">● REC  PART LIST DATABASE</div>
      <div id="demo-title" style="
        font-size:26px; font-weight:800; color:#fff; line-height:1.2;
        font-family:'Pretendard','Noto Sans KR',sans-serif;
        text-shadow:0 2px 12px rgba(0,0,0,0.8);
        margin-bottom:8px; min-height:32px;
        transition: opacity 0.3s ease;
      "></div>
      <div id="demo-desc" style="
        font-size:15px; color:rgba(255,255,255,0.75); line-height:1.6;
        font-family:'Pretendard','Noto Sans KR',sans-serif;
        text-shadow:0 1px 6px rgba(0,0,0,0.6);
        min-height:24px;
        transition: opacity 0.3s ease;
      "></div>
    `;
    document.body.appendChild(subtitleEl);

    progressEl = document.getElementById('demo-progress-bar');

    // 진행 바 클릭 / 호버 이벤트
    const wrap = document.getElementById('demo-progress-wrap');
    const thumb = document.getElementById('demo-progress-thumb');
    const tooltip = document.getElementById('demo-progress-tooltip');

    function msToTime(ms) {
      const s = Math.floor(ms / 1000);
      return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
    }

    wrap.addEventListener('mouseenter', () => {
      wrap.style.height = '8px';
      if (thumb) thumb.style.opacity = '1';
    });
    wrap.addEventListener('mouseleave', () => {
      wrap.style.height = '5px';
      if (thumb) thumb.style.opacity = '0';
      if (tooltip) tooltip.style.opacity = '0';
    });
    wrap.addEventListener('mousemove', (e) => {
      const rect = wrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const hoverMs = Math.floor(ratio * TOTAL_DURATION);
      if (thumb) thumb.style.left = (ratio * 100) + '%';
      if (tooltip) {
        tooltip.style.left = (ratio * 100) + '%';
        tooltip.style.opacity = '1';
        tooltip.textContent = msToTime(hoverMs);
      }
    });
    wrap.addEventListener('click', (e) => {
      const rect = wrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(Math.floor(ratio * TOTAL_DURATION));
    });
  }

  /* ── 하이라이트 포커스 ─────────────────────────────────────────── */
  function focusHighlight(selector) {
    if (!selector || !highlightBox) return;
    const el = document.querySelector(selector);
    if (!el) { highlightBox.style.opacity = '0'; return; }

    const r = el.getBoundingClientRect();
    const PAD = 6;
    highlightBox.style.cssText = `
      position:fixed; z-index:89995; pointer-events:none;
      border-radius:10px; transition: all 0.6s cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 0 0 4px rgba(99,179,237,0.8), 0 0 0 8px rgba(99,179,237,0.25), 0 0 60px rgba(99,179,237,0.4);
      opacity:1;
      left:${r.left - PAD}px;
      top:${r.top - PAD}px;
      width:${r.width + PAD * 2}px;
      height:${r.height + PAD * 2}px;
    `;
  }

  /* ── 자막 업데이트 ─────────────────────────────────────────────── */
  function updateSubtitle(title, desc) {
    const t = document.getElementById('demo-title');
    const d = document.getElementById('demo-desc');
    if (!t || !d) return;

    // 페이드 아웃 → 교체 → 페이드 인
    t.style.opacity = '0';
    d.style.opacity = '0';
    setTimeout(() => {
      t.textContent = title;
      d.textContent = desc;
      t.style.opacity = '1';
      d.style.opacity = '1';
    }, 300);
  }

  /* ── 진행 바 업데이트 ─────────────────────────────────────────── */
  function startProgressBar() {
    const iv = setInterval(() => {
      if (!demoRunning) { clearInterval(iv); return; }
      if (demoPaused) return;
      const elapsed = pausedElapsed + (Date.now() - demoStartedAt);
      const pct = Math.min(100, (elapsed / TOTAL_DURATION) * 100);
      if (progressEl) progressEl.style.width = pct + '%';
      // thumb 동기화 (마우스가 올라가 있지 않을 때)
      const thumb = document.getElementById('demo-progress-thumb');
      if (thumb && thumb.style.opacity === '0') {
        thumb.style.transition = 'opacity 0.15s ease, left 0.5s linear';
        thumb.style.left = pct + '%';
      }
      if (pct >= 100) clearInterval(iv);
    }, 200);
    demoTimers.push({ clear: () => clearInterval(iv) });
  }

  /* ── 특정 시간으로 이동 ───────────────────────────────────────── */
  function seekTo(targetMs) {
    if (!demoRunning) return;
    targetMs = Math.max(0, Math.min(TOTAL_DURATION, targetMs));

    // 현재 실행 중인 타이머 전부 취소
    demoTimers.forEach(t => t.clear());
    demoTimers = [];

    // 경과 시간 업데이트
    pausedElapsed = targetMs;
    demoStartedAt = Date.now();

    // 진행 바 즉시 반영
    const pct = (targetMs / TOTAL_DURATION) * 100;
    if (progressEl) {
      progressEl.style.transition = 'none';
      progressEl.style.width = pct + '%';
      requestAnimationFrame(() => { progressEl.style.transition = 'width 0.5s linear'; });
    }

    // 해당 시점의 자막 찾아서 즉시 표시
    let lastStep = null;
    for (const s of STEPS) {
      if (s.time <= targetMs && s.title) lastStep = s;
    }
    if (lastStep) updateSubtitle(lastStep.title, lastStep.desc);

    if (demoPaused) {
      // 일시정지 중이면 배지 유지, 진행 바만 갱신
      return;
    }
    startProgressBar();
    scheduleSteps(targetMs);
  }

  /* ── 스텝 스케줄링 (from = 재개 시 경과 ms) ─────────────────────── */
  function scheduleSteps(from) {
    STEPS.forEach((step) => {
      const delay = step.time - from;
      if (delay < 0) return;  // 이미 지난 스텝은 건너뜀
      const t = setTimeout(() => {
        if (!demoRunning || demoPaused) return;
        try { step.action(); } catch(e) {}
        if (step.title !== undefined) updateSubtitle(step.title, step.desc);
        setTimeout(() => {
          if (step.highlight) focusHighlight(step.highlight);
          else if (highlightBox) highlightBox.style.opacity = '0';
        }, 700);
      }, delay);
      demoTimers.push({ clear: () => clearTimeout(t) });
    });
  }

  /* ── 키보드 탐색 핸들러 ──────────────────────────────────────── */
  function _onKeySeek(e) {
    if (!demoRunning) return;
    // 입력 필드 포커스 중엔 무시
    if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = demoPaused
        ? pausedElapsed
        : pausedElapsed + (Date.now() - demoStartedAt);
      seekTo(cur - 5000);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const cur = demoPaused
        ? pausedElapsed
        : pausedElapsed + (Date.now() - demoStartedAt);
      seekTo(cur + 5000);
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    }
  }

  /* ── 데모 시작 ─────────────────────────────────────────────────── */
  function startDemo() {
    if (demoRunning) return;
    demoRunning = true;
    demoPaused = false;
    pausedElapsed = 0;
    demoStartedAt = Date.now();

    if (launchBtn) launchBtn.style.display = 'none';
    if (stopBtn)   stopBtn.style.display = 'flex';
    if (pauseBtn)  { pauseBtn.style.display = 'flex'; pauseBtn.innerHTML = '⏸ 일시정지'; }

    buildUI();
    startProgressBar();
    scheduleSteps(0);

    document.addEventListener('keydown', _onKeySeek);
  }

  /* ── 일시정지 / 재개 ──────────────────────────────────────────── */
  function pauseDemo() {
    if (!demoRunning || demoPaused) return;
    demoPaused = true;

    // 진행 타이머 취소 (진행 바 interval은 demoPaused 체크로 자동 멈춤)
    demoTimers.forEach(t => t.clear());
    demoTimers = [];

    // 경과 시간 저장
    pausedElapsed += Date.now() - demoStartedAt;

    // 자막 배지 업데이트
    const badge = document.getElementById('demo-badge');
    if (badge) badge.innerHTML = '⏸ PAUSED  PART LIST DATABASE';

    if (pauseBtn) pauseBtn.innerHTML = '▶ 재개';
  }

  function resumeDemo() {
    if (!demoRunning || !demoPaused) return;
    demoPaused = false;
    demoStartedAt = Date.now();

    // 자막 배지 복원
    const badge = document.getElementById('demo-badge');
    if (badge) badge.innerHTML = '● REC  PART LIST DATABASE';

    if (pauseBtn) pauseBtn.innerHTML = '⏸ 일시정지';

    // 진행 바 재시작
    startProgressBar();
    // 남은 스텝들 재스케줄
    scheduleSteps(pausedElapsed);
  }

  function togglePause() {
    if (demoPaused) resumeDemo();
    else pauseDemo();
  }

  /* ── 데모 중지 ─────────────────────────────────────────────────── */
  function stopDemo() {
    demoRunning = false;
    demoPaused = false;
    pausedElapsed = 0;
    demoTimers.forEach(t => t.clear());
    demoTimers = [];
    document.removeEventListener('keydown', _onKeySeek);

    // UI 제거
    ['demo-overlay', 'demo-subtitle', 'demo-highlight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    overlayEl = null;
    subtitleEl = null;
    progressEl = null;
    highlightBox = null;

    // 검색 초기화
    const inp = document.getElementById('searchInput');
    if (inp) { inp.value = ''; if (typeof onSearchInput === 'function') onSearchInput(); }

    // 라이트 모드면 다크로 복귀
    if (document.documentElement.getAttribute('data-theme') === 'light') {
      if (typeof toggleTheme === 'function') toggleTheme();
    }

    if (launchBtn) launchBtn.style.display = 'flex';
    if (stopBtn)   stopBtn.style.display = 'none';
    if (pauseBtn)  pauseBtn.style.display = 'none';
  }

  /* ── 런처 버튼 생성 ─────────────────────────────────────────────── */
  function createLauncher() {
    const F = `font-family:'Pretendard','Noto Sans KR',sans-serif;`;

    // ── 시작 버튼
    launchBtn = document.createElement('button');
    launchBtn.id = 'demo-launch-btn';
    launchBtn.innerHTML = '🎬 시연 시작';
    launchBtn.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:99999;
      display:flex; align-items:center; gap:8px;
      background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
      color:#fff; font-size:14px; font-weight:700;
      border:none; border-radius:999px; padding:12px 22px; cursor:pointer;
      box-shadow:0 8px 24px rgba(102,126,234,0.5),0 2px 8px rgba(0,0,0,0.3);
      ${F} transition:transform 0.2s,box-shadow 0.2s;
    `;
    launchBtn.onmouseenter = () => {
      launchBtn.style.transform = 'scale(1.05) translateY(-2px)';
      launchBtn.style.boxShadow = '0 12px 32px rgba(102,126,234,0.7),0 4px 12px rgba(0,0,0,0.3)';
    };
    launchBtn.onmouseleave = () => {
      launchBtn.style.transform = '';
      launchBtn.style.boxShadow = '0 8px 24px rgba(102,126,234,0.5),0 2px 8px rgba(0,0,0,0.3)';
    };
    launchBtn.onclick = startDemo;
    document.body.appendChild(launchBtn);

    // ── 시연 중 컨트롤 래퍼 (일시정지 + 중지)
    // stopBtn 변수를 이 래퍼로 설정 → startDemo/stopDemo의 display 제어가 그대로 동작
    const ctrlWrap = document.createElement('div');
    ctrlWrap.id = 'demo-ctrl-wrap';
    ctrlWrap.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:99999;
      display:none; align-items:center; gap:10px;
    `;
    stopBtn = ctrlWrap;   // ← startDemo에서 stopBtn.style.display = 'flex' 로 래퍼를 표시

    // ── 일시정지 버튼
    pauseBtn = document.createElement('button');
    pauseBtn.id = 'demo-pause-btn';
    pauseBtn.innerHTML = '⏸ 일시정지';
    pauseBtn.style.cssText = `
      display:flex; align-items:center; gap:6px;
      background:rgba(99,179,237,0.92); color:#fff;
      font-size:13px; font-weight:700; border:none; border-radius:999px;
      padding:10px 20px; cursor:pointer;
      box-shadow:0 6px 18px rgba(99,179,237,0.4);
      ${F} backdrop-filter:blur(8px); transition:background 0.2s;
    `;
    pauseBtn.onmouseenter = () => { pauseBtn.style.background = 'rgba(99,179,237,1)'; };
    pauseBtn.onmouseleave = () => { pauseBtn.style.background = 'rgba(99,179,237,0.92)'; };
    pauseBtn.onclick = togglePause;

    // ── 중지 버튼
    const realStopBtn = document.createElement('button');
    realStopBtn.id = 'demo-stop-btn';
    realStopBtn.innerHTML = '⏹ 중지';
    realStopBtn.style.cssText = `
      display:flex; align-items:center; gap:6px;
      background:rgba(244,106,106,0.9); color:#fff;
      font-size:13px; font-weight:700; border:none; border-radius:999px;
      padding:10px 20px; cursor:pointer;
      box-shadow:0 6px 18px rgba(244,106,106,0.4);
      ${F} backdrop-filter:blur(8px); transition:background 0.2s;
    `;
    realStopBtn.onmouseenter = () => { realStopBtn.style.background = 'rgba(244,106,106,1)'; };
    realStopBtn.onmouseleave = () => { realStopBtn.style.background = 'rgba(244,106,106,0.9)'; };
    realStopBtn.onclick = stopDemo;

    ctrlWrap.appendChild(pauseBtn);
    ctrlWrap.appendChild(realStopBtn);
    document.body.appendChild(ctrlWrap);
  }

  /* ── 초기화 ─────────────────────────────────────────────────────── */
  function init() {
    // 잠금 해제 후 앱이 준비될 때까지 대기
    const waitForApp = setInterval(() => {
      const app = document.getElementById('app');
      if (app && getComputedStyle(app).display !== 'none') {
        clearInterval(waitForApp);
        createLauncher();
      }
    }, 500);
  }

  // 전역 제어 함수 노출
  window.demoStart       = startDemo;
  window.demoStop        = stopDemo;
  window.demoPause       = pauseDemo;
  window.demoResume      = resumeDemo;
  window.demoTogglePause = togglePause;
  window.demoSeek        = seekTo;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500);
  }

})();

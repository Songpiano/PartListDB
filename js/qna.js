// ============================================================
// Part List Database — qna.js
// 요청 게시판 (Q&A): 누구나 요청/질문을 남기고, 관리자가 답변
// ============================================================

const QNA_STORAGE_KEY = 'shieldcan_qna_v1';
let qnaPosts = JSON.parse(localStorage.getItem(QNA_STORAGE_KEY) || '[]');
let currentAnswerId = null;

function saveQnaPosts() {
  localStorage.setItem(QNA_STORAGE_KEY, JSON.stringify(qnaPosts));
}

function formatQnaDate(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function renderQna() {
  const wrap = document.getElementById('qnaList');
  if (!wrap) return;

  if (!qnaPosts.length) {
    wrap.innerHTML = `<div class="qna-empty">아직 등록된 요청이 없습니다. 첫 요청을 작성해보세요! ✏️</div>`;
    return;
  }

  const sorted = [...qnaPosts].sort((a, b) => (Number(b.createdAt)||0) - (Number(a.createdAt)||0));

  wrap.innerHTML = sorted.map(q => {
    const isDone = q.status === '완료';
    return `
    <div class="qna-card ${isDone ? 'done' : 'pending'}">
      <div class="qna-card-head">
        <div class="qna-status-badge ${isDone ? 'done' : 'pending'}">${isDone ? '✅ 답변완료' : '🕓 대기중'}</div>
        <div class="qna-date">${formatQnaDate(q.createdAt)}</div>
      </div>
      <div class="qna-title">${escHtml(q.title || '')}</div>
      <div class="qna-content">${escHtml(q.content || '')}</div>
      <div class="qna-author">작성자: ${escHtml(q.author || '익명')}</div>
      ${q.answer ? `
        <div class="qna-answer">
          <div class="qna-answer-label">💬 답변</div>
          <div class="qna-answer-text">${escHtml(q.answer)}</div>
        </div>` : ''}
      <div class="qna-actions">
        <button class="btn-qna-answer" onclick="openAnswerModal('${q.id}')">${q.answer ? '답변 수정' : '답변하기'}</button>
        <button class="btn-qna-delete" onclick="askDeleteQna('${q.id}')">삭제</button>
      </div>
    </div>
  `; }).join('');
}

// ── 새 요청 작성 ──
function openQnaModal() {
  document.getElementById('qnaTitleInput').value = '';
  document.getElementById('qnaContentInput').value = '';
  document.getElementById('qnaAuthorInput').value = '';
  document.getElementById('qnaModal').classList.add('open');
  setTimeout(() => document.getElementById('qnaTitleInput').focus(), 80);
}
function closeQnaModal() {
  document.getElementById('qnaModal').classList.remove('open');
}

function submitQna(e) {
  e.preventDefault();
  const title   = document.getElementById('qnaTitleInput').value.trim();
  const content = document.getElementById('qnaContentInput').value.trim();
  const author  = document.getElementById('qnaAuthorInput').value.trim();
  if (!title || !content) return;

  const post = {
    id: 'qna_' + Date.now() + '_' + Math.floor(Math.random()*9999),
    title, content, author,
    status: '대기',
    answer: '',
    createdAt: Date.now(),
    answeredAt: null
  };
  qnaPosts.push(post);
  saveQnaPosts();
  renderQna();
  closeQnaModal();
  showSyncStatus('요청이 등록되었습니다', 'success');
  if (gasUrl) addQnaToSheets(post);
}

// ── 답변 작성 ──
function openAnswerModal(id) {
  const post = qnaPosts.find(q => q.id === id);
  if (!post) return;
  currentAnswerId = id;
  document.getElementById('qnaAnswerInput').value = post.answer || '';
  document.getElementById('qnaAnswerModal').classList.add('open');
  setTimeout(() => document.getElementById('qnaAnswerInput').focus(), 80);
}
function closeAnswerModal() {
  document.getElementById('qnaAnswerModal').classList.remove('open');
  currentAnswerId = null;
}

function submitAnswer(e) {
  e.preventDefault();
  const post = qnaPosts.find(q => q.id === currentAnswerId);
  if (!post) return;

  const answer = document.getElementById('qnaAnswerInput').value.trim();
  post.answer = answer;
  post.status = answer ? '완료' : '대기';
  post.answeredAt = answer ? Date.now() : null;

  saveQnaPosts();
  renderQna();
  closeAnswerModal();
  showSyncStatus('답변이 저장되었습니다', 'success');
  if (gasUrl) answerQnaOnSheets(post);
}

// ── 삭제 ──
function askDeleteQna(id) {
  document.getElementById('confirmBody').textContent = '이 요청을 삭제합니다. 삭제 후 복구할 수 없습니다.';
  pendingAction = () => {
    qnaPosts = qnaPosts.filter(q => q.id !== id);
    saveQnaPosts();
    renderQna();
    closeConfirm();
    if (gasUrl) deleteQnaFromSheets(id);
  };
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOk').onclick = pendingAction;
}

// ── Google Sheets 연동 (선택) ──
// GAS에 getQna/addQna/answerQna/deleteQna 액션이 구현되어 있으면 자동으로 동기화됩니다.
// 구현되어 있지 않더라도 요청 게시판은 이 브라우저의 localStorage 기준으로 정상 동작합니다.
async function loadQnaFromSheets() {
  if (!gasUrl) return false;
  try {
    const json = await gasJsonp({ action: 'getQna' });
    if (json && json.ok && Array.isArray(json.qna)) {
      qnaPosts = json.qna.map(q => ({
        id: q.id,
        title: q.title || '',
        content: q.content || '',
        author: q.author || '',
        status: q.status || '대기',
        answer: q.answer || '',
        createdAt: Number(q.createdAt) || Date.now(),
        answeredAt: q.answeredAt ? Number(q.answeredAt) : null
      }));
      saveQnaPosts();
      renderQna();
      return true;
    }
  } catch(e) {
    console.warn('Q&A 불러오기 실패 (로컬 데이터 사용):', e.message);
  }
  return false;
}

async function addQnaToSheets(post) {
  try {
    await fetch(gasUrl, {
      method: 'POST',
      body: new URLSearchParams({ action: 'addQna', post: JSON.stringify(post) })
    });
  } catch(e) { console.warn('Q&A 저장 실패:', e.message); }
}

async function answerQnaOnSheets(post) {
  try {
    await fetch(gasUrl, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'answerQna',
        id: post.id,
        answer: post.answer,
        status: post.status,
        answeredAt: post.answeredAt || ''
      })
    });
  } catch(e) { console.warn('Q&A 답변 저장 실패:', e.message); }
}

async function deleteQnaFromSheets(id) {
  try {
    await fetch(gasUrl, {
      method: 'POST',
      body: new URLSearchParams({ action: 'deleteQna', id })
    });
  } catch(e) { console.warn('Q&A 삭제 실패:', e.message); }
}

// ============================================================
// Part List Database — image.js
// ============================================================

// ─── IMAGE ────────────────────────────────────────────────────────────────────
function handleImgFile(e, id) {
  const file = e.target.files[0];
  if (file && file.type.startsWith('image/')) loadImg(id, file);
}
function handleImgDrop(e, id) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImg(id, file);
}
function loadImg(id, file) {
  const reader = new FileReader();
  reader.onloadend = () => {
    const part = parts.find(p=>p.id===id);
    if (part) {
      part.imageUrl = reader.result;
      saveParts();
      renderParts();
      if (gasUrl) updateImageOnSheets(id, reader.result);
    }
  };
  reader.readAsDataURL(file);
}
function removeImage(id) {
  const part = parts.find(p=>p.id===id);
  if (part) {
    part.imageUrl = null;
    saveParts();
    renderParts();
    if (gasUrl) updateImageOnSheets(id, null);
  }
}
function openZoom(id) {
  const part = parts.find(p=>p.id===id);
  if (part && part.imageUrl) {
    document.getElementById('zoomImg').src = part.imageUrl;
    document.getElementById('zoomModal').classList.add('open');
  }
}
function closeZoom() { document.getElementById('zoomModal').classList.remove('open'); }

// ─── DELETE / CLEAR ───────────────────────────────────────────────────────────
function askDelete(id) {
  document.getElementById('confirmBody').textContent = '선택한 항목을 삭제합니다. 삭제 후 리스트에서 제거됩니다.';
  pendingAction = () => {
    const idx = parts.findIndex(p=>p.id===id);
    if (idx < 0) return;
    parts.splice(idx, 1);
    saveParts(); renderParts(); renderStatus(); closeConfirm();
  };
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOk').onclick = pendingAction;
}
function askClearAll() {
  const modal = document.getElementById('clearPwModal');
  const input = document.getElementById('clearPwInput');
  const hint  = document.getElementById('clearPwHint');
  input.value = '';
  hint.textContent = '';
  hint.style.color = '';
  modal.classList.add('open');
  setTimeout(() => input.focus(), 80);
}
function closeClearPwModal() {
  document.getElementById('clearPwModal').classList.remove('open');
  document.getElementById('clearPwInput').value = '';
  document.getElementById('clearPwHint').textContent = '';
}
function submitClearPw(e) {
  e.preventDefault();
  const input = document.getElementById('clearPwInput');
  const hint  = document.getElementById('clearPwHint');
  if (input.value === '1234') {
    closeClearPwModal();
    parts = []; saveParts(); renderParts(); renderStatus();
    showSyncStatus('초기화 완료', 'error');
  } else {
    input.classList.add('error');
    input.value = '';
    hint.textContent = '비밀번호가 일치하지 않습니다.';
    hint.style.cssText = 'color:var(--rose);font-size:11px;font-weight:700;';
    setTimeout(() => {
      input.classList.remove('error');
      hint.textContent = '';
      input.focus();
    }, 1400);
  }
}
function closeConfirm() { document.getElementById('confirmModal').classList.remove('open'); pendingAction = null; }

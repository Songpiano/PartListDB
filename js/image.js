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
  reader.onloadend = async () => {
    const part = parts.find(p=>p.id===id);
    if (!part) return;
    // 즉시 미리보기 (base64)
    part.imageUrl = reader.result;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
    renderParts();
    if (gasUrl) {
      // Google Drive에 업로드하여 영구 링크로 교체 (모든 PC에서 보이도록)
      showSyncStatus('이미지 업로드 중...', 'info');
      const driveUrl = await uploadImageToDrive(id, reader.result);
      if (driveUrl) {
        part.imageUrl = driveUrl;
        renderParts();
      } else {
        showSyncStatus('이미지 업로드 실패 (이 PC에만 표시됨)', 'error');
      }
    }
    saveParts();
  };
  reader.readAsDataURL(file);
}
function removeImage(id) {
  const part = parts.find(p=>p.id===id);
  if (part) {
    part.imageUrl = null;
    saveParts();
    renderParts();
    if (gasUrl) deleteImageFromDrive(id);
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
function askDeleteModel(modelName) {
  const count = parts.filter(p => p.model === modelName).length;
  document.getElementById('confirmBody').textContent = `"${modelName}" 모델의 파트 ${count}개를 모두 삭제합니다.`;
  pendingAction = () => {
    const before = parts.length;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].model === modelName) parts.splice(i, 1);
    }
    if (parts.length !== before) { saveParts(); renderParts(); renderStatus(); }
    closeConfirm();
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

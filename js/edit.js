// ============================================================
// Part List Database — edit.js
// ============================================================

// ─── INLINE EDIT ──────────────────────────────────────────────────────────────
function startEdit(id, field) {
  const part = parts.find(p=>p.id===id);
  if (!part) return;
  const span = document.getElementById(`field_${id}_${field}`);
  if (!span) return;
  const oldVal = part[field];
  const input = document.createElement('input');
  input.className = 'inline-edit';
  input.value = oldVal || '';
  span.replaceWith(input);
  input.focus();
  input.select();
  const save = () => {
    const newVal = input.value.trim() || oldVal;
    part[field] = newVal;
    saveParts();
    if (gasUrl) updateFieldOnSheets(id, field, newVal);
    const newSpan = document.createElement('span');
    newSpan.id = `field_${id}_${field}`;
    newSpan.textContent = newVal;
    input.replaceWith(newSpan);
    if (field === 'approvalDate') renderStatus();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => { if(e.key==='Enter') input.blur(); if(e.key==='Escape'){ input.value=oldVal; input.blur(); } });
}

function setModelManager(modelName) {
  const name = prompt(`"${modelName}" 모델의 담당자 이름을 입력하세요\n(예: 홍길동 책임)`);
  if (!name || !name.trim()) return;
  const val = name.trim();
  parts.forEach(p => {
    if (p.model === modelName && p.isAssembly) {
      p.manager = val;
      const span = document.getElementById(`field_${p.id}_manager`);
      if (span) span.textContent = val;
    }
  });
  saveParts();
  renderParts();
}

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

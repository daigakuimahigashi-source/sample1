(() => {
  'use strict';

  const DAY_START = 15 * 60;
  const DAY_END = 30 * 60;
  const STEP = 15;
  let observer = null;
  let queued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    const workspace = document.querySelector('.workspace');
    if (workspace) {
      observer = new MutationObserver(schedule);
      observer.observe(workspace, { childList:true, subtree:true });
    }
    document.addEventListener('click', event => {
      if (event.target.closest?.('.shift-bar,[data-select]')) setTimeout(schedule, 0);
    });
    schedule();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      observer?.disconnect();
      try { patchInspector(); }
      finally {
        const workspace = document.querySelector('.workspace');
        if (observer && workspace) observer.observe(workspace, { childList:true, subtree:true });
      }
    });
  }

  function patchInspector() {
    const startSelect = document.getElementById('ins-start');
    const endSelect = document.getElementById('ins-end');
    if (!startSelect || !endSelect) return;

    const start = Number(startSelect.value);
    const end = Number(endSelect.value);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    setOptions(startSelect, DAY_START, Math.max(DAY_START, end - STEP), start);
    setOptions(endSelect, Math.min(DAY_END, start + STEP), DAY_END, end);
  }

  function setOptions(select, min, max, selected) {
    const signature = `${min}|${max}|${selected}|${STEP}`;
    if (select.dataset.quarterHourSignature === signature) return;

    let html = '';
    for (let minute = min; minute <= max; minute += STEP) {
      html += `<option value="${minute}"${minute === selected ? ' selected' : ''}>${fmtTime(minute)}</option>`;
    }

    if (selected >= min && selected <= max && selected % STEP !== 0) {
      html += `<option value="${selected}" selected>${fmtTime(selected)}</option>`;
    }

    select.innerHTML = html;
    select.value = String(selected);
    select.dataset.quarterHourSignature = signature;
  }

  function fmtTime(total) {
    const value = Number(total);
    const next = value >= 24 * 60;
    const hour = Math.floor(value / 60) % 24;
    const minute = value % 60;
    return `${next ? '翌' : ''}${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
})();

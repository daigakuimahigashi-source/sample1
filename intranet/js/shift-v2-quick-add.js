(() => {
  'use strict';

  const STYLE_ID = 'shift-v2-quick-add-style';
  const DEFAULT_START = 17 * 60;
  const DAY_START = 15 * 60;
  const SLOT = 30;
  const SLOT_PX = 46;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    enhanceStaffCards();
    const observer = new MutationObserver(enhanceStaffCards);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick, true);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .staff-card{position:relative;padding-right:58px!important}
      .staff-card .quick-add-btn{position:absolute;right:7px;top:50%;transform:translateY(-50%);border:1px solid #cfd8e6;background:#fff;color:#344054;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer;box-shadow:0 2px 6px rgba(16,24,40,.04)}
      .staff-card .quick-add-btn:hover{background:#f8fafc;border-color:#98a2b3}
      .staff-card.assigned .quick-add-btn{background:#f2f4f7;color:#98a2b3;border-color:#e4e7ec;cursor:default}
      .quick-add-note{font-size:9px;color:#667085;font-weight:700;margin-top:6px;line-height:1.5}
      #quick-add-toast{position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:10060;background:#101828;color:#fff;padding:10px 14px;border-radius:10px;font:800 11px/1.6 'Noto Sans JP',sans-serif;box-shadow:0 12px 30px rgba(16,24,40,.22);max-width:min(680px,90vw);text-align:center}
    `;
    document.head.appendChild(style);
  }

  function enhanceStaffCards() {
    const list = document.getElementById('staff-list');
    if (!list) return;
    list.querySelectorAll('.staff-card').forEach(card => {
      if (card.querySelector('.quick-add-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-add-btn';
      btn.dataset.quickAddStaff = card.dataset.staffId || '';
      if (card.classList.contains('assigned')) {
        btn.textContent = '配置済';
        btn.disabled = true;
      } else {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> 追加';
        btn.title = '17:00開始で仮配置し、右側ですぐ修正できます';
      }
      card.appendChild(btn);
    });

    const empty = document.getElementById('empty-drop-track');
    if (empty && !empty.querySelector('.quick-add-note')) {
      const note = document.createElement('div');
      note.className = 'quick-add-note';
      note.style.cssText = 'position:absolute;left:12px;bottom:7px;z-index:3;background:rgba(255,255,255,.94);padding:3px 6px;border-radius:6px;border:1px solid #e4e7ec;pointer-events:none';
      note.textContent = 'ドラッグでも追加できます。左の「追加」なら17:00で仮配置します。';
      empty.appendChild(note);
    }
  }

  function onClick(event) {
    const button = event.target.closest('[data-quick-add-staff]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const staffId = button.dataset.quickAddStaff;
    if (!staffId) return;
    quickAdd(staffId);
  }

  function quickAdd(staffId) {
    const dropTrack = document.getElementById('empty-drop-track');
    if (!dropTrack) return showToast('追加先がまだ表示されていません。ガント入力タブを開いてください。');

    try {
      const dt = new DataTransfer();
      dt.setData('text/staff-id', staffId);
      const rect = dropTrack.getBoundingClientRect();
      const slotsFromStart = (DEFAULT_START - DAY_START) / SLOT;
      const clientX = rect.left + (slotsFromStart * SLOT_PX) + 4;
      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientX,
        clientY: rect.top + Math.max(8, rect.height / 2)
      });
      dropTrack.dispatchEvent(event);
      showToast('17:00開始で仮配置しました。右側の編集欄で開始・終了時刻を調整できます。');
      setTimeout(() => {
        document.getElementById('inspector')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 120);
    } catch (error) {
      console.warn('Quick add failed', error);
      showToast('クイック追加に失敗しました。従来どおりドラッグで追加できます。');
    }
  }

  function showToast(message) {
    document.getElementById('quick-add-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'quick-add-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }
})();

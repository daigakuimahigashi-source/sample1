(() => {
  'use strict';

  const AFTER_APPLY_KEY = 'okk_shift_v2_guided_after_apply';
  const TARGET_DATE_KEY = 'okk_shift_v2_guided_target_date';
  const STYLE_ID = 'shift-v2-guided-ui-style';
  const GUIDE_ID = 'shift-v2-guided-help';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    injectStyles();
    enhanceUi();
    bindDelegatedEvents();

    const observer = new MutationObserver(() => enhanceUi());
    observer.observe(document.body, { childList: true, subtree: true });

    // 月間AUTO反映後は、ユーザーが確認したい日に自動で移動する。
    setTimeout(restoreAfterApply, 900);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${GUIDE_ID}{
        margin:10px 0 12px;padding:10px 12px;border:1px solid #dbe4f0;border-left:4px solid #344054;
        border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;
        box-shadow:0 4px 14px rgba(16,24,40,.04);font-family:'Noto Sans JP',sans-serif
      }
      #${GUIDE_ID} .guide-main{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}
      #${GUIDE_ID} strong{font-size:12px;color:#101828;white-space:nowrap}
      #${GUIDE_ID} span{font-size:10px;color:#667085;font-weight:700}
      #${GUIDE_ID} .guide-arrow{color:#98a2b3;font-weight:900}
      #${GUIDE_ID} button{white-space:nowrap}
      #gantt-canvas [data-select].guided-edit-button{display:inline-flex;align-items:center;gap:4px;min-width:54px;justify-content:center;font-weight:800}
      .month-builder-guide{margin:8px 14px 0;padding:9px 11px;border-radius:9px;background:#f8fafc;border:1px solid #e4e7ec;color:#475467;font-size:10px;font-weight:700;line-height:1.7}
      .month-builder-guide strong{color:#101828}
      .month-shortage.guided-shortage{cursor:pointer;position:relative;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
      .month-shortage.guided-shortage:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(16,24,40,.08)}
      .month-shortage.guided-shortage::after{content:'確認日として選ぶ';position:absolute;right:7px;top:6px;font-size:8px;font-weight:900;color:#667085;background:#fff;border:1px solid #e4e7ec;border-radius:999px;padding:2px 6px}
      .month-shortage.guided-shortage.guided-selected{outline:2px solid #344054;outline-offset:1px;background:#fff9f8}
      .month-shortage.guided-shortage.guided-selected::after{content:'反映後にこの日を開く';color:#fff;background:#344054;border-color:#344054}
      .guided-flash{animation:guidedFlash 1.1s ease 2}
      @keyframes guidedFlash{0%,100%{box-shadow:0 0 0 0 rgba(52,64,84,0)}50%{box-shadow:0 0 0 5px rgba(52,64,84,.18)}}
      #guided-toast{position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:10050;background:#101828;color:#fff;padding:10px 14px;border-radius:10px;font:800 11px/1.6 'Noto Sans JP',sans-serif;box-shadow:0 12px 30px rgba(16,24,40,.22);max-width:min(640px,90vw);text-align:center}
      @media(max-width:900px){#${GUIDE_ID}{align-items:flex-start;flex-direction:column}#${GUIDE_ID} .guide-main{display:block}#${GUIDE_ID} .guide-arrow{display:none}}
    `;
    document.head.appendChild(style);
  }

  function enhanceUi() {
    installPlannerGuide();
    enhanceEditButtons();
    enhanceMonthBuilder();
  }

  function installPlannerGuide() {
    if (document.getElementById(GUIDE_ID)) return;
    const planner = document.getElementById('view-planner');
    const toolbar = planner?.querySelector('.toolbar');
    if (!planner || !toolbar) return;

    const guide = document.createElement('div');
    guide.id = GUIDE_ID;
    guide.innerHTML = `
      <div class="guide-main">
        <strong><i class="fa-solid fa-pen-to-square"></i> 個別修正のやり方</strong>
        <span>① 上の日付を選ぶ</span><span class="guide-arrow">→</span>
        <span>② 配置済みスタッフの「編集」を押す</span><span class="guide-arrow">→</span>
        <span>③ 右側で時間変更／「このシフトを削除」</span>
        <span class="guide-arrow">｜</span><span>追加は左の従業員を「新しい配置」へドラッグ</span>
      </div>
      <button type="button" class="btn btn-light btn-small" data-guided-open-month><i class="fa-solid fa-calendar-plus"></i> 月間一括作成</button>
    `;
    toolbar.insertAdjacentElement('afterend', guide);
  }

  function enhanceEditButtons() {
    document.querySelectorAll('#gantt-canvas [data-select]').forEach(button => {
      if (button.dataset.guidedEnhanced === '1') return;
      button.dataset.guidedEnhanced = '1';
      button.classList.add('guided-edit-button');
      button.title = 'このスタッフのシフトを編集・削除';
      button.innerHTML = '<i class="fa-solid fa-pen"></i><span>編集</span>';
    });
  }

  function enhanceMonthBuilder() {
    const modal = document.getElementById('month-builder-modal');
    if (!modal) return;

    const notice = modal.querySelector('.month-builder-notice');
    if (notice && !modal.querySelector('.month-builder-guide')) {
      const guide = document.createElement('div');
      guide.className = 'month-builder-guide';
      guide.innerHTML = '<strong>ここでは月間案を作るだけです。</strong> 赤い不足カードを押すと「反映後に確認する日」を選べます。最後に右下の「この案を反映」を押すと、その日の日別編集画面へ移動します。';
      notice.insertAdjacentElement('afterend', guide);
    }

    const calc = document.getElementById('month-builder-calc');
    if (calc && calc.dataset.guidedEnhanced !== '1') {
      calc.dataset.guidedEnhanced = '1';
      calc.innerHTML = '<i class="fa-solid fa-rotate"></i> 再計算';
    }

    const apply = document.getElementById('month-builder-apply');
    if (apply && apply.dataset.guidedEnhanced !== '1') {
      apply.dataset.guidedEnhanced = '1';
      apply.innerHTML = '<i class="fa-solid fa-check"></i> この案を反映して個別修正へ';
      apply.title = '月間案を保存して、選んだ不足日の日別編集画面へ移動します';
    }

    const selectedDate = sessionStorage.getItem(TARGET_DATE_KEY) || '';
    modal.querySelectorAll('.month-shortage').forEach(card => {
      card.classList.add('guided-shortage');
      const date = parseDate(card.textContent);
      if (date && date === selectedDate) card.classList.add('guided-selected');
      else card.classList.remove('guided-selected');
    });
  }

  function bindDelegatedEvents() {
    document.addEventListener('click', event => {
      const openMonth = event.target.closest('[data-guided-open-month]');
      if (openMonth) {
        document.getElementById('month-builder-open')?.click();
        return;
      }

      const shortage = event.target.closest('#month-builder-modal .month-shortage');
      if (shortage) {
        const date = parseDate(shortage.textContent);
        if (!date) return;
        sessionStorage.setItem(TARGET_DATE_KEY, date);
        document.querySelectorAll('#month-builder-modal .month-shortage').forEach(card => card.classList.remove('guided-selected'));
        shortage.classList.add('guided-selected');
        showToast(`${formatDate(date)} を、反映後に個別修正で開きます`);
        return;
      }

      const apply = event.target.closest('#month-builder-apply');
      if (apply) {
        const selected = sessionStorage.getItem(TARGET_DATE_KEY);
        const firstShortage = parseDate(document.querySelector('#month-builder-modal .month-shortage')?.textContent || '');
        const month = document.getElementById('month-builder-month')?.value;
        const target = selected || firstShortage || (month ? `${month}-01` : '');
        if (target) sessionStorage.setItem(AFTER_APPLY_KEY, target);
        return;
      }

      const editButton = event.target.closest('#gantt-canvas [data-select]');
      if (editButton) {
        setTimeout(() => {
          const inspector = document.getElementById('inspector');
          inspector?.classList.add('guided-flash');
          inspector?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(() => inspector?.classList.remove('guided-flash'), 2400);
        }, 80);
      }
    }, true);
  }

  function restoreAfterApply() {
    const target = sessionStorage.getItem(AFTER_APPLY_KEY);
    if (!target) return;
    sessionStorage.removeItem(AFTER_APPLY_KEY);
    sessionStorage.removeItem(TARGET_DATE_KEY);

    // month-builder本体の復元処理より後に上書きする。
    setTimeout(() => {
      openDate(target);
      showToast(`月間一括作成を反映しました。${formatDate(target)} を開いています。配置済みスタッフの「編集」から個別修正できます。`, 6500);
    }, 450);
  }

  function openDate(date) {
    const input = document.getElementById('work-date');
    if (!input || !date) return;
    input.value = date;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
      input.classList.add('guided-flash');
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const guide = document.getElementById(GUIDE_ID);
      guide?.classList.add('guided-flash');
      setTimeout(() => {
        input.classList.remove('guided-flash');
        guide?.classList.remove('guided-flash');
      }, 2400);
    }, 120);
  }

  function parseDate(text) {
    const match = String(text || '').match(/20\d{2}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  function formatDate(date) {
    const [year, month, day] = String(date).split('-');
    return year && month && day ? `${Number(month)}月${Number(day)}日` : date;
  }

  function showToast(message, duration = 3200) {
    document.getElementById('guided-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'guided-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }
})();

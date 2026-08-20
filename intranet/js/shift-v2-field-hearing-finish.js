(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const REVIEW_KEY = 'okk_shift_v2_skill_reviewed_v1';
  const FILTER_KEY = 'okk_shift_v2_skill_filter_v1';
  const STYLE_ID = 'shift-v2-field-hearing-finish-style';
  const CONTROLS_ID = 'fhf-skill-controls';
  const LEVEL_TEXT = {
    0: '未経験',
    1: 'できる',
    2: '任せられる',
    3: '教えられる',
  };

  let observer = null;
  let queued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    patch();
    observer = new MutationObserver(schedulePatch);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick, false);
    document.addEventListener('change', onChange, false);
    document.addEventListener('input', onInput, false);
  }

  function schedulePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      observer?.disconnect();
      try { patch(); }
      finally { observer?.observe(document.body, { childList: true, subtree: true }); }
    });
  }

  function patch() {
    const view = document.getElementById('view-rules');
    if (!view) return;
    patchCopy(view);
    installControls();
    decorateLevelButtons();
    decorateRows();
    applyFilters();
    updateProgress();
    patchMasterConfirmButton();
  }

  function patchCopy(view) {
    const heroText = view.querySelector('.rs-hero p');
    const nextHero = '現場で確認するのは2つだけです。①スタッフのスキル → ②店舗・時間ごとの必要人数。入力が終わったら確認済みにします。';
    if (heroText && heroText.textContent !== nextHero) heroText.textContent = nextHero;

    const staffTitle = document.querySelector('#rs-staff .rs-head h3');
    if (staffTitle && staffTitle.textContent !== '1. スタッフのスキル') staffTitle.textContent = '1. スタッフのスキル';

    const staffHelp = document.querySelector('#rs-staff .rs-head small');
    const help = '各スキルをクリックして設定。0 未経験 / 1 できる / 2 任せられる / 3 教えられる';
    if (staffHelp && staffHelp.textContent !== help) staffHelp.textContent = help;
  }

  function installControls() {
    const section = document.getElementById('rs-staff');
    const head = section?.querySelector('.rs-head');
    if (!section || !head || document.getElementById(CONTROLS_ID)) return;

    const filters = loadFilters();
    const controls = document.createElement('div');
    controls.id = CONTROLS_ID;
    controls.className = 'fhf-controls';
    controls.innerHTML = `
      <div class="fhf-filter-block">
        <span class="fhf-label">表示</span>
        <div class="fhf-segment" role="group" aria-label="雇用区分で絞り込み">
          <button type="button" data-fhf-employment="all">全員</button>
          <button type="button" data-fhf-employment="fulltime">正社員</button>
          <button type="button" data-fhf-employment="parttime">アルバイト</button>
        </div>
        <label class="fhf-unreviewed"><input id="fhf-only-unreviewed" type="checkbox"> 未確認だけ</label>
      </div>
      <div class="fhf-progress-wrap">
        <div class="fhf-progress-copy"><strong id="fhf-progress-text">確認 0 / 0名</strong><span id="fhf-progress-note">未確認を順番に入力</span></div>
        <div class="fhf-progress"><span id="fhf-progress-bar"></span></div>
      </div>
      <div class="fhf-legend" aria-label="スキルレベルの意味">
        <span class="lv0"><b>0</b>未経験</span>
        <span class="lv1"><b>1</b>できる</span>
        <span class="lv2"><b>2</b>任せられる</span>
        <span class="lv3"><b>3</b>教えられる</span>
      </div>`;
    head.insertAdjacentElement('afterend', controls);

    document.getElementById('fhf-only-unreviewed').checked = filters.onlyUnreviewed;
    updateFilterButtons(filters.employment);
  }

  function decorateLevelButtons() {
    document.querySelectorAll('#rs-staff-body .rs-lv').forEach(button => {
      const level = clampLevel(button.textContent);
      button.dataset.fhfLevel = String(level);
      button.title = `Lv${level}：${LEVEL_TEXT[level]}（クリックで次のLvへ）`;
      button.setAttribute('aria-label', `${button.closest('tr')?.querySelector('.rs-person-name')?.textContent || 'スタッフ'} ${button.closest('td')?.cellIndex || ''} Lv${level} ${LEVEL_TEXT[level]}`);
    });
  }

  function decorateRows() {
    const reviewed = reviewedSet();
    document.querySelectorAll('#rs-staff-body tr[data-person]').forEach(row => {
      const id = normalizeId(row.dataset.person);
      const cell = row.querySelector('td:first-child');
      if (!id || !cell) return;
      const isReviewed = reviewed.has(id);
      const allZero = Array.from(row.querySelectorAll('.rs-lv')).every(button => clampLevel(button.textContent) === 0);

      const legacyStatus = cell.querySelector('.fh-person-status');
      if (legacyStatus) {
        const text = isReviewed ? (allZero ? '確認済・全0' : '確認済') : '未確認';
        if (legacyStatus.textContent !== text) legacyStatus.textContent = text;
        legacyStatus.classList.toggle('set', isReviewed);
        legacyStatus.classList.toggle('unset', !isReviewed);
      }

      let action = cell.querySelector('.fhf-review-action');
      if (!action) {
        action = document.createElement('button');
        action.type = 'button';
        action.className = 'fhf-review-action';
        action.dataset.fhfReview = id;
        cell.appendChild(action);
      }

      const label = isReviewed ? '確認済み' : (allZero ? '0のまま確認' : 'この内容で確認');
      if (action.textContent !== label) action.textContent = label;
      action.classList.toggle('reviewed', isReviewed);
      action.title = isReviewed ? 'クリックすると未確認へ戻します' : '数値を変更しない場合も、この内容で確認済みにできます';
    });
  }

  function applyFilters() {
    const filters = loadFilters();
    const staff = loadStaff();
    const reviewed = reviewedSet();

    document.querySelectorAll('#rs-staff-body tr[data-person]').forEach(row => {
      const id = normalizeId(row.dataset.person);
      const person = staff.find(item => normalizeId(item.id || item.employeeNumber) === id);
      const employmentOk = matchesEmployment(person, filters.employment);
      const reviewOk = !filters.onlyUnreviewed || !reviewed.has(id);
      row.classList.toggle('fhf-hidden', !(employmentOk && reviewOk));
    });

    const checkbox = document.getElementById('fhf-only-unreviewed');
    if (checkbox && checkbox.checked !== filters.onlyUnreviewed) checkbox.checked = filters.onlyUnreviewed;
    updateFilterButtons(filters.employment);
  }

  function updateProgress() {
    const reviewed = reviewedSet();
    const rows = Array.from(document.querySelectorAll('#rs-staff-body tr[data-person]')).filter(row => !row.classList.contains('fh-store-hidden'));
    const ids = Array.from(new Set(rows.map(row => normalizeId(row.dataset.person)).filter(Boolean)));
    const done = ids.filter(id => reviewed.has(id)).length;
    const total = ids.length;
    const remaining = Math.max(0, total - done);
    const pct = total ? Math.round((done / total) * 100) : 0;

    const text = document.getElementById('fhf-progress-text');
    const note = document.getElementById('fhf-progress-note');
    const bar = document.getElementById('fhf-progress-bar');
    if (text) text.textContent = `確認 ${done} / ${total}名`;
    if (note) note.textContent = remaining ? `残り${remaining}名` : (total ? 'この店舗は確認完了' : '対象スタッフなし');
    if (bar) bar.style.width = `${pct}%`;

    const count = document.getElementById('fh-visible-count');
    if (count && total) {
      const storeName = document.getElementById('fh-store')?.selectedOptions?.[0]?.textContent || '対象店舗';
      count.innerHTML = `<strong>${esc(storeName)}</strong> ${total}名 / <span>${remaining}名 未確認</span>`;
    }

    patchSummaryCards(done, total);
  }

  function patchSummaryCards(done, total) {
    const summary = document.getElementById('rs-summary');
    if (!summary) return;
    const cards = Array.from(summary.children);
    cards.forEach(card => {
      const label = card.querySelector('small')?.textContent?.trim() || '';
      if (['Lv入力済', 'スキル確認済'].includes(label)) {
        setText(card.querySelector('small'), 'スキル確認済');
        setText(card.querySelector('strong'), `${done}名`);
      }
      if (['Lv未設定', '未確認'].includes(label)) {
        setText(card.querySelector('small'), '未確認');
        setText(card.querySelector('strong'), `${Math.max(0, total - done)}名`);
        const sub = card.querySelector('span');
        if (sub) setText(sub, total === done && total ? '確認完了' : '現場確認が必要');
      }
    });
  }

  function patchMasterConfirmButton() {
    const button = document.querySelector('[data-fh-confirm="staff"]');
    if (!button) return;
    const staff = eligibleStaff();
    const reviewed = reviewedSet();
    const done = staff.filter(person => reviewed.has(normalizeId(person.id || person.employeeNumber))).length;
    const remaining = Math.max(0, staff.length - done);
    const state = button.querySelector('b');
    if (!button.classList.contains('confirmed') && state) state.textContent = remaining ? `残り${remaining}名` : '確認可能';
  }

  function onClick(event) {
    const filter = event.target.closest?.('[data-fhf-employment]');
    if (filter) {
      const next = loadFilters();
      next.employment = filter.dataset.fhfEmployment || 'all';
      saveFilters(next);
      applyFilters();
      return;
    }

    const review = event.target.closest?.('[data-fhf-review]');
    if (review) {
      event.preventDefault();
      event.stopPropagation();
      toggleReviewed(review.dataset.fhfReview);
      schedulePatch();
      return;
    }

    const level = event.target.closest?.('#rs-staff-body .rs-lv');
    if (level) {
      const id = level.closest('tr[data-person]')?.dataset.person;
      if (id) markReviewed(id);
      setTimeout(schedulePatch, 30);
      return;
    }

    const masterConfirm = event.target.closest?.('[data-fh-confirm="staff"]');
    if (masterConfirm && !masterConfirm.classList.contains('confirmed')) {
      const remaining = eligibleStaff().filter(person => !reviewedSet().has(normalizeId(person.id || person.employeeNumber))).length;
      if (remaining > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast(`人員・スキルはあと${remaining}名未確認です。「未確認だけ」で順番に確認してください。`);
      }
    }
  }

  function onChange(event) {
    if (event.target?.id === 'fhf-only-unreviewed') {
      const next = loadFilters();
      next.onlyUnreviewed = Boolean(event.target.checked);
      saveFilters(next);
      applyFilters();
      return;
    }
    if (event.target?.id === 'fh-store') setTimeout(schedulePatch, 30);
  }

  function onInput(event) {
    if (event.target?.id === 'rs-staff-search') setTimeout(schedulePatch, 30);
  }

  function markReviewed(id) {
    const set = reviewedSet();
    set.add(normalizeId(id));
    saveReviewed(set);
  }

  function toggleReviewed(id) {
    const key = normalizeId(id);
    const set = reviewedSet();
    if (set.has(key)) set.delete(key); else set.add(key);
    saveReviewed(set);
  }

  function reviewedSet() {
    try {
      const value = JSON.parse(localStorage.getItem(REVIEW_KEY));
      if (Array.isArray(value)) return new Set(value.map(normalizeId).filter(Boolean));
      if (value && typeof value === 'object') return new Set(Object.keys(value).filter(key => value[key]).map(normalizeId));
    } catch {}
    return new Set();
  }

  function saveReviewed(set) {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(Array.from(set)));
  }

  function loadFilters() {
    try {
      const value = JSON.parse(sessionStorage.getItem(FILTER_KEY));
      return {
        employment: ['all', 'fulltime', 'parttime'].includes(value?.employment) ? value.employment : 'all',
        onlyUnreviewed: value?.onlyUnreviewed !== false,
      };
    } catch {
      return { employment: 'all', onlyUnreviewed: true };
    }
  }

  function saveFilters(value) {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify(value));
  }

  function updateFilterButtons(value) {
    document.querySelectorAll('[data-fhf-employment]').forEach(button => {
      const active = button.dataset.fhfEmployment === value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function matchesEmployment(person, mode) {
    if (mode === 'all') return true;
    const type = String(person?.employmentType || person?.salaryType || '');
    if (mode === 'fulltime') return ['正社員', '契約社員'].includes(type) || type === 'monthly';
    if (mode === 'parttime') return type === 'アルバイト' || type === 'hourly';
    return true;
  }

  function eligibleStaff() {
    return loadStaff().filter(person => {
      if (!person) return false;
      if (person.active === false) return false;
      if (person.shiftTarget === false || person.shiftEnabled === false || person.shiftEligible === false) return false;
      return Boolean(normalizeId(person.id || person.employeeNumber));
    });
  }

  function loadStaff() {
    try {
      const value = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function clampLevel(value) {
    const num = Number(String(value ?? '').trim());
    return Number.isFinite(num) ? Math.max(0, Math.min(3, Math.round(num))) : 0;
  }

  function normalizeId(value) {
    return String(value || '').trim().toUpperCase();
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2600);
    } else {
      window.alert(message);
    }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-rules .fhf-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 10px;border-top:1px solid #eaecf0;border-bottom:1px solid #eaecf0;background:#fcfcfd}
      #view-rules .fhf-filter-block{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.fhf-label{font-size:9px;font-weight:900;color:#475467}.fhf-segment{display:flex;padding:2px;background:#f2f4f7;border-radius:8px}.fhf-segment button{border:0;background:transparent;border-radius:6px;padding:6px 9px;color:#667085;font-size:9px;font-weight:800;cursor:pointer}.fhf-segment button.active{background:#fff;color:#101828;box-shadow:0 1px 4px rgba(16,24,40,.12)}.fhf-unreviewed{display:flex;align-items:center;gap:5px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;padding:6px 9px;font-size:9px;font-weight:900;color:#344054;cursor:pointer}
      #view-rules .fhf-progress-wrap{min-width:190px}.fhf-progress-copy{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:8px;color:#667085}.fhf-progress-copy strong{font-size:9px;color:#344054}.fhf-progress{height:5px;margin-top:4px;border-radius:999px;background:#eaecf0;overflow:hidden}.fhf-progress span{display:block;height:100%;width:0;background:#12b76a;border-radius:inherit;transition:width .18s ease}
      #view-rules .fhf-legend{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.fhf-legend span{display:flex;align-items:center;gap:3px;border-radius:999px;padding:3px 6px;font-size:8px;font-weight:800;color:#475467;background:#fff;border:1px solid #e4e7ec}.fhf-legend b{display:grid;place-items:center;width:15px;height:15px;border-radius:50%;font-size:8px}.fhf-legend .lv0 b{background:#f2f4f7}.fhf-legend .lv1 b{background:#eff8ff;color:#175cd3}.fhf-legend .lv2 b{background:#ecfdf3;color:#067647}.fhf-legend .lv3 b{background:#f4f3ff;color:#5925dc}
      #view-rules #rs-staff-body tr.fhf-hidden{display:none!important}.fhf-review-action{display:inline-flex;margin:4px 0 0;border:1px solid #d0d5dd;background:#fff;color:#475467;border-radius:7px;padding:3px 6px;font-size:8px;font-weight:900;cursor:pointer}.fhf-review-action:hover{background:#f8fafc}.fhf-review-action.reviewed{background:#ecfdf3;border-color:#abefc6;color:#067647}.fh-person-status.set{background:#ecfdf3!important;color:#067647!important}.fh-person-status.unset{background:#fffaeb!important;color:#b54708!important}
      #view-rules #rs-staff-body .rs-lv{transition:transform .1s ease,box-shadow .1s ease}#view-rules #rs-staff-body .rs-lv:hover{transform:translateY(-1px);box-shadow:0 3px 8px rgba(16,24,40,.14)}
      @media(max-width:900px){#view-rules .fhf-controls{align-items:stretch;flex-direction:column}.fhf-progress-wrap{width:100%}.fhf-legend{width:100%}}
    `;
    document.head.appendChild(style);
  }
})();
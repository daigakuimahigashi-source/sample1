(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const READINESS_KEY = 'okk_shift_v2_master_readiness_v1';
  const REVIEW_KEY = 'okk_shift_v2_skill_reviewed_v1';
  const FILTER_KEY = 'okk_shift_v2_skill_filter_safe_v1';
  const STYLE_ID = 'shift-v2-field-hearing-safe-style';
  const CONTROLS_ID = 'fhf-safe-controls';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ employment:'all', onlyUnreviewed:false }));
    refresh();
    document.addEventListener('click', onClick, false);
    document.addEventListener('change', onChange, false);
    document.addEventListener('input', onInput, false);
  }

  function refreshSoon() {
    setTimeout(refresh, 40);
    setTimeout(refresh, 180);
  }

  function refresh() {
    const view = document.getElementById('view-rules');
    if (!view) return;
    patchCopy();
    installControls();
    decorateRows();
    applyFilters();
    updateProgress();
    patchStoreConfirm();
  }

  function patchCopy() {
    const hero = document.querySelector('#view-rules .rs-hero p');
    if (hero) hero.textContent = '現場で確認するのは2つだけです。①スタッフのスキル → ②店舗・時間ごとの必要人数。スキルは入力後に「この内容で確認」を押して確定します。';
    const title = document.querySelector('#rs-staff .rs-head h3');
    if (title) title.textContent = '1. スタッフのスキル';
    const help = document.querySelector('#rs-staff .rs-head small');
    if (help) help.textContent = '0〜3を入力したあと、その人の「この内容で確認」を押します。0 未経験 / 1 できる / 2 任せられる / 3 教えられる';
  }

  function installControls() {
    if (document.getElementById(CONTROLS_ID)) return;
    const head = document.querySelector('#rs-staff .rs-head');
    if (!head) return;
    const controls = document.createElement('div');
    controls.id = CONTROLS_ID;
    controls.className = 'fhf-safe-controls';
    controls.innerHTML = `
      <div class="fhf-safe-filter">
        <strong>絞り込み</strong>
        <div class="fhf-safe-segment">
          <button type="button" data-fhf-safe-employment="all">全員</button>
          <button type="button" data-fhf-safe-employment="fulltime">正社員</button>
          <button type="button" data-fhf-safe-employment="parttime">アルバイト</button>
        </div>
        <label><input id="fhf-safe-unreviewed" type="checkbox"> 未確認の人だけ表示</label>
      </div>
      <div class="fhf-safe-progress">
        <div><strong id="fhf-safe-progress-text">確認 0 / 0名</strong><span id="fhf-safe-progress-note"></span></div>
        <div class="fhf-safe-bar"><i id="fhf-safe-progress-bar"></i></div>
      </div>
      <div class="fhf-safe-legend"><span><b>0</b>未経験</span><span><b>1</b>できる</span><span><b>2</b>任せられる</span><span><b>3</b>教えられる</span></div>`;
    head.insertAdjacentElement('afterend', controls);
    syncFilterUi();
  }

  function decorateRows() {
    const reviewed = reviewedSet();
    document.querySelectorAll('#rs-staff-body tr[data-person]').forEach(row => {
      const id = norm(row.dataset.person);
      const first = row.querySelector('td:first-child');
      if (!id || !first) return;
      const isReviewed = reviewed.has(id);
      const levels = Array.from(row.querySelectorAll('.rs-lv')).map(node => Number(node.textContent || 0));
      const allZero = levels.length > 0 && levels.every(value => value === 0);

      let status = first.querySelector('.fh-person-status');
      if (status) {
        status.textContent = isReviewed ? (allZero ? '確認済・全0' : '確認済') : '未確認';
        status.classList.toggle('set', isReviewed);
        status.classList.toggle('unset', !isReviewed);
      }

      let button = first.querySelector('.fhf-safe-review');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'fhf-safe-review';
        button.dataset.fhfSafeReview = id;
        first.appendChild(button);
      }
      button.textContent = isReviewed ? '確認済み' : (allZero ? '0のまま確認' : 'この内容で確認');
      button.classList.toggle('reviewed', isReviewed);
    });
  }

  function onClick(event) {
    const employment = event.target.closest?.('[data-fhf-safe-employment]');
    if (employment) {
      const filters = loadFilters();
      filters.employment = employment.dataset.fhfSafeEmployment || 'all';
      saveFilters(filters);
      applyFilters();
      return;
    }

    const review = event.target.closest?.('[data-fhf-safe-review]');
    if (review) {
      event.preventDefault();
      event.stopPropagation();
      toggleReviewed(review.dataset.fhfSafeReview);
      refresh();
      return;
    }

    if (event.target.closest?.('#rs-staff-body .rs-lv')) {
      // Lv変更だけでは確認済みにしない。入力途中で行が消えないようにする。
      refreshSoon();
      return;
    }

    const staffConfirm = event.target.closest?.('[data-fh-confirm="staff-store"]');
    if (staffConfirm) {
      event.preventDefault();
      event.stopPropagation();
      toggleStoreConfirmation();
      return;
    }

    if (event.target.closest?.('[data-rs-tab],#nav-rules')) refreshSoon();
  }

  function onChange(event) {
    if (event.target?.id === 'fhf-safe-unreviewed') {
      const filters = loadFilters();
      filters.onlyUnreviewed = Boolean(event.target.checked);
      saveFilters(filters);
      applyFilters();
      return;
    }
    if (event.target?.id === 'fh-store') refreshSoon();
  }

  function onInput(event) {
    if (event.target?.id === 'rs-staff-search') refreshSoon();
  }

  function applyFilters() {
    const filters = loadFilters();
    const staff = loadStaff();
    const reviewed = reviewedSet();
    document.querySelectorAll('#rs-staff-body tr[data-person]').forEach(row => {
      const id = norm(row.dataset.person);
      const person = staff.find(item => norm(item.id || item.employeeNumber) === id);
      const employmentOk = employmentMatches(person, filters.employment);
      const reviewOk = !filters.onlyUnreviewed || !reviewed.has(id);
      row.classList.toggle('fhf-safe-hidden', !(employmentOk && reviewOk));
    });
    syncFilterUi();
  }

  function syncFilterUi() {
    const filters = loadFilters();
    document.querySelectorAll('[data-fhf-safe-employment]').forEach(button => button.classList.toggle('active', button.dataset.fhfSafeEmployment === filters.employment));
    const check = document.getElementById('fhf-safe-unreviewed');
    if (check) check.checked = filters.onlyUnreviewed;
  }

  function updateProgress() {
    const ids = storeRowIds();
    const reviewed = reviewedSet();
    const done = ids.filter(id => reviewed.has(id)).length;
    const total = ids.length;
    const remaining = Math.max(0, total - done);
    const pct = total ? Math.round(done / total * 100) : 0;

    text('fhf-safe-progress-text', `確認 ${done} / ${total}名`);
    text('fhf-safe-progress-note', remaining ? `残り${remaining}名` : (total ? 'この店舗は確認完了' : '対象スタッフなし'));
    const bar = document.getElementById('fhf-safe-progress-bar');
    if (bar) bar.style.width = `${pct}%`;

    const count = document.getElementById('fh-visible-count');
    if (count && total) count.innerHTML = `<strong>${esc(storeName() || '対象店舗')}</strong> ${total}名 / <span>${remaining}名 未確認</span>`;

    document.querySelectorAll('#rs-summary > *').forEach(card => {
      const label = card.querySelector('small')?.textContent?.trim() || '';
      if (['Lv入力済','スキル確認済'].includes(label)) {
        if (card.querySelector('small')) card.querySelector('small').textContent = 'スキル確認済';
        if (card.querySelector('strong')) card.querySelector('strong').textContent = `${done}名`;
      }
      if (['Lv未設定','未確認'].includes(label)) {
        if (card.querySelector('small')) card.querySelector('small').textContent = '未確認';
        if (card.querySelector('strong')) card.querySelector('strong').textContent = `${remaining}名`;
      }
    });
  }

  function patchStoreConfirm() {
    const button = document.querySelector('[data-fh-confirm="staff"],[data-fh-confirm="staff-store"]');
    if (!button) return;
    button.dataset.fhConfirm = 'staff-store';
    const id = storeId();
    const stores = loadStores();
    const readiness = loadReadiness();
    const confirmed = new Set(readiness.staffSkillsConfirmedStores || []);
    const label = button.querySelector('span');
    const badge = button.querySelector('b');

    if (!id) {
      const count = stores.filter(store => confirmed.has(String(store.id))).length;
      button.disabled = true;
      button.classList.toggle('confirmed', count === stores.length && stores.length > 0);
      if (label) label.textContent = '人員・スキル';
      if (badge) badge.textContent = `${count}/${stores.length}店舗`;
      return;
    }

    const ids = storeRowIds();
    const reviewed = reviewedSet();
    const remaining = ids.filter(personId => !reviewed.has(personId)).length;
    const isConfirmed = confirmed.has(id);
    button.disabled = false;
    button.classList.toggle('confirmed', isConfirmed);
    if (label) label.textContent = `${storeName()} 人員・スキル`;
    if (badge) badge.textContent = isConfirmed ? '確認済み' : (remaining ? `残り${remaining}名` : '確認可能');
  }

  function toggleStoreConfirmation() {
    const id = storeId();
    if (!id) return;
    const ids = storeRowIds();
    const reviewed = reviewedSet();
    const remaining = ids.filter(personId => !reviewed.has(personId)).length;
    if (remaining) {
      toast(`${storeName()}はあと${remaining}名未確認です。各スタッフの「この内容で確認」を押してください。`);
      return;
    }
    const readiness = loadReadiness();
    const confirmed = new Set(readiness.staffSkillsConfirmedStores || []);
    if (confirmed.has(id)) confirmed.delete(id); else confirmed.add(id);
    readiness.staffSkillsConfirmedStores = Array.from(confirmed);
    readiness.staffSkillsConfirmed = allStoresConfirmed(readiness.staffSkillsConfirmedStores);
    readiness.updatedAt = new Date().toISOString();
    localStorage.setItem(READINESS_KEY, JSON.stringify(readiness));
    refresh();
  }

  function reviewedSet() {
    try {
      const value = JSON.parse(localStorage.getItem(REVIEW_KEY));
      return new Set(Array.isArray(value) ? value.map(norm).filter(Boolean) : []);
    } catch { return new Set(); }
  }

  function toggleReviewed(id) {
    const set = reviewedSet();
    const key = norm(id);
    if (set.has(key)) set.delete(key); else set.add(key);
    localStorage.setItem(REVIEW_KEY, JSON.stringify(Array.from(set)));
  }

  function storeRowIds() {
    return Array.from(document.querySelectorAll('#rs-staff-body tr[data-person]'))
      .filter(row => !row.classList.contains('fh-store-hidden'))
      .map(row => norm(row.dataset.person)).filter(Boolean);
  }

  function storeId() { return String(document.getElementById('fh-store')?.value || ''); }
  function storeName() { const id = storeId(); return loadStores().find(store => String(store.id) === id)?.name || ''; }

  function employmentMatches(person, mode) {
    if (mode === 'all') return true;
    const type = String(person?.employmentType || person?.salaryType || '');
    if (mode === 'fulltime') return ['正社員','契約社員'].includes(type) || type === 'monthly';
    if (mode === 'parttime') return type === 'アルバイト' || type === 'hourly';
    return true;
  }

  function loadFilters() {
    try {
      const value = JSON.parse(sessionStorage.getItem(FILTER_KEY));
      return { employment:['all','fulltime','parttime'].includes(value?.employment) ? value.employment : 'all', onlyUnreviewed:Boolean(value?.onlyUnreviewed) };
    } catch { return { employment:'all', onlyUnreviewed:false }; }
  }
  function saveFilters(value) { sessionStorage.setItem(FILTER_KEY, JSON.stringify(value)); }
  function loadStaff() { try { const v=JSON.parse(localStorage.getItem(STAFF_KEY)); return Array.isArray(v)?v:[]; } catch { return []; } }
  function loadStores() { try { const v=JSON.parse(localStorage.getItem(STORES_KEY)); return Array.isArray(v)&&v.length?v:DEFAULT_STORES; } catch { return DEFAULT_STORES; } }
  function loadReadiness() { try { return JSON.parse(localStorage.getItem(READINESS_KEY)) || {}; } catch { return {}; } }
  function allStoresConfirmed(ids) { const set=new Set((ids||[]).map(String)); const stores=loadStores(); return Boolean(stores.length)&&stores.every(store=>set.has(String(store.id))); }
  function norm(value) { return String(value||'').trim().toUpperCase(); }
  function text(id,value) { const node=document.getElementById(id); if(node) node.textContent=value; }
  function esc(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(message) { const node=document.getElementById('toast'); if(node){node.textContent=message;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),2600);}else window.alert(message); }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #view-rules .fhf-safe-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 10px;border-top:1px solid #eaecf0;border-bottom:1px solid #eaecf0;background:#fcfcfd}
      .fhf-safe-filter{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:9px}.fhf-safe-filter>strong{color:#475467}.fhf-safe-filter label{display:flex;gap:5px;align-items:center;border:1px solid #d0d5dd;border-radius:8px;background:#fff;padding:6px 9px;font-weight:900;color:#344054}
      .fhf-safe-segment{display:flex;padding:2px;background:#f2f4f7;border-radius:8px}.fhf-safe-segment button{border:0;background:transparent;border-radius:6px;padding:6px 9px;font-size:9px;font-weight:800;color:#667085;cursor:pointer}.fhf-safe-segment button.active{background:#fff;color:#101828;box-shadow:0 1px 4px rgba(16,24,40,.12)}
      .fhf-safe-progress{min-width:190px}.fhf-safe-progress>div:first-child{display:flex;justify-content:space-between;gap:8px;font-size:8px;color:#667085}.fhf-safe-progress strong{color:#344054}.fhf-safe-bar{height:5px;margin-top:4px;background:#eaecf0;border-radius:999px;overflow:hidden}.fhf-safe-bar i{display:block;height:100%;width:0;background:#12b76a;border-radius:inherit}
      .fhf-safe-legend{display:flex;gap:5px;flex-wrap:wrap}.fhf-safe-legend span{display:flex;align-items:center;gap:3px;border:1px solid #e4e7ec;background:#fff;border-radius:999px;padding:3px 6px;font-size:8px;font-weight:800;color:#475467}.fhf-safe-legend b{display:grid;place-items:center;width:15px;height:15px;border-radius:50%;background:#f2f4f7}
      #rs-staff-body tr.fhf-safe-hidden{display:none!important}.fhf-safe-review{display:inline-flex;margin-top:4px;border:1px solid #d0d5dd;background:#fff;color:#475467;border-radius:7px;padding:4px 7px;font-size:8px;font-weight:900;cursor:pointer}.fhf-safe-review.reviewed{background:#ecfdf3;border-color:#abefc6;color:#067647}
      @media(max-width:900px){#view-rules .fhf-safe-controls{align-items:stretch;flex-direction:column}.fhf-safe-progress{width:100%}}
    `;
    document.head.appendChild(style);
  }
})();
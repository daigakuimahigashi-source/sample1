(() => {
  'use strict';

  const STORES_KEY = 'okk_shift_v2_config';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const STYLE_ID = 'shift-v2-month-shortage-presenter-style';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  let timer = null;
  let observer = null;
  let lastSignature = '';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    observeMonthModal();
    schedule(120);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest?.('#month-builder-open,#month-builder-calc')) schedule(120);
    }, true);
    document.addEventListener('change', event => {
      if (['month-builder-month','month-builder-auto-off','month-builder-soft'].includes(event.target?.id)) schedule(120);
    }, true);
  }

  function observeMonthModal() {
    const modal = document.getElementById('month-builder-modal');
    if (!modal || observer) return;
    observer = new MutationObserver(() => schedule(70));
    observer.observe(modal, { childList:true, subtree:true, characterData:true });
  }

  function schedule(delay=80) {
    clearTimeout(timer);
    timer = setTimeout(patch, delay);
  }

  function patch() {
    const modal = document.getElementById('month-builder-modal');
    if (!modal?.classList.contains('open')) return;
    const preview = window.shiftV2HolidayAccounting?.preview?.();
    if (!preview) return;

    const shortages = Array.isArray(preview.shortages) ? preview.shortages : [];
    const groups = groupByStoreDay(shortages);
    const shortageDays = new Set(groups.map(group => group.date)).size;
    const signature = JSON.stringify(groups.map(group => [group.date,group.storeId,group.maxShortage,group.windows.map(w => [w.start,w.end]),group.skills]));

    patchMetric(shortageDays, groups.length, shortages.length);
    patchShortageSection(groups, shortages.length, shortageDays);

    lastSignature = signature;
  }

  function patchMetric(shortageDays, storeDays, rawCount) {
    const metrics = Array.from(document.querySelectorAll('#month-builder-summary .month-metric'));
    const metric = metrics.find(node => node.querySelector('small')?.textContent?.trim() === '不足');
    if (!metric) return;
    const value = metric.querySelector('strong');
    const sub = metric.querySelector('span');
    const nextValue = `${shortageDays}日 / ${storeDays}店舗日`;
    const nextSub = `${rawCount}件の内部判定を集約`;
    if (value && value.textContent !== nextValue) value.textContent = nextValue;
    if (sub && sub.textContent !== nextSub) sub.textContent = nextSub;
  }

  function patchShortageSection(groups, rawCount, shortageDays) {
    const wrap = document.querySelector('#month-builder-body .month-shortages');
    if (!wrap) return;
    const section = wrap.closest('.month-builder-section');
    const title = section?.querySelector('h3');
    if (title) {
      const next = groups.length ? `不足の確認　${shortageDays}日 / ${groups.length}店舗日` : '不足の確認';
      if (title.textContent !== next) title.textContent = next;
    }

    let lead = section?.querySelector('.manager-shortage-lead');
    if (groups.length) {
      if (!lead) {
        lead = document.createElement('div');
        lead.className = 'manager-shortage-lead';
        wrap.insertAdjacentElement('beforebegin', lead);
      }
      lead.innerHTML = '<strong>1店舗×1日でまとめています。</strong><span>不足カードを選ぶと、反映後にその日・その店舗を開いて個別修正できます。</span>';
    } else {
      lead?.remove();
    }

    const nextHtml = groups.length
      ? groups.slice(0,124).map(renderGroup).join('')
      : '<div class="month-all-clear"><i class="fa-solid fa-circle-check"></i> スキル換算でも必要人数を満たしています。</div>';
    if (wrap.dataset.managerSignature !== lastSignature || !wrap.querySelector('.manager-shortage-card')) {
      wrap.innerHTML = nextHtml;
      wrap.dataset.managerSignature = lastSignature;
    }

    let detail = section?.querySelector('.manager-internal-detail');
    if (rawCount > 0) {
      if (!detail) {
        detail = document.createElement('details');
        detail.className = 'manager-internal-detail';
        wrap.insertAdjacentElement('afterend', detail);
      }
      detail.innerHTML = `<summary>内部判定を見る（${rawCount}件）</summary><div>30分×スキル単位の判定を、現場画面では ${groups.length}店舗日に集約しています。内部件数は開発・検証用です。</div>`;
    } else {
      detail?.remove();
    }
  }

  function renderGroup(group) {
    const windows = group.windows.map(window => `${fmtTime(window.start)}-${fmtTime(window.end)}`).join(' / ') || '要確認';
    const skills = group.skills.slice(0,5).join(' / ') + (group.skills.length > 5 ? ` ほか${group.skills.length - 5}` : '');
    return `<div class="month-shortage hard manager-shortage-card" data-date="${esc(group.date)}" data-store="${esc(group.storeId)}" data-store-name="${esc(group.storeName)}">
      <b>${esc(group.date)} ${esc(group.storeName)}</b>
      <span><strong>不足時間帯</strong> ${esc(windows)}</span>
      <span><strong>最大不足目安</strong> ${formatNeed(group.maxShortage)}人</span>
      ${skills ? `<small>不足条件：${esc(skills)}</small>` : ''}
    </div>`;
  }

  function groupByStoreDay(shortages) {
    const stores = loadStores();
    const skills = readArray(SKILLS_KEY);
    const storeMap = new Map(stores.map(store => [String(store.id), store.name || store.id]));
    const skillMap = new Map(skills.map(skill => [String(skill.id), skill.name || skill.id]));
    const map = new Map();

    shortages.forEach(item => {
      const rule = item?.rule || {};
      const date = String(item?.date || '');
      const storeId = String(rule.storeId || '');
      if (!date || !storeId) return;
      const key = `${date}|${storeId}`;
      if (!map.has(key)) {
        map.set(key, {
          date,
          storeId,
          storeName: storeMap.get(storeId) || storeId,
          maxShortage:0,
          intervals:[],
          skills:[],
        });
      }
      const group = map.get(key);
      const start = Number(rule.start || 0);
      const end = Number(rule.end || 0);
      const shortage = Number(item.shortage || Math.max(0, Number(rule.count || 0) - Number(item.minimum || 0)) || 0);
      group.maxShortage = Math.max(group.maxShortage, shortage);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) group.intervals.push({ start,end });
      const skillName = skillMap.get(String(rule.skillId || '')) || String(rule.skillId || '');
      if (skillName && !group.skills.includes(skillName)) group.skills.push(skillName);
    });

    return Array.from(map.values()).map(group => ({ ...group, windows:mergeIntervals(group.intervals) }))
      .sort((a,b) => a.date.localeCompare(b.date) || a.storeName.localeCompare(b.storeName,'ja'));
  }

  function mergeIntervals(intervals) {
    const rows = intervals.slice().sort((a,b) => a.start-b.start || a.end-b.end);
    const merged = [];
    rows.forEach(row => {
      const last = merged[merged.length-1];
      if (!last || row.start > last.end) merged.push({ start:row.start,end:row.end });
      else last.end = Math.max(last.end,row.end);
    });
    return merged;
  }

  function loadStores() {
    const value = readJson(STORES_KEY,DEFAULT_STORES);
    return Array.isArray(value) && value.length ? value : DEFAULT_STORES;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .manager-shortage-lead{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;padding:8px 10px;border:1px solid #e4e7ec;border-radius:8px;background:#f8fafc;font-size:8px;color:#667085}.manager-shortage-lead strong{color:#344054}.manager-shortage-card{min-width:280px;flex:1 1 320px;max-width:520px}.manager-shortage-card span{font-size:8px}.manager-shortage-card span strong{color:#475467}.manager-shortage-card small{display:block;font-size:7px;color:#667085;margin-top:2px}.manager-internal-detail{margin-top:8px;padding:7px 9px;border:1px solid #eaecf0;border-radius:8px;background:#fcfcfd;font-size:8px;color:#667085}.manager-internal-detail summary{cursor:pointer;font-weight:900;color:#475467}.manager-internal-detail div{padding-top:6px;line-height:1.6}
    `;
    document.head.appendChild(style);
  }

  function fmtTime(total) {
    const v=Number(total),next=v>=1440,h=Math.floor(v/60)%24,m=v%60;
    return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  function formatNeed(value) { const n=Math.round((Number(value)||0)*2)/2; return Number.isInteger(n)?String(n):n.toFixed(1); }
  function readArray(key) { const value=readJson(key,[]); return Array.isArray(value)?value:[]; }
  function readJson(key,fallback) { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? JSON.parse(JSON.stringify(fallback)); } catch { return JSON.parse(JSON.stringify(fallback)); } }
  function esc(value) { return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }
})();

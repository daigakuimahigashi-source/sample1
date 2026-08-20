(() => {
  'use strict';

  const LABELS = [
    '未経験',
    'サポートがあればできる',
    '一人でできる',
    '教育できる',
  ];
  const DETAIL = [
    '配置対象にしない',
    'サポートがあれば担当できる',
    '一人で担当できる',
    '他の従業員を教育できる',
  ];
  let timer = null;

  if (window.__shiftV2SkillLevelLabelsInstalled) return;
  window.__shiftV2SkillLevelLabelsInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    patchAll();
    bindEvents();
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest?.('.tab[data-view="master"],.tab[data-view="rules"],[data-unified-master],#master-manage-skills,[data-master-skill]')) schedule(40);
    }, false);

    document.addEventListener('input', event => {
      if (event.target?.id === 'master-search') schedule(20);
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.matches?.('#master-employment,#master-store,#master-inactive,[data-master-plan],#stable-store')) schedule(20);
    }, false);

    document.addEventListener('shiftv2-auth', () => schedule(260));
    document.addEventListener('shiftv2-master-rendered', () => schedule(0));
  }

  function schedule(delay = 0) {
    clearTimeout(timer);
    timer = setTimeout(patchAll, delay);
  }

  function patchAll() {
    patchMasterLegend();
    patchSkillButtons();
    patchRuleDefinitions();
    patchLevelOptions();
  }

  function patchMasterLegend() {
    document.querySelectorAll('#view-master .skill-legend-item').forEach((node, index) => {
      const level = Number(node.querySelector('b')?.textContent ?? index);
      if (!Number.isInteger(level) || level < 0 || level > 3) return;
      const expected = `${level}${LABELS[level]}`;
      if ((node.textContent || '').replace(/\s+/g, '') === expected.replace(/\s+/g, '')) return;
      node.innerHTML = `<b>${level}</b>${esc(LABELS[level])}`;
    });
  }

  function patchSkillButtons() {
    document.querySelectorAll('#view-master .skill-level').forEach(button => {
      const level = levelFrom(button);
      if (level < 0) return;
      const span = button.querySelector('span');
      if (span && span.textContent !== LABELS[level]) span.textContent = LABELS[level];
      const title = button.title || '';
      if (title) {
        const prefix = title.split(':')[0];
        const expected = `${prefix}: ${level} ${LABELS[level]}`;
        if (title !== expected) button.title = expected;
      }
    });
  }

  function patchRuleDefinitions() {
    document.querySelectorAll('#view-rules .level-definition').forEach(node => {
      const level = Number(node.querySelector('b')?.textContent ?? -1);
      if (level < 0 || level > 3) return;
      const strong = node.querySelector('strong');
      const small = node.querySelector('small');
      if (strong && strong.textContent !== LABELS[level]) strong.textContent = LABELS[level];
      if (small && small.textContent !== DETAIL[level]) small.textContent = DETAIL[level];
    });
  }

  function patchLevelOptions() {
    document.querySelectorAll('#view-rules select option').forEach(option => {
      const value = Number(option.value);
      if (!Number.isInteger(value) || value < 0 || value > 3) return;
      const text = option.textContent || '';
      if (!/Lv|未経験|できる|任せ|教育|サポート|一人/.test(text)) return;
      const expected = `${value} ${LABELS[value]}`;
      if (text !== expected) option.textContent = expected;
    });
  }

  function levelFrom(button) {
    for (let i = 0; i <= 3; i += 1) if (button.classList.contains(`level-${i}`)) return i;
    const b = Number(button.querySelector('b')?.textContent ?? -1);
    return Number.isInteger(b) && b >= 0 && b <= 3 ? b : -1;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
})();

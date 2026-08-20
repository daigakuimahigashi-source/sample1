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

  if (window.__shiftV2SkillLevelLabelsInstalled) return;
  window.__shiftV2SkillLevelLabelsInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    patchAll();
    observe(document.getElementById('view-master'));
    observe(document.getElementById('view-rules'));
    document.addEventListener('click', () => setTimeout(patchAll, 50), true);
  }

  function observe(root) {
    if (!root) return;
    new MutationObserver(() => patchAll()).observe(root, { childList:true, subtree:true });
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
      const b = node.querySelector('b');
      node.innerHTML = '';
      if (b) node.appendChild(b);
      else {
        const num = document.createElement('b');
        num.textContent = String(level);
        node.appendChild(num);
      }
      node.append(document.createTextNode(LABELS[level]));
    });
  }

  function patchSkillButtons() {
    document.querySelectorAll('#view-master .skill-level').forEach(button => {
      const level = levelFrom(button);
      if (level < 0) return;
      const span = button.querySelector('span');
      if (span) span.textContent = LABELS[level];
      if (button.title) {
        const prefix = button.title.split(':')[0];
        button.title = `${prefix}: ${level} ${LABELS[level]}`;
      }
    });
  }

  function patchRuleDefinitions() {
    document.querySelectorAll('#view-rules .level-definition').forEach(node => {
      const level = Number(node.querySelector('b')?.textContent ?? -1);
      if (level < 0 || level > 3) return;
      const strong = node.querySelector('strong');
      const small = node.querySelector('small');
      if (strong) strong.textContent = LABELS[level];
      if (small) small.textContent = DETAIL[level];
    });
  }

  function patchLevelOptions() {
    document.querySelectorAll('#view-rules select option').forEach(option => {
      const value = Number(option.value);
      if (!Number.isInteger(value) || value < 0 || value > 3) return;
      const text = option.textContent || '';
      if (/Lv|未経験|できる|任せ|教育|サポート|一人/.test(text)) option.textContent = `${value} ${LABELS[value]}`;
    });
  }

  function levelFrom(button) {
    for (let i = 0; i <= 3; i += 1) if (button.classList.contains(`level-${i}`)) return i;
    const b = Number(button.querySelector('b')?.textContent ?? -1);
    return Number.isInteger(b) && b >= 0 && b <= 3 ? b : -1;
  }
})();

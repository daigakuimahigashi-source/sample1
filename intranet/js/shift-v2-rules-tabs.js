(() => {
  'use strict';

  const TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  const VALID = ['skills', 'staff', 'requirements'];
  let observer = null;
  let queued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    patch();
    observer = new MutationObserver(schedule);
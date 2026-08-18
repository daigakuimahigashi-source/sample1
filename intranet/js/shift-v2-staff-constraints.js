(() => {
  'use strict';

  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const STORAGE_SKILLS = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const TEST_SEED_VERSION = 1;
  const DAYS = [
    { key: '1', label: '月' },
    { key: '2', label: '火' },
    { key: '3', label: '水' },
    { key: '4', label: '木' },
    { key: '5', label: '金' },
    { key: '6', label: '土' },
    { key: '0', label: '日' },
  ];

  let modalObserver = null;
  let seedTimer = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    injectStyles();
    injectMasterActions();
    observeCardModal();
    bind
(() => {
  'use strict';

  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  const state = {
    mode:'store-day',
    storeId:'matsuyama',
    date:'',
    month:'',
    staffId:'',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 120), { once:true });
  else setTimeout(init, 120);

  function init() {
    inject
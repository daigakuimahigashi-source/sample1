(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const CLOUD_STAFF = 'staff';
  let saving = false;

  if (window.__shiftV2MasterSaveGuardInstalled) return;
  window.__shiftV2MasterSaveGuardInstalled = true;

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#master-sync-cloud');
    if (!button) return;

    // 旧 shift-v2-staff-master.js の closure 内 state.staff を保存させない。
    // 統合後の正本は localStorage の最新 staff。
    event.preventDefault();
    event.stopImmediatePropagation();
    void saveLatest(button);
  }, true);

  async function saveLatest(button) {
    if (saving) return;
    if (window.shiftV2Access?.canEditHeadquarters?.() !== true) {
      window.shiftV2Access?.assertEdit?.();
      return;
    }

    const staff = readStaff();
    if (!staff) {
      notify('従業員データを読み込めませんでした');
      return;
    }

    saving = true;
    const oldText = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中';
    }

    try {
      if (!window.shiftV2Cloud || !window.shiftV2User) throw new Error('cloud-not-ready');
      await window.shiftV2Cloud.set(CLOUD_STAFF, staff);

      // 旧モジュールが持っている closure state も、保存済みクラウド値へ同期させる。
      document.dispatchEvent(new CustomEvent('shiftv2-auth', {
        detail:{ user:window.shiftV2User, admin:Boolean(window.shiftV2IsAdmin) }
      }));
      notify('従業員マスタをクラウド保存しました');
    } catch (error) {
      console.warn('Employee master latest save failed', error);
      notify('クラウド保存に失敗しました');
    } finally {
      saving = false;
      if (button) {
        button.disabled = false;
        button.innerHTML = oldText || '<i class="fa-solid fa-cloud-arrow-up"></i> クラウド保存';
      }
    }
  }

  function readStaff() {
    try {
      const value = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }
})();

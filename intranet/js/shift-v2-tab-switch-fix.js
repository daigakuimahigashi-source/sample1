(() => {
  'use strict';

  const TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  const VALID = ['skills', 'staff', 'requirements'];

  if (window.__shiftV2TabSwitchFixInstalled) return;
  window.__shiftV2TabSwitchFixInstalled = true;

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#view-rules [data-rs-tab]');
    if (!button) return;

    const key = button.dataset.rsTab;
    if (!VALID.includes(key)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    activate(key);
  }, true);

  function activate(key) {
    const view = document.getElementById('view-rules');
    if (!view) return;

    sessionStorage.setItem(TAB_KEY, key);

    view.querySelectorAll('[data-rs-tab]').forEach(button => {
      const active = button.dataset.rsTab === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    VALID.forEach(sectionKey => {
      const section = document.getElementById(`rs-${sectionKey}`);
      if (!section) return;
      const active = sectionKey === key;
      section.hidden = !active;
      section.classList.toggle('rs-independent-active', active);
      section.setAttribute('aria-hidden', active ? 'false' : 'true');
      section.style.setProperty('display', active ? 'block' : 'none', 'important');
    });

    if (key === 'requirements') {
      const store = document.getElementById('fh-store')?.value;
      const hourlyStore = document.getElementById('hrm-store');
      if (store && hourlyStore && hourlyStore.value !== store) {
        hourlyStore.value = store;
        hourlyStore.dispatchEvent(new Event('change', { bubbles:true }));
      }
    }

    setTimeout(() => {
      VALID.forEach(sectionKey => {
        const section = document.getElementById(`rs-${sectionKey}`);
        if (!section) return;
        const active = sectionKey === key;
        section.hidden = !active;
        section.classList.toggle('rs-independent-active', active);
        section.style.setProperty('display', active ? 'block' : 'none', 'important');
      });
    }, 0);
  }
})();

(() => {
  'use strict';

  let placeholder = null;
  let rulesView = null;
  let previousStyle = '';
  let previousClass = '';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  function init() {
    injectStyle();
    ensureModal();

    // Capture phase: works even if another module later clones/replaces the button.
    document.addEventListener('click', event => {
      const button
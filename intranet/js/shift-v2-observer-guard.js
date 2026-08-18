(() => {
  'use strict';

  if (window.__shiftV2ObserverGuardInstalled) return;
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver) return;

  class GuardedMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Map();
      this.scheduled = false;
      this.destroyed = false;
      this.native = new NativeMutationObserver((records) => this.queue(records));
    }

    observe(target, options) {
      if (!target || this.destroyed) return;
      this.targets.set(target, { ...options });
      this.native.observe(target, options);
    }

    disconnect() {
      this.native.disconnect();
      this.targets.clear();
      this.scheduled = false;
    }

    takeRecords() {
      return this.native.takeRecords();
    }

    queue(records) {
      if (this.destroyed || this.scheduled) return;
      this.scheduled = true;
      const pendingRecords = Array.from(records || []);
      requestAnimationFrame(() => {
        if (this.destroyed) return;
        this.scheduled = false;

        // Critical guard: callbacks in V2 frequently decorate the same subtree
        // they observe. Temporarily detach the native observer so those writes
        // do not recursively trigger another callback forever.
        this.native.disconnect();
        try {
          this.callback(pendingRecords, this);
        } catch (error) {
          console.error('Shift V2 MutationObserver callback failed', error);
        } finally {
          for (const [target, options] of this.targets.entries()) {
            if (target?.isConnected !== false) {
              try { this.native.observe(target, options); }
              catch (error) { console.warn('Shift V2 observer reconnect failed', error); }
            }
          }
        }
      });
    }
  }

  window.MutationObserver = GuardedMutationObserver;
  window.__shiftV2ObserverGuardInstalled = true;
})();
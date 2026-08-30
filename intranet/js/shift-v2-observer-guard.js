(() => {
  'use strict';

  if (window.__shiftV2ObserverGuardInstalled) return;
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver) return;

  const observers = new Set();
  const pendingObservers = new Set();
  let framePending = false;
  let flushing = false;
  let pauseDepth = window.__shiftV2Booting ? 1 : 0;

  class GuardedMutationObserver {
    constructor(callback) {
      if (typeof callback !== 'function') throw new TypeError('MutationObserver callback must be a function');
      this.callback = callback;
      this.targets = new Map();
      this.pendingRecords = [];
      this.native = new NativeMutationObserver(records => this.queue(records));
      observers.add(this);
    }

    observe(target, options) {
      if (!target) return;
      this.targets.set(target, { ...options });
      if (!flushing && pauseDepth === 0) this.native.observe(target, options);
    }

    disconnect() {
      this.native.disconnect();
      this.targets.clear();
      this.pendingRecords.length = 0;
      pendingObservers.delete(this);
    }

    takeRecords() {
      const records = this.pendingRecords.splice(0);
      records.push(...this.native.takeRecords());
      if (!this.pendingRecords.length) pendingObservers.delete(this);
      return records;
    }

    queue(records) {
      if (records?.length) this.pendingRecords.push(...records);
      if (!this.pendingRecords.length) return;
      pendingObservers.add(this);
      scheduleFlush();
    }
  }

  function scheduleFlush() {
    if (framePending || flushing || pauseDepth > 0 || !pendingObservers.size) return;
    framePending = true;
    requestAnimationFrame(flush);
  }

  function flush() {
    framePending = false;
    if (flushing || pauseDepth > 0 || !pendingObservers.size) return;
    flushing = true;

    const active = Array.from(observers).filter(observer => observer.targets.size);

    // V2 has many decorators watching the same workspace. Capture the whole
    // frame and detach every observer before callbacks run, so decorators do
    // not wake one another up in a render loop.
    active.forEach(observer => {
      const records = observer.native.takeRecords();
      if (records.length) {
        observer.pendingRecords.push(...records);
        pendingObservers.add(observer);
      }
      observer.native.disconnect();
    });

    const batch = Array.from(pendingObservers);
    pendingObservers.clear();
    try {
      batch.forEach(observer => {
        const records = observer.pendingRecords.splice(0);
        if (!records.length || !observer.targets.size) return;
        try {
          observer.callback(records, observer);
        } catch (error) {
          console.error('Shift V2 MutationObserver callback failed', error);
        }
      });
    } finally {
      flushing = false;
      reconnectAll();
      scheduleFlush();
    }
  }

  function reconnectAll() {
    if (pauseDepth > 0) return;
    observers.forEach(observer => {
      observer.targets.forEach((options, target) => {
        if (target?.isConnected === false) return;
        try { observer.native.observe(target, options); }
        catch (error) { console.warn('Shift V2 observer reconnect failed', error); }
      });
    });
  }

  function pause() {
    pauseDepth += 1;
    observers.forEach(observer => observer.native.disconnect());
  }

  function resume() {
    if (pauseDepth > 0) pauseDepth -= 1;
    if (pauseDepth > 0) return;
    reconnectAll();
    scheduleFlush();
  }

  function installSameTabStorageEvents() {
    if (!window.Storage || window.__shiftV2StorageEventsInstalled) return;
    const prototype = window.Storage.prototype;
    const originalSetItem = prototype.setItem;
    const originalRemoveItem = prototype.removeItem;
    const originalClear = prototype.clear;
    const changes = new Map();
    let queued = false;

    function isLocal(target) {
      try { return target === window.localStorage; }
      catch { return false; }
    }

    function queueChange(key, oldValue, newValue) {
      const normalizedKey = String(key);
      changes.set(normalizedKey, { key: normalizedKey, oldValue, newValue });
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        const batch = Array.from(changes.values());
        changes.clear();
        if (!batch.length) return;
        document.dispatchEvent(new CustomEvent('shiftv2-storage', {
          detail: { keys: batch.map(item => item.key), changes: batch },
        }));
      });
    }

    prototype.setItem = function setItem(key, value) {
      const local = isLocal(this);
      const oldValue = local ? this.getItem(key) : null;
      originalSetItem.call(this, key, value);
      if (local) {
        const newValue = String(value);
        if (oldValue !== newValue) queueChange(key, oldValue, newValue);
      }
    };

    prototype.removeItem = function removeItem(key) {
      const local = isLocal(this);
      const oldValue = local ? this.getItem(key) : null;
      originalRemoveItem.call(this, key);
      if (local && oldValue !== null) queueChange(key, oldValue, null);
    };

    prototype.clear = function clear() {
      const local = isLocal(this);
      const hadValues = local && this.length > 0;
      originalClear.call(this);
      if (hadValues) queueChange('*', null, null);
    };

    window.__shiftV2StorageEventsInstalled = true;
  }

  window.MutationObserver = GuardedMutationObserver;
  window.shiftV2ObserverGuard = { pause, resume, flush };
  window.__shiftV2ObserverGuardInstalled = true;
  installSameTabStorageEvents();
})();

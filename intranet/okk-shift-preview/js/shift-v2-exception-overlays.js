(() => {
  'use strict';

  const EXCEPTIONS_KEY = 'okk_shift_v2_exceptions';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';

  let queued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  document.addEventListener('shiftv2-auth', queue);
  document.addEventListener('shiftv2-cloud-ready', queue);

  function init() {
    injectStyles();
    const workspace = document.querySelector('.workspace');
    if (workspace) new MutationObserver(queue).observe(workspace, { childList:true, subtree:true });
    queue();
  }

  function queue() {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      decorateStaffView();
      decorateStoreView();
    }, 0);
  }

  function decorateStaffView() {
    const body = document.getElementById('staff-view-body');
    if (!body) return;
    const exceptions = read(EXCEPTIONS_KEY, {});

    body.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) return;
      const staffId = String(cells[0]?.textContent || '').trim().toUpperCase();
      const date = parseDisplayedDate(cells[2]?.textContent || '', document.getElementById('staff-month')?.value);
      let statusCell = cells[5];
      if (!statusCell) {
        statusCell = document.createElement('td');
        row.appendChild(statusCell);
      }
      const rows = Array.isArray(exceptions[date]) ? exceptions[date].filter(item => String(item.staffId || '').toUpperCase() === staffId) : [];
      statusCell.innerHTML = badges(rows);
    });

    const header = body.closest('table')?.querySelector('thead tr');
    if (header && header.children.length === 5) {
      const th = document.createElement('th');
      th.textContent = '当日対応';
      header.appendChild(th);
    }
  }

  function decorateStoreView() {
    const grid = document.getElementById('store-grid');
    const date = document.getElementById('store-date')?.value;
    if (!grid || !date) return;

    const exceptions = read(EXCEPTIONS_KEY, {});
    const day = Array.isArray(exceptions[date]) ? exceptions[date] : [];
    const shifts = read(SHIFTS_KEY, {});
    const dayShifts = Array.isArray(shifts[date]) ? shifts[date] : [];
    const stores = read(STORES_KEY, []);

    grid.querySelectorAll('.card').forEach(card => {
      card.querySelectorAll('.exception-store-extra').forEach(node => node.remove());
      card.querySelectorAll('.member').forEach(member => member.classList.remove('member-absence'));

      const storeName = card.querySelector('.store-card-head h3')?.textContent?.trim();
      const store = stores.find(item => item.name === storeName);
      if (!store) return;

      day.filter(item => item.type === 'absence').forEach(record => {
        const shift = dayShifts.find(item => item.id === record.shiftId);
        if (!shift || shift.startStoreId !== store.id) return;
        const member = findMember(card, staffName(record.staffId));
        if (member) {
          member.classList.add('member-absence');
          appendInlineBadge(member, '欠勤', 'absence');
        }
      });

      day.filter(item => item.type === 'emergency_call' && item.startStoreId === store.id).forEach(record => {
        const body = card.querySelector('.store-body');
        if (!body) return;
        const extra = document.createElement('div');
        extra.className = 'member exception-store-extra emergency-call-store';
        extra.innerHTML = `<div><strong>${esc(staffName(record.staffId))}</strong><div class="exception-inline emergency"><i class="fa-solid fa-bolt"></i> 臨時招集</div></div><span>${fmt(record.start)}-${fmt(record.end)}</span>`;
        body.appendChild(extra);
      });
    });
  }

  function badges(rows) {
    if (!rows.length) return '<span class="exception-none">—</span>';
    return rows.map(record => {
      if (record.type === 'emergency_call') return '<span class="exception-inline emergency"><i class="fa-solid fa-bolt"></i> 臨時招集</span>';
      return '<span class="exception-inline absence">欠勤</span>';
    }).join(' ');
  }

  function appendInlineBadge(member, text, type) {
    if (member.querySelector(`.exception-inline.${type}`)) return;
    const left = member.firstElementChild || member;
    const badge = document.createElement('div');
    badge.className = `exception-inline ${type}`;
    badge.textContent = text;
    left.appendChild(badge);
  }

  function findMember(card, name) {
    return Array.from(card.querySelectorAll('.member')).find(member => member.querySelector('strong')?.textContent?.trim() === name) || null;
  }

  function staffName(id) {
    const staff = read(STAFF_KEY, []);
    const person = staff.find(item => String(item.id || item.employeeNumber || '').toUpperCase() === String(id || '').toUpperCase());
    return person?.name || id || '-';
  }

  function parseDisplayedDate(text, month) {
    const match = String(text).match(/(\d{1,2})\/(\d{1,2})/);
    if (!match || !month) return '';
    return `${month}-${String(Number(match[2])).padStart(2,'0')}`;
  }

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function fmt(total) {
    const value = Number(total) || 0;
    const h = Math.floor(value / 60) % 24;
    const m = value % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  }

  function injectStyles() {
    if (document.getElementById('exception-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'exception-overlay-style';
    style.textContent = `
      .exception-inline{display:inline-flex;align-items:center;gap:3px;margin-top:3px;padding:2px 6px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}.exception-inline.emergency{background:#e11d48;color:#fff;box-shadow:0 0 0 2px #fff,0 2px 6px rgba(225,29,72,.18)}.exception-inline.absence{background:#475569;color:#fff}.exception-none{color:#98a2b3}.member.member-absence{opacity:.5;text-decoration:line-through}.member.member-absence .exception-inline{text-decoration:none}.emergency-call-store{background:#fff1f2;border-left:3px solid #e11d48;padding-left:8px !important}`;
    document.head.appendChild(style);
  }
})();

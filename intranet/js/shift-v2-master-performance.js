(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const LABELS = ['未経験','サポートがあればできる','一人でできる','教育できる'];
  let renderTimer = null;
  let rendering = false;

  if (window.__shiftV2MasterPerformanceInstalled) return;
  window.__shiftV2MasterPerformanceInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    bind();
    schedule(220);
  }

  function bind() {
    document.addEventListener('click', event => {
      if (event.target.closest?.('.tab[data-view="master"],[data-unified-master="employees"]')) schedule(70);
      if (event.target.closest?.('[data-auto],#master-sync-cloud')) schedule(60);
    }, false);

    document.addEventListener('input', event => {
      if (event.target?.id === 'master-search') schedule(0);
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.matches?.('#master-employment,#master-store,#master-inactive,[data-master-plan]')) schedule(0);
    }, false);

    document.addEventListener('shiftv2-auth', () => schedule(320));
    document.addEventListener('shiftv2-access-changed', () => schedule(60));
    document.addEventListener('shiftv2-master-render-request', () => schedule(0));
    document.addEventListener('shiftv2-master-data-changed', () => schedule(0));
  }

  function schedule(delay = 0) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderOnce, delay);
  }

  function renderOnce() {
    if (rendering) return;
    const body = document.getElementById('master-body');
    const head = document.querySelector('#view-master .master-table thead tr');
    if (!body || !head) return;
    rendering = true;
    try {
      patchHeader(head);
      patchRows(body);
      patchLegend();
      document.dispatchEvent(new CustomEvent('shiftv2-master-rendered'));
    } finally {
      rendering = false;
    }
  }

  function patchHeader(row) {
    const skills = activeSkills();
    row.querySelectorAll('.master-plan-head,.skill-head').forEach(node => node.remove());
    const cells = Array.from(row.children);
    if (cells.length < 3) return;
    const employment = cells[1];
    const placement = cells[cells.length - 1];

    const plan = document.createElement('th');
    plan.className = 'master-plan-head';
    plan.innerHTML = 'A/B<small>正社員</small>';
    employment.insertAdjacentElement('afterend', plan);

    skills.forEach(skill => {
      const th = document.createElement('th');
      th.className = 'skill-head';
      th.textContent = skill.name;
      placement.insertAdjacentElement('beforebegin', th);
    });
  }

  function patchRows(body) {
    const staff = staffList();
    const people = new Map(staff.map(person => [norm(person.id), person]));
    const skills = activeSkills();

    body.querySelectorAll('tr[data-person-id]').forEach(row => {
      const person = people.get(norm(row.dataset.personId));
      if (!person) return;

      row.querySelectorAll('.master-plan-cell,.skill-cell').forEach(node => node.remove());
      const cells = Array.from(row.children);
      if (cells.length < 3) return;
      const employment = cells[1];
      const placement = cells[cells.length - 1];

      const plan = document.createElement('td');
      plan.className = 'master-plan-cell';
      if (person.employmentType === '正社員') {
        const group = `master-plan-${safe(person.id)}`;
        plan.innerHTML = `<div class="master-plan-radios" role="radiogroup" aria-label="${esc(person.name || person.id)} A/Bプラン"><label class="plan-radio plan-a ${person.workPlanId === 'A' ? 'selected' : ''}"><input type="radio" data-master-plan="${esc(person.id)}" name="${group}" value="A" ${person.workPlanId === 'A' ? 'checked' : ''}><span>A</span></label><label class="plan-radio plan-b ${person.workPlanId === 'B' ? 'selected' : ''}"><input type="radio" data-master-plan="${esc(person.id)}" name="${group}" value="B" ${person.workPlanId === 'B' ? 'checked' : ''}><span>B</span></label></div>`;
      } else {
        plan.innerHTML = '<span class="plan-na">—</span>';
      }
      employment.insertAdjacentElement('afterend', plan);

      skills.forEach(skill => {
        const level = clamp(person.skillLevels?.[skill.id]);
        const td = document.createElement('td');
        td.className = 'skill-cell';
        td.innerHTML = `<button type="button" class="skill-level level-${level}" data-master-skill="${esc(skill.id)}" data-person-id="${esc(person.id)}" title="${esc(`${skill.name}: ${level} ${LABELS[level]}`)}"><b>${level}</b><span>${esc(LABELS[level])}</span></button>`;
        placement.insertAdjacentElement('beforebegin', td);
      });
    });

    const empty = body.querySelector('.master-empty');
    if (empty) empty.colSpan = 5 + skills.length;
  }

  function patchLegend() {
    document.querySelectorAll('#view-master .skill-legend-item').forEach((node, index) => {
      const level = Number(node.querySelector('b')?.textContent ?? index);
      if (!Number.isInteger(level) || level < 0 || level > 3) return;
      node.innerHTML = `<b>${level}</b>${esc(LABELS[level])}`;
    });
  }

  function activeSkills() {
    try {
      const value = JSON.parse(localStorage.getItem(SKILLS_KEY));
      return Array.isArray(value) ? value.filter(skill => skill && skill.active !== false) : [];
    } catch { return []; }
  }

  function staffList() {
    try {
      const value = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function clamp(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0; }
  function norm(value) { return String(value || '').trim().toUpperCase(); }
  function safe(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
})();

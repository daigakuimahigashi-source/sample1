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
      if (event.target.closest?.('[data-auto],#master-sync-cloud')) schedule(50);
    }, false);

    document.addEventListener('input', event => {
      if (event.target?.id === 'master-search') schedule(70);
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.matches?.('#master-employment,#master-store,#master-inactive')) {
        schedule(20);
        return;
      }
      if (event.target?.matches?.('[data-master-plan]')) {
        const group = event.target.closest('.master-plan-radios');
        if (group) updatePlanSelection(group);
      }
    }, false);

    document.addEventListener('shiftv2-auth', () => schedule(260));
    document.addEventListener('shiftv2-access-changed', () => schedule(50));
    document.addEventListener('shiftv2-master-render-request', () => schedule(20));
    document.addEventListener('shiftv2-master-data-changed', () => schedule(20));
  }

  function schedule(delay = 0) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => requestAnimationFrame(renderOnce), delay);
  }

  function renderOnce() {
    if (rendering) return;
    const body = document.getElementById('master-body');
    const head = document.querySelector('#view-master .master-table thead tr');
    if (!body || !head) return;

    rendering = true;
    try {
      const skills = activeSkills();
      const staff = staffList();
      const people = new Map(staff.map(person => [norm(person.id), person]));
      patchHeader(head, skills);
      patchRows(body, people, skills);
      patchLegend();
      document.dispatchEvent(new CustomEvent('shiftv2-master-rendered'));
    } finally {
      rendering = false;
    }
  }

  function patchHeader(row, skills) {
    row.querySelectorAll('.master-plan-head,.skill-head').forEach(node => node.remove());
    const cells = Array.from(row.children);
    if (cells.length < 3) return;
    const employment = cells[1];
    const placement = cells[cells.length - 1];
    const skillHeaders = skills.map(skill => `<th class="skill-head">${esc(skill.name)}</th>`).join('');
    employment.insertAdjacentHTML('afterend', '<th class="master-plan-head">A/B<small>正社員</small></th>');
    placement.insertAdjacentHTML('beforebegin', skillHeaders);
  }

  function patchRows(body, people, skills) {
    const rows = body.querySelectorAll('tr[data-person-id]');
    rows.forEach(row => {
      const person = people.get(norm(row.dataset.personId));
      if (!person) return;

      row.querySelectorAll('.master-plan-cell,.skill-cell').forEach(node => node.remove());
      const cells = Array.from(row.children);
      if (cells.length < 3) return;
      const employment = cells[1];
      const placement = cells[cells.length - 1];

      employment.insertAdjacentHTML('afterend', planCellHtml(person));
      placement.insertAdjacentHTML('beforebegin', skills.map(skill => skillCellHtml(person, skill)).join(''));
    });

    const empty = body.querySelector('.master-empty');
    if (empty) empty.colSpan = 5 + skills.length;
  }

  function planCellHtml(person) {
    if (person.employmentType !== '正社員') return '<td class="master-plan-cell"><span class="plan-na">—</span></td>';
    const group = `master-plan-${safe(person.id)}`;
    return `<td class="master-plan-cell"><div class="master-plan-radios" role="radiogroup" aria-label="${esc(person.name || person.id)} A/Bプラン"><label class="plan-radio plan-a ${person.workPlanId === 'A' ? 'selected' : ''}"><input type="radio" data-master-plan="${esc(person.id)}" name="${group}" value="A" ${person.workPlanId === 'A' ? 'checked' : ''}><span>A</span></label><label class="plan-radio plan-b ${person.workPlanId === 'B' ? 'selected' : ''}"><input type="radio" data-master-plan="${esc(person.id)}" name="${group}" value="B" ${person.workPlanId === 'B' ? 'checked' : ''}><span>B</span></label></div></td>`;
  }

  function skillCellHtml(person, skill) {
    const level = clamp(person.skillLevels?.[skill.id]);
    return `<td class="skill-cell"><button type="button" class="skill-level level-${level}" data-master-skill="${esc(skill.id)}" data-person-id="${esc(person.id)}" title="${esc(`${skill.name}: ${level} ${LABELS[level]}`)}"><b>${level}</b><span>${esc(LABELS[level])}</span></button></td>`;
  }

  function updatePlanSelection(group) {
    const checked = group.querySelector('input:checked')?.value || '';
    group.querySelectorAll('.plan-radio').forEach(label => {
      label.classList.toggle('selected', label.querySelector('input')?.value === checked);
    });
  }

  function patchLegend() {
    document.querySelectorAll('#view-master .skill-legend-item').forEach((node, index) => {
      const level = Number(node.querySelector('b')?.textContent ?? index);
      if (!Number.isInteger(level) || level < 0 || level > 3) return;
      const expected = `${level}${LABELS[level]}`.replace(/\s+/g, '');
      if ((node.textContent || '').replace(/\s+/g, '') === expected) return;
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

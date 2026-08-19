import {
  auth,
  loginWithGoogle,
  logout,
  isAdmin,
  onAuthStateChanged,
  fsGet,
  fsSet,
  fsListen,
  getStaffLink,
} from './firebase-config.js';
import { ROLE_DEFINITIONS, hasPermission } from '../data/shift-platform-config.js';

const DEFAULT_ACCESS = {
  roleId: 'employee',
  roleLabel: ROLE_DEFINITIONS.employee.label,
  staffId: null,
  staffName: null,
  linked: false,
  authenticated: false,
};

let access = { ...DEFAULT_ACCESS };
let applyQueued = false;

window.shiftV2Access = publicAccess();
window.shiftV2Login = () => loginWithGoogle();
window.shiftV2Logout = () => logout();

const rawCloud = {
  get: fsGet,
  set: fsSet,
  listen: fsListen,
};

window.shiftV2Cloud = {
  get: rawCloud.get,
  listen: rawCloud.listen,
  set: guardedCloudSet,
};

document.dispatchEvent(new Event('shiftv2-cloud-ready'));

onAuthStateChanged(auth, async user => {
  window.shiftV2User = user || null;
  window.shiftV2IsAdmin = isAdmin(user);

  try {
    access = await resolveAccess(user);
  } catch (error) {
    console.warn('Failed to resolve V2 access role', error);
    access = {
      ...DEFAULT_ACCESS,
      authenticated: Boolean(user),
    };
  }

  window.shiftV2Access = publicAccess();
  document.dispatchEvent(new CustomEvent('shiftv2-auth', {
    detail: { user, admin: isAdmin(user), access: window.shiftV2Access },
  }));
  document.dispatchEvent(new CustomEvent('shiftv2-access', {
    detail: window.shiftV2Access,
  }));
  queueApplyAccess();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startUiGuard, { once: true });
} else {
  startUiGuard();
}

function startUiGuard() {
  installCaptureGuards();
  queueApplyAccess();

  const root = document.querySelector('.app-shell');
  if (root) {
    new MutationObserver(() => queueApplyAccess()).observe(root, {
      childList: true,
      subtree: true,
    });
  }
}

async function resolveAccess(user) {
  if (!user) return { ...DEFAULT_ACCESS };

  if (isAdmin(user)) {
    return {
      roleId: 'hq',
      roleLabel: ROLE_DEFINITIONS.hq.label,
      staffId: null,
      staffName: user.displayName || user.email || '本部',
      linked: true,
      authenticated: true,
    };
  }

  const link = await getStaffLink(user.uid).catch(() => null);
  const staffId = String(link?.staffId || '').toUpperCase() || null;
  const staff = staffId ? await loadStaffRecord(staffId) : null;
  const roleId = roleFromStaff(staff);

  return {
    roleId,
    roleLabel: ROLE_DEFINITIONS[roleId]?.label || ROLE_DEFINITIONS.employee.label,
    staffId,
    staffName: staff?.name || link?.staffName || user.displayName || null,
    linked: Boolean(staffId),
    authenticated: true,
  };
}

async function loadStaffRecord(staffId) {
  let staffList = null;
  try {
    staffList = await fsGet('staff');
  } catch (error) {
    console.warn('Failed to load staff master for access resolution', error);
  }

  if (!Array.isArray(staffList)) {
    try {
      staffList = JSON.parse(localStorage.getItem('okk_shift_v2_staff') || '[]');
    } catch {
      staffList = [];
    }
  }

  return staffList.find(item => canonicalStaffId(item) === staffId) || null;
}

function roleFromStaff(staff) {
  if (!staff) return 'employee';

  const explicit = String(
    staff.systemRole || staff.roleId || staff.accessRole || ''
  ).trim();

  if (['hq', 'head_office', '本部'].includes(explicit)) return 'hq';
  if (['managerQualified', 'manager_qualified', '店長資格保有者', '店長資格'].includes(explicit)) {
    return 'managerQualified';
  }

  // Canonical V1 flag: qualification, not store assignment or job title.
  if (staff.managerQualified === true || staff.isManagerQualified === true) {
    return 'managerQualified';
  }

  return 'employee';
}

async function guardedCloudSet(key, value) {
  const required = cloudWritePermission(key);
  if (required && !can(required)) {
    throw new Error(`Permission denied for ${key}: ${access.roleId}`);
  }

  if (key === 'shiftV2Exceptions' && !canAnyException()) {
    throw new Error(`Permission denied for ${key}: ${access.roleId}`);
  }

  return rawCloud.set(key, value);
}

function cloudWritePermission(key) {
  if (key === 'shiftV2Shifts') return 'shift.plan.edit';
  if (key === 'shiftV2Config') return 'store.master.edit';
  if (key === 'staff') return 'staff.master.edit';
  return null;
}

function can(permission) {
  return hasPermission(access.roleId, permission);
}

function canAnyException() {
  return [
    'shift.exception.absence',
    'shift.exception.emergency_call',
    'shift.exception.support_move',
  ].some(permission => can(permission));
}

function publicAccess() {
  return {
    ...access,
    can: permission => can(permission),
    canAnyException: () => canAnyException(),
  };
}

function installCaptureGuards() {
  document.addEventListener('pointerdown', event => {
    if (can('shift.plan.edit')) return;
    if (event.target.closest('#view-planner .shift-bar')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('dragstart', event => {
    if (can('shift.plan.edit')) return;
    if (event.target.closest('#staff-list .staff-card')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('drop', event => {
    if (can('shift.plan.edit')) return;
    if (event.target.closest('#empty-drop-track')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('click', event => {
    const target = event.target;

    if (!can('shift.plan.edit') && target.closest('#save-btn, #delete-shift')) {
      block(event, '通常シフトの編集は本部のみです');
      return;
    }

    if (!can('store.master.edit') && target.closest('#settings-btn, #settings-save, #settings-reset')) {
      block(event, '店舗設定は本部のみです');
      return;
    }

    if (!hasPermission(access.roleId, 'mf.export') && target.closest('#csv-download, #csv-refresh')) {
      block(event, 'MF CSVは本部のみです');
      return;
    }

    if (!canAnyException() && target.closest('#view-exceptions #ex-submit, #view-exceptions [data-delete-exception], #view-exceptions [data-exception-type]')) {
      block(event, '当日対応の登録権限がありません');
    }
  }, true);

  document.addEventListener('change', event => {
    if (can('shift.plan.edit')) return;
    if (event.target.closest('#inspector #ins-store, #inspector #ins-start, #inspector #ins-end, #inspector #ins-memo')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify('通常シフトの編集は本部のみです');
      queueApplyAccess();
    }
  }, true);
}

function block(event, message) {
  event.preventDefault();
  event.stopImmediatePropagation();
  notify(message);
}

function queueApplyAccess() {
  if (applyQueued) return;
  applyQueued = true;
  requestAnimationFrame(() => {
    applyQueued = false;
    applyAccessToUi();
  });
}

function applyAccessToUi() {
  const roleId = access.roleId;
  const canEditPlan = can('shift.plan.edit');
  const canEditStores = can('store.master.edit');
  const canExport = can('mf.export');
  const canExceptions = canAnyException();

  renderAccessBadge();

  setVisible(document.getElementById('save-btn'), canEditPlan);
  setVisible(document.getElementById('settings-btn'), canEditStores);
  setVisible(document.querySelector('[data-view="exceptions"]'), canExceptions);
  setVisible(document.querySelector('[data-view="csv"]'), canExport);

  const plannerToolbarRight = document.querySelector('#view-planner .toolbar-right');
  setVisible(plannerToolbarRight, canEditPlan);

  document.querySelectorAll('#staff-list .staff-card').forEach(card => {
    if (!canEditPlan) card.setAttribute('draggable', 'false');
  });

  document.querySelectorAll('#gantt-canvas .handle').forEach(handle => {
    handle.style.display = canEditPlan ? '' : 'none';
  });

  document.querySelectorAll('#inspector select, #inspector input').forEach(control => {
    control.disabled = !canEditPlan;
  });
  setVisible(document.getElementById('delete-shift'), canEditPlan);

  const exceptionForm = document.getElementById('exception-form');
  if (exceptionForm) {
    exceptionForm.querySelectorAll('input, select, button').forEach(control => {
      control.disabled = !canExceptions;
    });
  }

  if (roleId === 'employee') {
    setVisible(document.querySelector('[data-view="planner"]'), false);
    setVisible(document.querySelector('[data-view="store"]'), false);
    setVisible(document.querySelector('[data-view="exceptions"]'), false);
    setVisible(document.querySelector('[data-view="csv"]'), false);
    filterEmployeeRows();
    setVisible(document.getElementById('staff-summary'), false);
    ensureEmployeeView();
  } else {
    setVisible(document.querySelector('[data-view="planner"]'), true);
    setVisible(document.querySelector('[data-view="store"]'), true);
    setVisible(document.getElementById('staff-summary'), true);
  }
}

function filterEmployeeRows() {
  const staffId = String(access.staffId || '').toUpperCase();
  const body = document.getElementById('staff-view-body');
  if (!body) return;

  body.querySelectorAll('tr').forEach(row => {
    const rowStaffId = String(row.querySelector('td')?.textContent || '').trim().toUpperCase();
    const isEmptyMessage = row.querySelectorAll('td').length === 1;
    row.style.display = isEmptyMessage || (staffId && rowStaffId === staffId) ? '' : 'none';
  });
}

function ensureEmployeeView() {
  const active = document.querySelector('.tab.active');
  if (active?.dataset.view === 'staff') return;
  document.querySelector('[data-view="staff"]')?.click();
}

function renderAccessBadge() {
  const actions = document.querySelector('.topbar .actions');
  if (!actions) return;

  let badge = document.getElementById('access-role-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'access-role-badge';
    badge.style.cssText = 'font-size:9px;font-weight:900;padding:4px 7px;border-radius:999px;background:#e2e8f0;color:#334155;white-space:nowrap';
    actions.insertBefore(badge, actions.firstChild);
  }

  const suffix = access.roleId === 'employee' && !access.linked && access.authenticated
    ? '・未紐付け'
    : '';
  badge.textContent = `${access.roleLabel}${suffix}`;
}

function setVisible(element, visible) {
  if (!element) return;
  element.style.display = visible ? '' : 'none';
}

function canonicalStaffId(staff) {
  return String(staff?.id || staff?.employeeNumber || '').toUpperCase();
}

function notify(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

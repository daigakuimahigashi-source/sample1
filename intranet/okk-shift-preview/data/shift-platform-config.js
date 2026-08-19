// OKK shift platform V1 configuration
// Business rules are centralized here so UI/AI/MF export can share one source of truth.

export const ROLE_DEFINITIONS = {
  hq: {
    label: '本部',
    permissions: [
      'shift.plan.create',
      'shift.plan.edit',
      'shift.plan.confirm',
      'shift.exception.absence',
      'shift.exception.emergency_call',
      'shift.exception.support_move',
      'staff.skill.edit',
      'staff.master.edit',
      'store.master.edit',
      'requirements.master.edit',
      'mf.export',
      'shift.view.all'
    ]
  },
  managerQualified: {
    label: '店長資格保有者',
    permissions: [
      'shift.exception.absence',
      'shift.exception.emergency_call',
      'staff.skill.edit',
      'shift.view.all'
    ]
  },
  employee: {
    label: '一般従業員',
    permissions: [
      'shift.view.own'
    ]
  }
};

export const AREA_DEFINITIONS = {
  naha: {
    label: '那覇エリア',
    storeIds: ['matsuyama', 'kumoji', 'miebashi']
  },
  okinawa: {
    label: '沖縄エリア',
    storeIds: ['misato']
  }
};

// Planned shifts intentionally stay simple.
// A monthly plan records only WHO / DATE / START STORE / START TIME / END TIME.
// Intra-day movement is an operational decision and is not encoded into the
// original monthly shift plan.
export const SHIFT_PLAN_FIELDS = [
  'employeeId',
  'workDate',
  'startStoreId',
  'startTime',
  'endTime'
];

// closeHour supports 24+ hour notation for next-day closing times.
// Closing time is reference information for UI/AI validation only; it does not
// automatically create a move or change the employee's planned shift.
export const DEFAULT_STORE_RULES = [
  {
    id: 'matsuyama',
    name: '松山店',
    areaId: 'naha',
    closeHour: 30,
    closeLabel: '翌6:00',
    displayOrder: 1,
    effectiveFrom: '2026-08-01'
  },
  {
    id: 'kumoji',
    name: '久茂地店',
    areaId: 'naha',
    closeHour: 25,
    closeLabel: '翌1:00',
    displayOrder: 2,
    effectiveFrom: '2026-08-01'
  },
  {
    id: 'miebashi',
    name: '美栄橋店',
    areaId: 'naha',
    closeHour: 25,
    closeLabel: '翌1:00',
    displayOrder: 3,
    effectiveFrom: '2026-08-01'
  },
  {
    id: 'misato',
    name: '美里店',
    areaId: 'okinawa',
    closeHour: 26,
    closeLabel: '翌2:00',
    displayOrder: 4,
    effectiveFrom: '2026-08-01'
  }
];

// This is the single skill catalogue used by human evaluation, staffing rules
// and future AI shift generation. Do not create a separate AI-only skill list.
export const SKILL_DEFINITIONS = [
  { id: 'meat', name: '肉場', legacyNames: ['肉場'] },
  { id: 'salad', name: 'サラダ場', legacyNames: ['サラダ場'] },
  { id: 'drink', name: 'ドリンカー', legacyNames: ['ドリンカー', 'ドリンク'] },
  { id: 'hall_grill', name: 'ホール（肉焼ける）', legacyNames: ['ホール（肉焼ける）'] },
  { id: 'hall_basic', name: 'ホール（肉焼けない）', legacyNames: ['ホール（肉焼けない）', 'ホール'] },
  { id: 'dish', name: '洗い場', legacyNames: ['洗い場'] },
  { id: 'closing', name: '締め作業', legacyNames: ['締め作業'] },
  { id: 'opening', name: '開店作業', legacyNames: ['開店作業', 'オープン準備'] },
  { id: 'register', name: 'レジ', legacyNames: ['レジ'] }
];

export const SKILL_LEVELS = [
  { value: 0, label: '未経験' },
  { value: 1, label: 'できる' },
  { value: 2, label: '責任もってできる' },
  { value: 3, label: '教育できる' }
];

// Same-day operational exceptions do not rewrite the original confirmed plan.
// Support moves remain a head-office capability in V1; manager-qualified users
// are limited to absence and emergency-call operations.
export const EXCEPTION_ACTIONS = [
  { id: 'absence', label: '欠勤' },
  { id: 'emergency_call', label: '臨時招集' },
  { id: 'support_move', label: '当日応援' }
];

export function hasPermission(roleId, permission) {
  return ROLE_DEFINITIONS[roleId]?.permissions?.includes(permission) === true;
}

export function getStoreRule(storeId, rules = DEFAULT_STORE_RULES) {
  return rules.find(store => store.id === storeId) || null;
}

// OKK shift platform V1 configuration

export const ROLE_DEFINITIONS = {
  hq: {
    label: '本部',
    permissions: [
      'shift.plan.create','shift.plan.edit','shift.plan.confirm',
      'shift.exception.absence','shift.exception.emergency_call',
      'staff.skill.edit','staff.master.edit','store.master.edit','requirements.master.edit',
      'mf.export','shift.view.all'
    ]
  },
  managerQualified: {
    label: '店長資格保有者',
    permissions: [
      'shift.exception.absence','shift.exception.emergency_call',
      'staff.skill.edit','shift.view.all'
    ]
  },
  employee: {
    label: '一般従業員',
    permissions: ['shift.view.own']
  }
};

export const AREA_DEFINITIONS = {
  naha: { label: '那覇エリア', storeIds: ['matsuyama','kumoji','miebashi'] },
  okinawa: { label: '沖縄エリア', storeIds: ['misato'] }
};

// Monthly shift plan is intentionally simple: who / date / start store / start / end.
export const SHIFT_PLAN_FIELDS = ['employeeId','workDate','startStoreId','startTime','endTime'];

export const DEFAULT_STORE_RULES = [
  { id:'matsuyama', name:'松山店', areaId:'naha', closeHour:30, closeLabel:'翌6:00', displayOrder:1 },
  { id:'kumoji', name:'久茂地店', areaId:'naha', closeHour:25, closeLabel:'翌1:00', displayOrder:2 },
  { id:'miebashi', name:'美栄橋店', areaId:'naha', closeHour:25, closeLabel:'翌1:00', displayOrder:3 },
  { id:'misato', name:'美里店', areaId:'okinawa', closeHour:26, closeLabel:'翌2:00', displayOrder:4 }
];

export const SKILL_NAMES = ['肉場','サラダ場','ドリンカー','ホール（肉焼ける）','ホール（肉焼けない）','洗い場','締め作業','開店作業','レジ'];
export const SKILL_LEVELS = [
  { value:0, label:'未経験' },
  { value:1, label:'できる' },
  { value:2, label:'責任もってできる' },
  { value:3, label:'教育できる' }
];

export const EXCEPTION_ACTIONS = [
  { id:'absence', label:'欠勤' },
  { id:'emergency_call', label:'臨時招集' }
];

export function hasPermission(roleId, permission) {
  return ROLE_DEFINITIONS[roleId]?.permissions?.includes(permission) === true;
}

export function getStoreRule(storeId, rules = DEFAULT_STORE_RULES) {
  return rules.find(store => store.id === storeId) || null;
}

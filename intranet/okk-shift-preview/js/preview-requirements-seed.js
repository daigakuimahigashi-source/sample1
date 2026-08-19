(() => {
  'use strict';
  const KEY = 'okk_shift_v2_staffing_requirements';
  if (localStorage.getItem(KEY)) return;

  const rows = [
    req('matsuyama','all',17,23,'hall_grill',2,1,'hard'),
    req('matsuyama','all',17,23,'hall_basic',1,2,'hard'),
    req('matsuyama','all',17,23,'meat',2,1,'hard'),
    req('matsuyama','all',17,23,'salad',1,1,'hard'),
    req('matsuyama','all',17,23,'drink',1,1,'hard'),
    req('matsuyama','all',23,30,'hall_basic',1,1,'hard'),
    req('matsuyama','all',23,30,'meat',2,1,'hard'),
    req('matsuyama','all',25,30,'closing',2,1,'hard'),

    req('kumoji','all',17,22,'hall_grill',2,1,'hard'),
    req('kumoji','all',17,22,'hall_basic',1,2,'hard'),
    req('kumoji','all',17,22,'meat',2,1,'hard'),
    req('kumoji','all',17,22,'salad',1,1,'recommended'),
    req('kumoji','all',17,22,'drink',1,1,'hard'),
    req('kumoji','all',22,25,'hall_basic',1,2,'hard'),
    req('kumoji','all',24,25,'closing',2,1,'hard'),

    req('miebashi','all',17,22,'hall_grill',2,1,'hard'),
    req('miebashi','all',17,22,'hall_basic',1,1,'hard'),
    req('miebashi','all',17,22,'meat',2,1,'hard'),
    req('miebashi','all',17,22,'drink',1,1,'hard'),
    req('miebashi','all',22,25,'hall_basic',1,2,'hard'),
    req('miebashi','all',24,25,'closing',2,1,'hard'),

    req('misato','all',17,22,'hall_grill',2,1,'hard'),
    req('misato','all',17,22,'hall_basic',1,1,'hard'),
    req('misato','all',17,22,'meat',2,1,'hard'),
    req('misato','all',17,22,'salad',1,1,'recommended'),
    req('misato','all',17,22,'drink',1,1,'hard'),
    req('misato','all',22,26,'hall_basic',1,2,'hard'),
    req('misato','all',25,26,'closing',2,1,'hard'),
  ];

  localStorage.setItem(KEY, JSON.stringify(rows));

  function req(storeId, dayType, startHour, endHour, skillId, minLevel, count, mode) {
    return {
      id:`req_${storeId}_${dayType}_${startHour}_${endHour}_${skillId}_${minLevel}_${count}_${mode}`,
      storeId,
      dayType,
      specificDate:'',
      start:startHour*60,
      end:endHour*60,
      skillId,
      minLevel,
      count,
      mode,
      active:true,
      sample:true,
    };
  }
})();

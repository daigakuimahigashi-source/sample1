import { fsGet, fsSet } from './firebase-config.js';

const waitForCloud = setInterval(() => {
  if (!window.shiftV2Cloud?.set) return;
  clearInterval(waitForCloud);
  installGuard();
}, 25);
setTimeout(() => clearInterval(waitForCloud), 5000);

function installGuard() {
  if (window.shiftV2Cloud.__skillWriteGuardInstalled) return;
  const guardedSet = window.shiftV2Cloud.set.bind(window.shiftV2Cloud);

  window.shiftV2Cloud.set = async (key, value) => {
    const access = window.shiftV2Access;
    if (key !== 'staff' || access?.roleId !== 'managerQualified') {
      return guardedSet(key, value);
    }

    if (!access?.can?.('staff.skill.edit')) {
      throw new Error('Permission denied: staff.skill.edit');
    }
    if (!Array.isArray(value)) throw new Error('Invalid staff payload');

    const current = await fsGet('staff');
    if (!Array.isArray(current)) throw new Error('Current staff master could not be verified');
    assertSkillOnlyChange(current, value);
    return fsSet('staff', value);
  };
  window.shiftV2Cloud.__skillWriteGuardInstalled = true;
}

function assertSkillOnlyChange(beforeList, afterList) {
  const before = new Map(beforeList.map(person => [idOf(person), person]));
  const after = new Map(afterList.map(person => [idOf(person), person]));
  if (before.size !== after.size) throw new Error('Staff rows cannot be added or removed by manager-qualified users');

  for (const [id, oldPerson] of before.entries()) {
    const newPerson = after.get(id);
    if (!newPerson) throw new Error(`Staff row missing: ${id}`);
    const oldSafe = stripSkillFields(oldPerson);
    const newSafe = stripSkillFields(newPerson);
    if (stable(oldSafe) !== stable(newSafe)) {
      throw new Error(`Non-skill staff fields changed: ${id}`);
    }
  }
}

function stripSkillFields(person) {
  const clone = JSON.parse(JSON.stringify(person || {}));
  delete clone.skillLevels;
  delete clone.skills;
  return clone;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function idOf(person) {
  return String(person?.id || person?.employeeNumber || '').toUpperCase();
}

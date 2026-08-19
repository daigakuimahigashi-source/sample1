export const SLOT_MINUTES = 30;

export function normalizeLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.round(n)));
}

export function skillLevel(person, skillId) {
  if (!person || !skillId) return 0;
  const direct = person.skillLevels?.[skillId];
  if (direct !== undefined) return normalizeLevel(direct);
  const legacy = Array.isArray(person.skills)
    ? person.skills.find(row => String(row?.id || row?.skillId || row?.name || '') === String(skillId))
    : null;
  return normalizeLevel(legacy?.level);
}

export function expandRulesToSlots(rules, slotMinutes = SLOT_MINUTES) {
  const groups = new Map();
  for (const raw of Array.isArray(rules) ? rules : []) {
    if (!raw || raw.active === false) continue;
    const start = Number(raw.start);
    const end = Number(raw.end);
    const count = Math.max(0, Number(raw.count || 0));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || count <= 0) continue;
    for (let slotStart = start; slotStart < end; slotStart += slotMinutes) {
      const slotEnd = Math.min(end, slotStart + slotMinutes);
      const key = `${raw.storeId}|${slotStart}|${slotEnd}`;
      if (!groups.has(key)) groups.set(key, {
        key,
        storeId: raw.storeId,
        start: slotStart,
        end: slotEnd,
        rules: [],
      });
      groups.get(key).rules.push({
        ...raw,
        start: slotStart,
        end: slotEnd,
        count,
        minLevel: Math.max(0, Number(raw.minLevel || 0)),
        mode: raw.mode === 'hard' ? 'hard' : 'recommended',
      });
    }
  }
  return [...groups.values()].sort((a, b) =>
    String(a.storeId).localeCompare(String(b.storeId)) || a.start - b.start || a.end - b.end
  );
}

export function evaluateSlot({ rules, people, levelOf = skillLevel }) {
  const hard = (rules || []).filter(rule => rule.mode === 'hard');
  const recommended = (rules || []).filter(rule => rule.mode !== 'hard');

  const hardResult = assignSeats(hard, people || [], new Set(), levelOf);
  const recommendedResult = assignSeats(recommended, people || [], hardResult.usedStaff, levelOf);

  const byRule = new Map();
  const results = [];
  for (const rule of rules || []) {
    const source = rule.mode === 'hard' ? hardResult.byRule : recommendedResult.byRule;
    const filled = source.get(rule.id) || 0;
    const result = {
      ruleId: rule.id,
      storeId: rule.storeId,
      skillId: rule.skillId,
      minLevel: Number(rule.minLevel || 0),
      count: Math.max(0, Number(rule.count || 0)),
      mode: rule.mode === 'hard' ? 'hard' : 'recommended',
      filled,
      shortage: Math.max(0, Number(rule.count || 0) - filled),
    };
    byRule.set(rule.id, result);
    results.push(result);
  }

  return {
    results,
    byRule,
    hardShortage: results
      .filter(row => row.mode === 'hard')
      .reduce((sum, row) => sum + row.shortage, 0),
    recommendedShortage: results
      .filter(row => row.mode !== 'hard')
      .reduce((sum, row) => sum + row.shortage, 0),
    assignments: [...hardResult.assignments, ...recommendedResult.assignments],
    usedStaff: new Set([...hardResult.usedStaff, ...recommendedResult.usedStaff]),
  };
}

export function assignSeats(rules, people, reservedStaff = new Set(), levelOf = skillLevel) {
  const uniquePeople = [];
  const seenPeople = new Set();
  for (const person of people || []) {
    const id = String(person?.id || '');
    if (!id || reservedStaff.has(id) || seenPeople.has(id)) continue;
    seenPeople.add(id);
    uniquePeople.push(person);
  }

  const seats = [];
  for (const rule of rules || []) {
    const count = Math.max(0, Number(rule.count || 0));
    for (let seat = 0; seat < count; seat += 1) {
      seats.push({
        key: `${rule.id}#${seat}`,
        ruleId: rule.id,
        skillId: rule.skillId,
        minLevel: Number(rule.minLevel || 0),
        seat,
      });
    }
  }

  const eligibleForSeat = seat => uniquePeople
    .filter(person => levelOf(person, seat.skillId) >= seat.minLevel)
    .sort((a, b) => {
      const aLevel = levelOf(a, seat.skillId);
      const bLevel = levelOf(b, seat.skillId);
      if (aLevel !== bLevel) return bLevel - aLevel;
      return String(a.id).localeCompare(String(b.id));
    });

  const seatOrder = seats
    .map((seat, index) => ({
      index,
      eligibleCount: eligibleForSeat(seat).length,
      minLevel: seat.minLevel,
    }))
    .sort((a, b) =>
      a.eligibleCount - b.eligibleCount ||
      b.minLevel - a.minLevel ||
      a.index - b.index
    )
    .map(row => row.index);

  const staffToSeat = new Map();

  function tryAssign(seatIndex, seenStaff) {
    const seat = seats[seatIndex];
    for (const person of eligibleForSeat(seat)) {
      const staffId = String(person.id);
      if (seenStaff.has(staffId)) continue;
      seenStaff.add(staffId);

      const occupiedSeat = staffToSeat.get(staffId);
      if (occupiedSeat === undefined || tryAssign(occupiedSeat, seenStaff)) {
        staffToSeat.set(staffId, seatIndex);
        return true;
      }
    }
    return false;
  }

  for (const seatIndex of seatOrder) {
    tryAssign(seatIndex, new Set());
  }

  const assignments = [];
  const byRule = new Map();
  for (const [staffId, seatIndex] of staffToSeat.entries()) {
    const seat = seats[seatIndex];
    if (!seat) continue;
    assignments.push({
      staffId,
      ruleId: seat.ruleId,
      skillId: seat.skillId,
      minLevel: seat.minLevel,
      seat: seat.seat,
    });
    byRule.set(seat.ruleId, (byRule.get(seat.ruleId) || 0) + 1);
  }

  return {
    assignments,
    byRule,
    usedStaff: new Set(staffToSeat.keys()),
  };
}

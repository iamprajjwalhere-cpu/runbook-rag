const GRADE_QUALITY = { again: 0, hard: 3, good: 4, easy: 5 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleReview(card, grade, now) {
  const quality = GRADE_QUALITY[grade];
  if (quality === undefined) throw new Error(`Unknown review grade: ${grade}`);

  let repetitions = card.repetitions || 0;
  let intervalDays = card.interval_days || 0;
  const ease = Math.max(1.3, (card.ease || 2.5) + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 10 / (24 * 60);
  } else {
    intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.max(1, Math.round(intervalDays * ease));
    if (grade === "hard") intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
    if (grade === "easy") intervalDays = Math.max(2, Math.round(intervalDays * 1.3));
    repetitions += 1;
  }

  return {
    ...card,
    repetitions,
    interval_days: intervalDays,
    ease,
    due_at: now + intervalDays * DAY_MS,
    last_grade: grade,
  };
}

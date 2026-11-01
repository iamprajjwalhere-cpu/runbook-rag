import assert from "node:assert/strict";
import test from "node:test";
import { scheduleReview } from "./reviewSchedule.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CARD = { repetitions: 0, interval_days: 0, ease: 2.5 };

test("Again resets repetitions and schedules a short relearning interval", () => {
  const result = scheduleReview({ ...CARD, repetitions: 4, interval_days: 12 }, "again", 1_000);
  assert.equal(result.repetitions, 0);
  assert.equal(result.last_grade, "again");
  assert.equal(result.due_at, 1_000 + 10 * 60 * 1000);
});

test("Good schedules first and second successful reviews at one and six days", () => {
  const first = scheduleReview(CARD, "good", 1_000);
  const second = scheduleReview(first, "good", 1_000);
  assert.equal(first.interval_days, 1);
  assert.equal(second.interval_days, 6);
  assert.equal(second.repetitions, 2);
});

test("Easy review gets a longer minimum interval and preserves card fields", () => {
  const result = scheduleReview({ ...CARD, front: "Question" }, "easy", 1_000);
  assert.equal(result.interval_days, 2);
  assert.equal(result.front, "Question");
  assert.equal(result.due_at, 1_000 + 2 * DAY_MS);
});

test("Unknown review grades are rejected", () => {
  assert.throws(() => scheduleReview(CARD, "perfect", 1_000), /Unknown review grade/);
});

// Open item #11: compares the layouts played in the Google Sheet with the course data.
// Needs internet; without it the tests are skipped instead of failing.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readHoleLengths, fetchPlayedLayouts } from "./helpers.mjs";

let played = null;
let offlineReason = null;

before(async () => {
  try {
    played = await fetchPlayedLayouts();
  } catch (error) {
    offlineReason = `Google Sheet could not be loaded (${error.message})`;
  }
});

test("every played layout has hole lengths", (t) => {
  if (!played) return t.skip(offlineReason);
  const lengths = readHoleLengths();
  const missing = [...played]
    .filter(([layout]) => !lengths.has(layout))
    .map(
      ([layout, holes]) =>
        `${layout}: played, but missing in hole_lengths.csv (add a line with ${holes} lengths)`,
    );
  assert.deepEqual(missing, [], `\n${missing.join("\n")}`);
});

test("hole_lengths.csv has as many lengths as the played layout has holes", (t) => {
  if (!played) return t.skip(offlineReason);
  const lengths = readHoleLengths();
  const wrong = [...played]
    .filter(([layout, holes]) => lengths.has(layout) && lengths.get(layout).length !== holes)
    .map(
      ([layout, holes]) =>
        `${layout}: ${holes} holes played, but ${lengths.get(layout).length} lengths in hole_lengths.csv`,
    );
  assert.deepEqual(wrong, [], `\n${wrong.join("\n")}`);
});

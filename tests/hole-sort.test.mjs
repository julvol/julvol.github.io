// Checks the order of the holes in the "Bahnen" table of a layout with made-up holes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

const holes = [
  { hole: 1, length: 80, par: 3, difficulty: 0.5 },
  { hole: 2, length: 120, par: 4, difficulty: -0.25 },
  { hole: 3, length: null, par: 3, difficulty: 0.5 },
  { hole: 4, length: 120, par: 4, difficulty: null },
  { hole: 5, length: 60, par: 5, difficulty: 1 },
];

const order = (sort) => {
  const table = loadStatsTable();
  return [...holes]
    .reverse()
    .sort((a, b) => table.compareHoles(sort, a, b))
    .map((h) => h.hole)
    .join(",");
};

test("hole sort: by hole number", () => {
  assert.equal(order("bahn"), "1,2,3,4,5");
});

test("hole sort: shortest first, ties by hole, no length last", () => {
  assert.equal(order("laenge"), "5,1,2,4,3");
});

test("hole sort: lowest par first, ties by hole", () => {
  assert.equal(order("par"), "1,3,2,4,5");
});

test("hole sort: easiest first, ties by hole, never played last", () => {
  assert.equal(order("schwierigkeit"), "2,1,3,5,4");
});

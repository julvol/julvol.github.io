// Checks of the hand-maintained files in discgolfstats/course_data. They need no internet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readCsv, readHoleLengths, layoutKey } from "./helpers.mjs";

const isPositiveInteger = (n) => Number.isInteger(n) && n > 0;

test("hole_lengths.csv: every layout has valid lengths", () => {
  const problems = [];
  const seen = new Set();
  readCsv("hole_lengths.csv").forEach((row, i) => {
    const where = `line ${i + 2} (${layoutKey(row.course, row.layout)})`;
    if (!row.course || !row.layout) problems.push(`${where}: course or layout is empty`);
    if (seen.has(layoutKey(row.course, row.layout))) problems.push(`${where}: layout is listed twice`);
    seen.add(layoutKey(row.course, row.layout));

    const lengths = (row.lengths ?? "").split(";").map((l) => l.trim());
    lengths.forEach((l, hole) => {
      if (!isPositiveInteger(Number(l)) || l === "")
        problems.push(`${where}: hole ${hole + 1} has no valid length ("${l}")`);
    });
  });
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});

test("isomorph_holes.csv: every row is valid and every hole is in at most one group", () => {
  const problems = [];
  const groupOf = new Map();
  readCsv("isomorph_holes.csv").forEach((row, i) => {
    const hole = `${layoutKey(row.course, row.layout)} hole ${row.hole}`;
    const where = `line ${i + 2} (${hole})`;
    if (!isPositiveInteger(Number(row.group))) problems.push(`${where}: group "${row.group}" is not a number`);
    if (!isPositiveInteger(Number(row.hole))) problems.push(`${where}: hole "${row.hole}" is not a number`);
    if (groupOf.has(hole))
      problems.push(`${where}: already in group ${groupOf.get(hole)}, now again in group ${row.group}`);
    groupOf.set(hole, row.group);
  });
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});

test("isomorph_holes.csv: every group has at least two holes of the same course", () => {
  const problems = [];
  for (const [group, rows] of groups()) {
    if (rows.length < 2) problems.push(`group ${group}: only one hole (${describe(rows)})`);
    if (new Set(rows.map((r) => r.course)).size > 1)
      problems.push(`group ${group}: holes of different courses (${describe(rows)})`);
  }
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});

test("isomorph_holes.csv: holes exist in their layout and identical holes have the same length", (t) => {
  const lengths = readHoleLengths();
  const problems = [];
  const withoutLengths = new Set();

  for (const [group, rows] of groups()) {
    const known = [];
    for (const row of rows) {
      const layoutLengths = lengths.get(layoutKey(row.course, row.layout));
      if (!layoutLengths) {
        withoutLengths.add(layoutKey(row.course, row.layout));
        continue;
      }
      if (Number(row.hole) > layoutLengths.length) {
        problems.push(
          `group ${group}: ${layoutKey(row.course, row.layout)} has only ${layoutLengths.length} holes, not hole ${row.hole}`,
        );
        continue;
      }
      known.push({ row, length: layoutLengths[Number(row.hole) - 1] });
    }
    // (invalid lengths are already reported by the hole_lengths.csv test)
    const valid = known.filter((k) => isPositiveInteger(k.length));
    if (new Set(valid.map((k) => k.length)).size > 1)
      problems.push(
        `group ${group}: different lengths (${valid.map((k) => `${k.row.layout} hole ${k.row.hole}: ${k.length} m`).join(", ")})`,
      );
  }

  // not an error (the layout may never have been played), but worth knowing
  withoutLengths.forEach((layout) =>
    t.diagnostic(`note: ${layout} is in isomorph_holes.csv but has no lengths in hole_lengths.csv`),
  );
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});

function groups() {
  const result = new Map();
  readCsv("isomorph_holes.csv").forEach((row) => {
    if (!result.has(row.group)) result.set(row.group, []);
    result.get(row.group).push(row);
  });
  return result;
}

function describe(rows) {
  return rows.map((r) => `${layoutKey(r.course, r.layout)} hole ${r.hole}`).join(", ");
}

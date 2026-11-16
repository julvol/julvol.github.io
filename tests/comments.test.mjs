// Match comments and unranked matches: a row below the player rows of a match with text in
// column A only (isCommentRow / parseCommentRow / getRankedMatches in scripts.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

const table = loadStatsTable();

// arrays made inside scripts.js (a vm context) have other prototypes; deepEqual compares those too
const plain = (value) => JSON.parse(JSON.stringify(value));

// a sheet row like the Google Sheet delivers it: cells with a value or null
const row = (...values) => ({ c: values.map((v) => (v == null ? null : { v })) });

test("a row with text in column A only is a comment row", () => {
  assert.equal(table.isCommentRow(row("Sturm")), true);
  assert.equal(table.isCommentRow(row("Sturm", null, null, null, null)), true);
  // player and par rows have a course and a start date
  assert.equal(
    table.isCommentRow(row("Anna", "Park", "Main", "2026-01-01 1000")),
    false,
  );
  assert.equal(table.isCommentRow(row("   ")), false);
});

test('"Unranked" at the start marks the match as unranked, the rest is the comment', () => {
  const parse = (text) => plain(table.parseCommentRow(row(text)));
  assert.deepEqual(parse("Sturm"), { unranked: false, comment: "Sturm" });
  assert.deepEqual(parse("Unranked"), { unranked: true, comment: "" });
  assert.deepEqual(parse("Unranked: Sturm"), { unranked: true, comment: "Sturm" });
  assert.deepEqual(parse("unranked - Doppel"), { unranked: true, comment: "Doppel" });
  assert.deepEqual(parse("UNRANKED, Mulligans"), { unranked: true, comment: "Mulligans" });
  // only at the start and only as a whole word
  assert.deepEqual(parse("Spaßrunde, unranked"), {
    unranked: false,
    comment: "Spaßrunde, unranked",
  });
  assert.equal(table.parseCommentRow(row("Unrankedness")).unranked, false);
});

test("unranked matches do not count for the records", () => {
  const t = loadStatsTable();
  const match = (day, holes, unranked) => ({
    startTime: new Date(2026, 0, day, 10),
    course: "Park",
    layout: "Main",
    unranked,
    players: {
      Par: { total: 9, holes: [3, 3, 3] },
      Anna: { total: holes.reduce((a, b) => a + b, 0), holes, howManyHolesNotPlayedInThisMatch: 0 },
    },
  });
  // the ace is only in the unranked match
  [match(1, [3, 3, 3], false), match(2, [1, 3, 3], true)].forEach(
    (m) => (t.matches[m.startTime.getTime()] = m),
  );
  t.players = { Anna: { name: "Anna", playedCoursesCount: 1, playedCourses: [] } };

  assert.equal(t.getRankedMatches().length, 1);
  const aces = t.getRecords().find((r) => r.title.includes("Asse"));
  assert.equal(aces.entries.length, 0);
});

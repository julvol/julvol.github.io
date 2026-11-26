// Checks the longest weekly streak (open item #36) with made-up matches.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

// arrays made inside scripts.js (a vm context) have other prototypes; deepEqual compares those too
const plain = (value) => JSON.parse(JSON.stringify(value));

// date: "YYYY-MM-DD" (local time, 18:00); names: who played
const match = (date, names, unranked = false) => {
  const [y, m, d] = date.split("-").map(Number);
  return {
    startTime: new Date(y, m - 1, d, 18),
    unranked,
    players: Object.fromEntries(["Par", ...names].map((n) => [n, {}])),
  };
};

const streaksFor = (matches, now) => {
  const table = loadStatsTable();
  matches.forEach((m, i) => (table.matches[i] = m));
  const entries = table.getWeeklyStreaks(now);
  // the text without the HTML of the status (icon, span)
  const text = (html) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return plain(
    table.rankRecordEntries(entries).map((e) => [e.rank, e.name, e.value, text(e.detail)]),
  );
};

// 2026: Mon 5 Jan, Mon 12 Jan, Mon 19 Jan, Mon 26 Jan, Mon 2 Feb, ...
const NOW = new Date(2026, 2, 18, 12); // Wed 18 Mar 2026

test("weeks in a row count, Monday to Sunday; several matches in one week count once", () => {
  const result = streaksFor(
    [
      match("2026-01-11", ["Anna"]), // Sun, week of 5 Jan
      match("2026-01-12", ["Anna"]), // Mon, next week
      match("2026-01-14", ["Anna"]), // same week
      match("2026-01-25", ["Anna"]), // Sun, week of 19 Jan
      match("2026-02-05", ["Anna"]), // week of 2 Feb: gap (week of 26 Jan missing)
    ],
    NOW,
  );
  assert.deepEqual(result, [[1, "Anna", 3, "11.01.2026 – 25.01.2026"]]);
});

test("a streak of 1 week does not count, unranked matches do not count", () => {
  const result = streaksFor(
    [
      match("2026-01-05", ["Anna", "Ben"]),
      match("2026-01-12", ["Anna", "Ben"], true), // unranked
      match("2026-01-19", ["Anna"]),
    ],
    NOW,
  );
  assert.deepEqual(result, []);
});

test("still running if the last week is this week (safe) or last week (still open)", () => {
  const matches = [
    match("2026-03-02", ["Anna", "Ben"]),
    match("2026-03-09", ["Anna", "Ben"]),
    match("2026-03-16", ["Anna"]), // this week (Mon 16 Mar)
  ];
  assert.deepEqual(streaksFor(matches, NOW), [
    [1, "Anna", 3, "seit 02.03.2026, diese Woche gesichert"], // played this week
    [2, "Ben", 2, "seit 02.03.2026, diese Woche noch offen"], // last week: this week is not over yet
  ]);
  // two weeks later Ben's streak is over, Anna's too
  assert.deepEqual(streaksFor(matches, new Date(2026, 2, 30, 12)), [
    [1, "Anna", 3, "02.03.2026 – 16.03.2026"],
    [2, "Ben", 2, "02.03.2026 – 09.03.2026"],
  ]);
});

test("per player the longest streak (the latest of equally long ones); ties: who got there first", () => {
  const result = streaksFor(
    [
      match("2026-01-05", ["Anna"]),
      match("2026-01-12", ["Anna", "Ben"]),
      match("2026-01-19", ["Ben"]),
      match("2026-02-02", ["Anna"]),
      match("2026-02-09", ["Anna"]),
    ],
    NOW,
  );
  assert.deepEqual(result, [
    [1, "Ben", 2, "12.01.2026 – 19.01.2026"], // 2 weeks reached on 19 Jan
    [1, "Anna", 2, "02.02.2026 – 09.02.2026"], // the later one of Anna's two
  ]);
});

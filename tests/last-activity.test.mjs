// Checks the "Letzte Aktivität" row of a player with made-up matches.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

test("last match: the latest ranked match of the player", () => {
  const table = loadStatsTable();
  const match = (day, names, unranked = false) => ({
    startTime: new Date(2026, 10, day, 12),
    unranked,
    players: Object.fromEntries(["Par", ...names].map((n) => [n, {}])),
  });
  const latest = match(10, ["Anna"]);
  table.matches = {
    1: match(3, ["Anna", "Ben"]),
    2: latest,
    3: match(5, ["Anna"]),
    4: match(15, ["Anna"], true), // unranked: doesn't count
    5: match(20, ["Ben"]), // without Anna
  };
  assert.equal(table.getLastMatch("Anna"), latest);
  assert.equal(table.getLastMatch("Nobody"), null);
});

test("time ago: by calendar days, in days, weeks, months and years", () => {
  const table = loadStatsTable();
  const now = new Date(2026, 10, 23, 0, 30);
  const daysAgo = (days) => new Date(2026, 10, 23 - days, 23, 45);
  const expected = [
    [0, "heute"],
    [1, "gestern"],
    [2, "vor 2 Tagen"],
    [13, "vor 13 Tagen"],
    [14, "vor 2 Wochen"],
    [59, "vor 8 Wochen"],
    [60, "vor 2 Monaten"],
    [364, "vor 12 Monaten"],
    [365, "vor einem Jahr"],
    [730, "vor 2 Jahren"],
  ];
  expected.forEach(([days, text]) =>
    assert.equal(table.formatTimeAgo(daysAgo(days), now), text),
  );
});

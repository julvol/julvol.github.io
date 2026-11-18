// Checks the playing partners of a player (open item #29) with made-up matches.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));

test("playing partners: shared ranked matches, most first, ties by name", () => {
  const table = loadStatsTable();
  const match = (names, unranked = false) => ({
    unranked,
    players: Object.fromEntries(["Par", ...names].map((n) => [n, {}])),
  });
  table.players = { Anna: {}, Ben: {}, Carla: {}, Dora: {} };
  table.matches = {
    1: match(["Anna", "Ben"]),
    2: match(["Anna", "Ben", "Carla"]),
    3: match(["Anna", "Dora"]),
    4: match(["Anna", "Carla", "Dora"]),
    5: match(["Anna", "Ben"], true), // unranked: doesn't count
    6: match(["Ben", "Carla"]), // without Anna
    7: match(["Anna", "Gast"]), // Gast has no player entry (e.g. only unranked matches)
  };
  assert.deepEqual(plain(table.getPlayingPartners("Anna")), [
    { name: "Ben", count: 2 },
    { name: "Carla", count: 2 },
    { name: "Dora", count: 2 },
  ]);
  assert.deepEqual(plain(table.getPlayingPartners("Ben")), [
    { name: "Anna", count: 2 },
    { name: "Carla", count: 2 },
  ]);
  assert.deepEqual(plain(table.getPlayingPartners("Nobody")), []);
});

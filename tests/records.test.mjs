// Open item #6: the records (getRecords / rankRecordEntries in scripts.js), with made-up rounds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

// a match on a 6-hole layout with par 3 everywhere; scores: { name: [hole scores, "-" = not played] }
function match(day, scores) {
  const players = { Par: { total: 18, holes: [3, 3, 3, 3, 3, 3] } };
  for (const [name, holes] of Object.entries(scores)) {
    const played = holes.filter((s) => s !== "-");
    players[name] = {
      total: played.reduce((a, b) => a + b, 0),
      holes,
      howManyHolesNotPlayedInThisMatch: holes.length - played.length,
    };
  }
  return {
    startTime: new Date(2026, 0, day, 10),
    course: "Park",
    layout: "Main",
    players,
  };
}

// arrays made inside scripts.js (a vm context) have other prototypes; deepEqual compares those too
const plain = (value) => JSON.parse(JSON.stringify(value));

function recordsFor(matches) {
  const table = loadStatsTable();
  matches.forEach((m) => (table.matches[m.startTime.getTime()] = m));
  table.players = {};
  for (const m of matches)
    for (const name of Object.keys(m.players).filter((n) => n !== "Par")) {
      table.players[name] ??= {
        name,
        playedCoursesCount: 0,
        playedCourses: [],
      };
      table.players[name].playedCoursesCount++;
    }
  const records = Object.fromEntries(
    table.getRecords().map((r) => [r.title, r]),
  );
  const top = (title) =>
    plain(
      table
        .rankRecordEntries(records[title].entries)
        .map((e) => [e.rank, e.name, e.value, e.detail]),
    );
  return { top, table };
}

const matches = [
  match(1, { Anna: [1, 2, 2, 4, 3, "-"], Ben: [3, 3, 3, 3, 3, 3] }),
  match(2, {
    Anna: [3, 3, 3, 3, 3, 3],
    Ben: [2, 3, 2, 2, 2, 1],
    Cleo: [4, 4, 4, 4, 4, 4],
  }),
  match(3, { Anna: [1, 3, 3, 3, 3, 3], Ben: [3, 3, 3, 3, 3, 4] }),
];

test("aces: counted per player, with the most recent one", () => {
  const { top } = recordsFor(matches);
  assert.deepEqual(top("Meiste Asse"), [
    [1, "Anna", 2, "zuletzt Bahn 1"],
    [2, "Ben", 1, "zuletzt Bahn 6"],
  ]);
});

test("birdies in a round: every score below par, also in incomplete rounds", () => {
  const { top } = recordsFor(matches);
  assert.deepEqual(
    top("Meiste Birdies in einer Partie").map((r) => r.slice(0, 3)),
    [
      [1, "Ben", 5],
      [2, "Anna", 3],
      [3, "Anna", 1],
    ],
  );
});

test("birdie streak: consecutive holes only, from 2 on", () => {
  const { top } = recordsFor(matches);
  assert.deepEqual(top("Längste Birdie-Serie"), [
    [1, "Ben", 4, "Bahn 3–6"],
    [2, "Anna", 3, "Bahn 1–3"],
  ]);
});

test("ties share a rank, are shown in full, and the earlier one is listed first", () => {
  const { table } = recordsFor([]);
  const rows = table.rankRecordEntries([
    { name: "B", value: 5, match: { startTime: new Date(2026, 0, 2) } },
    { name: "A", value: 7, match: { startTime: new Date(2026, 0, 3) } },
    { name: "C", value: 5, match: { startTime: new Date(2026, 0, 1) } },
    { name: "D", value: 5, match: { startTime: new Date(2026, 0, 4) } },
    { name: "E", value: 1, match: { startTime: new Date(2026, 0, 4) } },
  ]);
  assert.deepEqual(plain(rows.map((e) => [e.rank, e.name])), [
    [1, "A"],
    [2, "C"],
    [2, "B"],
    [2, "D"], // ties are shown in full; E (rank 5) is not
  ]);
});

test("best entry per player: one entry each, the earlier of equally good ones", () => {
  const { table } = recordsFor([]);
  const at = (day) => ({ startTime: new Date(2026, 0, day) });
  const best = table.getBestEntryPerPlayer([
    { name: "A", value: 5, match: at(1) },
    { name: "A", value: 7, match: at(2) },
    { name: "B", value: 4, match: at(4) },
    { name: "B", value: 4, match: at(3) },
    { name: "A", value: 6, match: at(5) },
    { name: "C", value: 3, match: at(6) },
  ]);
  assert.deepEqual(
    plain(table.rankRecordEntries(best).map((e) => [e.rank, e.name, e.value, e.match.startTime])),
    [
      [1, "A", 7, plain(at(2).startTime)],
      [2, "B", 4, plain(at(3).startTime)],
      [3, "C", 3, plain(at(6).startTime)],
    ],
  );
});

test("the switch only shows on per-round cards where it changes something", () => {
  const { table } = recordsFor(matches);
  const cards = Object.fromEntries(
    table.getRecords().map((r) => [r.title, table.getRecordCardString(r)]),
  );
  const hasSwitch = (title) => cards[title].includes("variant-switch");
  assert.equal(hasSwitch("Meiste Birdies in einer Partie"), true); // Anna twice
  assert.equal(hasSwitch("Längste Birdie-Serie"), false); // everyone once already
  assert.equal(hasSwitch("Meiste Asse"), false); // one entry per player anyway
});

test("a shared place is shown with a T (1, T2, T2, 4)", () => {
  const { table } = recordsFor([]);
  const rows = table.rankRecordEntries(
    [
      { name: "A", value: 7, detail: "" },
      { name: "B", value: 5, detail: "", time: 1 },
      { name: "C", value: 5, detail: "", time: 2 },
      { name: "D", value: 3, detail: "" },
    ],
    Infinity,
  );
  const ranks = [...table.getRecordListString(rows, "").matchAll(/class="record-rank[^"]*">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(ranks, ["1", "T2", "T2", "4"]);
});

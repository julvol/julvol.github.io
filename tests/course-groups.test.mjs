// Checks the course list with played and not yet played layouts, with made-up courses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

const played = (course, layout) => ({ course, layout, howManyHoles: 9 });

test("hole cell of a layout: popover only for holes identical to others", () => {
  const table = loadStatsTable();
  table.isomorphHoles = [
    [
      { course: "Berg", layout: "Neu", hole: 1 },
      { course: "Berg", layout: "Alt", hole: 4 },
    ],
  ];
  const withPopover = table.getHoleHeaderCell("Berg", "Neu", 1);
  assert.match(withPopover, /data-bs-toggle="popover"/);
  assert.match(withPopover, /identisch zu<\/b><br>Alt - Bahn 4/);
  assert.doesNotMatch(table.getHoleHeaderCell("Berg", "Neu", 2), /popover/);
});

test("course list: unplayed layouts and courses come after the played ones", () => {
  const table = loadStatsTable();
  table.courses = {
    BergZebra: played("Berg", "Zebra"),
    BergMain: played("Berg", "Main"),
    ZooMain: played("Zoo", "Main"),
  };
  table.standardLayouts = new Map([
    ["Berg", "Main"],
    ["Adler", "Lang"],
  ]);
  table.holeLengthsSets = ["Berg/Main", "Berg/Alpha", "Adler/Kurz", "Adler/Lang", "Zoo/Main"].map(
    (key) => {
      const [course, layout] = key.split("/");
      return { course, layout, lengths: [50] };
    },
  );

  const groups = table
    .getCourseGroups()
    .map((layouts) =>
      layouts.map((l) => `${l.course}/${l.layout}${l.unplayed ? " (unplayed)" : ""}`),
    );
  assert.deepEqual(JSON.parse(JSON.stringify(groups)), [
    ["Berg/Main", "Berg/Zebra", "Berg/Alpha (unplayed)"],
    ["Zoo/Main"],
    ["Adler/Lang (unplayed)", "Adler/Kurz (unplayed)"],
  ]);
  // they stay out of the statistics
  assert.equal(Object.keys(table.courses).length, 3);
});

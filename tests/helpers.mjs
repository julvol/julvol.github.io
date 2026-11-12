// Shared helpers for the tests. They reuse the code of the website (scripts.js) where
// possible, so the tests read the data exactly the way the website does.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "discgolfstats");

// the StatsTable class from scripts.js, created with the same arguments as in index.html
export function loadStatsTable() {
  const source = fs.readFileSync(path.join(SITE, "js", "scripts.js"), "utf8");
  // scripts.js only touches window/document when the page loads, so empty stubs are enough
  const context = { window: { addEventListener() {} }, document: {}, console };
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.StatsTable = StatsTable;`, context);

  const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
  const args = html.match(/new StatsTable\(\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"/);
  if (!args) throw new Error("Could not find `new StatsTable(...)` in index.html");
  return new context.StatsTable(args[1], args[2], args[3], args[4]);
}

const statsTable = loadStatsTable();

export function readCsv(name) {
  return statsTable.parseCsv(fs.readFileSync(path.join(SITE, "course_data", name), "utf8"));
}

export const layoutKey = (course, layout) => `${course} (${layout})`;

// hole_lengths.csv as a Map: "Course (Layout)" -> [length of hole 1, hole 2, ...]
export function readHoleLengths() {
  return new Map(
    readCsv("hole_lengths.csv").map((row) => [
      layoutKey(row.course, row.layout),
      row.lengths.split(";").map((l) => Number(l.trim())),
    ]),
  );
}

// The layouts played according to the Google Sheet: Map "Course (Layout)" -> number of holes.
// Downloaded the same way as on the website (see fetchAndRenderData in scripts.js).
export async function fetchPlayedLayouts() {
  const response = await fetch(statsTable.getURL(statsTable.range));
  if (!response.ok) throw new Error(`Google Sheet: HTTP ${response.status}`);
  const text = await response.text();
  const data = JSON.parse(text.substr(47).slice(0, -2));

  const layouts = new Map();
  for (const row of data.table.rows) {
    // the first row of every match is the par row; its number of holes is the layout's
    if (row.c[0]?.v !== "Par") continue;
    layouts.set(layoutKey(row.c[1]?.v, row.c[2]?.v), statsTable.howManyHolesHasLayout(row));
  }
  return layouts;
}

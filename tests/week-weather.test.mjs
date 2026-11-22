// Checks the 4-day disc golf weather of a course (open item #49) with a made-up forecast.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStatsTable } from "./helpers.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));

// 672 quarter hours from Monday 23.11. 10:00 on, daylight from 08:00 to 17:00, always fine
function makeSteps() {
  const time = [];
  const start = Date.UTC(2026, 10, 23, 10);
  for (let i = 0; i < 672; i++)
    time.push(new Date(start + i * 15 * 60 * 1000).toISOString().slice(0, 16));
  const minute = (t) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
  return {
    time,
    is_day: time.map((t) => (minute(t) >= 480 && minute(t) <= 1020 ? 1 : 0)),
    temperature_2m: time.map(() => 10),
    precipitation: time.map(() => 0),
    weather_code: time.map(() => 1),
    wind_speed_10m: time.map(() => 5),
    wind_gusts_10m: time.map(() => 10),
  };
}

test("week weather: 4 calendar days, today only from now on", () => {
  const week = plain(loadStatsTable().getDiscGolfWeek(makeSteps()));
  assert.deepEqual(
    week.days.map((day) => day.label),
    ["heute", "morgen", "Mi. 25.11.", "Do. 26.11."],
  );
  assert.equal(week.from, 480);
  assert.equal(week.to, 1020);
  assert.deepEqual(week.days[0].daylight, [{ from: 600, to: 1020 }]);
  assert.deepEqual(week.days[0].good, [{ from: 600, to: 1020 }]);
});

test("week weather: rain interrupts the disc golf weather", () => {
  const steps = makeSteps();
  // the rain of the 15 minutes before Tuesday 12:00
  steps.precipitation[steps.time.indexOf("2026-11-24T12:00")] = 0.5;
  const week = plain(loadStatsTable().getDiscGolfWeek(steps));
  assert.deepEqual(week.days[1].good, [
    { from: 480, to: 705 },
    { from: 720, to: 1020 },
  ]);
  assert.deepEqual(week.days[1].daylight, [{ from: 480, to: 1020 }]);
  assert.deepEqual(week.days[1].rain, [{ from: 705, to: 720 }]);
  assert.deepEqual(week.days[1].wind, []);
  assert.deepEqual(week.days[1].both, []);
});

test("week weather: wind, and rain with wind, get their own runs", () => {
  const steps = makeSteps();
  const step = steps.time.indexOf("2026-11-26T12:00");
  steps.wind_gusts_10m[step] = 50;
  steps.precipitation[step] = 0.5; // the 15 minutes before 12:00
  const table = loadStatsTable();
  const day = plain(table.getDiscGolfWeek(steps)).days[3];
  assert.deepEqual(day.both, [{ from: 705, to: 720 }]);
  assert.deepEqual(day.wind, [{ from: 720, to: 735 }]);
  assert.deepEqual(day.rain, []);
  const html = table.getWeekWeatherString(steps);
  ["Disc Golf-Wetter", "Regen", "Wind", "Regen + Wind", "dunkel"].forEach((text) =>
    assert.ok(html.includes(text)),
  );
});

test("week weather: fine weather shorter than 90 minutes is not disc golf weather", () => {
  const steps = makeSteps();
  steps.time.forEach((t, i) => {
    if (t.startsWith("2026-11-25") && t.slice(11, 16) !== "12:00")
      steps.wind_gusts_10m[i] = 50;
  });
  const week = plain(loadStatsTable().getDiscGolfWeek(steps));
  assert.deepEqual(week.days[2].good, []);
  assert.match(loadStatsTable().getWeekWeatherString(steps), /kein Disc Golf-Wetter/);
});

test("week weather: nothing to show without daylight", () => {
  const steps = makeSteps();
  steps.is_day = steps.is_day.map(() => 0);
  const table = loadStatsTable();
  assert.equal(table.getDiscGolfWeek(steps), null);
  assert.equal(table.getWeekWeatherString(steps), "");
});

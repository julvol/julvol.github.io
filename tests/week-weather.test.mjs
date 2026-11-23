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
});

test("week weather: the legend only lists what the bars show", () => {
  const table = loadStatsTable();
  const legend = (steps) =>
    [
      ...table
        .getWeekWeatherString(steps)
        .split('class="week-weather-legend"')[1]
        .matchAll(/<\/span>([^<]+)<\/span>/g),
    ].map((entry) => entry[1]);

  assert.deepEqual(legend(makeSteps()), ["Disc Golf-Wetter"]);

  const windAndRain = makeSteps();
  const step = windAndRain.time.indexOf("2026-11-26T12:00");
  windAndRain.wind_gusts_10m[step] = 50;
  windAndRain.precipitation[step] = 0.5;
  assert.deepEqual(legend(windAndRain), [
    "Disc Golf-Wetter",
    "Wind",
    "Regen + Wind",
  ]);

  // two short bad spells 45 minutes apart: the fine time between them is a gray gap
  const gap = makeSteps();
  gap.wind_gusts_10m[gap.time.indexOf("2026-11-25T12:00")] = 50;
  gap.wind_gusts_10m[gap.time.indexOf("2026-11-25T12:45")] = 50;
  assert.ok(legend(gap).includes("Lücke unter 90 Min."));
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

test("week weather: the next disc golf weather gets a box, if within the 4 days", () => {
  const table = loadStatsTable();
  const steps = makeSteps();
  const boxed = table.getWeekWeatherString(
    steps,
    steps.time.indexOf("2026-11-24T10:00"),
  );
  assert.match(boxed, /week-weather-next-box" style="left: 22\.22%; width: 16\.67%"/);
  assert.ok(boxed.includes("Nächstes Disc Golf-Wetter"));

  [undefined, steps.time.indexOf("2026-11-28T10:00")].forEach((start) => {
    const html = table.getWeekWeatherString(steps, start);
    assert.ok(!html.includes("week-weather-next-box"));
    assert.ok(!html.includes("Nächstes Disc Golf-Wetter"));
  });
});

test("week weather: red line for now only if asked for and within the shown hours", () => {
  const table = loadStatsTable();
  const steps = makeSteps();
  const marked = table.getWeekWeatherString(steps, null, true);
  assert.equal(marked.match(/week-weather-now" style="left: 22\.22%"/g).length, 1);
  assert.ok(marked.includes(">Jetzt<"));

  const unmarked = table.getWeekWeatherString(steps);
  assert.ok(!unmarked.includes("week-weather-now"));
  assert.ok(!unmarked.includes(">Jetzt<"));

  const beforeSunrise = makeSteps();
  beforeSunrise.time[0] = "2026-11-23T07:00";
  beforeSunrise.is_day[0] = 0;
  const outside = table.getWeekWeatherString(beforeSunrise, null, true);
  assert.ok(!outside.includes("week-weather-now"));
  assert.ok(!outside.includes(">Jetzt<"));
});

test("week weather: nothing to show without daylight", () => {
  const steps = makeSteps();
  steps.is_day = steps.is_day.map(() => 0);
  const table = loadStatsTable();
  assert.equal(table.getDiscGolfWeek(steps), null);
  assert.equal(table.getWeekWeatherString(steps), "");
});

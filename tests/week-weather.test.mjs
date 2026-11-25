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
  assert.equal(week.from, 0);
  assert.equal(week.to, 1440);
  assert.deepEqual(week.days[0].daylight, [{ from: 600, to: 1020 }]);
  assert.deepEqual(week.days[0].good, [{ from: 600, to: 1020 }]);
  assert.deepEqual(week.days[0].night, [{ from: 1020, to: 1440 }]);
  assert.deepEqual(week.days[1].night, [
    { from: 0, to: 480 },
    { from: 1020, to: 1440 },
  ]);
});

test("week weather: the whole day, rain and wind also by night, with stars", () => {
  const table = loadStatsTable();
  const steps = makeSteps();
  // rain in the 15 minutes before Tuesday 03:00, gusts at 22:00 (they count for both quarter hours around it)
  steps.precipitation[steps.time.indexOf("2026-11-24T03:00")] = 0.5;
  steps.wind_gusts_10m[steps.time.indexOf("2026-11-24T22:00")] = 40;
  const day = plain(table.getDiscGolfWeek(steps)).days[1];
  assert.deepEqual(day.rain, [{ from: 165, to: 180 }]);
  assert.deepEqual(day.wind, [{ from: 1305, to: 1335 }]);
  // a fine night is no gap and no disc golf weather
  assert.deepEqual(day.gap, []);
  assert.deepEqual(day.good, [{ from: 480, to: 1020 }]);
  const html = table.getWeekWeatherString(steps);
  // the night's color reaches 1px under the parts on both sides, the stars only on rain and wind
  assert.ok(html.includes('week-weather-night" style="left: calc(0.00% - 1px); width: calc(33.33% + 2px)"'));
  // white stars only on the rain by night (02:45 to 03:00), not on the fine night
  assert.equal(html.match(/week-weather-stars"/g).length, 2);
  assert.ok(html.includes('week-weather-stars" style="left: 11.46%; width: 1.04%"'));
  assert.ok(html.includes('week-weather-swatch week-weather-night"></span>Nacht<'));
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
  steps.wind_gusts_10m[step] = 40;
  steps.precipitation[step] = 0.5; // the 15 minutes before 12:00
  const table = loadStatsTable();
  const day = plain(table.getDiscGolfWeek(steps)).days[3];
  assert.deepEqual(day.both, [{ from: 705, to: 720 }]);
  assert.deepEqual(day.wind, [{ from: 720, to: 735 }]);
  assert.deepEqual(day.rain, []);
  assert.deepEqual(day.strongWind, []);
  assert.deepEqual(day.bothStrong, []);
});

test("week weather: gusts over 45 km/h are strong wind, exactly 45 is not", () => {
  const table = loadStatsTable();
  const steps = makeSteps();
  const step = steps.time.indexOf("2026-11-26T12:00");
  steps.wind_gusts_10m[step] = 46;
  steps.precipitation[step] = 0.5;
  const day = plain(table.getDiscGolfWeek(steps)).days[3];
  assert.deepEqual(day.bothStrong, [{ from: 705, to: 720 }]);
  assert.deepEqual(day.strongWind, [{ from: 720, to: 735 }]);
  assert.deepEqual(day.both, []);
  assert.deepEqual(day.wind, []);
  const html = table.getWeekWeatherString(steps);
  assert.ok(html.includes(">Windböen >45km/h<"));
  // rain with strong wind shares the one legend entry, with the plain swatch
  assert.ok(html.includes('week-weather-swatch week-weather-both"></span>Regen + Windböen<'));
  assert.ok(!html.includes("week-weather-swatch week-weather-both-strong"));
  assert.ok(!html.includes(">Windböen >30km/h<"));

  steps.wind_gusts_10m[step] = 45;
  const limit = plain(table.getDiscGolfWeek(steps)).days[3];
  assert.deepEqual(limit.strongWind, []);
  assert.deepEqual(limit.wind, [{ from: 720, to: 735 }]);
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

  assert.deepEqual(legend(makeSteps()), ["Disc Golf-Wetter™", "Nacht", "Jetzt"]);

  const windAndRain = makeSteps();
  const step = windAndRain.time.indexOf("2026-11-26T12:00");
  windAndRain.wind_gusts_10m[step] = 40;
  windAndRain.precipitation[step] = 0.5;
  assert.deepEqual(legend(windAndRain), [
    "Disc Golf-Wetter™",
    "Windböen >30km/h",
    "Regen + Windböen",
    "Nacht",
    "Jetzt",
  ]);

  // two short bad spells 45 minutes apart: the fine time between them is a gray gap
  const gap = makeSteps();
  gap.wind_gusts_10m[gap.time.indexOf("2026-11-25T12:00")] = 50;
  gap.wind_gusts_10m[gap.time.indexOf("2026-11-25T12:45")] = 50;
  assert.ok(legend(gap).includes("Lücke unter 90 Min."));
});

test("week weather: the gap color is only drawn for real gaps, without hairlines", () => {
  const table = loadStatsTable();
  const steps = makeSteps();
  steps.wind_gusts_10m[steps.time.indexOf("2026-11-26T12:00")] = 50;
  const week = plain(table.getDiscGolfWeek(steps));
  assert.ok(week.days.every((day) => day.gap.length === 0));
  const html = table.getWeekWeatherString(steps);
  assert.ok(!html.includes("week-weather-daylight"));
  // disc golf weather reaches 1px under the wind that follows it
  assert.match(html, /week-weather-good" style="left: \d+\.\d+%; width: calc\(\d+\.\d+% \+ 1px\)"/);

  const gap = makeSteps();
  gap.wind_gusts_10m[gap.time.indexOf("2026-11-25T12:00")] = 50;
  gap.wind_gusts_10m[gap.time.indexOf("2026-11-25T12:45")] = 50;
  assert.deepEqual(plain(table.getDiscGolfWeek(gap)).days[2].gap, [
    { from: 735, to: 750 },
  ]);
});

test("week weather: fine weather shorter than 90 minutes is not disc golf weather", () => {
  const steps = makeSteps();
  steps.time.forEach((t, i) => {
    if (t.startsWith("2026-11-25") && t.slice(11, 16) !== "12:00")
      steps.wind_gusts_10m[i] = 50;
  });
  const week = plain(loadStatsTable().getDiscGolfWeek(steps));
  assert.deepEqual(week.days[2].good, []);
  assert.match(loadStatsTable().getWeekWeatherString(steps), /kein Disc Golf-Wetter™/);
});

test("week weather: the next disc golf weather gets a box, if within the 4 days", () => {
  const table = loadStatsTable();
  const steps = makeSteps();
  const boxed = table.getWeekWeatherString(
    steps,
    steps.time.indexOf("2026-11-24T10:00"),
  );
  assert.match(boxed, /week-weather-next-box" style="left: 41\.67%; width: 6\.25%"/);
  assert.ok(boxed.includes("Nächstes Disc Golf-Wetter™"));

  [undefined, steps.time.indexOf("2026-11-28T10:00")].forEach((start) => {
    const html = table.getWeekWeatherString(steps, start);
    assert.ok(!html.includes("week-weather-next-box"));
    assert.ok(!html.includes("Nächstes Disc Golf-Wetter™"));
  });
});

test("week weather: red line for now, also in disc golf weather and by night", () => {
  const table = loadStatsTable();
  const marked = table.getWeekWeatherString(makeSteps());
  assert.equal(marked.match(/week-weather-now" style="left: 41\.67%"/g).length, 1);
  assert.ok(marked.includes(">Jetzt<"));

  const beforeSunrise = makeSteps();
  beforeSunrise.time[0] = "2026-11-23T07:00";
  beforeSunrise.is_day[0] = 0;
  const night = table.getWeekWeatherString(beforeSunrise);
  assert.match(night, /week-weather-now" style="left: 29\.17%"/);
});

test("week weather: today's bar also shows the time since sunrise", () => {
  const table = loadStatsTable();
  // one day of earlier steps in front of the 672 steps from 10:00 on
  const all = makeSteps();
  const start = Date.UTC(2026, 10, 22, 10);
  const earlierTimes = Array.from({ length: 96 }, (_, i) =>
    new Date(start + i * 15 * 60 * 1000).toISOString().slice(0, 16),
  );
  const minute = (t) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
  const withPast = {
    time: [...earlierTimes, ...all.time],
    is_day: [
      ...earlierTimes.map((t) => (minute(t) >= 480 && minute(t) <= 1020 ? 1 : 0)),
      ...all.is_day,
    ],
  };
  ["temperature_2m", "precipitation", "weather_code", "wind_speed_10m", "wind_gusts_10m"].forEach(
    (name) => (withPast[name] = [...earlierTimes.map(() => all[name][0]), ...all[name]]),
  );
  // rain in the 15 minutes before 09:00 today
  withPast.precipitation[withPast.time.indexOf("2026-11-23T09:00")] = 0.5;

  const steps = table.splitEarlierSteps(withPast, 96);
  assert.equal(steps.time[0], "2026-11-23T10:00");
  assert.equal(steps.time.length, 672);
  assert.equal(steps.earlierToday.time[0], "2026-11-23T00:00");
  assert.equal(steps.earlierToday.time.at(-1), "2026-11-23T09:45");

  const today = plain(table.getDiscGolfWeek(steps)).days[0];
  assert.equal(today.label, "heute");
  assert.deepEqual(today.daylight, [{ from: 480, to: 1020 }]);
  assert.deepEqual(today.rain, [{ from: 525, to: 540 }]);
  // the 45 fine minutes from sunrise to the rain are too short for disc golf weather
  assert.deepEqual(today.good, [{ from: 540, to: 1020 }]);
  assert.match(
    table.getWeekWeatherString(steps),
    /week-weather-now" style="left: 41\.67%"/,
  );
});

test("loading screen: goes away after loading, also if building the page fails", async () => {
  const run = async (loadTableData) => {
    const table = loadStatsTable();
    let hidden = 0;
    table.waitForPaint = async () => {};
    table.waitForIcons = async () => {};
    table.loadReferenceData = async () => {
      throw new Error("no csv");
    };
    table.loadTableData = loadTableData;
    table.hideLoadingScreen = () => hidden++;
    const consoleError = console.error;
    console.error = () => {};
    await table.initialize();
    console.error = consoleError;
    return hidden;
  };
  assert.equal(await run(async () => {}), 1);
  assert.equal(
    await run(() => {
      throw new Error("render failed");
    }),
    1,
  );
});

test("week weather: without daylight only night, nothing to show without steps", () => {
  const steps = makeSteps();
  steps.is_day = steps.is_day.map(() => 0);
  const table = loadStatsTable();
  const week = plain(table.getDiscGolfWeek(steps));
  assert.ok(week.days.every((day) => day.good.length === 0 && day.daylight.length === 0));
  assert.deepEqual(week.days[1].night, [{ from: 0, to: 1440 }]);
  const empty = { ...steps, time: [], is_day: [] };
  assert.equal(table.getDiscGolfWeek(empty), null);
  assert.equal(table.getWeekWeatherString(empty), "");
});

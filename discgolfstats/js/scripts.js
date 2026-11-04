/*!
 * Start Bootstrap - Freelancer v7.0.7 (https://startbootstrap.com/theme/freelancer)
 * Copyright 2013-2023 Start Bootstrap
 * Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-freelancer/blob/master/LICENSE)
 */
//
// Scripts
//

window.addEventListener("DOMContentLoaded", (event) => {
  // Navbar shrink function
  var navbarShrink = function () {
    const navbarCollapsible = document.body.querySelector("#mainNav");
    if (!navbarCollapsible) {
      return;
    }
    if (window.scrollY === 0) {
      navbarCollapsible.classList.remove("navbar-shrink");
    } else {
      navbarCollapsible.classList.add("navbar-shrink");
    }
  };

  // Shrink the navbar
  navbarShrink();

  // Shrink the navbar when page is scrolled
  document.addEventListener("scroll", navbarShrink);

  // Activate Bootstrap scrollspy on the main nav element
  const mainNav = document.body.querySelector("#mainNav");
  if (mainNav) {
    new bootstrap.ScrollSpy(document.body, {
      target: "#mainNav",
      rootMargin: "0px 0px -40%",
    });
  }

  // Collapse responsive navbar when toggler is visible
  const navbarToggler = document.body.querySelector(".navbar-toggler");
  const responsiveNavItems = [].slice.call(
    document.querySelectorAll("#navbarResponsive .nav-link"),
  );
  responsiveNavItems.map(function (responsiveNavItem) {
    responsiveNavItem.addEventListener("click", () => {
      if (window.getComputedStyle(navbarToggler).display !== "none") {
        navbarToggler.click();
      }
    });
  });
});

class StatsTable {
  constructor(sheetID, sheetName, dataRange, keyIndex) {
    this.sheetID = sheetID;
    this.sheetName = sheetName;
    this.cacheKeyTable = keyIndex;
    this.cacheDuration = 1 * 60 * 5 * 1000; // 5 Minuten Cache-Dauer
    this.range = dataRange;
    this.FIRST_SCORE_COLUMN_OFFSET = 8;
    this.matches = {};
    this.players = {};
    this.courses = {};

    // add hole length sets for new layouts here
    this.holeLengthsSets = [];

    // currently for the following Layouts:
    // Aachen Kronenbergpark (Main, Newcomer 18, Advanced Newcomer, Rotkehlchen, Andalucia Nueva, Aixpert 18, Pinguin, Phoenix, Spaßvogel)
    // Discgolfpark Herzogenrath (Main, Main + Six, Eurode 18)
    // Discgolfpark Station As (Main, Main 9 X 2)
    // Discgolfpark Rheindahlen (De Kull Main Am, De Kull Main, De Kull Safari)
    this.isomorphHoles = [];
  }

  getURL(range) {
    return `https://docs.google.com/spreadsheets/d/${this.sheetID}/gviz/tq?sheet=${this.sheetName}range=${range}`;
  }

  fetchAndRenderData(url, cacheKey, renderFunction) {
    fetch(url)
      .then((res) => res.text())
      .then((rep) => {
        let jsonData = JSON.parse(rep.substr(47).slice(0, -2));

        // Speichere die Daten im Cache (localStorage)
        let cacheData = {
          data: jsonData,
          expiry: Date.now() + this.cacheDuration,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

        // Rendere die Tabelle mit den Daten
        renderFunction(jsonData);
      })
      .catch((error) => {
        console.error("Fehler beim Abrufen der Daten: ", error);
      });
  }

  isCacheValid(cacheKey) {
    // return false; // TODO weg wenn fertig

    let cached = JSON.parse(localStorage.getItem(cacheKey));
    if (!cached) return false;
    return Date.now() < cached.expiry;
  }

  renderStats(jsonData) {
    this.renderMatchesStats(jsonData);
  }

  renderMatchesStats(jsonData) {
    let rows = jsonData.table.rows;

    rows.forEach((row) => {
      let howManyHoles = this.howManyHolesHasLayout(row);
      if (row.c[3]?.v === "StartDate") {
        return;
      } else if (row.c[1]?.v + row.c[2]?.v in this.courses) {
        // new combination of player+round for existing course found
        // if the new player is Par: ignore
        if (row.c[0]?.v == "Par") {
          return;
        }
        for (var i = 0; i < howManyHoles; i++) {
          // add scores to course
          // if not played: ignore
          if (row.c[i + this.FIRST_SCORE_COLUMN_OFFSET]?.v == 0) {
            continue;
          }
          this.courses[row.c[1]?.v + row.c[2]?.v][i + 1].push({
            name: row.c[0]?.v,
            score: row.c[i + this.FIRST_SCORE_COLUMN_OFFSET]?.v,
            date: row.c[3]?.v,
          });
        }
      } else {
        // new course found (and we are in the Par row)
        let howManyHoles = this.howManyHolesHasLayout(row);
        let newCourse = {
          course: row.c[1]?.v,
          layout: row.c[2]?.v,
          howManyHoles: howManyHoles,
        };
        for (var i = 0; i < howManyHoles; i++) {
          newCourse[i + 1] = [];
          newCourse[i + 1].push({
            name: row.c[0]?.v, // (= Par because Par is first row)
            score: row.c[i + this.FIRST_SCORE_COLUMN_OFFSET]?.v,
          });
        }

        // add courses scores to course
        this.courses[row.c[1]?.v + row.c[2]?.v] = newCourse;
      }
    });

    this.calculateHoleStatistics();

    // we always have (1 header row + 1 par row + 1 row for each player) per match in the sheet
    rows.forEach((row) => {
      if (row.c[3]?.v === "StartDate") {
        return;
      } else if (row.c[3]?.v in this.matches) {
        // new player for existing match found --> add to corresponding match

        // first check if player is already in this.players. Add otherwise
        if (!(row.c[0]?.v in this.players)) {
          // player is not yet in this.players --> add
          let newPlayer = {
            name: row.c[0]?.v,
            playedCoursesCount: 0,
            devFromParPerHole: [],
            playedCourses: [],
            playedHolesCount: 0,
            recentScores: {},
          };
          this.players[row.c[0]?.v] = newPlayer;
        }

        let newPlayerForMatch = {
          total: row.c[5]?.v,
          devFromPar: row.c[6]?.v,
          holes: [],
          howManyHolesNotPlayedInThisMatch: 0,
        };
        for (let i = 1; i <= this.matches[row.c[3]?.v].holes; i++) {
          if (row.c[7 + i]?.v > 0) {
            // player has played the hole: add score
            newPlayerForMatch.holes.push(row.c[7 + i]?.v);
            this.players[row.c[0]?.v].playedHolesCount++;
            this.players[row.c[0]?.v].devFromParPerHole.push(
              row.c[7 + i]?.v -
                this.matches[row.c[3]?.v].players["Par"].holes[i - 1],
            );
          } else {
            // player has not played the hole
            newPlayerForMatch.howManyHolesNotPlayedInThisMatch++;
            newPlayerForMatch.holes.push("-");
            this.players[row.c[0]?.v].devFromParPerHole.push(420); // put 420 ==> has not played the hole
          }
        }
        this.players[row.c[0]?.v].playedCoursesCount++;
        this.players[row.c[0]?.v].playedCourses.push({
          course: row.c[1]?.v,
          layout: row.c[2]?.v,
        });

        this.matches[row.c[3]?.v].players[row.c[0]?.v] = newPlayerForMatch;
      } else {
        // new match found. Add to object. We are now in the par row

        // first: find out how many holes the layout has
        let howManyHoles = this.howManyHolesHasLayout(row);

        const startTimeAsDate = this.formatCsvTimeAsDate(row.c[3]?.v);
        const endTimeAsDate = this.formatCsvTimeAsDate(row.c[4]?.v);

        let match = {
          startTime: startTimeAsDate,
          endTime: endTimeAsDate,
          duration: this.formatDuration(startTimeAsDate, endTimeAsDate),
          course: row.c[1]?.v,
          layout: row.c[2]?.v,
          par: row.c[5]?.v,
          holes: howManyHoles,
          players: {},
        };

        this.holeLengthsSets.forEach((holeLengthSet) => {
          if (
            match.course == holeLengthSet.course &&
            match.layout == holeLengthSet.layout
          ) {
            match.holeLengths = holeLengthSet.lengths;
          }
        });

        match.players["Par"] = {
          total: row.c[5]?.v,
          devFromPar: 0,
          holes: [],
        };
        for (let i = 1; i <= howManyHoles; i++) {
          match.players["Par"].holes.push(row.c[7 + i]?.v);
        }
        this.matches[row.c[3]?.v] = match;
      }
    });
    // console.log(this.matches);

    // refine this.players (grouping)
    Object.values(this.players).forEach((player) => {
      const playedCoursesCounts = Object.values(
        player.playedCourses.reduce((acc, { course, layout }) => {
          const key = `${course}__${layout}`;

          if (!acc[key]) {
            acc[key] = { course, layout, count: 0 };
          }

          acc[key].count += 1;

          return acc;
        }, {}),
      );
      player.playedCourses = playedCoursesCounts;

      const devFromParPerHoleCounts = player.devFromParPerHole.reduce(
        (acc, value) => {
          if (value == 420) {
            // player has not played the hole ==> do nothing
          } else if (value >= 3) {
            acc["3+"]++;
          } else if (value < 0) {
            acc["-1"]++;
          } else {
            acc[value]++;
          }
          return acc;
        },
        {
          "-1": 0,
          0: 0,
          1: 0,
          2: 0,
          "3+": 0,
        },
      );

      player.devFromParPerHole = devFromParPerHoleCounts;
    });

    Object.entries(this.courses).forEach(([courseKey, course]) => {
      for (let hole = 1; hole <= course.howManyHoles; hole++) {
        const entries = course[hole];
        const par = entries[0].score; // Par row is always first

        // skip index 0 (Par)
        for (let i = 1; i < entries.length; i++) {
          const { name, score, date } = entries[i];
          const player = this.players[name];
          if (!player) continue; // player not in this.players

          player.recentScores[courseKey] ??= {};
          (player.recentScores[courseKey][hole] ??= []).push({
            score,
            par,
            time: this.formatCsvTimeAsDate(date).getTime(),
            layout: course.layout,
            hole,
          });
        }
      }
    });

    console.log(this.matches);
    Object.values(this.matches)
      .sort((a, b) => a.startTime - b.startTime)
      .forEach((match) => this.getStatsString(match));

    console.log(this.players);
    Object.values(this.players)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((player) => this.getPlayerString(player));

    console.log(this.courses);
    Object.values(this.courses)
      .sort((a, b) => (a.course + a.layout).localeCompare(b.course + b.layout))
      .forEach((course) => this.getCourseString(course));

    // popover content inline style is restricted by Bootstrap; allow inline styles on <span> only
    bootstrap.Popover.Default.allowList.span = ["style"];

    // initialize isomorph holes popovers once all player HTML exists
    document
      .querySelectorAll(
        '#playersAccordion [data-bs-toggle="popover"], #coursesAccordion [data-bs-toggle="popover"]',
      )
      .forEach((el) => new bootstrap.Popover(el));
  }

  // distribution + average vs. par for every hole of every course/layout (needs all rows to be read first)
  calculateHoleStatistics() {
    Object.values(this.courses).forEach((course) => {
      for (let hole = 1; hole <= course.howManyHoles; hole++) {
        const entries = course[hole];
        const par = entries[0].score; // Par row is always first

        const distribution = { "-1": 0, 0: 0, 1: 0, 2: 0, "3+": 0 };
        let total = 0;
        let count = 0;

        // skip index 0 (Par itself)
        for (let i = 1; i < entries.length; i++) {
          const score = entries[i].score;
          const diff = score - par;
          total += score;
          count++;

          if (diff <= -1) distribution["-1"]++;
          else if (diff === 0) distribution[0]++;
          else if (diff === 1) distribution[1]++;
          else if (diff === 2) distribution[2]++;
          else distribution["3+"]++;
        }

        entries.distribution = distribution;
        entries.averageToPar = count > 0 ? total / count - par : null;
      }
    });
  }

  formatAverageToPar(avg) {
    if (avg === null) return "-";
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    }).format(avg);
  }

  getHoleStatsString(course) {
    const lengths = this.holeLengthsSets.find(
      (s) => s.course === course.course && s.layout === course.layout,
    )?.lengths;

    const segments = [
      { key: "-1", label: "Unter", cls: "birdie" },
      { key: "0", label: "Par", cls: "par" },
      { key: "1", label: "Bogey", cls: "bogey" },
      { key: "2", label: "Double", cls: "doublebogey" },
      { key: "3+", label: "3+", cls: "plusthree" },
    ];
    const headStyle =
      "font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;";

    let rowsString = "";
    for (let hole = 1; hole <= course.howManyHoles; hole++) {
      const entries = course[hole];
      const par = entries[0].score; // Par row is always first
      const distribution = entries.distribution;
      const total = segments.reduce((sum, s) => sum + distribution[s.key], 0);

      // color by the rounded value, so "0,0" is not shown as over par
      const avg = entries.averageToPar;
      const rounded = avg === null ? 0 : Math.round(avg * 10) / 10;
      const avgColor =
        rounded > 0 ? "#e26028" : rounded < 0 ? "#408ce2" : "#212529";

      let barCell = `<td>-</td>`;
      if (total > 0) {
        const popoverContent =
          `<b>${total} Einträge</b>` +
          segments
            .map((s) => {
              const count = distribution[s.key];
              const percent = Math.round((count / total) * 100);
              return `<span style="display: flex; align-items: center; gap: 8px; white-space: nowrap;${count === 0 ? " opacity: 0.4;" : ""}">
                  ${this.getScoreClassDot(s.cls)}
                  <span style="min-width: 2ch; text-align: right;">${count}</span>
                  <span style="min-width: 4ch; text-align: right;">${percent}%</span>
                </span>`;
            })
            .join("");

        const bar = segments
          .filter((s) => distribution[s.key] > 0)
          .map(
            (s) =>
              `<div class="bg-scorecard-${s.cls}" style="width: ${(distribution[s.key] / total) * 100}%;"></div>`,
          )
          .join("");

        barCell = `
        <td style="padding: 6px; cursor: pointer;" ${this.getPopoverAttributes(popoverContent)}>
          <div style="display: flex; width: 110px; height: 14px; border-radius: 3px; overflow: hidden;">${bar}</div>
        </td>`;
      }

      rowsString += `
      <tr>
        <th class="text-start-table-header-info">Bahn ${hole}</th>
        ${lengths ? `<td>${lengths[hole - 1] ?? "-"}</td>` : ""}
        <td>${par}</td>
        <td><b style="color: ${avgColor};">${this.formatAverageToPar(avg)}</b></td>
        ${barCell}
      </tr>`;
    }

    const legend = segments
      .map((s) => `<span>${this.getScoreClassDot(s.cls)} ${s.label}</span>`)
      .join("");

    return `
    <h5 class="mt-3">Bahnen:</h5>
    <table class="table table-bordered text-center align-middle w-auto">
      <thead>
        <tr>
          <th style="${headStyle}"></th>
          ${lengths ? `<th style="${headStyle}">Länge</th>` : ""}
          <th style="${headStyle}">Par</th>
          <th style="${headStyle}">Ø Par</th>
          <th style="${headStyle}">Verteilung</th>
        </tr>
      </thead>
      <tbody>${rowsString}</tbody>
    </table>
    <div class="d-flex flex-wrap gap-3" style="font-size: 0.75rem;">Die Verteilung betrachtet nur auf diesem Layout gespielte Runden.</div>
    <div class="d-flex flex-wrap gap-3" style="font-size: 0.75rem;">${legend}</div>`;
  }

  getScoreClassDot(cls) {
    return `<span
      class="badge bg-scorecard-${cls}"
      style="display: inline-block; width: 11px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;"
    ></span>`;
  }

  // last #limit totals (dev from par) of this player on exactly this course/layout, oldest -> newest
  getRecentTotals(player, course, limit) {
    return Object.values(this.matches)
      .filter(
        (m) =>
          m.course === course.course &&
          m.layout === course.layout &&
          player.name in m.players,
      )
      .sort((a, b) => a.startTime - b.startTime)
      .slice(-limit)
      .map((m) => ({
        dev: m.players[player.name].devFromPar,
        thru: this.hasPlayerCompletedMatch(m, player)
          ? null // null = round completed, otherwise the number of holes played
          : m.holes - m.players[player.name].howManyHolesNotPlayedInThisMatch,
        time: m.startTime,
      }));
  }

  formatDevFromPar(dev) {
    if (dev > 0) return `+${dev}`;
    if (dev === 0) return "E";
    return `${dev}`;
  }

  // all scores on this hole and all its isomorph holes for player, oldest -> newest
  getCombinedScores(player, course, hole) {
    const sources = [
      { course: course.course, layout: course.layout, hole: Number(hole) },
      ...this.getIsomorphHoles(course.course, course.layout, hole),
    ];

    return sources
      .flatMap((h) => player.recentScores[h.course + h.layout]?.[h.hole] ?? [])
      .sort((a, b) => a.time - b.time);
  }

  // last #limit scores on this hole and all its isomorph holes for player, oldest -> newest
  getCombinedRecentScores(player, course, hole, limit) {
    return this.getCombinedScores(player, course, hole).slice(-limit);
  }

  // personal best on this hole incl. isomorph holes = fewest throws (absolute score)
  // on a tie the earliest one wins, because getCombinedScores is sorted oldest -> newest
  // count = how often that score was achieved
  getPersonalBestScore(player, course, hole) {
    const all = this.getCombinedScores(player, course, hole);
    if (all.length === 0) return null;

    const best = all.reduce((b, s) => (s.score < b.score ? s : b));
    return { ...best, count: all.filter((s) => s.score === best.score).length };
  }

  // personal best total on exactly this course/layout, only completed rounds
  // returns { dev, total, time, count } or null (on a tie the earliest round wins)
  getPersonalBestTotal(player, course) {
    const totals = Object.values(this.matches)
      .filter(
        (m) =>
          m.course === course.course &&
          m.layout === course.layout &&
          this.hasPlayerCompletedMatch(m, player),
      )
      .sort((a, b) => a.startTime - b.startTime)
      .map((m) => ({
        dev: m.players[player.name].devFromPar,
        total: m.players[player.name].total,
        time: m.startTime,
      }));
    if (totals.length === 0) return null;

    const best = totals.reduce((b, t) => (t.dev < b.dev ? t : b));
    return { ...best, count: totals.filter((t) => t.dev === best.dev).length };
  }

  formatDate(time) {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(time);
  }

  // popover content for a single hole score (recent or PB)
  getScorePopoverContent({ time, layout, hole, par }) {
    return `<b>${this.formatDate(time)}</b><br>auf ${layout}`;
  }

  // attributes that turn an element into a hover/tap popover
  getPopoverAttributes(content, placement = "top") {
    const escapedContent = content.replace(/"/g, "&quot;");
    return `tabindex="0"
      data-bs-toggle="popover"
      data-bs-trigger="hover focus"
      data-bs-container="body"
      data-bs-html="true"
      data-bs-placement="${placement}"
      data-bs-content="${escapedContent}"`;
  }

  // check if the player played every hole of this match
  hasPlayerCompletedMatch(match, player) {
    return match.players[player.name]?.howManyHolesNotPlayedInThisMatch === 0;
  }

  // returns all other holes that are isomorph to the given one
  getIsomorphHoles(course, layout, hole) {
    const isSame = (h) =>
      h.course === course && h.layout === layout && h.hole === Number(hole);

    const group = this.isomorphHoles.find((g) => g.some(isSame));
    if (!group) return [];

    return group.filter((h) => !isSame(h));
  }

  formatCsvTimeAsDate(time) {
    return new Date(time.replace(/(\d{2})(\d{2})$/, "$1:$2"));
  }

  howManyHolesHasLayout(row) {
    let howManyHoles = row.c?.length - 8;
    let isStillLessHoles = true;
    while (isStillLessHoles) {
      if (row.c[howManyHoles + 7]?.v == null) {
        howManyHoles--;
      } else {
        isStillLessHoles = false;
      }
    }
    return howManyHoles;
  }

  formatDuration(start, end) {
    const diffMs = end - start; // difference in milliseconds

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h${minutes.toString().padStart(2, "0")}min`;
  }

  roundToNearestHour(date) {
    const rounded = new Date(date);
    const minutes = rounded.getMinutes();

    if (minutes >= 30) {
      rounded.setHours(rounded.getHours() + 1);
    }

    rounded.setMinutes(0, 0, 0); // reset minutes, seconds, ms
    return rounded;
  }

  getScoreClass(devFromPar) {
    if (devFromPar < 0) return "birdie";
    if (devFromPar === 0) return "par";
    if (devFromPar === 1) return "bogey";
    if (devFromPar === 2) return "doublebogey";
    return "plusthree";
  }

  getRecentScoresString(player) {
    const MAX_RECENT = 4;
    const label = (courseKey) => {
      const course = this.courses[courseKey];
      return `${course.course} (${course.layout})`;
    };

    const recentScoresEntries = Object.entries(player.recentScores).sort(
      ([keyA], [keyB]) =>
        label(keyA).localeCompare(label(keyB), "de", { numeric: true }),
    );
    if (recentScoresEntries.length === 0) return "";

    let html = `<h5>Letzte Ergebnisse</h5>`;

    recentScoresEntries.forEach(([courseKey]) => {
      const course = this.courses[courseKey];

      html += `
    <details class="mb-2">
      <summary style="cursor: pointer">${course.course} (${course.layout})</summary>
      <table class="table table-bordered text-center align-middle w-auto mt-2">
        <thead>
          <tr>
            <th></th>
            <th colspan="${MAX_RECENT}" style="font-size: 0.75rem; font-weight: normal; padding: 2px 6px;">
              <span class="d-flex align-items-center">
                <span><b>alt</b></span>
                <span style="flex-grow: 1; text-align: center;"><b>&#10230;</b></span>
                <span><b>neu</b></span>
              </span>
            </th>
            <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle; border-left: 3px double #adb5bd;">PB</th>
          </tr>
        </thead>
        <tbody>
      `;
      const totals = this.getRecentTotals(player, course, MAX_RECENT);
      if (totals.length > 0) {
        html += `<tr><th class="text-start-table-header-info">Gesamt</th>`;

        // pad on the left so the newest total is in the rightmost column
        for (let i = totals.length; i < MAX_RECENT; i++) {
          html += `<td style="padding: 3px; width: 36px"></td>`;
        }

        totals.forEach(({ dev, thru, time }) => {
          const color = dev > 0 ? "#e26028" : dev < 0 ? "#408ce2" : "#212529";
          const isIncomplete = thru !== null;
          const content =
            `<b>${this.formatDate(time)}</b>` +
            (isIncomplete
              ? `<br><span style='font-size: 0.7rem'>THRU</span> ${thru}`
              : "");

          html += `
            <td style="padding: 3px; width: 36px; vertical-align: middle; cursor: pointer;" ${this.getPopoverAttributes(content)}>
              <b style="color: ${color};">${this.formatDevFromPar(dev)}${isIncomplete ? "*" : ""}</b>
            </td>`;
        });

        const pbTotal = this.getPersonalBestTotal(player, course);
        if (pbTotal !== null) {
          const pbColor =
            pbTotal.dev > 0
              ? "#e26028"
              : pbTotal.dev < 0
                ? "#408ce2"
                : "#212529";
          html += `
            <td style="padding: 3px; width: 36px; vertical-align: middle; border-left: 3px double #adb5bd; cursor: pointer;" ${this.getPopoverAttributes(this.getPbDateLabel(pbTotal.time, pbTotal.count > 1))}>
              <b style="color: ${pbColor};">${this.formatDevFromPar(pbTotal.dev)}</b>
            </td>`;
        } else {
          html += `<td style="border-left: 3px double #adb5bd;">-</td>`;
        }
      }

      html += `</tr></tbody></table>
      <table class="table table-bordered text-center align-middle w-auto mt-2">
        <thead>
          <tr>
            <th></th>
            <th colspan="${MAX_RECENT}" style="font-size: 0.75rem; font-weight: normal; padding: 2px 6px;">
              <span class="d-flex align-items-center">
                <span><b>alt</b></span>
                <span style="flex-grow: 1; text-align: center;"><b>&#10230;</b></span>
                <span><b>neu</b></span>
              </span>
            </th>
            <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle; border-left: 3px double #adb5bd;">PB</th>
          </tr>
        </thead>
        <tbody>`;

      for (let hole = 1; hole <= course.howManyHoles; hole++) {
        const recent = this.getCombinedRecentScores(
          player,
          course,
          hole,
          MAX_RECENT,
        );
        if (recent.length === 0) continue; // never played this hole (or an isomorph of it)

        const isomorphs = this.getIsomorphHoles(
          course.course,
          course.layout,
          hole,
        );
        if (isomorphs.length > 0) {
          const popoverContent =
            "<b>identisch zu</b><br>" +
            isomorphs.map((h) => `${h.layout} - Bahn ${h.hole}`).join("<br>");
          html += `<tr><th
          class="text-start-table-header-info"
          tabindex="0"
          style="cursor: pointer;"
          data-bs-toggle="popover"
          data-bs-trigger="hover focus"
          data-bs-container="body"
          data-bs-html="true"
          data-bs-placement="right"
          data-bs-content="${popoverContent}"
        >Bahn ${hole}</th>`;
        } else {
          html += `<tr><th class="text-start-table-header-info">Bahn ${hole}</th>`;
        }

        // fill with empty cells so all rows have the same width
        for (let i = recent.length; i < MAX_RECENT; i++) {
          html += `<td style="padding: 3px; width: 36px"></td>`;
        }

        recent.forEach((entry) => {
          html += `
            <td style="padding: 3px; width: 36px; line-height: 1; vertical-align: middle; cursor: pointer;" ${this.getPopoverAttributes(this.getScorePopoverContent(entry))}>
              <span class="badge bg-scorecard-${this.getScoreClass(entry.score - entry.par)}" style="display: block; width: 30px; margin: 0 auto; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${entry.score}</span>
            </td>`;
        });

        const pb = this.getPersonalBestScore(player, course, hole);
        const originalPar = course[hole][0].score;
        html += `
          <td style="padding: 3px; width: 36px; line-height: 1; vertical-align: middle; border-left: 3px double #adb5bd; cursor: pointer;" ${this.getPopoverAttributes(`${this.getPbDateLabel(pb.time, pb.count > 1)}<br>auf ${pb.layout}`)}>
            <span class="badge bg-scorecard-${this.getScoreClass(pb.score - originalPar)}" style="display: block; width: 30px; margin: 0 auto; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${pb.score}</span>
          </td>`;
      }

      html += `
        </tbody>
      </table>
    </details>`;
    });

    return html;
  }

  // date line for PB popovers: "erstmals am" only if the PB was achieved more than once
  getPbDateLabel(time, achievedMultipleTimes) {
    return `<b>${achievedMultipleTimes ? "erstmals am" : ""} ${this.formatDate(time)}</b>`;
  }

  formatDateStringForStatsStringHeader(date) {
    date = this.roundToNearestHour(date);
    const weekday = new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
    }).format(date);
    const day = new Intl.DateTimeFormat("de-DE", { day: "2-digit" }).format(
      date,
    );
    const month = new Intl.DateTimeFormat("de-DE", { month: "2-digit" }).format(
      date,
    );
    const year = new Intl.DateTimeFormat("de-DE", { year: "numeric" }).format(
      date,
    );
    const hour = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      hour12: false,
    }).format(date);

    return `${weekday} ${day}.${month}.${year} ${hour}`;
  }

  formatDateStringForStatsStringCollapsed(date) {
    const hourminute = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

    return `${hourminute} Uhr`;
  }

  getPlayerString(player) {
    const playerNameWithoutSpecialChars = player.name.replace(
      /[^a-zA-Z0-9]/g,
      "",
    ); // specialChars problematic in ids

    let playerString = `<div class="accordion-item col-lg-6 mx-auto">
            <h2 class="accordion-header" id="heading-${playerNameWithoutSpecialChars}">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse-${playerNameWithoutSpecialChars}"
                aria-expanded="true"
                aria-controls="collapse-${playerNameWithoutSpecialChars}"
              >
                <h4>${player.name}</h4>
              </button>
            </h2>
            <div
              id="collapse-${playerNameWithoutSpecialChars}"
              class="accordion-collapse collapse"
              aria-labelledby="heading-${playerNameWithoutSpecialChars}"
              data-bs-parent="#myAccordion"
            >
              <div class="accordion-body" style="background-color: #fff9f3;">
                <h5>Gespielte Partien: ${player.playedCoursesCount}</h5>
                <table
                  class="table table-bordered text-center align-middle w-auto"
                >
                  <thead>
                    <tr>
                      <th colspan="2" style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;">Parcours</th>
                      <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;"># gesp.</th>
                      <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle; border-left: 3px double #adb5bd;">PB</th>
                    </tr>
                  </thead>
                  <tbody>`;

    player.playedCourses.forEach((course) => {
      const pbTotal = this.getPersonalBestTotal(player, course);
      let pbCell = `<td style="border-left: 3px double #adb5bd;">-</td>`; // if no completed round: pbCell not overwritten
      if (pbTotal !== null) {
        const pbColor =
          pbTotal.dev > 0 ? "#e26028" : pbTotal.dev < 0 ? "#408ce2" : "#212529";
        pbCell = `
        <td style="border-left: 3px double #adb5bd; cursor: pointer;" ${this.getPopoverAttributes(this.getPbDateLabel(pbTotal.time, pbTotal.count > 1))}>
          <b style="color: ${pbColor};">${this.formatDevFromPar(pbTotal.dev)}</b> (${pbTotal.total})
        </td>`;
      }

      playerString += `
      <tr>
        <th class="text-start-table-header-info">${course.course}</th>
        <th class="text-start">${course.layout}</th>
        <td>${course.count}</td>${pbCell}
      </tr>`;
    });
    playerString += `</tbody>
                </table>
                <h5>Gespielte Bahnen: ${player.playedHolesCount}</h5>
                <table
                  class="table table-bordered text-center align-middle w-auto"
                >
                  <tbody>
                    <tr>
                      <th class="text-start-table-header-info">Unter</th>
                      <th>${this.getScoreClassDot("birdie")}</th>
                      <td>${player.devFromParPerHole[-1]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">Par</th>
                      <th>${this.getScoreClassDot("par")}</th>
                      <td>${player.devFromParPerHole["0"]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">Bogey</th>
                      <th>${this.getScoreClassDot("bogey")}</th>
                      <td>${player.devFromParPerHole["1"]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">Double</th>
                      <th>${this.getScoreClassDot("doublebogey")}</th>
                      <td>${player.devFromParPerHole["2"]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">3+</th>
                      <th>${this.getScoreClassDot("plusthree")}</th>
                      <td>${player.devFromParPerHole["3+"]}</td>
                    </tr>
                  </tbody>
                </table>`;
    playerString += this.getRecentScoresString(player);
    playerString += `
              </div>
            </div>
          </div>`;

    document.getElementById("playersAccordion").innerHTML += playerString;
  }

  getCourseString(course) {
    const courseNameWithoutSpecialChars = (
      course.course + course.layout
    ).replace(/[^a-zA-Z0-9]/g, ""); // specialChars problematic in ids

    // all players with at least one completed round on this course/layout, best (lowest) first
    const pbRows = Object.values(this.players)
      .map((player) => ({
        name: player.name,
        pb: this.getPersonalBestTotal(player, course),
      }))
      .filter(({ pb }) => pb !== null)
      .sort(
        (a, b) =>
          a.pb.dev - b.pb.dev ||
          a.pb.time - b.pb.time || // tie: who was first
          a.name.localeCompare(b.name),
      );

    let pbRowsString = "";
    if (pbRows.length === 0) {
      pbRowsString = `<tr><td colspan="2" class="text-muted">Noch keine abgeschlossene Runde.</td></tr>`;
    } else {
      pbRows.forEach(({ name, pb }) => {
        const pbColor =
          pb.dev > 0 ? "#e26028" : pb.dev < 0 ? "#408ce2" : "#212529";
        pbRowsString += `
          <tr>
            <th class="text-start-table-header-info">${name}</th>
            <td style="cursor: pointer;" ${this.getPopoverAttributes(this.getPbDateLabel(pb.time, pb.count > 1))}>
              <b style="color: ${pbColor};">${this.formatDevFromPar(pb.dev)}</b> (${pb.total})
            </td>
          </tr>`;
      });
    }

    let courseLayoutString = `<div class="accordion-item col-lg-6 mx-auto">
            <h2 class="accordion-header" id="heading-${courseNameWithoutSpecialChars}">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse-${courseNameWithoutSpecialChars}"
                aria-expanded="true"
                aria-controls="collapse-${courseNameWithoutSpecialChars}"
              >
                <h4>${course.course} (${course.layout})</h4>
              </button>
            </h2>
            <div
              id="collapse-${courseNameWithoutSpecialChars}"
              class="accordion-collapse collapse"
              aria-labelledby="heading-${courseNameWithoutSpecialChars}"
              data-bs-parent="#myAccordion"
            >
              <div class="accordion-body" style="background-color: #fff9f3;">
                <h5>Bestenliste:</h5>
                <table
                  class="table table-bordered text-center align-middle w-auto"
                >
                  <thead>
                    <tr>
                      <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;">Spieler</th>
                      <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;">PB</th>
                    </tr>
                  </thead>
                  <tbody>${pbRowsString}</tbody>
                </table>
                ${this.getHoleStatsString(course)}
              </div>
            </div>
          </div>`;

    document.getElementById("coursesAccordion").innerHTML += courseLayoutString;
  }

  getStatsString(match) {
    const HOLES_PER_ROW = 9;
    const par = match.players["Par"];

    const sortedPlayers = Object.entries(match.players)
      .filter(([playerKey]) => playerKey !== "Par")
      .sort((a, b) => a[1].devFromPar - b[1].devFromPar);

    // Builds one scorecard table for holes [from, to)
    const buildScorecardTable = (from, to) => {
      let html = `
        <table class="table table-dark table-borderless text-center align-middle w-auto mb-2 scorecard-block">
          <thead class="border-bottom-scorecard-block">
            <tr>
              <th class="text-start-table-header-info" style="line-height: 0.8">Bahn</th>`;
      for (let i = from; i < to; i++) {
        html += `<th style="line-height: 0.8">${i + 1}</th>`;
      }
      html += `</tr>`;

      if (match.holeLengths) {
        html += `<tr>
              <th class="text-start-table-header-info" style="line-height: 0.8">Länge</th>`;
        for (let i = from; i < to; i++) {
          html += `<td style="padding-left: 3px; padding-right: 3px; width: 30px; line-height: 0.8">${match.holeLengths[i]}</td>`;
        }
        html += `</tr>`;
      }

      html += `<tr>
              <th class="text-start-table-header-info" style="line-height: 0.8">Par</th>`;
      for (let i = from; i < to; i++) {
        html += `<td style="line-height: 0.8">${par.holes[i]}</td>`;
      }
      html += `</tr>
          </thead>
          <tbody>`;

      sortedPlayers.forEach(([playerKey, playerVal]) => {
        html += `<tr>
              <th class="text-start" style="line-height: 0.2">${playerKey}</th>`;
        for (let i = from; i < to; i++) {
          const devFromParOnThisHole = playerVal.holes[i] - par.holes[i];
          let classToAssign = "";
          if (devFromParOnThisHole < 0) {
            classToAssign = "birdie";
          } else if (devFromParOnThisHole === 0) {
            classToAssign = "par";
          } else if (devFromParOnThisHole === 1) {
            classToAssign = "bogey";
          } else if (devFromParOnThisHole === 2) {
            classToAssign = "doublebogey";
          } else if (devFromParOnThisHole >= 3) {
            classToAssign = "plusthree";
          } else {
            // not played
            classToAssign = "par"; // par = no background color = same as if not played
          }
          html += `
              <td style="padding: 3px; width: 30px; line-height: 0.2">
                <span class="badge bg-scorecard-${classToAssign}" style="display: inline-block; width: 30px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${playerVal.holes[i]}</span>
              </td>`;
        }
        html += `</tr>`;
      });

      html += `
          </tbody>
        </table>`;
      return html;
    };

    let statsString = `
        <div
          class="d-flex justify-content-start justify-content-md-center mt-4"
          style="margin-bottom: 10px"
        >
          <div
            class="bg-dark text-white p-3 rounded d-inline-block"
            style="cursor: pointer"
            data-bs-toggle="collapse"
            data-bs-target="#scorecard-collapsing-${match.startTime.valueOf()}"
          >
            <h4>${match.course} <span style="white-space: nowrap;">(${match.layout}) -</span> <span style="white-space: nowrap;">${this.formatDateStringForStatsStringHeader(match.startTime)}</span></h4>
            <h5 class="mb-3">Ergebnis</h5>
            <table
              class="table table-dark table-bordered text-center align-middle w-auto"
            >
              <tbody>`;

    sortedPlayers.forEach(([playerKey, playerVal]) => {
      statsString += `<tr>
            <th class="text-start">${playerKey}</th>
            <td><b style="color: ${playerVal.devFromPar > 0 ? '#fd6c2e">+' : playerVal.devFromPar == 0 ? '#ffffff">' : '#408ce2">'}${playerVal.devFromPar != 0 ? playerVal.devFromPar : "E"}</b> (${playerVal.total})</td>
            ${playerVal.howManyHolesNotPlayedInThisMatch > 0 ? "<td><span style='font-size: 0.7rem'>THRU</span> " + (match.holes - playerVal.howManyHolesNotPlayedInThisMatch) + "</td>" : ""}
        </tr>`;
    });

    statsString += `
            </tbody>
          </table>
          <div class="collapse" id="scorecard-collapsing-${match.startTime.valueOf()}">
            <ul><li>Start - ${this.formatDateStringForStatsStringCollapsed(match.startTime)}</li>
            <li>Dauer - ${match.duration}</li>
            <li>Ende - ${this.formatDateStringForStatsStringCollapsed(match.endTime)}</li></ul>
            <h5 class="mb-3">Scorecard</h5>`;

    // One table per block of 9 holes
    for (let from = 0; from < match.holes; from += HOLES_PER_ROW) {
      statsString += buildScorecardTable(
        from,
        Math.min(from + HOLES_PER_ROW, match.holes),
      );
    }

    statsString += `
          </div>
        </div>
      </div>`;

    document.getElementById("partien-container").innerHTML += statsString;
  }

  loadTableData() {
    if (this.isCacheValid(this.cacheKeyTable)) {
      // lade die Daten aus localStorage (Cache)
      let cachedData = JSON.parse(
        localStorage.getItem(this.cacheKeyTable),
      ).data;
      this.renderStats(cachedData);
    } else {
      // Lade die Daten aus dem Google Sheet
      this.fetchAndRenderData(
        this.getURL(this.range),
        this.cacheKeyTable,
        this.renderStats.bind(this),
      );
    }
  }

  parseCsv(text) {
    const [header, ...lines] = text.trim().split(/\r?\n/);
    const keys = header.split(",");
    return lines
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const values = line.split(",");
        return Object.fromEntries(keys.map((k, i) => [k, values[i].trim()]));
      });
  }

  async loadReferenceData() {
    const [lengthsText, isomorphText] = await Promise.all([
      fetch("course_data/hole_lengths.csv").then((res) => res.text()),
      fetch("course_data/isomorph_holes.csv").then((res) => res.text()),
    ]);

    this.holeLengthsSets = this.parseCsv(lengthsText).map((row) => ({
      course: row.course,
      layout: row.layout,
      lengths: row.lengths.split(";").map(Number),
    }));

    // group rows by their group number, keeping the order of the isomorph file
    const groups = new Map();
    this.parseCsv(isomorphText).forEach((row) => {
      if (!groups.has(row.group)) groups.set(row.group, []);
      groups.get(row.group).push({
        course: row.course,
        layout: row.layout,
        hole: Number(row.hole),
      });
    });
    this.isomorphHoles = [...groups.values()];
  }

  async initialize() {
    try {
      await this.loadReferenceData();
    } catch (error) {
      console.error("Error while loading csv files: ", error);
    }
    this.loadTableData();
  }
}

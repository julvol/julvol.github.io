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
    // Discgolfpark Rheindahlen (De Kull Main Am, De Kull Main)
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
          newCourse[i + 1].distribution = {
            "-1": 0,
            0: 0,
            1: 0,
            2: 0,
            "3+": 0,
          };
          newCourse[i + 1].averageToPar = 0;
        }

        // create distribution from the scores for each hole of each course/layout combination
        Object.values(this.courses).forEach((course) => {
          for (let hole = 1; hole <= course.howManyHoles; hole++) {
            const entries = course[hole];
            const parEntry = entries[0]; // Par row is always first
            const par = parEntry.score;

            // reset in case this runs more than once
            const distribution = { "-1": 0, 0: 0, 1: 0, 2: 0, "3+": 0 };

            // skip index 0 (Par itself)
            let total = 0;
            let count = 0;
            for (let i = 1; i < entries.length; i++) {
              const score = entries[i].score;
              const diff = score - par;
              total += score;
              count++;

              if (diff <= -1) {
                distribution["-1"]++;
              } else if (diff === 0) {
                distribution[0]++;
              } else if (diff === 1) {
                distribution[1]++;
              } else if (diff === 2) {
                distribution[2]++;
              } else {
                distribution["3+"]++;
              }
            }
            course[hole].distribution = distribution;

            course[hole].averageToPar = count > 0 ? total / count - par : null;
          }
        });

        // add courses scores to course
        this.courses[row.c[1]?.v + row.c[2]?.v] = newCourse;
      }
    });

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
          });
        }
      }
    });

    console.log(this.courses);
    console.log(this.matches);
    Object.values(this.matches)
      .sort((a, b) => a.startTime - b.startTime)
      .forEach((match) => this.getStatsString(match));

    console.log(this.players);
    Object.values(this.players)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((player) => this.getPlayerString(player));

    // initialize isomorph holes popovers once all player HTML exists
    document
      .querySelectorAll('#playersAccordion [data-bs-toggle="popover"]')
      .forEach((el) => new bootstrap.Popover(el));
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

  // personal best on this hole incl. isomorph holes (best = lowest dev from par, ties: fewer throws)
  getPersonalBestScore(player, course, hole) {
    const all = this.getCombinedScores(player, course, hole);
    if (all.length === 0) return null;

    return all.reduce((best, s) => {
      const devS = s.score - s.par;
      const devBest = best.score - best.par;
      return devS < devBest || (devS === devBest && s.score < best.score)
        ? s
        : best;
    });
  }

  // personal best total (dev from par) on exactly this course/layout, only completed rounds
  getPersonalBestTotal(player, course) {
    const totals = Object.values(this.matches)
      .filter(
        (m) =>
          m.course === course.course &&
          m.layout === course.layout &&
          player.name in m.players &&
          this.hasPlayerCompletedMatch(m, player),
      )
      .map((m) => m.players[player.name].devFromPar);

    return totals.length > 0 ? Math.min(...totals) : null;
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
    const recentScoresEntries = Object.entries(player.recentScores);
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

        totals.forEach(({ dev, thru }) => {
          const color = dev > 0 ? "#e26028" : dev < 0 ? "#408ce2" : "#212529";
          const isIncomplete = thru !== null;

          const popoverAttributes = isIncomplete
            ? `tabindex="0"
              data-bs-toggle="popover"
              data-bs-trigger="hover focus"
              data-bs-container="body"
              data-bs-html="true"
              data-bs-placement="top"
              data-bs-content="<b>THRU ${thru}</b>"`
            : "";

          html += `
            <td style="padding: 3px; width: 36px; vertical-align: middle;${isIncomplete ? " cursor: pointer;" : ""}" ${popoverAttributes}>
              <b style="color: ${color};">${this.formatDevFromPar(dev)}${isIncomplete ? "*" : ""}</b>
            </td>`;
        });

        const pbTotal = this.getPersonalBestTotal(player, course);
        if (pbTotal !== null) {
          const pbColor =
            pbTotal > 0 ? "#e26028" : pbTotal < 0 ? "#408ce2" : "#212529";
          html += `
            <td style="padding: 3px; width: 36px; vertical-align: middle; border-left: 3px double #adb5bd;">
              <b style="color: ${pbColor};">${this.formatDevFromPar(pbTotal)}</b>
            </td>`;
        } else {
          html += `<td style="border-left: 3px double #adb5bd;"></td>`;
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

        recent.forEach(({ score, par }, index) => {
          html += `
            <td style="padding: 3px; width: 36px; line-height: 1; vertical-align: middle;">
              <span class="badge bg-scorecard-${this.getScoreClass(score - par)}" style="display: block; width: 30px; margin: 0 auto; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${score}</span>
            </td>`;
        });
        const pb = this.getPersonalBestScore(player, course, hole);
        html += `
          <td style="padding: 3px; width: 36px; line-height: 1; vertical-align: middle; border-left: 3px double #adb5bd;">
            <span class="badge bg-scorecard-${this.getScoreClass(pb.score - pb.par)}" style="display: block; width: 30px; margin: 0 auto; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${pb.score}</span>
          </td>`;

        html += `</tr>`;
      }

      html += `
        </tbody>
      </table>
    </details>`;
    });

    return html;
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
                  <tbody>`;

    player.playedCourses.forEach((course) => {
      playerString += `
      <tr>
        <th class="text-start-table-header-info">${course.course}</th>
        <th class="text-start">${course.layout}</th>
        <td>${course.count}</td>
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
                      <th class="text-start-table-header-info">Under Par</th>
                      <th><span class="badge bg-scorecard-birdie" style="display: inline-block; width: 11px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;"></span></th>
                      <td>${player.devFromParPerHole[-1]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">Par</th>
                      <th><span class="badge bg-scorecard-par" style="display: inline-block; width: 11px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;"> </span></th>
                      <td>${player.devFromParPerHole["0"]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">Bogey</th>
                      <th><span class="badge bg-scorecard-bogey" style="display: inline-block; width: 11px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;"> </span></th>
                      <td>${player.devFromParPerHole["1"]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">Double Bogey</th>
                      <th><span class="badge bg-scorecard-doublebogey" style="display: inline-block; width: 11px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;"> </span></th>
                      <td>${player.devFromParPerHole["2"]}</td>
                    </tr>
                    <tr>
                      <th class="text-start-table-header-info">3+</th>
                      <th><span class="badge bg-scorecard-plusthree" style="display: inline-block; width: 11px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;"> </span></th>
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

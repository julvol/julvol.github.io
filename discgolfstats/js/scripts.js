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
    this.matches = {};
    this.players = {};

    // add hole length sets for new layouts here
    this.holeLengthsSets = [
      {
        course: "Aachen Kronenbergpark",
        layout: "Main",
        lengths: [96, 61, 40, 61, 112, 58, 36, 77, 44],
      },
      {
        course: "Aachen Kronenbergpark",
        layout: "Newcomer 18",
        lengths: [
          96, 61, 40, 61, 112, 58, 36, 64, 63, 77, 30, 37, 44, 80, 82, 44, 48,
          15,
        ],
      },
      {
        course: "Aachen Kronenbergpark",
        layout: "Rotkehlchen",
        lengths: [
          91, 97, 66, 91, 32, 66, 53, 40, 59, 99, 50, 90, 55, 107, 91, 60, 52,
          41,
        ],
      },
      {
        course: "Aachen Kronenbergpark",
        layout: "Andalucia Nueva",
        lengths: [
          91, 61, 40, 66, 91, 58, 53, 40, 59, 99, 37, 44, 80, 55, 50, 100, 52,
          48,
        ],
      },
      {
        course: "Aachen Kronenbergpark",
        layout: "Aixpert 18",
        lengths: [
          96, 61, 40, 61, 112, 58, 63, 75, 70, 107, 73, 82, 152, 59, 82, 155,
          80, 172,
        ],
      },
      {
        course: "Aachen Kronenbergpark",
        layout: "Phoenix",
        lengths: [
          73, 76, 98, 93, 79, 88, 152, 83, 112, 75, 63, 157, 81, 77, 74, 145,
          186, 231,
        ],
      },
      {
        course: "Aachen Kronenbergpark",
        layout: "Pinguin",
        lengths: [
          60, 93, 81, 56, 76, 91, 59, 67, 77, 56, 63, 107, 56, 118, 69, 115, 86,
          88,
        ],
      },
      {
        course: "Discgolfpark Herzogenrath",
        layout: "Main",
        lengths: [64, 52, 60, 41, 77, 101, 56, 64],
      },
      {
        course: "Discgolfpark Herzogenrath",
        layout: "Main + Six",
        lengths: [64, 52, 60, 41, 43, 64, 55, 61, 77, 101, 56, 64, 63, 117],
      },
      {
        course: "Discgolfpark Herzogenrath",
        layout: "Eurode 18",
        lengths: [
          64, 52, 65, 41, 43, 60, 75, 64, 48, 61, 77, 101, 56, 64, 63, 117, 85,
          50,
        ],
      },
      {
        course: "Discgolfpark Station As",
        layout: "Main",
        lengths: [50, 35, 52, 36, 41, 39, 28, 37, 96],
      },
      {
        course: "Discgolfpark Station As",
        layout: "Main 9 X 2",
        lengths: [
          50, 35, 52, 36, 41, 39, 28, 37, 96, 50, 35, 52, 36, 41, 39, 28, 37,
          96,
        ],
      },
    ];
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

    // we always have (1 header row + 1 par row + 1 row for each player) per match
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
        let howManyHoles = row.c?.length - 8;
        let isStillLessHoles = true;
        while (isStillLessHoles) {
          if (row.c[howManyHoles + 7]?.v == null) {
            howManyHoles--;
          } else {
            isStillLessHoles = false;
          }
        }

        const startTimeAsDate = new Date(
          row.c[3]?.v.replace(/(\d{2})(\d{2})$/, "$1:$2"),
        );
        const endTimeAsDate = new Date(
          row.c[4]?.v.replace(/(\d{2})(\d{2})$/, "$1:$2"),
        );

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

    console.log(this.matches);
    Object.values(this.matches)
      .sort((a, b) => a.startTime - b.startTime)
      .forEach((match) => this.getStatsString(match));

    Object.values(this.players)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((player) => this.getPlayerString(player));
  }

  formatDuration(start, end) {
    console.log(start);
    const diffMs = end - start; // difference in milliseconds

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h${minutes.toString().padStart(2, "0")}min`;
  }

  formatDateStringForStatsStringHeader(date) {
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
                </table>
              </div>
            </div>
          </div>`;

    document.getElementById("playersAccordion").innerHTML += playerString;
  }

  getStatsString(match) {
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
            <h4>${match.course} (${match.layout}) - ${this.formatDateStringForStatsStringHeader(match.startTime)}</h4>
            <h5 class="mb-3">Ergebnis</h5>
            <table
              class="table table-dark table-bordered text-center align-middle w-auto"
            >
              <tbody>`;
    Object.entries(match.players)
      .sort((a, b) => a[1].devFromPar - b[1].devFromPar)
      .forEach(([playerKey, playerVal]) => {
        if (playerKey === "Par") return;
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
              <h5 class="mb-3">Scorecard</h5>

              <table
                class="table table-dark table-borderless text-center align-middle w-auto"
              >
                <thead class="border-bottom">
                  <tr>
                    <th class="text-start-table-header-info">Bahn</th>`;
    for (let i = 1; i <= match.holes; i++) {
      statsString += `<th>${i}</th>`;
    }
    statsString += `
        </tr>
                  `;
    if (match.holeLengths) {
      statsString += `<tr>
                    <th class="text-start-table-header-info">Länge</th>`;
      for (let i = 0; i < match.holes; i++) {
        statsString += `<td style="padding-left: 3px; padding-right: 3px; width: 30px">${match.holeLengths[i]}</td>`;
      }

      statsString += `</tr>`;
    }
    statsString += `
                  <tr>
                    <th class="text-start-table-header-info">Par</th>`;
    for (let i = 0; i < match.holes; i++) {
      statsString += `<td>${match.players["Par"].holes[i]}</td>`;
    }
    statsString += `
        </tr>
                </thead>

                <tbody>`;

    Object.entries(match.players)
      .sort((a, b) => a[1].devFromPar - b[1].devFromPar)
      .forEach(([playerKey, playerVal]) => {
        if (playerKey === "Par") return;
        statsString += `
        <tr>
                    <th class="text-start">${playerKey}</th>`;

        for (let i = 0; i < match.holes; i++) {
          const devFromParOnThisHole =
            playerVal.holes[i] - match.players["Par"].holes[i];
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
          statsString += `
            <td style="padding: 3px; width: 30px">
                      <span class="badge bg-scorecard-${classToAssign}" style="display: inline-block; width: 30px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${playerVal.holes[i]}</span>
                    </td>`;
        }
        statsString += `</tr>`;
      });
    statsString += `
                </tbody>
              </table>
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

  initialize() {
    this.loadTableData();
  }
}

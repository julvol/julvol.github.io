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
    let rows = jsonData.table.rows;
    console.log(rows);
    rows.forEach((row) => {
      if (row.c[3]?.v === "StartDate") {
        return;
      } else if (row.c[3]?.v in this.matches) {
        // new player for existing match found --> add to corresponding match
        let newPlayer = {
          total: row.c[5]?.v,
          devFromPar: row.c[6]?.v,
          holes: [],
        };
        for (let i = 1; i <= this.matches[row.c[3]?.v].holes; i++) {
          newPlayer.holes.push(row.c[7 + i]?.v);
        }

        this.matches[row.c[3]?.v].players[row.c[0]?.v] = newPlayer;
      } else {
        // new match found. Add too object. We are now in the par row
        const howManyHoles = row.c?.length - 8;

        let match = {
          startTime: row.c[3]?.v,
          endTime: row.c[4]?.v,
          course: row.c[1]?.v,
          layout: row.c[2]?.v,
          par: row.c[5]?.v,
          holes: howManyHoles,
          players: {},
        };
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
    console.log(this.matches);
    Object.values(this.matches).forEach((match) => this.getStatsString(match));
  }

  getStatsString(match) {
    let statsString = `
        <div
          class="d-flex justify-content-start justify-content-md-center mt-4"
          style="margin-bottom: 20px"
        >
          <div
            class="bg-dark text-white p-3 rounded d-inline-block"
            style="cursor: pointer"
            data-bs-toggle="collapse"
            data-bs-target="#scorecard-collapsing-${match.startTime.replace(/\s/g, "")}"
          >
            <h4>${match.course} (${match.layout}) - ${match.startTime}</h4>
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
            <td><b style="color: #fd6c2e">+${playerVal.devFromPar}</b> (${playerVal.total})</td>
        </tr>`;
      });
    statsString += `
        </tbody>
            </table>
            <div class="collapse" id="scorecard-collapsing-${match.startTime.replace(/\s/g, "")}">
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
                  <tr>
                    <th class="text-start-table-header-info">Länge</th>
                    <td>96</td>
                    <td>61</td>
                    <td>40</td>
                    <td>61</td>
                    <td>112</td>
                    <td>58</td>
                    <td>36</td>
                    <td>77</td>
                    <td>44</td>
                  </tr>
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
          } else {
            classToAssign = "plusthree";
          }
          statsString += `
            <td>
                      <span class="badge bg-scorecard-${classToAssign}">${playerVal.holes[i]}</span>
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
    console.log(statsString);
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

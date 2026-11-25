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

const SCORE_CATEGORIES = [
  { key: "-1", label: "Unter", cls: "birdie", matches: (d) => d <= -1 },
  { key: "0", label: "Par", cls: "par", matches: (d) => d === 0 },
  { key: "1", label: "Bogey", cls: "bogey", matches: (d) => d === 1 },
  { key: "2", label: "Double", cls: "doublebogey", matches: (d) => d === 2 },
  { key: "3+", label: "3+", cls: "plusthree", matches: (d) => d >= 3 },
];

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
    // weather of the opened matches by start time in ms (see loadMatchWeather)
    this.matchWeather = new Map();

    // add hole length sets for new layouts here
    this.holeLengthsSets = [];

    // currently for the following Layouts:
    // Aachen Kronenbergpark (Main, Newcomer 18, Advanced Newcomer, Rotkehlchen, Andalucia Nueva, Aixpert 18, Pinguin, Phoenix, Spaßvogel)
    // Discgolfpark Herzogenrath (Main, Main + Six, Eurode 18)
    // Discgolfpark Station As (Main, Main 9 X 2)
    // Discgolfpark Rheindahlen (De Kull Main Am, De Kull Main, De Kull Safari)
    this.isomorphHoles = [];

    // for unique ids of the "identische Bahnen" switches
    this.variantSwitchCount = 0;
  }

  getURL(range) {
    return `https://docs.google.com/spreadsheets/d/${this.sheetID}/gviz/tq?sheet=${this.sheetName}range=${range}`;
  }

  fetchAndRenderData(url, cacheKey, renderFunction) {
    return fetch(url)
      .then((res) => res.text())
      .then((rep) => JSON.parse(rep.substr(47).slice(0, -2)))
      .then(
        (jsonData) => {
          // Speichere die Daten im Cache (localStorage)
          let cacheData = {
            data: jsonData,
            expiry: Date.now() + this.cacheDuration,
            savedAt: Date.now(),
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));

          // Rendere die Tabelle mit den Daten
          return renderFunction(jsonData);
        },
        (error) => {
          console.error("Fehler beim Abrufen der Daten: ", error);
          return this.renderLastData(cacheKey, renderFunction);
        },
      );
  }

  // offline (or the sheet is unavailable): show the last loaded data, even if it's old
  renderLastData(cacheKey, renderFunction) {
    const notice = document.getElementById("offlineNotice");
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey));
    } catch (error) {}

    notice.hidden = false;
    if (!cached?.data) {
      notice.textContent =
        "Keine Verbindung – die Partien konnten nicht geladen werden.";
      return;
    }
    // older cache entries have no savedAt, but their expiry tells the same
    const savedAt = cached.savedAt ?? cached.expiry - this.cacheDuration;
    const time = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(savedAt);
    notice.textContent = `Keine Verbindung – angezeigt werden die Daten vom ${this.formatDate(savedAt)}, ${time} Uhr.`;
    renderFunction(cached.data);
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

  // a comment row in the sheet: text in column A only (no course and no start date);
  // completely empty rows are not delivered by the sheet at all
  isCommentRow(row) {
    return (
      row.c[1]?.v == null &&
      row.c[3]?.v == null &&
      String(row.c[0]?.v ?? "").trim() !== ""
    );
  }

  // text of a comment row; "Unranked" at the start marks the match as unranked
  // (e.g. "Unranked: Sturm"), the rest is the comment
  parseCommentRow(row) {
    const text = String(row.c[0].v).trim();
    const match = text.match(/^unranked\b[\s:,;.\-–—]*/i);
    if (!match) return { unranked: false, comment: text };
    return { unranked: true, comment: text.slice(match[0].length).trim() };
  }

  // matches that count for the statistics (unranked matches are only in the match list)
  getRankedMatches() {
    return Object.values(this.matches).filter((m) => !m.unranked);
  }

  renderMatchesStats(jsonData) {
    let rows = jsonData.table.rows;

    // start dates (= match keys) of unranked matches; their comment row comes after the
    // player rows, so they have to be known before the rows are processed
    const unrankedMatchKeys = new Set();
    let previousStartDate = null;
    rows.forEach((row) => {
      if (this.isCommentRow(row)) {
        if (this.parseCommentRow(row).unranked && previousStartDate != null) {
          unrankedMatchKeys.add(previousStartDate);
        }
      } else {
        previousStartDate = row.c[3]?.v;
      }
    });

    rows.forEach((row) => {
      let howManyHoles = this.howManyHolesHasLayout(row);
      if (
        row.c[3]?.v === "StartDate" ||
        this.isCommentRow(row) ||
        unrankedMatchKeys.has(row.c[3]?.v) // unranked: not in the course stats
      ) {
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

    // we always have (1 header row + 1 par row + 1 row for each player) per match in the sheet,
    // optionally followed by a comment row (text in column A only) for the match above it
    let lastMatchKey = null;
    rows.forEach((row) => {
      if (row.c[3]?.v === "StartDate") {
        return;
      } else if (this.isCommentRow(row)) {
        if (lastMatchKey in this.matches) {
          const { comment } = this.parseCommentRow(row);
          if (comment) this.matches[lastMatchKey].comment = comment;
        }
        return;
      } else if (row.c[3]?.v in this.matches) {
        // new player for existing match found --> add to corresponding match
        // unranked match: only in the match list, not in the player stats
        const counts = !this.matches[row.c[3]?.v].unranked;

        // first check if player is already in this.players. Add otherwise
        if (counts && !(row.c[0]?.v in this.players)) {
          // player is not yet in this.players --> add
          let newPlayer = {
            name: row.c[0]?.v,
            playedCoursesCount: 0,
            devs: [], // dev from par per hole
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
            if (counts) {
              this.players[row.c[0]?.v].playedHolesCount++;
              this.players[row.c[0]?.v].devs.push(
                row.c[7 + i]?.v -
                  this.matches[row.c[3]?.v].players["Par"].holes[i - 1],
              );
            }
          } else {
            // player has not played the hole
            newPlayerForMatch.howManyHolesNotPlayedInThisMatch++;
            newPlayerForMatch.holes.push("-");
            // unplayed hole: nothing is added
          }
        }
        if (counts) {
          this.players[row.c[0]?.v].playedCoursesCount++;
          this.players[row.c[0]?.v].playedCourses.push({
            course: row.c[1]?.v,
            layout: row.c[2]?.v,
          });
        }

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
          unranked: unrankedMatchKeys.has(row.c[3]?.v),
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
        lastMatchKey = row.c[3]?.v;
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
      // grouped by course: most played course first, within a course the
      // standard layout first, then the most played layout; ties
      // alphabetically by course, then layout
      const courseCounts = {};
      playedCoursesCounts.forEach(({ course, count }) => {
        courseCounts[course] = (courseCounts[course] ?? 0) + count;
      });
      playedCoursesCounts.sort(
        (a, b) =>
          courseCounts[b.course] - courseCounts[a.course] ||
          a.course.localeCompare(b.course, "de") ||
          this.isStandardLayout(b.course, b.layout) -
            this.isStandardLayout(a.course, a.layout) ||
          b.count - a.count ||
          a.course.localeCompare(b.course, "de") ||
          a.layout.localeCompare(b.layout, "de"),
      );
      player.playedCourses = playedCoursesCounts;

      player.devFromParPerHole = this.createDistribution(player.devs);
      delete player.devs; // not needed anymore
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
      .forEach((match) => this.getMatchesString(match));

    console.log(this.players);
    Object.values(this.players)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((player) => this.getPlayerString(player));

    console.log(this.courses);
    this.getCourseGroups().forEach((layouts) =>
      this.renderCourseGroup(layouts),
    );

    this.renderRecords();
    this.renderActivityCalendar();

    // popover content inline style is restricted by Bootstrap; allow inline styles on <span> only
    bootstrap.Popover.Default.allowList.span = ["style"];

    // initialize popovers once all player HTML exists
    document
      .querySelectorAll(
        '#playersAccordion [data-bs-toggle="popover"], #coursesAccordion [data-bs-toggle="popover"], #partien-container [data-bs-toggle="popover"]',
      )
      .forEach((el) => new bootstrap.Popover(el));

    // show the distribution cells of a match only while its scorecard is expanded
    const setDistributionCellsVisible = (collapseElement, visible) => {
      document
        .querySelectorAll(`[data-scorecard-id="${collapseElement.id}"]`)
        .forEach((td) => (td.style.display = visible ? "table-cell" : "none"));
    };
    const partienContainer = document.getElementById("partien-container");
    partienContainer.addEventListener("show.bs.collapse", (e) => {
      setDistributionCellsVisible(e.target, true);
      // Bootstrap makes the scorecard measurable right after this event, still before it is painted
      queueMicrotask(() => this.fitScorecardNames(e.target));
    });
    partienContainer.addEventListener("hide.bs.collapse", (e) =>
      setDistributionCellsVisible(e.target, false),
    );
    window.addEventListener("resize", () =>
      partienContainer
        .querySelectorAll(".collapse.show")
        .forEach((el) => this.fitScorecardNames(el)),
    );

    // a search term from the link has to be in the field before the filter is set up
    const linkedSearch = new URLSearchParams(window.location.search).get(
      "suche",
    );
    if (linkedSearch)
      document.getElementById("matchFilter").value = linkedSearch;
    // the same for the order of the matches
    const linkedSort = new URLSearchParams(window.location.search).get(
      "sortierung",
    );
    const sortSelect = document.getElementById("matchSort");
    if ([...sortSelect.options].some((o) => o.value === linkedSort))
      sortSelect.value = linkedSort;

    this.setupMatchFilter();
    this.setupMatchSort();
    this.setupHoleSort();
    this.setupActivityCalendar();
    this.setupMatchWeather(); // before the links, so a linked match loads its weather
    this.setupCurrentWeather(); // the same for a linked course
    this.setupScoreHistoryCharts(); // before the links, so a linked player gets the chart drawn
    this.setupShareableLinks();

    // switches like "identische Bahnen einbeziehen": show the matching variant
    document.addEventListener("change", (e) => {
      if (!e.target.classList.contains("variant-switch")) return;
      e.target
        .closest(".variant-toggle")
        .querySelectorAll(":scope > [data-variant]")
        .forEach((variant) =>
          variant.classList.toggle(
            "d-none",
            (variant.dataset.variant === "on") !== e.target.checked,
          ),
        );
    });
  }

  // filter field above the matches: every word of the input has to match (AND)
  // - date words are compared exactly: 15.03.2025, 03.2025 / 3.2025, 2025
  // - all other words are searched in course, layout and player names (case-insensitive)
  setupMatchFilter() {
    const input = document.getElementById("matchFilter");
    const info = document.getElementById("matchFilterInfo");
    const cards = [
      ...document.querySelectorAll("#partien-container .match-card"),
    ];

    const pad = (n) => n.padStart(2, "0");
    const matchesTerm = (card, term) => {
      const dates = card.dataset.filterDates.split(" ");
      let m;
      if ((m = term.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)))
        return dates.includes(`${pad(m[1])}.${pad(m[2])}.${m[3]}`);
      if ((m = term.match(/^(\d{1,2})\.(\d{4})$/)))
        return dates.includes(`${pad(m[1])}.${m[2]}`);
      if (/^\d{4}$/.test(term)) return dates.includes(term);
      return card.dataset.filterText.includes(term);
    };

    const applyFilter = () => {
      const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      let visibleCount = 0;
      cards.forEach((card) => {
        const visible = terms.every((term) => matchesTerm(card, term));
        card.classList.toggle("filtered-out", !visible);
        if (visible) visibleCount++;
      });
      info.textContent =
        terms.length === 0
          ? ""
          : visibleCount === 0
            ? "Keine Partien gefunden"
            : `${visibleCount} von ${cards.length} Partien`;
      this.updateActivityCalendar();
    };

    input.addEventListener("input", applyFilter);

    // magnifying glass: opens the search field; closes it again if it is empty
    const box = document.getElementById("matchFilterBox");
    const toggle = document.getElementById("matchFilterToggle");
    const setOpen = (open) => {
      box.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open);
      input.tabIndex = open ? 0 : -1;
    };
    // keep the focus in the field, so clicking the icon does not trigger the blur below first
    toggle.addEventListener("mousedown", (e) => e.preventDefault());
    toggle.addEventListener("click", () => {
      if (box.classList.contains("open") && input.value === "") {
        setOpen(false);
        input.blur();
      } else {
        setOpen(true);
        input.focus();
      }
    });
    input.addEventListener("blur", () => {
      if (input.value === "") setOpen(false);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      input.value = "";
      // an input event (not applyFilter directly), so the link in the URL is updated too
      input.dispatchEvent(new Event("input"));
      setOpen(false);
      input.blur();
    });

    applyFilter(); // in case the browser restored a value
    if (input.value !== "") setOpen(true);

    // used by the activity calendar: show the matches of one day
    this.setMatchFilter = (value) => {
      input.value = value;
      input.dispatchEvent(new Event("input"));
      setOpen(value !== "");
    };
  }

  // ---------------------------------------------------------------------------
  // Activity calendar (open item #14): a GitHub-style grid of the ranked matches per day at
  // the top of the matches, one grid per year (buttons to switch, the latest year first).
  // Columns are weeks (Monday to Sunday), days with at least one match are darker. The whole
  // year is drawn; today has a red border.
  // Days with matches show the courses on hover / tap; clicking one filters the matches.
  // Only the matches shown in the match list (see the match filter) are marked; the number
  // of matches per year above the grid stays the same.
  // On narrow screens the boxes shrink, so the whole year fits the width (see styles.css).

  renderActivityCalendar() {
    const container = document.getElementById("activityCalendar");
    const matches = this.getRankedMatches().sort(
      (a, b) => a.startTime - b.startTime,
    );
    if (matches.length === 0) return;

    const pad = (n) => String(n).padStart(2, "0");
    const dayKey = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const matchesByDay = new Map();
    matches.forEach((match) => {
      const key = dayKey(match.startTime);
      if (!matchesByDay.has(key)) matchesByDay.set(key, []);
      matchesByDay.get(key).push(match);
    });

    const years = [
      ...new Set(matches.map((m) => m.startTime.getFullYear())),
    ].sort((a, b) => b - a);
    const today = new Date();
    const WEEKDAYS = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];
    const MONTHS = [
      "Jan",
      "Feb",
      "Mär",
      "Apr",
      "Mai",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Okt",
      "Nov",
      "Dez",
    ];
    const partien = (n) => `${n} ${n === 1 ? "Partie" : "Partien"}`;
    this.activityDays = new Map(); // "03.10.2026" -> { label, matches: [{ link, course }] }

    const getYearString = (year) => {
      // the grid starts on the Monday of the week of January 1st
      const first = new Date(year, 0, 1);
      const start = new Date(year, 0, 1 - ((first.getDay() + 6) % 7));
      let months = "";
      let cells = "";
      let total = 0;
      let week = 0;
      for (
        let d = new Date(start), i = 0;
        d.getFullYear() <= year;
        d = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + ++i,
        )
      ) {
        const weekday = (d.getDay() + 6) % 7; // Monday = 0
        week = Math.floor(i / 7);
        // the name of a month above the first week that starts in it
        if (weekday === 0 && d.getFullYear() === year && d.getDate() <= 7)
          months += `<span class="activity-month" style="grid-column: ${week + 2};">${MONTHS[d.getMonth()]}</span>`;
        // days of the year before or after: no cell
        if (d.getFullYear() !== year) continue;
        const todayClass = dayKey(d) === dayKey(today) ? " activity-today" : "";

        const dayMatches = matchesByDay.get(dayKey(d)) ?? [];
        total += dayMatches.length;
        const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${year}`;
        const position = `grid-column: ${week + 2}; grid-row: ${weekday + 2};`;
        if (dayMatches.length === 0) {
          cells += `<span class="activity-day${todayClass}" style="${position}" title="Keine Partie am ${WEEKDAYS[d.getDay()]} ${date}"></span>`;
          continue;
        }
        const label = `${WEEKDAYS[d.getDay()]} ${date}`;
        this.activityDays.set(date, {
          label,
          matches: dayMatches.map((m) => ({
            link: this.getMatchLinkValue(m),
            course: this.escapeHtml(`${m.course} (${m.layout})`),
          })),
        });
        cells += `<span class="activity-day${todayClass}" style="${position}" data-day="${date}"
          ${this.getPopoverAttributes(label)}
        ></span>`;
      }
      const weekdays = ["Mo", "Mi", "Fr", "So"] // every other row: Monday, Wednesday, …
        .map(
          (name, i) =>
            `<span class="activity-weekday" style="grid-row: ${i * 2 + 2};">${name}</span>`,
        )
        .join("");
      return `
        <div class="activity-year${year === years[0] ? "" : " d-none"}" data-year="${year}">
          <div class="activity-summary">${partien(total)} in ${year}</div>
          <div class="activity-grid" style="--weeks: ${week + 1};">
            ${months}${weekdays}${cells}
          </div>
        </div>`;
    };

    const yearButtons =
      years.length < 2
        ? ""
        : `<div class="activity-years">${years
            .map(
              (year, i) =>
                `<button type="button" class="btn btn-sm ${i === 0 ? "btn-secondary" : "btn-outline-secondary"}" data-year="${year}">${year}</button>`,
            )
            .join("")}</div>`;
    container.innerHTML = yearButtons + years.map(getYearString).join("");
  }

  // marks the days with matches that the match list shows (not filtered out) and puts
  // only those matches in their popovers; the other days look like days without a match
  updateActivityCalendar() {
    if (!this.activityDays) return;
    const shownMatches = new Set(
      [
        ...document.querySelectorAll(
          '#partien-container .match-card:not(.filtered-out) [data-link-param="partie"]',
        ),
      ].map((el) => el.dataset.linkValue),
    );
    document
      .querySelectorAll("#activityCalendar [data-day]")
      .forEach((cell) => {
        const { label, matches } = this.activityDays.get(cell.dataset.day);
        const shown = matches.filter((m) => shownMatches.has(m.link));
        const popover = bootstrap.Popover.getInstance(cell);
        cell.classList.toggle("activity-played", shown.length > 0);
        if (shown.length === 0) {
          delete cell.dataset.filterDate; // not clickable
          cell.title = `Keine Partie am ${label}`;
          popover?.hide();
          popover?.disable();
          return;
        }
        cell.dataset.filterDate = cell.dataset.day;
        cell.removeAttribute("title");
        popover?.enable();
        const content = `<b>${shown.length} ${shown.length === 1 ? "Partie" : "Partien"}</b> am ${label}<br>${shown.map((m) => m.course).join("<br>")}`;
        if (cell.dataset.content !== content) {
          cell.dataset.content = content;
          popover?.setContent({ ".popover-body": content });
        }
      });
  }

  setupActivityCalendar() {
    const container = document.getElementById("activityCalendar");
    this.updateActivityCalendar(); // the filter may already be set (link or restored value)

    container.addEventListener("click", (e) => {
      const button = e.target.closest(".activity-years button");
      if (button) {
        container.querySelectorAll(".activity-years button").forEach((b) => {
          b.classList.toggle("btn-secondary", b === button);
          b.classList.toggle("btn-outline-secondary", b !== button);
        });
        container
          .querySelectorAll(".activity-year")
          .forEach((year) =>
            year.classList.toggle(
              "d-none",
              year.dataset.year !== button.dataset.year,
            ),
          );
        return;
      }
      // a day with matches: show them below
      const day = e.target.closest("[data-filter-date]");
      if (day) this.setMatchFilter(day.dataset.filterDate);
    });
  }

  // dropdown next to the search: order of the match cards. Ties (and matches without a
  // completed round when sorting by result) are ordered newest first.
  //   neu: date new -> old (default)   alt: date old -> new
  //   spieler: most players first      ergebnis: best winning deviation from par first
  setupMatchSort() {
    const select = document.getElementById("matchSort");
    const container = document.getElementById("partien-container");
    const cards = [...container.querySelectorAll(".match-card")];

    const newestFirst = (a, b) => b.dataset.start - a.dataset.start;
    const winningDev = (card) =>
      card.dataset.winningDev === ""
        ? Infinity
        : Number(card.dataset.winningDev);
    const compare = {
      alt: (a, b) => a.dataset.start - b.dataset.start,
      neu: newestFirst,
      spieler: (a, b) =>
        b.dataset.playerCount - a.dataset.playerCount || newestFirst(a, b),
      ergebnis: (a, b) => winningDev(a) - winningDev(b) || newestFirst(a, b),
    };

    const applySort = () => {
      // append() moves the cards; they are the last elements in the container
      container.append(
        ...[...cards].sort(compare[select.value] ?? compare.neu),
      );
    };
    select.addEventListener("change", applySort);
    applySort();

    const fitWidth = () => this.fitSelectWidth(select);
    select.addEventListener("change", fitWidth);
    fitWidth();
    // the web font may arrive after the first measurement
    document.fonts?.ready.then(fitWidth);
  }

  // a <select> is as wide as its longest option: fit it to the chosen one instead
  fitSelectWidth(select) {
    const style = getComputedStyle(select);
    const text = select.options[select.selectedIndex]?.text ?? "";
    this.selectWidthCanvas ??= document.createElement("canvas");
    const ctx = this.selectWidthCanvas.getContext("2d");
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const extra = [
      "paddingLeft",
      "paddingRight",
      "borderLeftWidth",
      "borderRightWidth",
    ].reduce((sum, prop) => sum + parseFloat(style[prop]), 0);
    select.style.width = `${Math.ceil(ctx.measureText(text).width + extra) + 2}px`;
  }

  // order of two holes in the "Bahnen" table of a layout: shortest, lowest par or easiest
  // first; holes without that value last; ties (and "bahn") by hole number
  compareHoles(sort, a, b) {
    const key = { laenge: "length", par: "par", schwierigkeit: "difficulty" }[
      sort
    ];
    if (key) {
      const [valueA, valueB] = [a[key], b[key]];
      if ((valueA === null) !== (valueB === null))
        return valueA === null ? 1 : -1;
      if (valueA !== valueB) return valueA - valueB;
    }
    return a.hole - b.hole;
  }

  // dropdown above the "Bahnen" table; sorts both variants of the isomorph switch
  setupHoleSort() {
    const selects = [...document.querySelectorAll(".hole-sort")];
    const fitAll = () => selects.forEach((s) => this.fitSelectWidth(s));
    fitAll();
    document.fonts?.ready.then(fitAll);

    const number = (value) => (value === "" ? null : Number(value));
    const getHole = (row) => ({
      row,
      hole: Number(row.dataset.hole),
      length: number(row.dataset.length),
      par: number(row.dataset.par),
      difficulty: number(row.dataset.difficulty),
    });
    document.addEventListener("change", (e) => {
      if (!e.target.classList.contains("hole-sort")) return;
      this.fitSelectWidth(e.target);
      e.target
        .closest(".hole-stats")
        .querySelectorAll("tbody")
        .forEach((tbody) => {
          const holes = [...tbody.rows].map(getHole);
          holes.sort((a, b) => this.compareHoles(e.target.value, a, b));
          tbody.append(...holes.map((h) => h.row));
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Weather per match (open item #23): a "Wetter" line in the opened match card with the
  // temperature, sky, wind and rain while the match was played. Loaded from Open-Meteo
  // (free, no account) the first time the card is opened, using the course's coordinates
  // from course_data/course_coordinates.csv. Courses without coordinates show no line.
  // The match times are read as local times of the viewer, which is fine as long as viewer
  // and course are in the same time zone. The weather is asked for in UTC: with
  // timezone=auto, Open-Meteo's archive used UTC+1 also in summer (one hour off).

  // the list item, filled by loadMatchWeather
  getWeatherListItem(match) {
    const coordinates = this.courseCoordinates?.get(match.course);
    if (!coordinates) return "";
    return `<li class="match-weather"
      data-latitude="${coordinates.latitude}"
      data-longitude="${coordinates.longitude}"
      data-start="${match.startTime.getTime()}"
      data-end="${match.endTime.getTime()}"
    >Wetter wird geladen …</li>`;
  }

  setupMatchWeather() {
    document
      .getElementById("partien-container")
      .addEventListener("show.bs.collapse", (e) => {
        const item = e.target.querySelector(
          ":scope > ul > .match-weather:not([data-loaded])",
        );
        if (!item) return;
        item.dataset.loaded = "";
        this.loadMatchWeather(item).catch((error) => {
          console.error("Error while loading the weather: ", error);
          item.textContent = "Wetter nicht verfügbar";
          delete item.dataset.loaded; // try again the next time it is opened
        });
      });
  }

  async loadMatchWeather(item) {
    const start = Number(item.dataset.start);
    const end = Number(item.dataset.end);
    const { latitude, longitude } = item.dataset;
    const HOUR = 60 * 60 * 1000;
    // in UTC: "2026-11-13" and "2026-11-13T14:00", like Open-Meteo's times with timezone=GMT
    const day = (ms) => new Date(ms).toISOString().slice(0, 10);
    const hourKey = (ms) => `${new Date(ms).toISOString().slice(0, 13)}:00`;
    const hoursBetween = (from, to) => {
      const keys = [];
      for (let t = from; t <= to; t += HOUR) keys.push(hourKey(t));
      return keys;
    };

    // older matches don't change any more: keep their weather in the browser
    const ageInDays = (Date.now() - end) / (24 * HOUR);
    // "utc": entries saved before the switch to UTC may be an hour off in summer
    const cacheKey = `weather-utc:${latitude},${longitude},${start}`;
    let hourly = null;
    try {
      hourly = JSON.parse(localStorage.getItem(cacheKey));
    } catch {}

    if (!hourly) {
      // the archive is a few days behind: recent matches come from the forecast API
      const endpoint =
        ageInDays > 30
          ? "https://archive-api.open-meteo.com/v1/archive"
          : "https://api.open-meteo.com/v1/forecast";
      const params = new URLSearchParams({
        latitude,
        longitude,
        start_date: day(start),
        end_date: day(end + HOUR), // the end is rounded up to the next full hour
        hourly:
          "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
        timezone: "GMT",
      });
      const response = await fetch(`${endpoint}?${params}`);
      if (!response.ok) throw new Error(`Open-Meteo: HTTP ${response.status}`);
      hourly = (await response.json()).hourly;
      if (ageInDays > 7)
        try {
          localStorage.setItem(cacheKey, JSON.stringify(hourly));
        } catch {}
    }

    const valuesAt = (keys, name) =>
      keys
        .map((key) => hourly[name]?.[hourly.time.indexOf(key)])
        .filter((v) => typeof v === "number");

    // the full hours closest to start and end. The precipitation of a full hour is the
    // one of the hour before it, so the rain uses the hours that end during the match.
    const roundHour = (ms) => Math.round(ms / HOUR) * HOUR;
    const firstRainHour = Math.floor(start / HOUR) * HOUR + HOUR;
    const hours = hoursBetween(roundHour(start), roundHour(end));
    const rainHours = hoursBetween(
      firstRainHour,
      Math.max(Math.ceil(end / HOUR) * HOUR, firstRainHour),
    );

    const temperatures = valuesAt(hours, "temperature_2m").map(Math.round);
    if (temperatures.length === 0)
      throw new Error("Open-Meteo: no data for this time");
    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);
    const wind = valuesAt(hours, "wind_speed_10m");
    const gusts = valuesAt(hours, "wind_gusts_10m");
    // the worst weather during the match (higher WMO codes are worse)
    const codes = valuesAt(hours, "weather_code");
    const rain = valuesAt(rainHours, "precipitation").reduce(
      (a, b) => a + b,
      0,
    );

    const weather = {
      minTemp,
      maxTemp,
      code: codes.length ? Math.max(...codes) : null,
      wind: wind.length ? Math.max(...wind) : null,
      gusts: gusts.length ? Math.max(...gusts) : null,
      rain,
    };
    // kept for the image of the match (see getMatchImage)
    this.matchWeather.set(start, weather);
    item.textContent = this.formatWeather(weather);
  }

  // a Font Awesome icon (solid) for a WMO weather code (see getWeatherDescription)
  getWeatherIcon(code) {
    if (code <= 1) return "sun";
    if (code === 2) return "cloud-sun";
    if (code === 3) return "cloud";
    if (code <= 48) return "smog";
    if (code <= 63) return "cloud-rain";
    if (code <= 67) return "cloud-showers-heavy";
    if (code <= 77) return "snowflake";
    if (code <= 82) return "cloud-sun-rain";
    if (code <= 86) return "snowflake";
    return "cloud-bolt";
  }

  // e.g. "7 bis 8 °C, bewölkt, Wind 9 km/h (Böen 21 km/h), 0,4 mm Niederschlag";
  // values that are null are left out, the rain only from 0.1 mm on
  formatWeather({ minTemp, maxTemp, code, wind, gusts, rain }) {
    const parts = [
      minTemp === maxTemp ? `${minTemp} °C` : `${minTemp} bis ${maxTemp} °C`,
    ];
    if (code !== null) parts.push(this.getWeatherDescription(code));
    if (wind !== null)
      parts.push(
        `Wind ${Math.round(wind)} km/h` +
          (gusts !== null ? ` (Böen ${Math.round(gusts)} km/h)` : ""),
      );
    if (rain >= 0.1)
      parts.push(
        `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(rain)} mm Niederschlag`,
      );
    return parts.join(", ");
  }

  // ---------------------------------------------------------------------------
  // Weather forecast of a course: the weather of the next 90 minutes at the top of an opened
  // course, loaded from Open-Meteo for all courses in one request with the page (again for a
  // course when it is opened more than 15 minutes later).
  // If that is no disc golf weather (dark, rain or gusts over 30 km/h), the next 90 minutes
  // in daylight without rain and strong gusts are shown below it ("Nächstes Disc Golf-Wetter").

  getCurrentWeatherString(course) {
    const coordinates = this.courseCoordinates?.get(course.course);
    if (!coordinates) return "";
    return `
                <h5>Wetter in den nächsten 90 Minuten</h5>
                <p class="course-weather"
                  data-latitude="${coordinates.latitude}"
                  data-longitude="${coordinates.longitude}"
                >Wetter wird geladen …</p>
                <div class="course-weather-week"></div>
                <div class="course-weather-next"></div>`;
  }

  // loaded for all courses right away in one request (for the "Regen" / "Wind" tags on the
  // course names) and again for a course when it is opened more than 15 minutes later
  setupCurrentWeather() {
    const MAX_AGE = 15 * 60 * 1000;
    const fail = (item, error) => {
      console.error("Error while loading the weather forecast: ", error);
      item.textContent = "Wetter nicht verfügbar";
      item.nextElementSibling?.replaceChildren();
      item.nextElementSibling?.nextElementSibling?.replaceChildren();
      this.setCourseWeatherTags(item, null);
      delete item.dataset.loadedAt; // try again the next time it is opened
    };
    const load = async (items) => {
      const stale = items.filter(
        (item) => Date.now() - (Number(item.dataset.loadedAt) || 0) >= MAX_AGE,
      );
      if (!stale.length) return;
      stale.forEach((item) => (item.dataset.loadedAt = Date.now()));
      let forecasts;
      try {
        forecasts = await this.loadCourseForecasts(stale);
      } catch (error) {
        stale.forEach((item) => fail(item, error));
        return;
      }
      stale.forEach((item, i) => {
        try {
          this.showCurrentWeather(item, forecasts[i]);
        } catch (error) {
          fail(item, error);
        }
      });
    };
    const accordion = document.getElementById("coursesAccordion");
    load([...accordion.querySelectorAll(".course-weather")]);
    accordion.addEventListener("show.bs.collapse", (e) => {
      const item = e.target.querySelector(".course-weather");
      if (item) load([item]).finally(() => this.fitOpeningCollapse(e.target));
    });
  }

  // tags on the course name when the next 90 minutes are no disc golf weather because of
  // rain (blue) or wind (amber), like in the 4-day weather, a violet one when it gets dark during them
  // ("Dämmerung": day at the start, night at the end; no tag if it is night already);
  // weather null: no tags
  setCourseWeatherTags(item, weather, dusk = false) {
    const tags = item
      .closest(".accordion-item")
      ?.querySelector(".course-weather-tags");
    if (!tags) return;
    const labels = [];
    if (weather && this.isRainy(weather)) labels.push(["Regen", "rain"]);
    if (weather && this.isWindy(weather)) labels.push(["Wind", "wind"]);
    const tagElements = labels.map(([label, kind]) => {
      const tag = document.createElement("span");
      tag.className = `badge weather-badge weather-badge-${kind}`;
      tag.textContent = label;
      return tag;
    });
    if (weather && dusk) {
      const tag = document.createElement("span");
      tag.className = "badge weather-badge weather-badge-dusk";
      tag.textContent = "Dämmerung";
      tagElements.push(tag);
    }
    tags.replaceChildren(...tagElements);
  }

  // Bootstrap animates an opening section to the height it had when the animation started.
  // If content (e.g. the weather) grows during the animation, the content below it would be
  // cut off until the end and then pop up: let the animation run to the new height instead.
  fitOpeningCollapse(collapse) {
    // while closing, Bootstrap has cleared the height (it animates to 0): leave that alone
    if (collapse.classList.contains("collapsing") && collapse.style.height)
      collapse.style.height = `${collapse.scrollHeight}px`;
  }

  // the forecasts of these courses (.course-weather elements) in one request: 15-minute steps
  // from the current quarter hour on, for the next 7 days, in the order of the items;
  // the steps of today before that are in earlierToday (for the bar of today)
  async loadCourseForecasts(items) {
    const DAYS = 7;
    const PAST_STEPS = 96; // one day, so it always reaches back to midnight
    const params = new URLSearchParams({
      // several places: comma separated, the answer is then a list in the same order
      latitude: items.map((item) => item.dataset.latitude).join(","),
      longitude: items.map((item) => item.dataset.longitude).join(","),
      minutely_15:
        "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
      past_minutely_15: String(PAST_STEPS),
      forecast_minutely_15: String(DAYS * 96),
      timezone: "auto",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
    );
    if (!response.ok) throw new Error(`Open-Meteo: HTTP ${response.status}`);
    const data = await response.json();
    // one place: a single object instead of a list
    return (Array.isArray(data) ? data : [data]).map((place) =>
      this.splitEarlierSteps(place.minutely_15, PAST_STEPS),
    );
  }

  // steps with pastCount steps in front: the steps from now on, with today's earlier ones
  // in earlierToday
  splitEarlierSteps(steps, pastCount) {
    const today = steps?.time?.[pastCount]?.slice(0, 10);
    if (!today) return steps;
    const part = (from, to) =>
      Object.fromEntries(
        Object.entries(steps).map(([name, values]) => [
          name,
          values.slice(from, to),
        ]),
      );
    const midnight = steps.time.findIndex((time) => time.startsWith(today));
    return { ...part(pastCount), earlierToday: part(midnight, pastCount) };
  }

  // the steps from now on with today's earlier ones in front
  getStepsOfWholeToday(steps) {
    const earlier = steps.earlierToday;
    if (!earlier?.time.length) return steps;
    return Object.fromEntries(
      Object.keys(earlier).map((name) => [
        name,
        [...earlier[name], ...steps[name]],
      ]),
    );
  }

  showCurrentWeather(item, steps) {
    const SPAN = 7; // 7 steps cover 90 minutes
    const now = steps && this.getWeatherOfSteps(steps, 0, SPAN);
    if (!now) throw new Error("Open-Meteo: no forecast");
    // day at the start of the 90 minutes, night at their end
    const dusk =
      steps.is_day?.[0] === 1 && steps.is_day?.[SPAN - 1] === 0;
    this.setCourseWeatherTags(item, now, dusk);
    item.replaceChildren(
      this.getWeatherTimeSpan(steps, 0, SPAN),
      document.createElement("br"),
      this.formatWeather(now),
    );

    const week = item.nextElementSibling;
    const next = week?.nextElementSibling;
    if (!next) return;
    // only daylight is disc golf weather
    const isDaylight = (start) =>
      steps.is_day?.slice(start, start + SPAN).every((d) => d === 1) ?? false;
    if (isDaylight(0) && this.isDiscGolfWeather(now)) {
      week.innerHTML = this.getWeekWeatherString(steps);
      next.replaceChildren();
      return;
    }
    // the first 90 minutes in daylight (from a later quarter hour on) with disc golf weather
    let found = null;
    for (let start = 1; start + SPAN <= steps.time.length; start++) {
      if (!isDaylight(start)) continue;
      const weather = this.getWeatherOfSteps(steps, start, SPAN);
      if (weather && this.isDiscGolfWeather(weather)) {
        found = { start, weather };
        break;
      }
    }
    week.innerHTML = this.getWeekWeatherString(steps, found?.start);
    const heading = document.createElement("h5");
    heading.textContent = "Nächstes Disc Golf-Wetter™";
    const text = document.createElement("p");
    if (found)
      text.replaceChildren(
        this.getWeatherTimeSpan(steps, found.start, SPAN),
        document.createElement("br"),
        this.formatWeather(found.weather),
      );
    else
      text.textContent = `keins in den nächsten ${Math.round(steps.time.length / 96)} Tagen`; // 96 steps a day
    next.replaceChildren(heading, text);
  }

  // the weather of the steps start .. start + count - 1 of Open-Meteo's minutely_15, in the
  // form of formatWeather; null if there are no temperatures
  getWeatherOfSteps(steps, start, count) {
    const values = (name) =>
      (steps?.[name] ?? [])
        .slice(start, start + count)
        .filter((v) => typeof v === "number");
    const temperatures = values("temperature_2m").map(Math.round);
    if (temperatures.length === 0) return null;
    const codes = values("weather_code");
    const wind = values("wind_speed_10m");
    const gusts = values("wind_gusts_10m");
    // the precipitation of a step is the one of the 15 minutes before it, so the
    // first step (the quarter hour the span starts in) is left out
    const rain = (steps.precipitation ?? [])
      .slice(start + 1, start + count)
      .filter((v) => typeof v === "number")
      .reduce((sum, v) => sum + v, 0);
    return {
      minTemp: Math.min(...temperatures),
      maxTemp: Math.max(...temperatures),
      code: codes.length ? Math.max(...codes) : null,
      wind: wind.length ? Math.max(...wind) : null,
      gusts: gusts.length ? Math.max(...gusts) : null,
      rain,
    };
  }

  // no rain (no measurable rain and no drizzle / rain / snow / thunderstorm code) and
  // gusts of at most 30 km/h
  isDiscGolfWeather(weather) {
    return !this.isRainy(weather) && !this.isWindy(weather);
  }

  isRainy({ code, rain }) {
    return rain >= 0.1 || (code ?? 0) >= 51;
  }

  isWindy({ gusts }) {
    return (gusts ?? 0) > 30;
  }

  isStrongWind({ gusts }) {
    return (gusts ?? 0) > 45;
  }

  // the 90 minutes from step start on in the local time of the course, e.g. "17:30 bis 19:00 Uhr",
  // with "morgen " / "Fr. 20.11. " in front if they are not today
  getWeatherTimeSpan(steps, start, count) {
    // the step times have no time zone: read and written as UTC, so only the clock is used
    const clock = (date) => date.toISOString().slice(11, 16);
    const from = new Date(`${steps.time[start]}Z`);
    // e.g. 7 steps from 17:30 on: 17:30, 17:45, …, 19:00
    const to = new Date(`${steps.time[start + count - 1]}Z`);
    const span = `${clock(from)} bis ${clock(to)} Uhr`;
    const day = this.getWeatherDayLabel(steps.time[start], steps.time[0]);
    return day === "heute" ? span : `${day} ${span}`;
  }

  // "heute", "morgen" or e.g. "Fr. 20.11." for a step time, seen from the first step's day
  getWeatherDayLabel(time, firstTime) {
    const date = new Date(`${time.slice(0, 10)}T00:00Z`);
    const today = new Date(`${firstTime.slice(0, 10)}T00:00Z`);
    const days = Math.round((date - today) / (24 * 60 * 60 * 1000));
    if (days === 0) return "heute";
    if (days === 1) return "morgen";
    const weekday = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."][
      date.getUTCDay()
    ];
    return `${weekday} ${time.slice(8, 10)}.${time.slice(5, 7)}.`;
  }

  // The next 4 calendar days from the steps that are loaded anyway: per day the daylight, the
  // night and the weather as runs of minutes after midnight. A quarter hour counts as disc
  // golf weather if it lies in 90 minutes that are (same rule as "Nächstes Disc Golf-Wetter"),
  // so only in daylight; rain and wind are shown by night too.
  // from / to: the time axis, the whole day; null if there are no steps.
  getDiscGolfWeek(stepsFromNow) {
    const SPAN = 7; // 7 steps cover 90 minutes
    const DAYS = 4;
    const steps = this.getStepsOfWholeToday(stepsFromNow);
    const times = steps.time;
    const good = new Array(times.length).fill(false);
    for (let start = 0; start + SPAN <= times.length; start++) {
      const daylight = steps.is_day
        ?.slice(start, start + SPAN)
        .every((d) => d === 1);
      if (!daylight) continue;
      const weather = this.getWeatherOfSteps(steps, start, SPAN);
      if (weather && this.isDiscGolfWeather(weather))
        good.fill(true, start, start + SPAN - 1);
    }

    const addRun = (runs, from) => {
      const last = runs[runs.length - 1];
      if (last?.to === from) last.to = from + 15;
      else runs.push({ from, to: from + 15 });
    };
    const days = [];
    for (let i = 0; i + 1 < times.length; i++) {
      const date = times[i].slice(0, 10);
      if (days[days.length - 1]?.date !== date) {
        if (days.length === DAYS) break;
        days.push({
          date,
          label: this.getWeatherDayLabel(times[i], times[0]),
          daylight: [],
          good: [],
          rain: [],
          wind: [],
          strongWind: [],
          both: [],
          bothStrong: [],
          gap: [],
          night: [],
        });
      }
      const day = days[days.length - 1];
      const minute =
        Number(times[i].slice(11, 13)) * 60 + Number(times[i].slice(14, 16));
      const isDay = steps.is_day?.[i] === 1 && steps.is_day?.[i + 1] === 1;
      addRun(isDay ? day.daylight : day.night, minute);
      if (good[i]) {
        addRun(day.good, minute);
        continue;
      }
      // this quarter hour alone: from its start to its end
      const weather = this.getWeatherOfSteps(steps, i, 2);
      const rainy = weather && this.isRainy(weather);
      const windy = weather && this.isWindy(weather);
      const strong = weather && this.isStrongWind(weather);
      if (rainy && windy) addRun(strong ? day.bothStrong : day.both, minute);
      else if (rainy) addRun(day.rain, minute);
      else if (windy) addRun(strong ? day.strongWind : day.wind, minute);
      // fine night: only the night is drawn
      else if (isDay) addRun(day.gap, minute);
    }

    if (days.length === 0) return null;
    return { from: 0, to: 24 * 60, days };
  }

  // one bar per day: light gray with a hint of green = disc golf weather, blue = rain, amber = wind,
  // amber with brown stripes = strong wind, split = rain and wind,
  // gray diagonal stripes = other daylight (a gap under 90 minutes),
  // dark blue with stars = night (stars also on rain and wind by night), empty = not forecast;
  // nextStart: first step of "Nächstes Disc Golf-Wetter", boxed if it is within these days;
  // a red line marks the current quarter hour on today's bar, if within the shown hours
  getWeekWeatherString(steps, nextStart = null) {
    const week = this.getDiscGolfWeek(steps);
    if (!week) return "";
    const { from, to } = week;
    const minuteOf = (time) =>
      Number(time.slice(11, 13)) * 60 + Number(time.slice(14, 16));
    const nextTime = nextStart === null ? undefined : steps.time[nextStart];
    const nextDate = nextTime?.slice(0, 10);
    const nextBox =
      nextTime && week.days.some((day) => day.date === nextDate)
        ? {
            date: nextDate,
            from: minuteOf(nextTime),
            to: minuteOf(nextTime) + 90,
          }
        : null;
    const nowMinute = minuteOf(steps.time[0]);
    const showNow = nowMinute >= from && nowMinute < to;
    const percent = (minute) =>
      (((minute - from) / (to - from)) * 100).toFixed(2);
    // overlap: 1px further, under the next part, so no hairline shows between the two
    const run = (className, r, overlap = false) => {
      const width = (((r.to - r.from) / (to - from)) * 100).toFixed(2);
      return `<span class="${className}" style="left: ${percent(r.from)}%; width: ${overlap ? `calc(${width}% + 1px)` : `${width}%`}"></span>`;
    };
    // the night's color reaches 1px under the parts on both sides, which are drawn later
    const nightRun = (r) => {
      const width = (((r.to - r.from) / (to - from)) * 100).toFixed(2);
      return `<span class="week-weather-night" style="left: calc(${percent(r.from)}% - 1px); width: calc(${width}% + 2px)"></span>`;
    };
    const clock = (minute) =>
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

    // the legend only lists what the bars show (empty parts need no explanation)
    const runsOfKind = {
      daylight: ["gap"],
      "strong-wind": ["strongWind"],
      // one legend entry for rain with wind of either strength
      both: ["both", "bothStrong"],
    };
    const isShown = (kind) =>
      kind === "now"
        ? showNow
        : kind === "next-box"
        ? nextBox !== null
        : week.days.some((day) =>
            (runsOfKind[kind] ?? [kind]).some((runs) => day[runs].length > 0),
          );

    const everyHours = to - from > 12 * 60 ? 3 : 2;
    const ticks = [];
    for (
      let hour = Math.ceil(from / 60 / everyHours) * everyHours;
      hour * 60 < to;
      hour += everyHours
    )
      if (hour * 60 > from) ticks.push(hour);

    const rows = week.days.map((day) => {
      const windows = day.good.length
        ? day.good.map((r) => `${clock(r.from)} bis ${clock(r.to)} Uhr`).join(", ")
        : "kein Disc Golf-Wetter™";
      const parts = [
        ["daylight", day.gap],
        ["good", day.good],
        ["rain", day.rain],
        ["wind", day.wind],
        ["strong-wind", day.strongWind],
        ["both", day.both],
        ["both-strong", day.bothStrong],
      ]
        .flatMap(([kind, runs]) => runs.map((r) => ({ ...r, kind })))
        .sort((a, b) => a.from - b.from);
      return `
                  <div class="week-weather-row">
                    <span class="week-weather-label">${day.label}</span>
                    <div class="week-weather-bar" role="img" title="${windows}" aria-label="${day.label}: ${windows}">
                      ${day.night.map(nightRun).join("")}
                      ${parts
                        .map((r, i) =>
                          run(
                            `week-weather-${r.kind}`,
                            r,
                            parts[i + 1]?.from === r.to,
                          ),
                        )
                        .join("")}
                      ${day.night.map((r) => run("week-weather-stars", r)).join("")}
                      ${ticks.map((hour) => `<span class="week-weather-tick" style="left: ${percent(hour * 60)}%"></span>`).join("")}
                      ${nextBox?.date === day.date ? run("week-weather-next-box", nextBox) : ""}
                      ${showNow && day === week.days[0] ? `<span class="week-weather-now" style="left: ${percent(nowMinute)}%"></span>` : ""}
                    </div>
                  </div>`;
    });
    return `
                <h5>Wetter in den nächsten 4 Tagen</h5>
                <div class="week-weather">
                  <div class="week-weather-row">
                    <span class="week-weather-label"></span>
                    <div class="week-weather-axis">
                      ${ticks.map((hour) => `<span style="left: ${percent(hour * 60)}%">${hour}</span>`).join("")}
                    </div>
                  </div>${rows.join("")}
                  <div class="week-weather-legend">
                    ${[
                      ["good", "Disc Golf-Wetter™"],
                      ["rain", "Regen"],
                      ["wind", "Windböen >30km/h"],
                      ["strong-wind", "Windböen >45km/h"],
                      ["both", "Regen + Windböen"],
                      ["daylight", "Lücke unter 90 Min."],
                      ["night", "Nacht"],
                      ["next-box", "Nächstes Disc Golf-Wetter™"],
                      ["now", "Jetzt"],
                    ]
                      .filter(([kind]) => isShown(kind))
                      .map(
                        ([kind, text]) =>
                          `<span class="week-weather-legend-entry"><span class="week-weather-swatch week-weather-${kind}${kind === "night" ? " week-weather-stars" : ""}"></span>${text}</span>`,
                      )
                      .join("")}
                  </div>
                </div>`;
  }

  // WMO weather codes as used by Open-Meteo
  getWeatherDescription(code) {
    if (code === 0) return "klar";
    if (code === 1) return "überwiegend klar";
    if (code === 2) return "teilweise bewölkt";
    if (code === 3) return "bewölkt";
    if (code <= 48) return "Nebel";
    if (code <= 55) return "Nieselregen";
    if (code <= 57) return "gefrierender Nieselregen";
    if (code <= 61) return "leichter Regen";
    if (code <= 63) return "Regen";
    if (code <= 65) return "starker Regen";
    if (code <= 67) return "gefrierender Regen";
    if (code <= 77) return "Schnee";
    if (code <= 82) return "Regenschauer";
    if (code <= 86) return "Schneeschauer";
    if (code === 95) return "Gewitter";
    return "Gewitter mit Hagel";
  }

  // Shareable links, e.g.
  //   ?partie=2026-10-03-1430   ?spieler=Julian   ?parcours=Aachen Kronenbergpark (Main)   ?suche=2026
  // Every collapse that can be linked has data-link-param and data-link-value (see getLinkAttributes);
  // its link button copies a link with that parameter. Opening or closing a section does not
  // change the URL. When the page is loaded with such parameters, the matching sections are
  // opened, the first one is scrolled to, and the parameters are removed from the URL again
  // (it would no longer describe what is open once something is closed). The match filter and
  // the order of the matches stay in the URL.
  setupShareableLinks() {
    const updateUrl = (change) => {
      const params = new URLSearchParams(window.location.search);
      change(params);
      const query = params.toString();
      history.replaceState(
        null,
        "",
        window.location.pathname +
          (query ? `?${query}` : "") +
          window.location.hash,
      );
    };

    // open the sections named in the URL
    const params = new URLSearchParams(window.location.search);
    let scrolled = false;
    ["partie", "spieler", "parcours"].forEach((param) => {
      const value = params.get(param);
      if (value === null) return;
      // only the first one found is scrolled to
      if (this.openLinkedSection(param, value, !scrolled)) scrolled = true;
      updateUrl((p) => p.delete(param));
    });

    document.getElementById("matchFilter").addEventListener("input", (e) => {
      const value = e.target.value.trim();
      updateUrl((p) => (value ? p.set("suche", value) : p.delete("suche")));
    });
    // the default order (new -> old) is not in the URL
    document.getElementById("matchSort").addEventListener("change", (e) => {
      const value = e.target.value;
      updateUrl((p) =>
        value !== "neu" ? p.set("sortierung", value) : p.delete("sortierung"),
      );
    });

    // "Link kopieren" / "Teilen" buttons of a match / player / course: the link button copies
    // a link to just this one, the share button shares a short summary text with that link.
    // (no "share" in their class names: ad blockers hide e.g. .share-text as a social widget)
    // Bootstrap listens for its collapse clicks on document in the capture phase, so this
    // listens on window in the capture phase (runs before it) and stops the click there.
    // Otherwise sharing would also close the match card.
    window.addEventListener(
      "click",
      (e) => {
        const button = e.target.closest?.(".copy-link-button, .summary-button");
        if (!button) return;
        e.stopPropagation();

        const { linkParam, linkValue } =
          button.closest("[data-link-param]").dataset;
        const url = new URL(window.location.pathname, window.location.origin);
        url.searchParams.set(linkParam, linkValue);
        if (button.classList.contains("copy-link-button"))
          this.copyToClipboard(button, url.toString());
        // a match is shared as an image of its result and scorecard (with the link)
        else if (linkParam === "partie")
          this.shareMatchImage(
            button,
            Object.values(this.matches).find(
              (match) => this.getMatchLinkValue(match) === linkValue,
            ),
            url.toString(),
          );
        else this.shareText(button, `${button.dataset.summary}\n${url}`);
      },
      true,
    );

    // player names (in the results of a match card and in the records): go to that player's
    // stats; match links (in the records): go to that match
    // (also stopped in the capture phase, so the match card does not toggle)
    window.addEventListener(
      "click",
      (e) => {
        const link = e.target.closest?.(".player-link, .match-link");
        if (!link) return;
        e.stopPropagation();
        // Ctrl / Cmd / Shift click: let the browser open the link in a new tab or window
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        if (link.classList.contains("player-link"))
          this.openLinkedSection("spieler", link.dataset.player);
        else this.openLinkedSection("partie", link.dataset.match);
      },
      true,
    );

    // ".discgolfstats." in the navbar: back to the start, i.e. everything closed,
    // the search cleared and a plain URL (no ?partie=… etc. and no #page-top)
    document
      .querySelector("#mainNav .navbar-brand")
      .addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".collapse.show").forEach((el) =>
          bootstrap.Collapse.getOrCreateInstance(el, {
            toggle: false,
          }).hide(),
        );
        document
          .querySelectorAll("details[open]")
          .forEach((details) => (details.open = false));
        // like Escape in the search field: clears it and closes it
        document
          .getElementById("matchFilter")
          .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        // back to the default order
        const sort = document.getElementById("matchSort");
        if (sort.value !== "neu") {
          sort.value = "neu";
          sort.dispatchEvent(new Event("change"));
        }
        history.replaceState(null, "", window.location.pathname);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
  }

  // opens the match / player / course with this link value (see getLinkAttributes) and,
  // if scroll is true, scrolls to it. Returns false if there is no such section.
  openLinkedSection(param, value, scroll = true) {
    const collapse = [...document.querySelectorAll("[data-link-param]")].find(
      (el) => el.dataset.linkParam === param && el.dataset.linkValue === value,
    );
    if (!collapse) return false;

    // a match hidden by the match filter could not be seen: clear the filter
    const card = collapse.closest(".match-card");
    if (card?.classList.contains("filtered-out")) {
      const filter = document.getElementById("matchFilter");
      filter.value = "";
      filter.dispatchEvent(new Event("input"));
    }

    // below the fixed navbar, whose height depends on the screen width (wraps on phones)
    const scrollToSection = () => {
      const target = card ?? collapse.closest(".accordion-item");
      const navHeight = document.getElementById("mainNav")?.offsetHeight ?? 0;
      window.scrollTo({
        top:
          target.getBoundingClientRect().top + window.scrollY - navHeight - 8,
        behavior: "smooth",
      });
    };

    // a layout of a course: open the course around it too
    for (
      let outer = collapse.parentElement.closest(".collapse");
      outer;
      outer = outer.parentElement.closest(".collapse")
    )
      if (!outer.classList.contains("show"))
        bootstrap.Collapse.getOrCreateInstance(outer, { toggle: false }).show();

    if (collapse.classList.contains("show")) {
      if (scroll) scrollToSection();
    } else {
      // scroll once it is fully open, so the layout above it has settled
      if (scroll)
        collapse.addEventListener("shown.bs.collapse", scrollToSection, {
          once: true,
        });
      bootstrap.Collapse.getOrCreateInstance(collapse, {
        toggle: false,
      }).show();
    }
    return true;
  }

  // phones: the system share sheet; otherwise: copy to the clipboard
  async shareText(button, text) {
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
      } catch (error) {
        // closing the share sheet without choosing anything is not an error
        if (error.name !== "AbortError") console.error(error);
      }
      return;
    }
    this.copyToClipboard(button, text);
  }

  async copyToClipboard(button, text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // clipboard blocked: at least show the text, so it can be copied by hand
      window.prompt("Zum Kopieren:", text);
      return;
    }
    this.showCopied(button);
  }

  // Share button of a match (open item #35): an image of the result and the scorecard.
  // Phones: the system share sheet with the image and the link; otherwise the image is
  // copied to the clipboard, or downloaded if that is not possible.
  // The image is made synchronously, so the click still counts as the user's action when
  // the share sheet / clipboard is asked for (Safari is strict about that).
  async shareMatchImage(button, match, url) {
    const blob = this.getMatchImage(match);
    const file = new File(
      [blob],
      `Partie ${this.getMatchLinkValue(match)}.png`,
      {
        type: "image/png",
      },
    );

    if (
      navigator.share &&
      window.matchMedia("(pointer: coarse)").matches &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], text: url });
      } catch (error) {
        // closing the share sheet without choosing anything is not an error
        if (error.name !== "AbortError") console.error(error);
      }
      return;
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      this.showCopied(button);
    } catch (error) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    }
  }

  // the image of a match for shareMatchImage, as a PNG blob: title, date, result, comment
  // and scorecard (9 holes per row), in the colors of the match card
  getMatchImage(match) {
    const SCALE = 2; // sharp on phone screens
    const PAD = 24; // around everything
    const HOLES_PER_ROW = 9;
    const CELL = 34; // width of a hole column
    const BLOCK_PAD = 12; // inside a scorecard block
    const COLORS = {
      background: "#212529", // the match card
      block: "#3E4145", // a scorecard block
      text: "#ffffff",
      muted: "#adb5bd",
      over: "#fd6c2e", // deviation from par in the result, as in the match card
      under: "#408ce2",
      unranked: "#ffc107",
    };
    // the fonts of the page (already loaded, so the canvas can use them)
    const bodyFont = getComputedStyle(document.body).fontFamily;
    const headingFont = getComputedStyle(
      document.querySelector("#partien-container h4") ?? document.body,
    ).fontFamily;
    const font = (size, style = "", family = bodyFont) =>
      `${style} ${size}px ${family}`.trim();
    // the colors of the score badges and place circles, from the CSS
    const backgroundOf = (className) => {
      const el = document.createElement("span");
      el.className = className;
      el.hidden = true;
      document.body.appendChild(el);
      const color = getComputedStyle(el).backgroundColor;
      el.remove();
      return color;
    };

    const measure = document.createElement("canvas").getContext("2d");
    const textWidth = (text, f) => {
      measure.font = f;
      return measure.measureText(text).width;
    };

    // Font Awesome icons as paths ([width, height, …, path] of the solid icon), or null
    const ICON_SIZE = 14; // height
    const ICON_GAP = 6; // between icon and text
    const PART_GAP = 18; // between the parts of a line
    const iconOf = (name) =>
      window.FontAwesome?.findIconDefinition({ prefix: "fas", iconName: name })
        ?.icon ?? null;
    const iconWidth = (name) => {
      const icon = iconOf(name);
      return icon ? (icon[0] / icon[1]) * ICON_SIZE + ICON_GAP : 0;
    };
    const lineWidth = (parts, f) =>
      parts.reduce(
        (sum, [icon, string], i) =>
          sum + (i ? PART_GAP : 0) + iconWidth(icon) + textWidth(string, f),
        0,
      );

    const par = match.players["Par"];
    const players = Object.entries(match.players)
      .filter(([name]) => name !== "Par")
      .sort((a, b) => a[1].devFromPar - b[1].devFromPar);
    const pad = (n) => String(n).padStart(2, "0");
    const t = match.startTime;

    const title = `${match.course} (${match.layout})`;
    // lines of [icon, text] parts (Font Awesome icons, like in the records), e.g.
    // [calendar] 20.09.2026, 17:52   [clock] 1h12min
    // and below it the weather if the match has already loaded it (when it was opened, see
    // loadMatchWeather), with the average of the lowest and highest temperature and the
    // wind without gusts: [sun] 13°C   [wind] 10km/h
    const dateLine = [
      [
        "calendar",
        `${this.formatDate(t)}, ${pad(t.getHours())}:${pad(t.getMinutes())}`,
      ],
      ["clock", match.duration],
    ];
    const weather = this.matchWeather.get(t.getTime());
    const weatherLine = weather
      ? [
          [
            weather.code !== null
              ? this.getWeatherIcon(weather.code)
              : "temperature-half",
            `${Math.round((weather.minTemp + weather.maxTemp) / 2)}°C`,
          ],
          ...(weather.wind !== null
            ? [["wind", `${Math.round(weather.wind)}km/h`]]
            : []),
        ]
      : [];
    // the address of the site (not of the match), e.g. julvol.github.io/discgolfstats
    const footer = `mehr Statistiken unter ${location.host}${location.pathname.replace(/\/(index\.html)?$/, "")}`;
    const fonts = {
      title: font(22, "bold", headingFont),
      date: font(15),
      section: font(17, "bold", headingFont),
      name: font(16, "bold"),
      text: font(16),
      small: font(12),
      footer: font(12, "italic"),
      comment: font(15, "italic"),
      cell: font(13),
      cellBold: font(13, "bold"),
      badge: font(14, "bold"),
      rank: font(12, "bold"),
    };

    // places like in the records (1, T2, T2, 4), in the order of the list (also unfinished
    // rounds); only from three players on
    const ranked = players.length >= 3 ? players : [];
    const rankOf = new Map();
    ranked.forEach(([name, p], i) => {
      const previous = ranked[i - 1];
      rankOf.set(
        name,
        previous && previous[1].devFromPar === p.devFromPar
          ? rankOf.get(previous[0])
          : i + 1,
      );
    });
    const rankLabel = (name) => {
      const rank = rankOf.get(name);
      if (rank === undefined) return null;
      const tied = [...rankOf.values()].filter((r) => r === rank).length > 1;
      return { rank, label: this.formatRank(rank, tied) };
    };

    // result: place | name | deviation (total) | THRU n
    const results = players.map(([name, p]) => ({
      place: rankLabel(name),
      name,
      dev: this.formatDevFromPar(p.devFromPar),
      devColor:
        p.devFromPar > 0
          ? COLORS.over
          : p.devFromPar < 0
            ? COLORS.under
            : COLORS.text,
      total: ` (${p.total})`,
      thru:
        p.howManyHolesNotPlayedInThisMatch > 0
          ? `THRU ${match.holes - p.howManyHolesNotPlayedInThisMatch}`
          : "",
    }));
    const nameWidth = Math.max(
      ...results.map((r) => textWidth(r.name, fonts.name)),
    );
    // the deviations are right aligned, so the "(" of all totals are one below the other
    const devWidth = Math.max(
      ...results.map((r) => textWidth(r.dev, fonts.name)),
    );
    const scoreWidth =
      devWidth +
      Math.max(...results.map((r) => textWidth(r.total, fonts.text)));
    const thruWidth = Math.max(
      0,
      ...results.map((r) => textWidth(r.thru, fonts.small)),
    );
    // the place circle in front of the names
    const RANK_SIZE = 24;
    const RANK_GAP = 10;
    const rankWidth = results.some((r) => r.place) ? RANK_SIZE + RANK_GAP : 0;
    const resultWidth =
      rankWidth +
      nameWidth +
      20 +
      scoreWidth +
      (thruWidth ? 16 + thruWidth : 0);

    // scorecard: the label column fits "Bahn", "Länge", "Par" and the names
    const labelWidth =
      Math.max(
        textWidth("Länge", fonts.cellBold),
        ...players.map(([name]) => textWidth(name, fonts.cellBold)),
      ) + 12;
    const blockWidth = (holes) => BLOCK_PAD * 2 + labelWidth + holes * CELL;
    const scorecardWidth = blockWidth(Math.min(HOLES_PER_ROW, match.holes));

    const contentWidth = Math.ceil(
      Math.max(
        320,
        textWidth(footer, fonts.footer),
        textWidth(title, fonts.title),
        lineWidth(dateLine, fonts.date) +
          (match.unranked ? 12 + textWidth("Unranked", fonts.small) + 12 : 0),
        lineWidth(weatherLine, fonts.date),
        resultWidth,
        scorecardWidth,
      ),
    );

    // the comment, wrapped to the width (keeps its own line breaks)
    const commentLines = [];
    (match.comment ?? "").split("\n").forEach((paragraph) => {
      let line = "";
      paragraph
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => {
          const next = line ? `${line} ${word}` : word;
          if (line && textWidth(next, fonts.comment) > contentWidth) {
            commentLines.push(line);
            line = word;
          } else line = next;
        });
      if (line) commentLines.push(line);
    });

    // everything as drawing steps, so the height is known before the canvas is made
    const steps = [];
    let y = PAD;
    const text = (string, x, yPos, f, color, align = "left") =>
      steps.push((ctx) => {
        ctx.font = f;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.fillText(string, x, yPos);
      });
    const roundRect = (x, yPos, w, h, r, color) =>
      steps.push((ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, yPos, w, h, r);
        ctx.fill();
      });

    // a line of [icon, text] parts; the icons sit on the text's baseline like a capital letter
    const iconLine = (parts, yPos, f, color) => {
      let x = PAD;
      parts.forEach(([name, string], i) => {
        if (i) x += PART_GAP;
        const icon = iconOf(name);
        if (icon) {
          const [w, h, , , path] = icon;
          const iconX = x;
          steps.push((ctx) => {
            ctx.save();
            ctx.translate(iconX, yPos - ICON_SIZE + 2);
            ctx.scale(ICON_SIZE / h, ICON_SIZE / h);
            ctx.fillStyle = color;
            ctx.fill(new Path2D(Array.isArray(path) ? path.join(" ") : path));
            ctx.restore();
          });
          x += (w / h) * ICON_SIZE + ICON_GAP;
        }
        text(string, x, yPos, f, color);
        x += textWidth(string, f);
      });
    };

    y += 22;
    text(title, PAD, y, fonts.title, COLORS.text);
    y += 24;
    iconLine(dateLine, y, fonts.date, COLORS.muted);
    if (match.unranked) {
      const x = PAD + lineWidth(dateLine, fonts.date) + 12;
      const w = textWidth("Unranked", fonts.small) + 12;
      roundRect(x, y - 14, w, 19, 4, COLORS.unranked);
      text("Unranked", x + 6, y, fonts.small, COLORS.background);
    }
    if (weatherLine.length) {
      y += 22;
      iconLine(weatherLine, y, fonts.date, COLORS.muted);
    }

    y += 34;
    text("Ergebnis", PAD, y, fonts.section, COLORS.text);
    y += 6;
    // the circles are centered on the capital letters of the names (not on their baseline),
    // and so is the place inside them
    const ascent = (string, f) => {
      measure.font = f;
      return measure.measureText(string).actualBoundingBoxAscent;
    };
    const nameMiddle = ascent("H", fonts.name) / 2;
    // gold, silver, bronze, gray (place 4 and below)
    const rankColors = [1, 2, 3, 4].map((rank) =>
      backgroundOf(`record-rank${rank <= 3 ? ` record-rank-${rank}` : ""}`),
    );
    results.forEach((r) => {
      y += rankWidth ? 30 : 26; // a bit more room for the circles
      if (r.place) {
        const middle = y - nameMiddle;
        steps.push((ctx) => {
          ctx.fillStyle = rankColors[Math.min(r.place.rank, 4) - 1];
          ctx.beginPath();
          ctx.arc(PAD + RANK_SIZE / 2, middle, RANK_SIZE / 2, 0, 2 * Math.PI);
          ctx.fill();
        });
        text(
          r.place.label,
          PAD + RANK_SIZE / 2,
          middle + ascent(r.place.label, fonts.rank) / 2,
          fonts.rank,
          COLORS.background,
          "center",
        );
      }
      text(r.name, PAD + rankWidth, y, fonts.name, COLORS.text);
      const x = PAD + rankWidth + nameWidth + 20;
      text(r.dev, x + devWidth, y, fonts.name, r.devColor, "right");
      text(r.total, x + devWidth, y, fonts.text, COLORS.text);
      if (r.thru)
        text(r.thru, x + scoreWidth + 16, y, fonts.small, COLORS.muted);
    });

    if (commentLines.length) {
      y += 10;
      commentLines.forEach((line) => {
        y += 21;
        text(line, PAD, y, fonts.comment, COLORS.text);
      });
    }

    y += 36;
    text("Scorecard", PAD, y, fonts.section, COLORS.text);
    y += 12;

    const badgeColors = Object.fromEntries(
      SCORE_CATEGORIES.map((c) => [c.cls, backgroundOf(`bg-scorecard-${c.cls}`)]),
    );
    const headerRows = [
      ["Bahn", (i) => String(i + 1), fonts.cellBold],
      ...(match.holeLengths
        ? [["Länge", (i) => String(match.holeLengths[i] ?? ""), fonts.cell]]
        : []),
      ["Par", (i) => String(par.holes[i]), fonts.cell],
    ];
    for (let from = 0; from < match.holes; from += HOLES_PER_ROW) {
      const to = Math.min(from + HOLES_PER_ROW, match.holes);
      const top = y;
      const height =
        BLOCK_PAD * 2 + headerRows.length * 22 + 9 + players.length * 30;
      roundRect(PAD, top, blockWidth(to - from), height, 8, COLORS.block);
      const holeX = (i) =>
        PAD + BLOCK_PAD + labelWidth + (i - from) * CELL + CELL / 2;

      let rowY = top + BLOCK_PAD;
      headerRows.forEach(([label, value, f]) => {
        rowY += 22;
        text(label, PAD + BLOCK_PAD, rowY - 6, fonts.cellBold, COLORS.text);
        for (let i = from; i < to; i++)
          text(value(i), holeX(i), rowY - 6, f, COLORS.text, "center");
      });
      // line below the header, like in the match card
      rowY += 4;
      steps.push(
        ((lineY) => (ctx) => {
          ctx.fillStyle = COLORS.background;
          ctx.fillRect(
            PAD + BLOCK_PAD,
            lineY,
            blockWidth(to - from) - 2 * BLOCK_PAD,
            1,
          );
        })(rowY),
      );
      rowY += 5;

      players.forEach(([name, p]) => {
        text(name, PAD + BLOCK_PAD, rowY + 20, fonts.cellBold, COLORS.text);
        for (let i = from; i < to; i++) {
          const score = p.holes[i];
          const cls =
            score === "-" ? "par" : this.getScoreClass(score - par.holes[i]);
          roundRect(holeX(i) - 15, rowY + 3, 30, 24, 6, badgeColors[cls]);
          text(
            String(score),
            holeX(i),
            rowY + 20,
            fonts.badge,
            COLORS.text,
            "center",
          );
        }
        rowY += 30;
      });
      y = top + height + 8;
    }

    y += 14;
    text(footer, PAD + contentWidth, y, fonts.footer, COLORS.muted, "right");
    y += PAD - 8;

    const canvas = document.createElement("canvas");
    canvas.width = (contentWidth + 2 * PAD) * SCALE;
    canvas.height = Math.ceil(y) * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, contentWidth + 2 * PAD, y);
    ctx.textBaseline = "alphabetic";
    steps.forEach((step) => step(ctx));

    // a blob right away (canvas.toBlob would wait)
    const data = atob(canvas.toDataURL("image/png").split(",")[1]);
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  // confirmation of a copy button: a check mark instead of the icon for 2 seconds
  showCopied(button) {
    button.originalTitle ??= button.title;
    const setCopied = (copied) => {
      button.querySelector(".button-icon").classList.toggle("d-none", copied);
      button
        .querySelector(".button-icon-done")
        .classList.toggle("d-none", !copied);
      button.title = copied ? "Kopiert" : button.originalTitle;
    };
    setCopied(true);
    clearTimeout(button.resetTimer);
    button.resetTimer = setTimeout(() => setCopied(false), 2000);
  }

  // icons only, at the bottom right of the match card / player / course: copy the link,
  // and share shareText (a few lines summing it up) followed by the link
  // (the icons are wrapped in spans, because Font Awesome replaces the <i> with an <svg>)
  getShareButtonString(buttonClass, shareText) {
    const icons = (icon) => `
        <span class="button-icon"><i class="fas ${icon}"></i></span>
        <span class="button-icon-done d-none"><i class="fas fa-check"></i></span>`;
    const escaped = shareText
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/\n/g, "&#10;");
    return `<div class="link-buttons">
      <button type="button" class="btn btn-sm ${buttonClass} copy-link-button" title="Link kopieren" aria-label="Link kopieren">${icons("fa-link")}
      </button>
      <button type="button" class="btn btn-sm ${buttonClass} summary-button" title="Teilen" aria-label="Teilen" data-summary="${escaped}">${icons("fa-share-nodes")}
      </button>
    </div>`;
  }

  // the link buttons to the right of content, bottom aligned, if there is enough space
  // next to it; otherwise below it (see .with-link-buttons in styles.css)
  getWithLinkButtons(content, buttonClass, shareText) {
    return `<div class="with-link-buttons">
      <div class="link-buttons-content">${content}</div>
      ${this.getShareButtonString(buttonClass, shareText)}
    </div>`;
  }

  getPlayerLinkAttribute(name) {
    return `data-player="${String(name).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
  }

  getLinkAttributes(param, value) {
    const escaped = String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
    return `data-link-param="${param}" data-link-value="${escaped}"`;
  }

  // start time of the match, e.g. 2026-10-03-1430
  getMatchLinkValue(match) {
    const t = match.startTime;
    const pad = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;
  }

  // compact scorecard (CSS sets --scorecard-name-max): shrink the font of every player name
  // that is wider than that, each name individually; otherwise reset to the normal size
  fitScorecardNames(root) {
    root.querySelectorAll(".scorecard-name").forEach((name) => {
      name.style.fontSize = "";
      const maxWidth = parseFloat(
        getComputedStyle(name).getPropertyValue("--scorecard-name-max"),
      );
      if (!maxWidth) return; // full size scorecard

      const width = name.getBoundingClientRect().width;
      if (width > maxWidth) {
        const fontSize = parseFloat(getComputedStyle(name).fontSize);
        name.style.fontSize = `${Math.floor(fontSize * (maxWidth / width) * 10) / 10}px`;
      }
    });
  }

  // true if at least one hole of this course/layout has isomorph holes
  hasIsomorphHoles(course) {
    for (let hole = 1; hole <= course.howManyHoles; hole++) {
      if (this.getIsomorphHoles(course.course, course.layout, hole).length > 0)
        return true;
    }
    return false;
  }

  // switch + both variants (with / without isomorph holes) of a section, only one is visible
  getIsomorphToggleString(variantWith, variantWithout, includedByDefault) {
    return this.getVariantToggleString(
      "identische Bahnen einbeziehen",
      variantWith,
      variantWithout,
      includedByDefault,
    );
  }

  // switch + two variants, only one is visible: variantOn while checked, else variantOff
  getVariantToggleString(label, variantOn, variantOff, checked) {
    const id = `variant-switch-${this.variantSwitchCount++}`;
    return `
    <div class="variant-toggle">
      <div class="form-check form-switch mb-2" style="font-size: 0.85rem;">
        <input class="form-check-input variant-switch" type="checkbox" role="switch" id="${id}" ${checked ? "checked" : ""}>
        <label class="form-check-label" for="${id}">${label}</label>
      </div>
      <div data-variant="on" class="${checked ? "" : "d-none"}">${variantOn}</div>
      <div data-variant="off" class="${checked ? "d-none" : ""}">${variantOff}</div>
    </div>`;
  }

  // entries of all played isomorph holes of this hole that have the same par
  getSameParIsomorphEntries(course, hole) {
    const par = course[hole][0].score; // Par row is always first
    return this.getIsomorphHoles(course.course, course.layout, hole)
      .map((h) => this.courses[h.course + h.layout]?.[h.hole]) // isomorph layout may never have been played
      .filter((entries) => entries && entries[0].score === par);
  }

  // distribution + average vs. par of all rounds on this hole
  // (optionally incl. its isomorph holes, but only those with the same par)
  getHoleStatistics(course, hole, includeIsomorphs) {
    const sources = [course[hole]];
    if (includeIsomorphs) {
      sources.push(...this.getSameParIsomorphEntries(course, hole));
    }

    const devs = sources.flatMap((entries) => {
      const par = entries[0].score; // Par row is always first
      return entries.slice(1).map((e) => e.score - par); // skip the Par entry
    });

    return {
      distribution: this.createDistribution(devs),
      averageToPar: devs.length
        ? devs.reduce((a, b) => a + b, 0) / devs.length
        : null,
    };
  }

  formatAverageToPar(avg) {
    if (avg === null) return "-";
    const formatted = new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    }).format(avg);
    // values that round to zero get no sign from exceptZero
    return /^[+-]/.test(formatted) ? formatted : `±${formatted}`;
  }

  getHoleStatsString(course) {
    const hasLengths = this.holeLengthsSets.some(
      (s) => s.course === course.course && s.layout === course.layout,
    );
    const heading = this.getHoleSortHeading(hasLengths, true);

    // switch only if including isomorph holes would change anything
    let hasSameParIsomorphs = false;
    for (let hole = 1; hole <= course.howManyHoles; hole++) {
      if (this.getSameParIsomorphEntries(course, hole).length > 0)
        hasSameParIsomorphs = true;
    }
    const tables = hasSameParIsomorphs
      ? this.getIsomorphToggleString(
          this.getHoleStatsTableString(course, true),
          this.getHoleStatsTableString(course, false),
          false, // course overview: by default only rounds on this layout
        )
      : this.getHoleStatsTableString(course, false);
    return `<div class="hole-stats">${heading}${tables}</div>`;
  }

  // "Bahnen:" with the sort dropdown. Played layouts also sort by par and difficulty and have
  // the Bestenliste above it (hence the margin)
  getHoleSortHeading(hasLengths, played) {
    return `
    <div class="d-flex flex-wrap align-items-center gap-2 ${played ? "mt-3 " : ""}mb-2">
      <h5 class="mb-0">Bahnen:</h5>
      <select class="form-select form-select-sm hole-sort" aria-label="Bahnen sortieren" title="Bahnen sortieren">
        <option value="bahn" selected>nach Bahn</option>
        ${hasLengths ? `<option value="laenge">nach Länge</option>` : ""}
        ${played ? `<option value="par">nach Par</option>` : ""}
        ${played ? `<option value="schwierigkeit">nach Schwierigkeit</option>` : ""}
      </select>
    </div>`;
  }

  // "Bahn N" cell of a "Bahnen" table, with a popover if the hole is identical to other holes
  getHoleHeaderCell(course, layout, hole) {
    const isomorphs = this.getIsomorphHoles(course, layout, hole);
    if (isomorphs.length === 0) {
      return `<th class="text-start-table-header-info">Bahn ${hole}</th>`;
    }
    const popoverContentIsomorphHoles =
      "<b>identisch zu</b><br>" +
      isomorphs.map((h) => `${h.layout} - Bahn ${h.hole}`).join("<br>");
    return `<th
          class="text-start-table-header-info"
          tabindex="0"
          style="cursor: pointer;"
          data-bs-toggle="popover"
          data-bs-trigger="hover focus"
          data-bs-container="body"
          data-bs-html="true"
          data-bs-placement="right"
          data-bs-content="${popoverContentIsomorphHoles}"
        >Bahn ${hole}</th>`;
  }

  // "Bahnen" of a layout without rounds: only the length
  getUnplayedHolesString({ course, layout }) {
    const lengths =
      this.holeLengthsSets.find(
        (s) => s.course === course && s.layout === layout,
      )?.lengths ?? [];
    const headStyle =
      "font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;";
    const rows = lengths
      .map((length, i) => {
        const hole = i + 1;
        return `<tr data-hole="${hole}" data-length="${length > 0 ? length : ""}" data-par="" data-difficulty="">
          ${this.getHoleHeaderCell(course, layout, hole)}
          <td>${length > 0 ? length : "-"}</td>
        </tr>`;
      })
      .join("");
    return `<div class="hole-stats">
      ${this.getHoleSortHeading(true, false)}
      <table class="table table-bordered text-center align-middle w-auto mb-0">
        <thead>
          <tr>
            <th style="${headStyle}"></th>
            <th style="${headStyle}">Länge</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  getHoleStatsTableString(course, includeIsomorphs) {
    const lengths = this.holeLengthsSets.find(
      (s) => s.course === course.course && s.layout === course.layout,
    )?.lengths;

    const segments = SCORE_CATEGORIES;
    const headStyle =
      "font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;";

    let rowsString = "";
    for (let hole = 1; hole <= course.howManyHoles; hole++) {
      const entries = course[hole];
      const par = entries[0].score; // Par row is always first
      const { distribution, averageToPar } = this.getHoleStatistics(
        course,
        hole,
        includeIsomorphs,
      );
      const total = segments.reduce((sum, s) => sum + distribution[s.key], 0);

      // color by the value rounded to whole throws (like the averages in the player
      // view): -0,50 to +0,49 is par
      const avg = averageToPar;
      const rounded = avg === null ? 0 : Math.round(avg);
      const avgColor =
        rounded > 0 ? "#e26028" : rounded < 0 ? "#408ce2" : "#212529";

      let barCell = `<td>-</td>`;
      if (total > 0) {
        const popoverContentDistribution =
          `<b>${total} ${total == 1 ? "Eintrag" : "Einträge"}</b>` +
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
        <td style="padding: 6px; cursor: pointer;" ${this.getPopoverAttributes(popoverContentDistribution)}>
          <div style="display: flex; width: 110px; height: 14px; border-radius: 3px; overflow: hidden;">${bar}</div>
        </td>`;
      }

      // what the dropdown sorts by (see setupHoleSort). The difficulty as shown (2 decimals),
      // so holes that show the same average count as a tie
      const length = lengths?.[hole - 1];
      const rowAttributes = `data-hole="${hole}"
        data-length="${length > 0 ? length : ""}"
        data-par="${par}"
        data-difficulty="${avg === null ? "" : avg.toFixed(2)}"`;

      rowsString += `<tr ${rowAttributes}>${this.getHoleHeaderCell(course.course, course.layout, hole)}`;

      rowsString += `
        ${lengths ? `<td>${lengths[hole - 1] ?? "-"}</td>` : ""}
        <td>${par}</td>
        <td><b style="color: ${avgColor};">${this.formatAverageToPar(avg)}</b></td>
        ${barCell}
      </tr>`;
    }

    const footnote = includeIsomorphs
      ? `&#x00B9; enthält auch Runden auf identischen Bahnen anderer Layouts mit gleichem Par`
      : `&#x00B9; enthält nur auf ${course.layout} gespielte Runden`;

    return `
    <table class="table table-bordered text-center align-middle w-auto">
      <thead>
        <tr>
          <th style="${headStyle}"></th>
          ${lengths ? `<th style="${headStyle}">Länge</th>` : ""}
          <th style="${headStyle}">Par</th>
          <th style="${headStyle}">Ø Par&#x00B9;</th>
          <th style="${headStyle}">Verteilung&#x00B9;</th>
        </tr>
      </thead>
      <tbody>${rowsString}</tbody>
    </table>
    <div class="d-flex flex-wrap gap-3" style="font-size: 0.75rem;">${footnote}</div>`;
  }

  // popover of the average on a hole in "Letzte Ergebnisse" of a player: how often each number
  // of throws was played (like the "Verteilung" of a course, but absolute throws instead of
  // the categories), from 1 (an ace) to the most throws; numbers never played are dimmed
  getThrowsDistributionPopoverContent(entries) {
    const counts = {};
    entries.forEach(({ score }) => (counts[score] = (counts[score] ?? 0) + 1));
    const throws = entries.map((e) => e.score);
    const total = entries.length;

    let lines = "";
    for (let n = 1; n <= Math.max(...throws); n++) {
      const count = counts[n] ?? 0;
      const percent = Math.round((count / total) * 100);
      lines += `<span style="display: flex; align-items: center; gap: 8px; white-space: nowrap;${count === 0 ? " opacity: 0.4;" : ""}">
          <span style="min-width: 2ch; text-align: right;"><b>${n}:</b></span>
          <span style="min-width: 2ch; text-align: right;">${count}</span>
          <span style="min-width: 4ch; text-align: right;">${percent}%</span>
        </span>`;
    }
    return `<b>${total} ${total === 1 ? "Eintrag" : "Einträge"}</b>${lines}`;
  }

  getScoreClassDot(cls) {
    return `<span
      class="badge bg-scorecard-${cls}"
      style="display: inline-block; width: 11px; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;"
    ></span>`;
  }

  // last #limit totals (dev from par) of this player on exactly this course/layout, oldest -> newest
  getRecentTotals(player, course, limit) {
    return this.getRankedMatches()
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

  // average score (absolute) on this hole (optionally incl. isomorph holes), or null if never played
  getAverageScore(player, course, hole, includeIsomorphs) {
    const all = this.getCombinedScores(player, course, hole, includeIsomorphs);
    if (all.length === 0) return null;

    return all.reduce((sum, s) => sum + s.score, 0) / all.length;
  }

  // all scores on this hole (optionally incl. all its isomorph holes) for player, oldest -> newest
  getCombinedScores(player, course, hole, includeIsomorphs) {
    const sources = [
      { course: course.course, layout: course.layout, hole: Number(hole) },
      ...(includeIsomorphs
        ? this.getIsomorphHoles(course.course, course.layout, hole)
        : []),
    ];

    return sources
      .flatMap((h) => player.recentScores[h.course + h.layout]?.[h.hole] ?? [])
      .sort((a, b) => a.time - b.time);
  }

  // last #limit scores on this hole (optionally incl. isomorph holes) for player, oldest -> newest
  getCombinedRecentScores(player, course, hole, limit, includeIsomorphs) {
    return this.getCombinedScores(player, course, hole, includeIsomorphs).slice(
      -limit,
    );
  }

  // personal best on this hole (optionally incl. isomorph holes) = fewest throws (absolute score)
  // on a tie the earliest one wins, because getCombinedScores is sorted oldest -> newest
  // count = how often that score was achieved
  getPersonalBestScore(player, course, hole, includeIsomorphs) {
    const all = this.getCombinedScores(player, course, hole, includeIsomorphs);
    if (all.length === 0) return null;

    const best = all.reduce((b, s) => (s.score < b.score ? s : b));
    return { ...best, count: all.filter((s) => s.score === best.score).length };
  }

  // personal best total on exactly this course/layout, only completed rounds
  // returns { dev, total, time, count } or null (on a tie the earliest round wins)
  getPersonalBestTotal(player, course) {
    const totals = this.getRankedMatches()
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

  getScoreClass(dev) {
    return SCORE_CATEGORIES.find((c) => c.matches(dev)).cls;
  }

  // devs = array of (score - par)
  createDistribution(devs) {
    const distribution = Object.fromEntries(
      SCORE_CATEGORIES.map((c) => [c.key, 0]),
    );
    devs.forEach(
      (dev) => distribution[SCORE_CATEGORIES.find((c) => c.matches(dev)).key]++,
    );
    return distribution;
  }

  // ---------------------------------------------------------------------------
  // Score history: line chart of a player's completed rounds on one layout, at the top
  // of that layout in "Letzte Ergebnisse". It is drawn by renderScoreHistory once the
  // layout is opened, because it needs the width it has there.
  // ---------------------------------------------------------------------------

  getScoreHistoryString(player, course) {
    const rounds = this.getRankedMatches()
      .filter(
        (m) =>
          m.course === course.course &&
          m.layout === course.layout &&
          this.hasPlayerCompletedMatch(m, player),
      )
      .sort((a, b) => a.startTime - b.startTime)
      .map((m) => ({
        time: m.startTime,
        dev: m.players[player.name].devFromPar,
        total: m.players[player.name].total,
        linkValue: this.getMatchLinkValue(m),
      }));
    // a chart only says something from 3 completed rounds on
    if (rounds.length <= 2) return "";

    this.scoreHistories ??= [];
    const index = this.scoreHistories.push(rounds) - 1;

    return `
      <div class="score-history mt-2 mb-3" data-history-index="${index}">
        <div class="score-history-chart"></div>
        <div style="font-size: 0.75rem;">enthält nur vollständige Runden</div>
      </div>`;
  }

  setupScoreHistoryCharts() {
    const accordion = document.getElementById("playersAccordion");
    const renderAll = (root) =>
      root
        .querySelectorAll(".score-history")
        .forEach((el) => this.renderScoreHistory(el));

    // Bootstrap makes the section measurable right after this event (see fitScorecardNames)
    accordion.addEventListener("show.bs.collapse", (e) =>
      queueMicrotask(() => renderAll(e.target)),
    );
    // a layout in "Letzte Ergebnisse" is opened (toggle does not bubble, hence capture)
    accordion.addEventListener(
      "toggle",
      (e) => {
        if (e.target.open) renderAll(e.target);
      },
      true,
    );
    let resizeFrame;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() =>
        accordion.querySelectorAll(".collapse.show").forEach(renderAll),
      );
    });

    // touch: a tap outside of a chart closes its tooltip
    document.addEventListener("pointerdown", (e) => {
      document.querySelectorAll(".score-history-chart").forEach((chart) => {
        if (!chart.contains(e.target)) chart.hideTooltip?.();
      });
    });
  }

  renderScoreHistory(container) {
    const chart = container.querySelector(".score-history-chart");
    const width = chart.clientWidth;
    if (width === 0) return; // section or layout closed

    const rounds = this.scoreHistories[container.dataset.historyIndex];
    const n = rounds.length;

    // colors of the site: under par blue, par dark, over par orange
    const devColor = (dev) =>
      dev > 0 ? "#e26028" : dev < 0 ? "#408ce2" : "#212529";
    const SURFACE = "#fff9f3"; // background of the player section
    const GRID = "#e3dcd3";
    const MUTED = "#6c757d";

    // --- geometry ---
    const height = width < 400 ? 190 : 220;
    const m = { top: 22, right: 16, bottom: 26, left: 34 };
    const inset = 10; // keeps the first and last point away from the axis
    const plotLeft = m.left + inset;
    const plotRight = width - m.right - inset;
    const x = (i) =>
      n === 1
        ? (plotLeft + plotRight) / 2
        : plotLeft + (i * (plotRight - plotLeft)) / (n - 1);

    // y: clean integer ticks, with room above and below for the labels
    const devs = rounds.map((r) => r.dev);
    let min = Math.min(...devs);
    let max = Math.max(...devs);
    const step = [1, 2, 5, 10, 20, 50].find((s) => (max - min) / s <= 4) ?? 100;
    let lo = Math.floor(min / step) * step;
    let hi = Math.ceil(max / step) * step;
    if (hi - max < step * 0.4) hi += step;
    if (min - lo < step * 0.6) lo -= step; // more room below: the PB label sits there
    const y = (dev) =>
      m.top + ((hi - dev) * (height - m.top - m.bottom)) / (hi - lo);

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="score-history-svg"
      tabindex="0" role="img" aria-label="Verlauf: ${n} ${n === 1 ? "vollständige Runde" : "vollständige Runden"}, mit den Pfeiltasten durchgehen">`;

    // gridlines + y labels (the par line a bit stronger)
    for (let t = lo; t <= hi; t += step) {
      svg += `<line x1="${m.left}" x2="${width - m.right}" y1="${y(t)}" y2="${y(t)}"
        stroke="${t === 0 ? "#b9b0a5" : GRID}" stroke-width="1" shape-rendering="crispEdges"/>
        <text x="${m.left - 6}" y="${y(t)}" dy="0.32em" text-anchor="end" class="score-history-tick">${this.formatDevFromPar(t)}</text>`;
    }

    // x labels: dates, as many as fit (always the first and the last round)
    const shortDate = (t) =>
      new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }).format(t);
    const maxLabels = Math.max(2, Math.floor((plotRight - plotLeft) / 70) + 1);
    const labelIndices = new Set();
    if (n <= maxLabels) rounds.forEach((_, i) => labelIndices.add(i));
    else
      for (let k = 0; k < maxLabels; k++)
        labelIndices.add(Math.round((k * (n - 1)) / (maxLabels - 1)));
    labelIndices.forEach((i) => {
      const anchor =
        n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle";
      const offset = anchor === "start" ? -inset : anchor === "end" ? inset : 0;
      svg += `<text x="${x(i) + offset}" y="${height - 6}" text-anchor="${anchor}" class="score-history-tick">${shortDate(rounds[i].time)}</text>`;
    });

    // crosshair (moved by the hover layer)
    svg += `<line class="score-history-crosshair" y1="${m.top}" y2="${height - m.bottom}" stroke="#b9b0a5" stroke-width="1" visibility="hidden"/>`;

    // the line and the points
    if (n > 1) {
      const path = rounds
        .map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(r.dev)}`)
        .join("");
      svg += `<path d="${path}" fill="none" stroke="${MUTED}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    rounds.forEach((r, i) => {
      svg += `<circle class="score-history-dot" cx="${x(i)}" cy="${y(r.dev)}" r="4.5"
        fill="${devColor(r.dev)}" stroke="${SURFACE}" stroke-width="2"/>`;
    });

    // direct labels: only the personal best (first time achieved) and the newest round
    const pbIndex = devs.indexOf(min);
    const lastIndex = n - 1;
    // the PB is the lowest point, so its label goes below it (above, it would sit on the line)
    const label = (i, text, preferBelow = false) => {
      const px = x(i);
      const py = y(rounds[i].dev);
      const above = preferBelow
        ? py + 19 > height - m.bottom + 4
        : py - 11 > m.top - 8;
      const anchor =
        px > width - m.right - 24
          ? "end"
          : px < m.left + 24
            ? "start"
            : "middle";
      const dx = anchor === "end" ? 6 : anchor === "start" ? -6 : 0;
      return `<text x="${px + dx}" y="${above ? py - 10 : py + 19}" text-anchor="${anchor}" class="score-history-label">${text}</text>`;
    };
    if (pbIndex === lastIndex) {
      svg += label(
        lastIndex,
        `${this.formatDevFromPar(rounds[lastIndex].dev)} PB`,
        true,
      );
    } else {
      svg += label(lastIndex, this.formatDevFromPar(rounds[lastIndex].dev));
      svg += label(pbIndex, "PB", true);
    }

    // hover layer: bigger than the points, the nearest round is picked
    svg += `<rect class="score-history-hit" x="${m.left}" y="0" width="${width - m.left - m.right}" height="${height}" fill="transparent"/>`;
    svg += `</svg>`;

    chart.innerHTML = svg + `<div class="score-history-tooltip" hidden></div>`;
    this.setupScoreHistoryHover(chart, rounds, x, y, devColor);
  }

  setupScoreHistoryHover(chart, rounds, x, y, devColor) {
    const svg = chart.querySelector("svg");
    const crosshair = svg.querySelector(".score-history-crosshair");
    const dots = [...svg.querySelectorAll(".score-history-dot")];
    const tooltip = chart.querySelector(".score-history-tooltip");
    let current = null;

    const show = (i) => {
      current = i;
      const r = rounds[i];
      crosshair.setAttribute("x1", x(i));
      crosshair.setAttribute("x2", x(i));
      crosshair.setAttribute("visibility", "visible");
      dots.forEach((d, k) => d.setAttribute("r", k === i ? 6.5 : 4.5));

      // value first, then the date; text in text colors, the colored dot carries the color
      tooltip.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="score-history-tooltip-key" style="background: ${devColor(r.dev)}"></span>
          <span><b>${this.formatDevFromPar(r.dev)}</b> (${r.total})</span>
        </div>
        <div class="text-secondary">${this.formatDate(r.time)}</div>
        <button type="button" class="btn btn-link btn-sm p-0 score-history-goto">Zur Partie</button>`;
      tooltip
        .querySelector(".score-history-goto")
        .addEventListener("click", () =>
          this.openLinkedSection("partie", r.linkValue),
        );
      tooltip.hidden = false;

      // above the point, kept inside the chart; below it if there is no room above
      const tipWidth = tooltip.offsetWidth;
      const tipHeight = tooltip.offsetHeight;
      const left = Math.min(
        Math.max(x(i) - tipWidth / 2, 0),
        chart.clientWidth - tipWidth,
      );
      const top =
        y(r.dev) - tipHeight - 12 >= 0
          ? y(r.dev) - tipHeight - 12
          : y(r.dev) + 14;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    const hide = () => {
      current = null;
      crosshair.setAttribute("visibility", "hidden");
      dots.forEach((d) => d.setAttribute("r", 4.5));
      tooltip.hidden = true;
    };
    chart.hideTooltip = hide;

    const nearest = (clientX) => {
      const px = clientX - svg.getBoundingClientRect().left;
      let best = 0;
      rounds.forEach((_, i) => {
        if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
      });
      return best;
    };

    svg.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") show(nearest(e.clientX));
    });
    svg.addEventListener("pointerdown", (e) => show(nearest(e.clientX)));
    // mouse: hide when leaving the chart (the tooltip belongs to it, so its button stays reachable)
    // (a property, not addEventListener: the chart element stays when the chart is redrawn)
    chart.onpointerleave = (e) => {
      if (e.pointerType === "mouse") hide();
    };

    // keyboard: arrow keys move through the rounds
    svg.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const start = current ?? (e.key === "ArrowLeft" ? rounds.length : -1);
      show(
        Math.min(
          Math.max(start + (e.key === "ArrowLeft" ? -1 : 1), 0),
          rounds.length - 1,
        ),
      );
    });
    svg.addEventListener("blur", (e) => {
      if (!tooltip.contains(e.relatedTarget)) hide();
    });
  }

  // the player's latest ranked match
  getLastMatch(name) {
    return Object.values(this.matches)
      .filter((match) => !match.unranked && name in match.players)
      .reduce(
        (latest, match) =>
          !latest || match.startTime > latest.startTime ? match : latest,
        null,
      );
  }

  // "heute", "gestern", "vor 3 Tagen", "vor 2 Wochen", "vor einem Monat", "vor 2 Jahren"
  // (by calendar days, so a match late yesterday is "gestern" also after midnight)
  formatTimeAgo(time, now = new Date()) {
    const calendarDay = (t) =>
      Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 86400000;
    const days = Math.max(0, calendarDay(now) - calendarDay(time));
    if (days === 0) return "heute";
    if (days === 1) return "gestern";
    const ago = (count, one, many) =>
      `vor ${count === 1 ? `einem ${one}` : `${count} ${many}`}`;
    if (days < 14) return ago(days, "Tag", "Tagen");
    if (days < 60) return ago(Math.floor(days / 7), "Woche", "Wochen");
    if (days < 365) return ago(Math.floor(days / 30), "Monat", "Monaten");
    return ago(Math.floor(days / 365), "Jahr", "Jahren");
  }

  getLastActivityString(player) {
    const match = this.getLastMatch(player.name);
    if (!match) return "";
    const linkValue = this.getMatchLinkValue(match);
    return `
                <h5>Letzte Aktivität</h5>
                <p><a class="match-link text-decoration-none" href="?partie=${linkValue}" data-match="${linkValue}">${this.formatTimeAgo(match.startTime)} auf ${this.escapeHtml(match.course)} (${this.escapeHtml(match.layout)})</a></p>`;
  }

  getRecentScoresString(player) {
    const MAX_RECENT = 4;
    const label = (courseKey) => {
      const course = this.courses[courseKey];
      return `${course.course} (${course.layout})`;
    };

    // by course, its standard layout first, the other layouts alphabetically
    const recentScoresEntries = Object.entries(player.recentScores).sort(
      ([keyA], [keyB]) => {
        const a = this.courses[keyA];
        const b = this.courses[keyB];
        return (
          a.course.localeCompare(b.course, "de", { numeric: true }) ||
          this.isStandardLayout(b.course, b.layout) -
            this.isStandardLayout(a.course, a.layout) ||
          keyA.localeCompare(keyB, "de", { numeric: true })
        );
      },
    );
    if (recentScoresEntries.length === 0) return "";

    let html = `<h5>Letzte Ergebnisse</h5>`;

    recentScoresEntries.forEach(([courseKey]) => {
      const course = this.courses[courseKey];

      html += `
    <details class="mb-2">
      <summary style="cursor: pointer">${course.course} (${course.layout})</summary>
      ${this.getScoreHistoryString(player, course)}
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
            <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle; border-left: 3px double #adb5bd;">PB&#x00B9;</th>
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

      html += `</tr></tbody></table>`;

      if (this.hasIsomorphHoles(course)) {
        html += this.getIsomorphToggleString(
          this.getRecentHolesTableString(player, course, MAX_RECENT, true),
          this.getRecentHolesTableString(player, course, MAX_RECENT, false),
          true, // player section: by default incl. isomorph holes
        );
      } else {
        html += this.getRecentHolesTableString(
          player,
          course,
          MAX_RECENT,
          false,
        );
      }

      html += `
      <div class="d-flex flex-wrap gap-3" style="font-size: 0.75rem;">&#x00B9; über die gesamte Zeit</div>
    </details>`;
    });

    return html;
  }

  // per hole: last #maxRecent scores, PB and average of player (optionally incl. isomorph holes)
  getRecentHolesTableString(player, course, MAX_RECENT, includeIsomorphs) {
    let html = `
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
            <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle; border-left: 3px double #adb5bd;">PB&#x00B9;</th>
            <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;">&#x2300;&#x00B9;</th>
          </tr>
        </thead>
        <tbody>`;

    for (let hole = 1; hole <= course.howManyHoles; hole++) {
      const recent = this.getCombinedRecentScores(
        player,
        course,
        hole,
        MAX_RECENT,
        includeIsomorphs,
      );
      if (recent.length === 0) continue; // never played this hole (or an included isomorph of it)

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

      const pb = this.getPersonalBestScore(
        player,
        course,
        hole,
        includeIsomorphs,
      );
      const originalPar = course[hole][0].score;
      html += `
        <td style="padding: 3px; width: 36px; line-height: 1; vertical-align: middle; border-left: 3px double #adb5bd; cursor: pointer;" ${this.getPopoverAttributes(`${this.getPbDateLabel(pb.time, pb.count > 1)}<br>auf ${pb.layout}`)}>
          <span class="badge bg-scorecard-${this.getScoreClass(pb.score - originalPar)}" style="display: block; width: 30px; margin: 0 auto; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${pb.score}</span>
        </td>`;

      const average = this.getAverageScore(
        player,
        course,
        hole,
        includeIsomorphs,
      );
      const averageText = new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(average);
      const throwsPopover = this.getThrowsDistributionPopoverContent(
        this.getCombinedScores(player, course, hole, includeIsomorphs),
      );
      html += `
        <td style="padding: 3px; width: 46px; line-height: 1; vertical-align: middle; cursor: pointer;" ${this.getPopoverAttributes(throwsPopover)}>
          <span class="badge bg-scorecard-${this.getScoreClass(Math.round(average - originalPar))}" style="display: block; width: 40px; margin: 0 auto; text-align: center; padding-left: 0; padding-right: 0; overflow: hidden; white-space: nowrap;">${averageText}</span>
        </td>`;
    }

    html += `
        </tbody>
      </table>`;

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

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
              ${this.getLinkAttributes("spieler", player.name)}
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

    player.playedCourses.forEach((course, i, courses) => {
      // one cell per course spanning all of its layouts (they are adjacent)
      let courseCell = "";
      if (i === 0 || courses[i - 1].course !== course.course) {
        const layoutCount = courses.filter(
          (c) => c.course === course.course,
        ).length;
        courseCell = `<th class="text-start-table-header-info"${layoutCount > 1 ? ` rowspan="${layoutCount}"` : ""}>${course.course}</th>`;
      }
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
        ${courseCell}
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
                    ${SCORE_CATEGORIES.map(
                      (c) => `
                        <tr>
                          <th class="text-start-table-header-info">${c.label}</th>
                          <th>${this.getScoreClassDot(c.cls)}</th>
                          <td>${player.devFromParPerHole[c.key]}</td>
                        </tr>`,
                    ).join("")}
                  </tbody>
                </table>
                ${this.getPlayingPartnersString(player)}`;

    // share text: the number of matches and the PB per layout
    const shareLines = [
      `${player.name} - ${player.playedCoursesCount} ${player.playedCoursesCount === 1 ? "Partie" : "Partien"}`,
    ];
    player.playedCourses.forEach((course) => {
      const pb = this.getPersonalBestTotal(player, course);
      if (pb !== null)
        shareLines.push(
          `${course.course} (${course.layout}) - PB ${this.formatDevFromPar(pb.dev)} (${pb.total})`,
        );
    });
    playerString += `
                ${this.getWithLinkButtons(this.getLastActivityString(player) + this.getRecentScoresString(player), "btn-outline-secondary", shareLines.join("\n"))}
              </div>
            </div>
          </div>`;

    document.getElementById("playersAccordion").innerHTML += playerString;
  }

  // Playing partners (open item #29): who a player played with, by the number of shared
  // matches (unranked ones don't count, like everywhere else), most first, ties by name
  getPlayingPartners(name) {
    const counts = new Map();
    Object.values(this.matches).forEach((match) => {
      if (match.unranked || !(name in match.players)) return;
      Object.keys(match.players).forEach((other) => {
        if (other === name || other === "Par" || !(other in this.players))
          return;
        counts.set(other, (counts.get(other) ?? 0) + 1);
      });
    });
    return [...counts]
      .map(([partner, count]) => ({ name: partner, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
  }

  // ranked matches the player played alone
  getSoloMatchCount(name) {
    return Object.values(this.matches).filter((match) => {
      if (match.unranked || !(name in match.players)) return false;
      return Object.keys(match.players).every(
        (other) => other === name || other === "Par",
      );
    }).length;
  }

  // the partners plus a "Solo" entry (if any), sorted like a real partner
  getPlayingPartnerRows(name) {
    const rows = this.getPlayingPartners(name);
    const soloCount = this.getSoloMatchCount(name);
    if (soloCount > 0) rows.push({ name: "Solo", count: soloCount, solo: true });
    return rows.sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"),
    );
  }

  getPlayingPartnersString(player) {
    const partners = this.getPlayingPartnerRows(player.name);
    if (partners.length === 0) return "";
    return `
                <h5>Mitspieler:</h5>
                <table
                  class="table table-bordered text-center align-middle w-auto"
                >
                  <tbody>
                    ${partners
                      .map(
                        ({ name, count, solo }) => `
                        <tr>
                          ${
                            solo
                              ? `<th class="text-start fst-italic">Solo</th>`
                              : `<th class="text-start"><a class="player-link" href="?spieler=${encodeURIComponent(name)}" ${this.getPlayerLinkAttribute(name)}>${this.escapeHtml(name)}</a></th>`
                          }
                          <td>${count}</td>
                        </tr>`,
                      )
                      .join("")}
                  </tbody>
                </table>`;
  }

  getCourseString(course) {
    const courseNameWithoutSpecialChars = (
      course.course + course.layout
    ).replace(/[^a-zA-Z0-9]/g, ""); // specialChars problematic in ids

    // all players who played this course/layout with their number of matches on it:
    // the ones with a completed round best (lowest) first, then the others, most matches first
    const playerRows = Object.values(this.players)
      .map((player) => ({
        name: player.name,
        count:
          player.playedCourses.find(
            (c) => c.course === course.course && c.layout === course.layout,
          )?.count ?? 0,
        pb: this.getPersonalBestTotal(player, course),
      }))
      .filter(({ count, pb }) => count > 0 || pb !== null)
      .sort(
        (a, b) =>
          (a.pb === null) - (b.pb === null) ||
          (a.pb && b.pb
            ? a.pb.dev - b.pb.dev || a.pb.time - b.pb.time // tie: who was first
            : b.count - a.count) ||
          a.name.localeCompare(b.name),
      );
    const pbRows = playerRows.filter(({ pb }) => pb !== null);
    // the same PB shares a place (1, T2, T2, 4)
    pbRows.forEach((row, i) => {
      row.rank =
        i > 0 && row.pb.dev === pbRows[i - 1].pb.dev
          ? pbRows[i - 1].rank
          : i + 1;
    });
    pbRows.forEach((row) => {
      row.tied = pbRows.filter((other) => other.rank === row.rank).length > 1;
      row.rankLabel = this.formatRank(row.rank, row.tied);
    });

    let pbRowsString = "";
    if (playerRows.length === 0) {
      pbRowsString = `<tr><td colspan="4" class="text-muted">Noch keine abgeschlossene Runde.</td></tr>`;
    } else {
      playerRows.forEach(({ name, count, pb, rank, tied }) => {
        // if no completed round: no PB
        let pbCell = `<td style="border-left: 3px double #adb5bd;">-</td>`;
        if (pb !== null) {
          const pbColor =
            pb.dev > 0 ? "#e26028" : pb.dev < 0 ? "#408ce2" : "#212529";
          pbCell = `
            <td style="border-left: 3px double #adb5bd; cursor: pointer;" ${this.getPopoverAttributes(this.getPbDateLabel(pb.time, pb.count > 1))}>
              <b style="color: ${pbColor};">${this.formatDevFromPar(pb.dev)}</b> (${pb.total})
            </td>`;
        }
        pbRowsString += `
          <tr>
            <td style="border-right-width: 0; padding-right: 0;">${rank ? this.getRankBadge(rank, tied) : ""}</td>
            <th class="text-start" style="border-left-width: 0;">${name}</th>
            <td>${count}</td>${pbCell}
          </tr>`;
      });
    }

    return `<div class="accordion-item">
            <h2 class="accordion-header" id="heading-${courseNameWithoutSpecialChars}">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse-${courseNameWithoutSpecialChars}"
                aria-expanded="true"
                aria-controls="collapse-${courseNameWithoutSpecialChars}"
              >
                <div class="layout-title">
                  <h4>${course.layout}</h4>
                  <span class="layout-caption">Layout</span>
                </div>
              </button>
            </h2>
            <div
              id="collapse-${courseNameWithoutSpecialChars}"
              class="accordion-collapse collapse"
              aria-labelledby="heading-${courseNameWithoutSpecialChars}"
              ${this.getLinkAttributes("parcours", `${course.course} (${course.layout})`)}
            >
              <div class="accordion-body" style="background-color: #fff9f3;">
                <h5>Bestenliste:</h5>
                <table
                  class="table table-bordered text-center align-middle w-auto"
                >
                  <thead>
                    <tr>
                      <th colspan="2" style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;">Spieler</th>
                      <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle;"># gesp.</th>
                      <th style="font-size: 0.75rem; padding: 2px 6px; vertical-align: middle; border-left: 3px double #adb5bd;">PB</th>
                    </tr>
                  </thead>
                  <tbody>${pbRowsString}</tbody>
                </table>
                ${this.getWithLinkButtons(
                  this.getHoleStatsString(course),
                  "btn-outline-secondary",
                  [
                    `Bestenliste ${course.course} (${course.layout})`,
                    ...pbRows.map(
                      ({ name, pb, rankLabel }) =>
                        `${rankLabel}. ${name} ${this.formatDevFromPar(pb.dev)} (${pb.total})`,
                    ),
                  ].join("\n"),
                )}
              </div>
            </div>
          </div>`;
  }

  // the layouts per course for the course list: the played ones plus the ones only known from
  // course_data/hole_lengths.csv ({ course, layout, unplayed: true }, kept out of this.courses
  // so they count in no statistic). Played courses first, then alphabetically; within a course
  // the played layouts first, of those the standard layout, then alphabetically
  getCourseGroups() {
    const played = Object.values(this.courses);
    const playedCourses = new Set(played.map((c) => c.course));
    const unplayed = this.holeLengthsSets
      .filter((s) => !this.courses[s.course + s.layout])
      .map(({ course, layout }) => ({ course, layout, unplayed: true }));

    const groups = new Map();
    [...played, ...unplayed]
      .sort(
        (a, b) =>
          playedCourses.has(b.course) - playedCourses.has(a.course) ||
          a.course.localeCompare(b.course) ||
          Boolean(a.unplayed) - Boolean(b.unplayed) ||
          this.isStandardLayout(b.course, b.layout) -
            this.isStandardLayout(a.course, a.layout) ||
          (a.course + a.layout).localeCompare(b.course + b.layout),
      )
      .forEach((entry) => {
        if (!groups.has(entry.course)) groups.set(entry.course, []);
        groups.get(entry.course).push(entry);
      });
    return [...groups.values()];
  }

  // a layout without any round: grayed out, opens to its holes with their length
  getUnplayedLayoutString(entry) {
    const id = (entry.course + entry.layout).replace(/[^a-zA-Z0-9]/g, ""); // like getCourseString
    return `<div class="accordion-item layout-unplayed">
            <h2 class="accordion-header" id="heading-${id}">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse-${id}"
                aria-expanded="false"
                aria-controls="collapse-${id}"
                title="Noch nicht gespielt"
              >
                <div class="layout-title">
                  <h4>${entry.layout}</h4>
                  <span class="layout-caption">Layout</span>
                  <span class="visually-hidden">(noch nicht gespielt)</span>
                </div>
              </button>
            </h2>
            <div
              id="collapse-${id}"
              class="accordion-collapse collapse"
              aria-labelledby="heading-${id}"
              ${this.getLinkAttributes("parcours", `${entry.course} (${entry.layout})`)}
            >
              <div class="accordion-body" style="background-color: #fff9f3;">
                ${this.getUnplayedHolesString(entry)}
              </div>
            </div>
          </div>`;
  }

  // "Gespielte Parcours": one entry per course with the weather forecast (the same for all
  // layouts) and an accordion of its layouts (see getCourseString)
  renderCourseGroup(layouts) {
    const { course } = layouts[0];
    const id = `course-${course.replace(/[^a-zA-Z0-9]/g, "")}`; // specialChars problematic in ids
    const neverPlayed = layouts.every((layout) => layout.unplayed);
    document.getElementById("coursesAccordion").innerHTML += `
          <div class="accordion-item col-lg-6 mx-auto${neverPlayed ? " course-unplayed" : ""}">
            <h2 class="accordion-header" id="heading-${id}">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse-${id}"
                aria-expanded="true"
                aria-controls="collapse-${id}"
              >
                <h4>${course}<span class="course-weather-tags"></span></h4>
              </button>
            </h2>
            <div
              id="collapse-${id}"
              class="accordion-collapse collapse"
              aria-labelledby="heading-${id}"
            >
              <div class="accordion-body" style="background-color: #fff9f3;">
                ${this.getCurrentWeatherString(layouts[0])}
                <div class="accordion course-layouts">
                  ${layouts
                    .map((layout) =>
                      layout.unplayed
                        ? this.getUnplayedLayoutString(layout)
                        : this.getCourseString(layout),
                    )
                    .join("")}
                </div>
              </div>
            </div>
          </div>`;
  }

  getMatchesString(match) {
    const HOLES_PER_ROW = 9;
    // on big screens an opened match gets wider and shows 18 holes per row (see styles.css)
    const HOLES_PER_WIDE_ROW = 18;
    const wideScorecard = match.holes > HOLES_PER_ROW;
    const par = match.players["Par"];
    const collapseId = `scorecard-collapsing-${match.startTime.valueOf()}`;

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
          html += `<td class="scorecard-cell" style="line-height: 0.8">${match.holeLengths[i]}</td>`;
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
              <th class="text-start" style="line-height: 0.2"><span class="scorecard-name">${playerKey}</span></th>`;
        for (let i = from; i < to; i++) {
          const devFromParOnThisHole = playerVal.holes[i] - par.holes[i];
          const classToAssign =
            playerVal.holes[i] === "-"
              ? "par" // if not played: no background which is the same background as par
              : this.getScoreClass(playerVal.holes[i] - par.holes[i]);

          html += `
              <td class="scorecard-cell" style="line-height: 0.2">
                <span class="badge bg-scorecard-${classToAssign} scorecard-badge">${playerVal.holes[i]}</span>
              </td>`;
        }
        html += `</tr>`;
      });

      html += `
          </tbody>
        </table>`;
      return html;
    };

    // what the match sort orders by (see setupMatchSort): the best deviation from par of a
    // completed round (empty if nobody completed it)
    const completedDevs = sortedPlayers
      .filter(([, p]) => p.howManyHolesNotPlayedInThisMatch === 0)
      .map(([, p]) => p.devFromPar);
    const winningDev = completedDevs.length ? Math.min(...completedDevs) : "";

    // what the match filter searches in (see setupMatchFilter)
    const filterText = [
      match.course,
      match.layout,
      ...sortedPlayers.map(([playerKey]) => playerKey),
      match.comment ?? "",
      match.unranked ? "unranked" : "",
    ]
      .join(" ")
      .toLowerCase();
    const day = String(match.startTime.getDate()).padStart(2, "0");
    const month = String(match.startTime.getMonth() + 1).padStart(2, "0");
    const year = match.startTime.getFullYear();
    const filterDates = `${day}.${month}.${year} ${month}.${year} ${year}`;

    let statsString = `
        <div
          class="d-flex justify-content-start justify-content-md-center mt-4 match-card"
          style="margin-bottom: 10px"
          data-filter-text="${filterText.replace(/"/g, "&quot;")}"
          data-filter-dates="${filterDates}"
          data-start="${match.startTime.getTime()}"
          data-player-count="${sortedPlayers.length}"
          data-winning-dev="${winningDev}"
        >
          <div
            class="bg-dark text-white p-3 rounded d-inline-block match-box${wideScorecard ? " match-box-wide" : ""}"
            style="cursor: pointer;"
            data-bs-toggle="collapse"
            data-bs-target="#${collapseId}"
          >
            <h4>${match.course} <span style="white-space: nowrap;">(${match.layout}) -</span> <span style="white-space: nowrap;">${this.formatDateStringForStatsStringHeader(match.startTime)}</span></h4>
            <h5 class="mb-3">Ergebnis${match.unranked ? ` <span class="badge unranked-badge" title="Zählt nicht für die Statistiken">Unranked</span>` : ""}</h5>
            <div class="scorecard-scroll mb-3">
            <table
              class="table table-dark table-bordered text-center align-middle w-auto mb-0"
            >
              <tbody>`;

    sortedPlayers.forEach(([playerKey, playerVal]) => {
      statsString += `<tr>
        <th class="text-start">${playerKey in this.players ? `<a class="player-link" href="?spieler=${encodeURIComponent(playerKey)}" ${this.getPlayerLinkAttribute(playerKey)}>${playerKey}</a>` : playerKey}</th>
        <td><b style="color: ${playerVal.devFromPar > 0 ? '#fd6c2e">+' : playerVal.devFromPar == 0 ? '#ffffff">' : '#408ce2">'}${playerVal.devFromPar != 0 ? playerVal.devFromPar : "E"}</b> (${playerVal.total})</td>
        ${playerVal.howManyHolesNotPlayedInThisMatch > 0 ? "<td><span style='font-size: 0.7rem'>THRU</span> " + (match.holes - playerVal.howManyHolesNotPlayedInThisMatch) + "</td>" : ""}
        ${this.getMatchDistributionCell(playerVal, par.holes, collapseId)}
    </tr>`;
    });

    statsString += `
            </tbody>
          </table>
          </div>
          ${match.comment ? `<p class="match-comment mb-3">${this.escapeHtml(match.comment)}</p>` : ""}
          <div class="collapse" id="${collapseId}" ${this.getLinkAttributes("partie", this.getMatchLinkValue(match))}>
            <ul><li>Start - ${this.formatDateStringForStatsStringCollapsed(match.startTime)}</li>
            <li>Dauer - ${match.duration}</li>
            <li>Ende - ${this.formatDateStringForStatsStringCollapsed(match.endTime)}</li>
            ${this.getWeatherListItem(match)}</ul>
            <h5 class="mb-3">Scorecard</h5>`;

    // One table per block of 9 holes, all in one shared scroll container
    // so the blocks scroll horizontally together; the link buttons go next to it if they fit.
    // With more than 9 holes also a variant with blocks of 18 holes, which replaces it on
    // big screens (see styles.css)
    const buildScorecardBlocks = (holesPerRow, variantClass) => {
      let html = `<div class="${variantClass}">`;
      for (let from = 0; from < match.holes; from += holesPerRow)
        html += buildScorecardTable(
          from,
          Math.min(from + holesPerRow, match.holes),
        );
      return html + `</div>`;
    };
    statsString += `<div class="with-link-buttons scorecard-row"><div class="scorecard-scroll">`;
    statsString += buildScorecardBlocks(
      HOLES_PER_ROW,
      wideScorecard ? "scorecard-narrow-only" : "",
    );
    if (wideScorecard)
      statsString += buildScorecardBlocks(
        HOLES_PER_WIDE_ROW,
        "scorecard-wide-only",
      );

    statsString += `
          </div>
          ${this.getShareButtonString("btn-outline-light", "")}
          </div>
          </div>
        </div>
      </div>`;

    document.getElementById("partien-container").innerHTML += statsString;
  }

  // ---------------------------------------------------------------------------
  // Records (open item #6): one card per record with the top 3, in the "Rekorde" section.
  // A birdie counts every score below par (like "Unter" in the player stats).
  // ---------------------------------------------------------------------------

  // every round of every player, with the deviation from par per hole (null = not played)
  getAllRounds() {
    return this.getRankedMatches().flatMap((match) => {
      const par = match.players["Par"].holes;
      return Object.entries(match.players)
        .filter(([name]) => name !== "Par")
        .map(([name, round]) => ({
          name,
          match,
          scores: round.holes,
          devs: round.holes.map((score, i) =>
            score === "-" ? null : score - par[i],
          ),
        }));
    });
  }

  // entries: { name, value, match?, detail? }; higher value is better. perRound: a player can
  // be listed several times (one entry per round), the card gets a switch to show only the
  // best entry of each player (switched on at first if bestPerPlayerByDefault).
  getRecords() {
    const rounds = this.getAllRounds();
    const isBirdie = (dev) => dev !== null && dev <= -1;

    // aces per player, with the most recent one
    const aces = new Map();
    rounds.forEach((round) =>
      round.scores.forEach((score, i) => {
        if (score !== 1) return;
        const entry = aces.get(round.name) ?? { name: round.name, value: 0 };
        entry.value++;
        if (!entry.match || round.match.startTime > entry.match.startTime) {
          entry.match = round.match;
          entry.detail = `zuletzt Bahn ${i + 1}`;
        }
        aces.set(round.name, entry);
      }),
    );

    const birdieRounds = rounds
      .map((round) => ({
        name: round.name,
        match: round.match,
        value: round.devs.filter(isBirdie).length,
      }))
      .filter((entry) => entry.value > 0);

    // longest run of holes matching isHit within one round (unplayed holes end a run)
    const getStreaks = (isHit) =>
      rounds
        .map((round) => {
          let best = { value: 0, end: 0 };
          let run = 0;
          round.devs.forEach((dev, i) => {
            run = isHit(dev) ? run + 1 : 0;
            if (run > best.value) best = { value: run, end: i + 1 };
          });
          return {
            name: round.name,
            match: round.match,
            value: best.value,
            detail: `Bahn ${best.end - best.value + 1}–${best.end}`,
          };
        })
        .filter((entry) => entry.value >= 2);

    const streaks = getStreaks(isBirdie);
    const bogeyFreeStreaks = getStreaks((dev) => dev !== null && dev <= 0);

    // completed rounds without a hole over par, per player, with the most recent one
    const bogeyFree = new Map();
    rounds
      .filter((round) => round.devs.every((dev) => dev !== null && dev <= 0))
      .forEach((round) => {
        const entry = bogeyFree.get(round.name) ?? {
          name: round.name,
          value: 0,
        };
        entry.value++;
        if (!entry.match || round.match.startTime > entry.match.startTime) {
          entry.match = round.match;
          const total = round.devs.reduce((a, b) => a + b, 0);
          entry.detail = `zuletzt ${this.formatDevFromPar(total)}`;
        }
        bogeyFree.set(round.name, entry);
      });

    const weeklyStreaks = this.getWeeklyStreaks();

    const mostRounds = Object.values(this.players).map((player) => ({
      name: player.name,
      value: player.playedCoursesCount,
      detail: `auf ${player.playedCourses.length} Layouts`,
    }));

    return [
      {
        title: "Meiste Asse",
        icon: "bullseye",
        entries: [...aces.values()],
        empty: "Noch kein Ass.",
      },
      {
        title: "Meiste Birdies in einer Partie",
        icon: "dove",
        entries: birdieRounds,
        perRound: true,
        bestPerPlayerByDefault: true,
        empty: "Noch kein Birdie.",
      },
      {
        title: "Längste Birdie-Serie",
        icon: "fire",
        entries: streaks,
        perRound: true,
        empty: "Noch keine zwei Birdies hintereinander.",
      },
      {
        title: "Längste Bogey-freie Serie",
        icon: "equals",
        entries: bogeyFreeStreaks,
        perRound: true,
        empty: "Noch keine zwei Bahnen ohne Bogey hintereinander.",
      },
      {
        title: "Bogey-freie Runden",
        icon: "shield-halved",
        entries: [...bogeyFree.values()],
        empty: "Noch keine Runde ohne Bogey.",
      },
      {
        title: "Meiste Partien",
        icon: "calendar-check",
        entries: mostRounds,
        empty: "Noch keine Partie.",
      },
      {
        title: "Längste Wochen-Serie",
        icon: "calendar-week",
        entries: weeklyStreaks,
        empty: "Noch niemand in zwei Wochen hintereinander gespielt.",
      },
    ];
  }

  // Longest weekly streak (open item #36): per player the most calendar weeks (Monday to
  // Sunday) in a row with at least one ranked match, from 2 weeks on. A streak is still
  // running if the player played this week or last week (this week is not over yet).
  // Of equally long streaks of one player the latest counts. time = when the streak got
  // that long (who got there first is listed first on equal values).
  getWeeklyStreaks(now = new Date()) {
    const DAY = 24 * 60 * 60 * 1000;
    // number of the week (weeks start on Monday; 1 Jan 1970 was a Thursday)
    const weekOf = (date) =>
      Math.floor(
        (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY +
          3) /
          7,
      );
    const currentWeek = weekOf(now);

    const matchesByPlayer = new Map();
    this.getRankedMatches()
      .sort((a, b) => a.startTime - b.startTime)
      .forEach((match) =>
        Object.keys(match.players)
          .filter((name) => name !== "Par")
          .forEach((name) => {
            if (!matchesByPlayer.has(name)) matchesByPlayer.set(name, []);
            matchesByPlayer.get(name).push(match);
          }),
      );

    const entries = [];
    matchesByPlayer.forEach((matches, name) => {
      let best = null;
      let start = null; // first match of the current run
      let weeks = 0;
      matches.forEach((match, i) => {
        const week = weekOf(match.startTime);
        const previousWeek = i > 0 ? weekOf(matches[i - 1].startTime) : null;
        if (week === previousWeek) {
          if (best?.end === matches[i - 1]) best.end = match; // the run goes on this week
          return;
        }
        if (week === previousWeek + 1) weeks++;
        else {
          start = match;
          weeks = 1;
        }
        if (!best || weeks >= best.value)
          best = { value: weeks, start, end: match };
      });
      if (best.value < 2) return;

      const running = weekOf(best.end.startTime) >= currentWeek - 1;
      entries.push({
        name,
        value: best.value,
        time: best.end.startTime,
        detail: running
          ? `seit ${this.formatDate(best.start.startTime)}, läuft noch`
          : `${this.formatDate(best.start.startTime)} – ${this.formatDate(best.end.startTime)}`,
      });
    });
    return entries;
  }

  // best first; equal values share a rank (1, 1, 3) and the one who got there first is listed
  // first. Shows everyone on the ranks 1 to maxRank, so ties are shown in full.
  rankRecordEntries(entries, maxRank = 3) {
    const ranked = [...entries].sort(
      (a, b) =>
        b.value - a.value ||
        (a.time ?? a.match?.startTime ?? 0) -
          (b.time ?? b.match?.startTime ?? 0) ||
        a.name.localeCompare(b.name),
    );
    ranked.forEach((entry, i) => {
      entry.rank =
        i > 0 && entry.value === ranked[i - 1].value
          ? ranked[i - 1].rank
          : i + 1;
    });
    return ranked.filter((entry) => entry.rank <= maxRank);
  }

  // only the best entry of each player (of equally good ones the earlier, like in the ranking)
  getBestEntryPerPlayer(entries) {
    const best = new Map();
    this.rankRecordEntries(entries, Infinity).forEach((entry) => {
      if (!best.has(entry.name)) best.set(entry.name, entry);
    });
    return [...best.values()];
  }

  renderRecords() {
    document.getElementById("recordsContainer").innerHTML = this.getRecords()
      .map((record) => this.getRecordCardString(record))
      .join("");
  }

  getRecordCardString({
    title,
    icon,
    entries,
    perRound,
    bestPerPlayerByDefault,
    empty,
    note,
  }) {
    const rows = this.rankRecordEntries(entries);
    const listString = this.getRecordListString(rows, empty);

    // switch only if showing one entry per player would change anything
    let body = listString;
    if (perRound) {
      const bestRows = this.rankRecordEntries(
        this.getBestEntryPerPlayer(entries),
      );
      const bestListString = this.getRecordListString(bestRows, empty);
      if (bestListString !== listString)
        body = this.getVariantToggleString(
          "nur bester Eintrag pro Spieler",
          bestListString,
          listString,
          Boolean(bestPerPlayerByDefault),
        );
    }

    return `
      <div class="col-md-6">
        <div class="record-card h-100">
          <h5 class="record-title"><span class="record-icon"><i class="fas fa-${icon}"></i></span>${title}</h5>
          ${body}
          ${note ? `<div class="record-note">${note}</div>` : ""}
        </div>
      </div>`;
  }

  // a place shared with others gets a T ("tied"): 1, T2, T2, 4
  formatRank(rank, tied) {
    return tied ? `T${rank}` : String(rank);
  }

  // the place in a circle: gold, silver, bronze for 1 to 3, gray below (see .record-rank)
  getRankBadge(rank, tied) {
    return `<span class="record-rank${rank <= 3 ? ` record-rank-${rank}` : ""}">${this.formatRank(rank, tied)}</span>`;
  }

  getRecordListString(rows, empty) {
    if (!rows.length) return `<p class="text-muted mb-0">${empty}</p>`;
    const rowStrings = rows.map((entry) => {
      const context = [entry.detail];
      if (entry.match) {
        context.push(
          `<a class="match-link" href="?partie=${this.getMatchLinkValue(entry.match)}" data-match="${this.getMatchLinkValue(entry.match)}">${this.formatDate(entry.match.startTime)}, ${entry.match.course} (${entry.match.layout})</a>`,
        );
      }
      return `
        <li class="record-row">
          ${this.getRankBadge(entry.rank, rows.filter((other) => other.rank === entry.rank).length > 1)}
          <div class="record-who">
            <a class="player-link fw-bold" href="?spieler=${encodeURIComponent(entry.name)}" ${this.getPlayerLinkAttribute(entry.name)}>${entry.name}</a>
            <div class="record-context">${context.filter(Boolean).join(" · ")}</div>
          </div>
          <span class="record-value"><b>${entry.value}</b></span>
        </li>`;
    });
    return `<ol class="record-list">${rowStrings.join("")}</ol>`;
  }

  // hidden by default, shown while the scorecard of this match is expanded
  getMatchDistributionCell(playerVal, parHoles, collapseId) {
    const distribution = this.getMatchDistribution(playerVal, parHoles);
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const cellAttributes = `data-scorecard-id="${collapseId}" style="display: none; padding: 6px;`;

    if (total === 0) return `<td ${cellAttributes}">-</td>`;

    const title = `${total} ${total === 1 ? "Bahn" : "Bahnen"}`;
    // stopPropagation: a tap on the bar must not collapse the scorecard again
    return `<td ${cellAttributes} cursor: pointer;" onclick="event.stopPropagation()" ${this.getPopoverAttributes(this.getDistributionPopoverContent(distribution, total, title))}>
      ${this.getDistributionBarString(distribution, total)}
    </td>`;
  }

  // distribution of all played holes of one player in one match
  getMatchDistribution(playerVal, parHoles) {
    const devs = playerVal.holes
      .map((score, i) => (score === "-" ? null : score - parHoles[i]))
      .filter((dev) => dev !== null);
    return this.createDistribution(devs);
  }

  getDistributionBarString(distribution, total) {
    const bar = SCORE_CATEGORIES.filter((s) => distribution[s.key] > 0)
      .map(
        (s) =>
          `<div class="bg-scorecard-${s.cls}" style="width: ${(distribution[s.key] / total) * 100}%;"></div>`,
      )
      .join("");
    return `<div style="display: flex; width: 110px; height: 14px; border-radius: 3px; overflow: hidden;">${bar}</div>`;
  }

  getDistributionPopoverContent(distribution, total, title) {
    return (
      `<b>${title}</b>` +
      SCORE_CATEGORIES.map((s) => {
        const count = distribution[s.key];
        const percent = Math.round((count / total) * 100);
        return `<span style="display: flex; align-items: center; gap: 8px; white-space: nowrap;${count === 0 ? " opacity: 0.4;" : ""}">
            ${this.getScoreClassDot(s.cls)}
            <span style="min-width: 2ch; text-align: right;">${count}</span>
            <span style="min-width: 4ch; text-align: right;">${percent}%</span>
          </span>`;
      }).join("")
    );
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
      return this.fetchAndRenderData(
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

  // 1 for the standard layout of a course (course_data/standard_layouts.csv), else 0
  isStandardLayout(course, layout) {
    return this.standardLayouts?.get(course) === layout ? 1 : 0;
  }

  async loadReferenceData() {
    const [lengthsText, isomorphText, coordinatesText, standardText] =
      await Promise.all([
        fetch("course_data/hole_lengths.csv").then((res) => res.text()),
        fetch("course_data/isomorph_holes.csv").then((res) => res.text()),
        // optional: without it there is just no weather
        fetch("course_data/course_coordinates.csv")
          .then((res) => (res.ok ? res.text() : ""))
          .catch(() => ""),
        // optional: without it no layout is sorted first
        fetch("course_data/standard_layouts.csv")
          .then((res) => (res.ok ? res.text() : ""))
          .catch(() => ""),
      ]);

    // course -> its standard layout; courses without one are left out
    this.standardLayouts = new Map();
    if (standardText)
      this.parseCsv(standardText).forEach((row) => {
        if (row.layout) this.standardLayouts.set(row.course, row.layout);
      });

    // course -> { latitude, longitude }; courses without coordinates are left out
    this.courseCoordinates = new Map();
    if (coordinatesText)
      this.parseCsv(coordinatesText).forEach((row) => {
        const latitude = parseFloat(row.latitude);
        const longitude = parseFloat(row.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude))
          this.courseCoordinates.set(row.course, { latitude, longitude });
      });

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

  // resolves after the browser has drawn the current state of the page; the timeout is
  // for background tabs, which draw nothing
  waitForPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve));
      setTimeout(resolve, 100);
    });
  }

  // Font Awesome turns the icons of the new content into SVGs after it was built, which
  // also blocks the page for a moment; at most 3 seconds, and nothing to wait for without it
  waitForIcons() {
    return Promise.race([
      window.FontAwesome?.dom?.i2svg?.(),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }

  // fades out the loading screen of index.html
  hideLoadingScreen() {
    const screen = document.getElementById("statsLoading");
    if (!screen) return;
    screen.classList.add("stats-loading-done");
    setTimeout(() => screen.remove(), 300);
  }

  async initialize() {
    // the loading screen has to be on screen before the page gets busy
    await this.waitForPaint();
    try {
      await this.loadReferenceData();
    } catch (error) {
      console.error("Error while loading csv files: ", error);
    }
    try {
      await this.loadTableData();
      await this.waitForIcons();
      await this.waitForPaint();
    } catch (error) {
      console.error("Error while building the page: ", error);
    } finally {
      this.hideLoadingScreen();
    }
  }
}

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

    // add hole length sets for new layouts here
    this.holeLengthsSets = [];

    // currently for the following Layouts:
    // Aachen Kronenbergpark (Main, Newcomer 18, Advanced Newcomer, Rotkehlchen, Andalucia Nueva, Aixpert 18, Pinguin, Phoenix, Spaßvogel)
    // Discgolfpark Herzogenrath (Main, Main + Six, Eurode 18)
    // Discgolfpark Station As (Main, Main 9 X 2)
    // Discgolfpark Rheindahlen (De Kull Main Am, De Kull Main, De Kull Safari)
    this.isomorphHoles = [];

    // for unique ids of the "identische Bahnen" switches
    this.isomorphSwitchCount = 0;
  }

  getURL(range) {
    return `https://docs.google.com/spreadsheets/d/${this.sheetID}/gviz/tq?sheet=${this.sheetName}range=${range}`;
  }

  fetchAndRenderData(url, cacheKey, renderFunction) {
    fetch(url)
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
          renderFunction(jsonData);
        },
        (error) => {
          console.error("Fehler beim Abrufen der Daten: ", error);
          this.renderLastData(cacheKey, renderFunction);
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
            this.players[row.c[0]?.v].playedHolesCount++;
            this.players[row.c[0]?.v].devs.push(
              row.c[7 + i]?.v -
                this.matches[row.c[3]?.v].players["Par"].holes[i - 1],
            );
          } else {
            // player has not played the hole
            newPlayerForMatch.howManyHolesNotPlayedInThisMatch++;
            newPlayerForMatch.holes.push("-");
            // unplayed hole: nothing is added
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
    Object.values(this.courses)
      .sort((a, b) => (a.course + a.layout).localeCompare(b.course + b.layout))
      .forEach((course) => this.getCourseString(course));

    this.renderRecords();

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
    const linkedSearch = new URLSearchParams(window.location.search).get("suche");
    if (linkedSearch) document.getElementById("matchFilter").value = linkedSearch;

    this.setupMatchFilter();
    this.setupScoreHistoryCharts(); // before the links, so a linked player gets the chart drawn
    this.setupShareableLinks();

    // "identische Bahnen" switch: show the variant with or without isomorph holes
    document.addEventListener("change", (e) => {
      if (!e.target.classList.contains("isomorph-switch")) return;
      e.target
        .closest(".isomorph-toggle")
        .querySelectorAll(":scope > [data-isomorph-variant]")
        .forEach((variant) =>
          variant.classList.toggle(
            "d-none",
            (variant.dataset.isomorphVariant === "with") !== e.target.checked,
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
    const cards = [...document.querySelectorAll("#partien-container .match-card")];

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
  }

  // Shareable links: the URL always describes what is open, e.g.
  //   ?partie=2026-10-03-1430   ?spieler=Julian   ?parcours=Aachen Kronenbergpark (Main)   ?suche=2026
  // Every collapse that can be linked has data-link-param and data-link-value (see getLinkAttributes).
  // Opening one sets its parameter, closing it removes the parameter again. When the page is
  // loaded with such parameters, the matching sections are opened and the first one is scrolled to.
  setupShareableLinks() {
    const updateUrl = (change) => {
      const params = new URLSearchParams(window.location.search);
      change(params);
      const query = params.toString();
      history.replaceState(
        null,
        "",
        window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
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
      // the linked item does not exist (anymore): remove it, so the URL does not lie
      else updateUrl((p) => p.delete(param));
    });

    // keep the URL in sync with what is open
    document.addEventListener("shown.bs.collapse", (e) => {
      const { linkParam, linkValue } = e.target.dataset;
      if (linkParam) updateUrl((p) => p.set(linkParam, linkValue));
    });
    document.addEventListener("hidden.bs.collapse", (e) => {
      const { linkParam, linkValue } = e.target.dataset;
      // only remove it if the URL still points to this one (another one may have been opened since)
      if (linkParam)
        updateUrl((p) => p.get(linkParam) === linkValue && p.delete(linkParam));
    });
    document.getElementById("matchFilter").addEventListener("input", (e) => {
      const value = e.target.value.trim();
      updateUrl((p) => (value ? p.set("suche", value) : p.delete("suche")));
    });

    // "Link teilen" buttons: a link to just this match / player / course.
    // Bootstrap listens for its collapse clicks on document in the capture phase, so this
    // listens on window in the capture phase (runs before it) and stops the click there.
    // Otherwise sharing would also close the match card.
    window.addEventListener(
      "click",
      (e) => {
        const button = e.target.closest?.(".share-link");
        if (!button) return;
        e.stopPropagation();

        const { linkParam, linkValue } = button.closest("[data-link-param]").dataset;
        const url = new URL(window.location.pathname, window.location.origin);
        url.searchParams.set(linkParam, linkValue);
        this.shareLink(button, url.toString());
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
        top: target.getBoundingClientRect().top + window.scrollY - navHeight - 8,
        behavior: "smooth",
      });
    };

    if (collapse.classList.contains("show")) {
      if (scroll) scrollToSection();
    } else {
      // scroll once it is fully open, so the layout above it has settled
      if (scroll)
        collapse.addEventListener("shown.bs.collapse", scrollToSection, { once: true });
      bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
    }
    return true;
  }

  // phones: the system share sheet; otherwise: copy to the clipboard
  async shareLink(button, url) {
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ url });
      } catch (error) {
        // closing the share sheet without choosing anything is not an error
        if (error.name !== "AbortError") console.error(error);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      // clipboard blocked: at least show the link, so it can be copied by hand
      window.prompt("Link zum Kopieren:", url);
      return;
    }
    // confirmation: a check mark instead of the share icon for 2 seconds
    const setCopied = (copied) => {
      button.querySelector(".share-icon").classList.toggle("d-none", copied);
      button.querySelector(".share-icon-copied").classList.toggle("d-none", !copied);
      button.title = copied ? "Link kopiert" : "Link teilen";
    };
    setCopied(true);
    clearTimeout(button.resetTimer);
    button.resetTimer = setTimeout(() => setCopied(false), 2000);
  }

  // icon only, placed at the bottom right of the match card / player / course
  // (the icons are wrapped in spans, because Font Awesome replaces the <i> with an <svg>)
  getShareButtonString(buttonClass) {
    return `<div class="text-end mt-1">
      <button type="button" class="btn btn-sm ${buttonClass} share-link" title="Link teilen" aria-label="Link teilen">
        <span class="share-icon"><i class="fas fa-share-nodes"></i></span>
        <span class="share-icon-copied d-none"><i class="fas fa-check"></i></span>
      </button>
    </div>`;
  }

  getPlayerLinkAttribute(name) {
    return `data-player="${String(name).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
  }

  getLinkAttributes(param, value) {
    const escaped = String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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
    const id = `isomorph-switch-${this.isomorphSwitchCount++}`;
    return `
    <div class="isomorph-toggle">
      <div class="form-check form-switch mb-2" style="font-size: 0.85rem;">
        <input class="form-check-input isomorph-switch" type="checkbox" role="switch" id="${id}" ${includedByDefault ? "checked" : ""}>
        <label class="form-check-label" for="${id}">identische Bahnen einbeziehen</label>
      </div>
      <div data-isomorph-variant="with" class="${includedByDefault ? "" : "d-none"}">${variantWith}</div>
      <div data-isomorph-variant="without" class="${includedByDefault ? "d-none" : ""}">${variantWithout}</div>
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
    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    }).format(avg);
  }

  getHoleStatsString(course) {
    const heading = `<h5 class="mt-3">Bahnen:</h5>`;

    // switch only if including isomorph holes would change anything
    let hasSameParIsomorphs = false;
    for (let hole = 1; hole <= course.howManyHoles; hole++) {
      if (this.getSameParIsomorphEntries(course, hole).length > 0)
        hasSameParIsomorphs = true;
    }
    if (!hasSameParIsomorphs) {
      return heading + this.getHoleStatsTableString(course, false);
    }
    return (
      heading +
      this.getIsomorphToggleString(
        this.getHoleStatsTableString(course, true),
        this.getHoleStatsTableString(course, false),
        false, // course overview: by default only rounds on this layout
      )
    );
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

      // color by the rounded value, so "0,0" is not shown as over par
      const avg = averageToPar;
      const rounded = avg === null ? 0 : Math.round(avg * 10) / 10;
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

      const isomorphs = this.getIsomorphHoles(
        course.course,
        course.layout,
        hole,
      );
      if (isomorphs.length > 0) {
        const popoverContentIsomorphHoles =
          "<b>identisch zu</b><br>" +
          isomorphs.map((h) => `${h.layout} - Bahn ${h.hole}`).join("<br>");
        rowsString += `<tr><th
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
      } else {
        rowsString += `<tr><th class="text-start-table-header-info">Bahn ${hole}</th>`;
      }

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
    const rounds = Object.values(this.matches)
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
      root.querySelectorAll(".score-history").forEach((el) => this.renderScoreHistory(el));

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
    const devColor = (dev) => (dev > 0 ? "#e26028" : dev < 0 ? "#408ce2" : "#212529");
    const SURFACE = "#fff9f3"; // background of the player section
    const GRID = "#e3dcd3";
    const MUTED = "#6c757d";

    // --- geometry ---
    const height = width < 400 ? 190 : 220;
    const m = { top: 22, right: 16, bottom: 26, left: 34 };
    const inset = 10; // keeps the first and last point away from the axis
    const plotLeft = m.left + inset;
    const plotRight = width - m.right - inset;
    const x = (i) => (n === 1 ? (plotLeft + plotRight) / 2 : plotLeft + (i * (plotRight - plotLeft)) / (n - 1));

    // y: clean integer ticks, with room above and below for the labels
    const devs = rounds.map((r) => r.dev);
    let min = Math.min(...devs);
    let max = Math.max(...devs);
    const step = [1, 2, 5, 10, 20, 50].find((s) => (max - min) / s <= 4) ?? 100;
    let lo = Math.floor(min / step) * step;
    let hi = Math.ceil(max / step) * step;
    if (hi - max < step * 0.4) hi += step;
    if (min - lo < step * 0.6) lo -= step; // more room below: the PB label sits there
    const y = (dev) => m.top + ((hi - dev) * (height - m.top - m.bottom)) / (hi - lo);

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
      new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(t);
    const maxLabels = Math.max(2, Math.floor((plotRight - plotLeft) / 70) + 1);
    const labelIndices = new Set();
    if (n <= maxLabels) rounds.forEach((_, i) => labelIndices.add(i));
    else for (let k = 0; k < maxLabels; k++) labelIndices.add(Math.round((k * (n - 1)) / (maxLabels - 1)));
    labelIndices.forEach((i) => {
      const anchor = n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle";
      const offset = anchor === "start" ? -inset : anchor === "end" ? inset : 0;
      svg += `<text x="${x(i) + offset}" y="${height - 6}" text-anchor="${anchor}" class="score-history-tick">${shortDate(rounds[i].time)}</text>`;
    });

    // crosshair (moved by the hover layer)
    svg += `<line class="score-history-crosshair" y1="${m.top}" y2="${height - m.bottom}" stroke="#b9b0a5" stroke-width="1" visibility="hidden"/>`;

    // the line and the points
    if (n > 1) {
      const path = rounds.map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(r.dev)}`).join("");
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
      const above = preferBelow ? py + 19 > height - m.bottom + 4 : py - 11 > m.top - 8;
      const anchor = px > width - m.right - 24 ? "end" : px < m.left + 24 ? "start" : "middle";
      const dx = anchor === "end" ? 6 : anchor === "start" ? -6 : 0;
      return `<text x="${px + dx}" y="${above ? py - 10 : py + 19}" text-anchor="${anchor}" class="score-history-label">${text}</text>`;
    };
    if (pbIndex === lastIndex) {
      svg += label(lastIndex, `${this.formatDevFromPar(rounds[lastIndex].dev)} PB`, true);
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
      tooltip.querySelector(".score-history-goto").addEventListener("click", () =>
        this.openLinkedSection("partie", r.linkValue),
      );
      tooltip.hidden = false;

      // above the point, kept inside the chart; below it if there is no room above
      const tipWidth = tooltip.offsetWidth;
      const tipHeight = tooltip.offsetHeight;
      const left = Math.min(Math.max(x(i) - tipWidth / 2, 0), chart.clientWidth - tipWidth);
      const top = y(r.dev) - tipHeight - 12 >= 0 ? y(r.dev) - tipHeight - 12 : y(r.dev) + 14;
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
      show(Math.min(Math.max(start + (e.key === "ArrowLeft" ? -1 : 1), 0), rounds.length - 1));
    });
    svg.addEventListener("blur", (e) => {
      if (!tooltip.contains(e.relatedTarget)) hide();
    });
  }

  getRecentScoresString(player) {
    const MAX_RECENT = 4;
    const label = (courseKey) => {
      const course = this.courses[courseKey];
      return `${course.course} (${course.layout})`;
    };

    const recentScoresEntries = Object.entries(player.recentScores).sort(
      ([keyA], [keyB]) => keyA.localeCompare(keyB, "de", { numeric: true }),
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
        html += this.getRecentHolesTableString(player, course, MAX_RECENT, false);
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
      html += `
        <td style="padding: 3px; width: 46px; line-height: 1; vertical-align: middle;">
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
                    ${SCORE_CATEGORIES.map(
                      (c) => `
                        <tr>
                          <th class="text-start-table-header-info">${c.label}</th>
                          <th>${this.getScoreClassDot(c.cls)}</th>
                          <td>${player.devFromParPerHole[c.key]}</td>
                        </tr>`,
                    ).join("")}
                  </tbody>
                </table>`;
    playerString += this.getRecentScoresString(player);
    playerString += `
                ${this.getShareButtonString("btn-outline-secondary")}
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
              ${this.getLinkAttributes("parcours", `${course.course} (${course.layout})`)}
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
                ${this.getShareButtonString("btn-outline-secondary")}
              </div>
            </div>
          </div>`;

    document.getElementById("coursesAccordion").innerHTML += courseLayoutString;
  }

  getMatchesString(match) {
    const HOLES_PER_ROW = 9;
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

    // what the match filter searches in (see setupMatchFilter)
    const filterText = [
      match.course,
      match.layout,
      ...sortedPlayers.map(([playerKey]) => playerKey),
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
        >
          <div
            class="bg-dark text-white p-3 rounded d-inline-block"
            style="cursor: pointer; width: 100%; max-width: 600px; min-width: 0;"
            data-bs-toggle="collapse"
            data-bs-target="#${collapseId}"
          >
            <h4>${match.course} <span style="white-space: nowrap;">(${match.layout}) -</span> <span style="white-space: nowrap;">${this.formatDateStringForStatsStringHeader(match.startTime)}</span></h4>
            <h5 class="mb-3">Ergebnis</h5>
            <div class="scorecard-scroll mb-3">
            <table
              class="table table-dark table-bordered text-center align-middle w-auto mb-0"
            >
              <tbody>`;

    sortedPlayers.forEach(([playerKey, playerVal]) => {
      statsString += `<tr>
        <th class="text-start"><a class="player-link" href="?spieler=${encodeURIComponent(playerKey)}" ${this.getPlayerLinkAttribute(playerKey)}>${playerKey}</a></th>
        <td><b style="color: ${playerVal.devFromPar > 0 ? '#fd6c2e">+' : playerVal.devFromPar == 0 ? '#ffffff">' : '#408ce2">'}${playerVal.devFromPar != 0 ? playerVal.devFromPar : "E"}</b> (${playerVal.total})</td>
        ${playerVal.howManyHolesNotPlayedInThisMatch > 0 ? "<td><span style='font-size: 0.7rem'>THRU</span> " + (match.holes - playerVal.howManyHolesNotPlayedInThisMatch) + "</td>" : ""}
        ${this.getMatchDistributionCell(playerVal, par.holes, collapseId)}
    </tr>`;
    });

    statsString += `
            </tbody>
          </table>
          </div>
          <div class="collapse" id="${collapseId}" ${this.getLinkAttributes("partie", this.getMatchLinkValue(match))}>
            <ul><li>Start - ${this.formatDateStringForStatsStringCollapsed(match.startTime)}</li>
            <li>Dauer - ${match.duration}</li>
            <li>Ende - ${this.formatDateStringForStatsStringCollapsed(match.endTime)}</li></ul>
            <h5 class="mb-3">Scorecard</h5>`;

    // One table per block of 9 holes, all in one shared scroll container
    // so the blocks scroll horizontally together
    statsString += `<div class="scorecard-scroll">`;
    for (let from = 0; from < match.holes; from += HOLES_PER_ROW) {
      statsString += buildScorecardTable(
        from,
        Math.min(from + HOLES_PER_ROW, match.holes),
      );
    }

    statsString += `
          </div>
          ${this.getShareButtonString("btn-outline-light")}
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
    return Object.values(this.matches).flatMap((match) => {
      const par = match.players["Par"].holes;
      return Object.entries(match.players)
        .filter(([name]) => name !== "Par")
        .map(([name, round]) => ({
          name,
          match,
          total: round.total,
          complete: round.howManyHolesNotPlayedInThisMatch === 0,
          scores: round.holes,
          devs: round.holes.map((score, i) => (score === "-" ? null : score - par[i])),
        }));
    });
  }

  // entries: { name, value, match?, detail? }; higher value is better
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

    // longest run of birdies on consecutive holes within one round (unplayed holes end a run)
    const streaks = rounds
      .map((round) => {
        let best = { value: 0, end: 0 };
        let run = 0;
        round.devs.forEach((dev, i) => {
          run = isBirdie(dev) ? run + 1 : 0;
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

    // winner's lead over the second, only between completed rounds of the same match
    const margins = Object.values(this.matches).flatMap((match) => {
      const complete = rounds
        .filter((round) => round.match === match && round.complete)
        .sort((a, b) => a.total - b.total);
      if (complete.length < 2) return [];
      const margin = complete[1].total - complete[0].total;
      if (margin <= 0) return []; // shared win
      const seconds = complete.filter((round) => round.total === complete[1].total);
      return [
        {
          name: complete[0].name,
          match,
          value: margin,
          detail: `vor ${seconds.map((round) => round.name).join(", ")}`,
        },
      ];
    });

    const mostRounds = Object.values(this.players).map((player) => ({
      name: player.name,
      value: player.playedCoursesCount,
      detail: `auf ${player.playedCourses.length} Parcours`,
    }));

    return [
      {
        title: "Meiste Asse",
        icon: "bullseye",
        unit: ["Ass", "Asse"],
        entries: [...aces.values()],
        empty: "Noch kein Ass.",
      },
      {
        title: "Meiste Birdies in einer Partie",
        icon: "dove",
        unit: ["Birdie", "Birdies"],
        entries: birdieRounds,
        empty: "Noch kein Birdie.",
        note: "zählt alle Ergebnisse unter Par",
      },
      {
        title: "Längste Birdie-Serie",
        icon: "fire",
        unit: ["Bahn", "Bahnen"],
        entries: streaks,
        empty: "Noch keine zwei Birdies hintereinander.",
        note: "Birdies auf aufeinanderfolgenden Bahnen einer Partie",
      },
      {
        title: "Größter Vorsprung",
        icon: "trophy",
        unit: ["Wurf", "Würfe"],
        entries: margins,
        empty: "Noch keine Partie mit zwei vollständigen Runden.",
        note: "Vorsprung des Siegers auf den Zweiten, nur vollständige Runden",
      },
      {
        title: "Meiste Partien",
        icon: "calendar-check",
        unit: ["Partie", "Partien"],
        entries: mostRounds,
        empty: "Noch keine Partie.",
      },
    ];
  }

  // best first; equal values share a rank (1, 1, 3) and the one who got there first is listed
  // first. Shows the ranks 1 to 3, at most MAX_ROWS rows (the rest of a tie is counted below).
  rankRecordEntries(entries) {
    const MAX_ROWS = 3;
    const ranked = [...entries].sort(
      (a, b) =>
        b.value - a.value ||
        (a.match?.startTime ?? 0) - (b.match?.startTime ?? 0) ||
        a.name.localeCompare(b.name),
    );
    ranked.forEach((entry, i) => {
      entry.rank =
        i > 0 && entry.value === ranked[i - 1].value ? ranked[i - 1].rank : i + 1;
    });
    const top = ranked.filter((entry) => entry.rank <= 3);
    return { rows: top.slice(0, MAX_ROWS), more: Math.max(top.length - MAX_ROWS, 0) };
  }

  renderRecords() {
    document.getElementById("recordsContainer").innerHTML = this.getRecords()
      .map((record) => this.getRecordCardString(record))
      .join("");
  }

  getRecordCardString({ title, icon, unit, entries, empty, note }) {
    const { rows, more } = this.rankRecordEntries(entries);

    const rowStrings = rows.map((entry) => {
      const context = [entry.detail];
      if (entry.match) {
        context.push(
          `<a class="match-link" href="?partie=${this.getMatchLinkValue(entry.match)}" data-match="${this.getMatchLinkValue(entry.match)}">${this.formatDate(entry.match.startTime)}, ${entry.match.course} (${entry.match.layout})</a>`,
        );
      }
      return `
        <li class="record-row">
          <span class="record-rank${entry.rank === 1 ? " record-rank-first" : ""}">${entry.rank}</span>
          <div class="record-who">
            <a class="player-link fw-bold" href="?spieler=${encodeURIComponent(entry.name)}" ${this.getPlayerLinkAttribute(entry.name)}>${entry.name}</a>
            <div class="record-context">${context.filter(Boolean).join(" · ")}</div>
          </div>
          <span class="record-value"><b>${entry.value}</b> ${unit[entry.value === 1 ? 0 : 1]}</span>
        </li>`;
    });

    return `
      <div class="col-md-6 col-xl-4">
        <div class="record-card h-100">
          <h5 class="record-title"><span class="record-icon"><i class="fas fa-${icon}"></i></span>${title}</h5>
          ${
            rows.length
              ? `<ol class="record-list">${rowStrings.join("")}</ol>`
              : `<p class="text-muted mb-0">${empty}</p>`
          }
          ${more ? `<div class="record-note">und ${more} ${more === 1 ? "weiterer" : "weitere"} mit gleichem Wert</div>` : ""}
          ${note ? `<div class="record-note">${note}</div>` : ""}
        </div>
      </div>`;
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

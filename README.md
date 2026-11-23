## View

Visit https://julvol.github.io/discgolfstats/ for the stats.

## Features

This tool displays disc golf match csv exports from UDisc on a website hosted on GitHub pages.
- At the top, an activity calendar in the style of GitHub shows on which days of a year (ranked) matches were played, with buttons to switch the year. Hover over or tap a day to see the courses played; clicking it shows the matches of that day. The grid only marks the matches the match list currently shows, so searching e.g. for a course also filters the grid. On narrow screens (phones, tablets in portrait) the boxes shrink so the whole year fits the width.
- For every match, it shows a section with the total score, deviation from par and scorecard. Click on it to expand it. The scorecard shows 9 holes per row; on big screens an expanded match with more holes gets wider, so up to 18 holes fit in one row.<br>
  <img width="721" height="513" alt="image" src="https://github.com/user-attachments/assets/cbe83374-f7b4-4877-85cb-f9d1b04cb3b5" />
- A match can have a comment, shown in its section below the result (also when collapsed). Matches can also be marked as unranked, e.g. when played in a storm, as doubles or with mulligans: they are still shown in the match list with an "Unranked" badge, but don't count for any statistics (players, courses, personal bests, records). See step 8 below for how to add both in the Google Sheet. The match filter also searches the comments, and "unranked" finds all unranked matches.
- An expanded match shows the weather while it was played: temperature, sky (the worst during the match), wind with gusts and, if any, the rain. It is loaded from [Open-Meteo](https://open-meteo.com/) (free, no account) when the match is opened, for courses with coordinates in [course_coordinates.csv](discgolfstats/course_data/course_coordinates.csv) (see step 10 below).
- The match list can be sorted with the dropdown next to the search: by date (new → old, the default, or old → new), by number of players (most first) or by the winning result (best deviation from par of a completed round first). Ties are shown newest first.
- For every player, it shows the played courses with their personal best, the distribution of played holes, the playing partners with the number of shared matches (each linking to that player) and the number of solo matches, the last activity (e.g. "vor 3 Tagen auf Course (Layout)", linking to that match), the most recent score for every layout and hole, with a chart of the score over time on that layout (completed rounds only, shown from 3 rounds on; tap or hover a point to see the round and jump to the match). If the same hole is included in multiple layouts, recent results on the isomorphic holes in other layouts are also displayed. Hover over or click on the hole number to see which other holes are isomorphic to it. Hover over or click on a recent score or personal best to see where it originates from and when that result was achieved.<br>
  <img width="570" height="1354" alt="image" src="https://github.com/user-attachments/assets/20de0351-9b48-49b6-8207-761da48ccf6e" />
- Every course shows the weather forecast for the next 90 minutes at the course (loaded from Open-Meteo for all courses in one request when the page is loaded and again when the course is opened more than 15 minutes later, if the course has coordinates; a blue "Regen" or amber "Wind" tag on the course name shows when rain or gusts over 30 km/h make it no disc golf weather, a violet "Dämmerung" tag when it gets dark during them; if it is dark, rains or the gusts exceed 30 km/h, also the next 90 minutes in daylight without rain and strong gusts within the next 7 days), a strip of the next 4 days with one bar per day, today's from sunrise on (green = disc golf weather for at least 90 minutes, blue = rain, amber = wind, split in both colors = rain and wind, gray = a shorter gap in daylight, a box around the next disc golf weather if it is within these days, a red line at the current time if it is within the shown hours, with a legend of what is shown; from the same request, so no extra data) and its layouts, each opening on its own with the layout leaderbord (place by personal best in the same gold, silver and bronze circles as the records, ties shown as e.g. T3; every player who played the layout with their number of matches on it and, after a completed round, their personal best) and the per-hole distribution (only from rounds played on that layout; a dropdown sorts the holes by number, length, par or difficulty, shortest, lowest par or easiest first, ties by hole number). Courses and layouts from `course_data/hole_lengths.csv` that have not been played yet are listed grayed out after the played ones; such a layout opens to its holes with their length, sortable by number or length (hover over or click on a hole number to see which other holes are identical to it).<br>
  <img width="483" height="821" alt="image" src="https://github.com/user-attachments/assets/5fc3e6d5-f39e-4508-a8be-316e9a9b6e9b" />
- The records section shows the top 3 for most aces, most birdies in a round (every score below par), longest birdie streak, longest bogey-free streak, bogey-free rounds, most rounds played and the longest weekly streak (most calendar weeks in a row with at least one match; marked "läuft noch" while it is still running, i.e. the player played this week or last week) (places 1 to 3 in gold, silver and bronze; ties share a place, shown as e.g. T2, the next place is then 4, and are shown in full). Cards that can list a player more than once (birdies in a round, the two streaks) get a switch "nur bester Eintrag pro Spieler" that shows only the best entry of each player (only if that changes anything; on at first for birdies in a round). Names link to the player, dates to the match.<br>

  
- Links can be shared: the link button in every match, player and course copies a link like `?partie=2026-10-03-1430` for a match, `?spieler=Name` for a player or `?parcours=Course (Layout)` for a course. Opening such a link opens and scrolls to that section (for a layout also its course) (opening or closing sections does not change the URL). The URL also keeps the match filter (`?suche=2026`) and the order of the matches (`?sortierung=alt`). The share button (bottom right) in every player and course copies a short summary with a link to it (on phones it opens the share menu). In a match it makes an image of the result (with the places in gold, silver and bronze circles, if three or more players played) and the scorecard instead (with date, duration and, once loaded, the weather): on phones it opens the share menu with the image and the link, on computers it copies the image (or downloads it if copying is not possible).
- The site can be installed as an app: on Android/Chrome via "Install app" or "Add to home screen" in the browser menu, on iPhone via Share → "Add to Home Screen". Without internet it still opens and shows the data from the last visit, with a note when that data was loaded ([sw.js](discgolfstats/sw.js), [manifest.webmanifest](discgolfstats/manifest.webmanifest)).

Personal bests require a round to be completed, i.e. not missing any holes.

## How to make one for your own friends group

1. Fork the repository.
2. Enable GitHub Pages on your fork.
3. Create a Google Sheet and set it public to spectators.
4. Rename the Google Sheet tab to "Main".
5. In [index.html](discgolfstats/index.html), near the end of the file, change the id of the Google Sheet to your's.<br>
   <img width="418" height="196" alt="image" src="https://github.com/user-attachments/assets/c87f84df-79ae-4383-b83b-e3b399b4d873" />
7. When completing a new round of disc golf, export it as csv and paste it into the Google Sheet. The format should look like [this](https://docs.google.com/spreadsheets/d/14up0_1zaAB4xFlMcZLhKO15Wh7Ay9eNCegthaG4RzVk/edit?usp=sharing). Leave one or two rows empty between matches.
8. Optionally, add a comment to a match: write it in column A of the row directly below the match's last player row, with all other columns of that row empty. Leave at least one empty row between the comment and the next match. To mark the match as unranked, start that row with "Unranked", optionally followed by the comment, e.g. `Unranked: Sturm`.
   ```
   Par             | Aachen Kronenbergpark | Main | ...
   Anna            | Aachen Kronenbergpark | Main | ...
   Ben             | Aachen Kronenbergpark | Main | ...
   Unranked: Sturm |                       |      |
   (empty row)
   ```
9. If you want to show hole lengths and isomorphic holes on the website, you need to add them manually as they are not included in the csv information. Add the data to [hole_lengths.csv](discgolfstats/course_data/hole_lengths.csv) and [isomorph_holes.csv](discgolfstats/course_data/isomorph_holes.csv) in the same format as the example data that is already in the files.
10. For the weather of a match, add the coordinates of each course to [course_coordinates.csv](discgolfstats/course_data/course_coordinates.csv): one line per course (all layouts share it), latitude and longitude with a dot as decimal separator, e.g. `My Course,50.7753,6.0839`. Courses with empty coordinates just show no weather.
11. To list the standard layout of a course first (in the course list and in the player's "Gespielte Partien" and "Letzte Ergebnisse"), add it to [standard_layouts.csv](discgolfstats/course_data/standard_layouts.csv): one line per course with exactly one layout, e.g. `My Course,Main`. An empty layout means no standard layout; the other layouts keep their usual order.

## Checking the course data

The tests in [tests/](tests/) check the hand-maintained course data. They need [Node.js](https://nodejs.org/) 20 or newer and no other installation. Run them from the repository root:

```
node --test
```

- [course-data.test.mjs](tests/course-data.test.mjs) checks [hole_lengths.csv](discgolfstats/course_data/hole_lengths.csv), [isomorph_holes.csv](discgolfstats/course_data/isomorph_holes.csv) and [course_coordinates.csv](discgolfstats/course_data/course_coordinates.csv) on their own: valid numbers, no layout or hole listed twice, every hole exists in its layout, identical holes have the same length, every course has a line in the coordinates file (coordinates empty or valid) and in the standard layouts file (layout empty or one of the course's layouts).
- [sheet-data.test.mjs](tests/sheet-data.test.mjs) loads the Google Sheet and checks that every played layout has hole lengths, with as many lengths as the layout has holes. It is skipped when there is no internet connection.
- [records.test.mjs](tests/records.test.mjs) checks the records with made-up rounds (aces, birdies, streaks, shared ranks).
- [weekly-streaks.test.mjs](tests/weekly-streaks.test.mjs) checks the longest weekly streak with made-up matches.
- [playing-partners.test.mjs](tests/playing-partners.test.mjs) checks the playing partners of a player with made-up matches.
- [last-activity.test.mjs](tests/last-activity.test.mjs) checks the last activity of a player with made-up matches.
- [week-weather.test.mjs](tests/week-weather.test.mjs) checks the 4-day disc golf weather of a course with a made-up forecast.
- [comments.test.mjs](tests/comments.test.mjs) checks how comment rows and the "Unranked" mark are read, and that unranked matches don't count for the records.

The tests also run automatically on GitHub ([.github/workflows/tests.yml](.github/workflows/tests.yml)): on every push, and once a day because new rounds go into the Google Sheet without a commit. GitHub sends an email when they fail. They can also be started by hand with "Run workflow" on the Actions tab.

A failing test says which line or layout to fix, e.g. `Discgolfpark Herzogenrath (Main): played, but missing in hole_lengths.csv (add a line with 8 lengths)`.

## License

The code in this repository is licensed under the [MIT License](LICENSE). It is based on the [Start Bootstrap Freelancer](https://startbootstrap.com/theme/freelancer) template and [Bootstrap](https://getbootstrap.com/), both also under the MIT License; their copyright notices are kept in the files that contain their code.

**Not covered by this license:** the contents of [hole_lengths.csv](discgolfstats/course_data/hole_lengths.csv) and [isomorph_holes.csv](discgolfstats/course_data/isomorph_holes.csv). This data comes from [UDisc](https://udisc.com/), so no rights to it are granted here. If you fork this project, replace it with your own data. The match data in the Google Sheet is not part of this repository or the license either.

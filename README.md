## View

Visit https://julvol.github.io/discgolfstats/ for the stats.

## Features

This tool displays disc golf match csv exports from UDisc on a website hosted on GitHub pages.
- For every match, it shows a section with the total score, deviation from par and scorecard. Click on it to expand it.<br>
  <img width="721" height="513" alt="image" src="https://github.com/user-attachments/assets/cbe83374-f7b4-4877-85cb-f9d1b04cb3b5" />
- For every player, it shows the played courses with their personal best, the distribution of played holes, the most recent score for every layout and hole, with a chart of the score over time on that layout (completed rounds only, shown from 3 rounds on; tap or hover a point to see the round and jump to the match). If the same hole is included in multiple layouts, recent results on the isomorphic holes in other layouts are also displayed. Hover over or click on the hole number to see which other holes are isomorphic to it. Hover over or click on a recent score or personal best to see where it originates from and when that result was achieved.<br>
  <img width="570" height="1354" alt="image" src="https://github.com/user-attachments/assets/20de0351-9b48-49b6-8207-761da48ccf6e" />
- For every course and layout, it shows the layout leaderbord and the per-hole distribution (only from rounds played on that layout).<br>
  <img width="483" height="821" alt="image" src="https://github.com/user-attachments/assets/5fc3e6d5-f39e-4508-a8be-316e9a9b6e9b" />
- The records section shows the top 3 for most aces, most birdies in a round (every score below par), longest birdie streak, biggest winning margin (completed rounds only) and most rounds played. Names link to the player, dates to the match.<br>

  
- Links can be shared: the URL always reflects what is open, e.g. `?partie=2026-10-03-1430` for a match, `?spieler=Name` for a player, `?parcours=Course (Layout)` for a course and `?suche=2026` for the match filter. Opening such a link opens and scrolls to that section. The share button (bottom right) in every match, player and course copies a link to it (on phones it opens the share menu).
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
8. If you want to show hole lengths and isomorphic holes on the website, you need to add them manually as they are not included in the csv information. Add the data to [hole_lengths.csv](discgolfstats/course_data/hole_lengths.csv) and [isomorph_holes.csv](discgolfstats/course_data/isomorph_holes.csv) in the same format as the example data that is already in the files.

## Checking the course data

The tests in [tests/](tests/) check the hand-maintained course data. They need [Node.js](https://nodejs.org/) 20 or newer and no other installation. Run them from the repository root:

```
node --test
```

- [course-data.test.mjs](tests/course-data.test.mjs) checks [hole_lengths.csv](discgolfstats/course_data/hole_lengths.csv) and [isomorph_holes.csv](discgolfstats/course_data/isomorph_holes.csv) on their own: valid numbers, no layout or hole listed twice, every hole exists in its layout, and identical holes have the same length.
- [sheet-data.test.mjs](tests/sheet-data.test.mjs) loads the Google Sheet and checks that every played layout has hole lengths, with as many lengths as the layout has holes. It is skipped when there is no internet connection.
- [records.test.mjs](tests/records.test.mjs) checks the records with made-up rounds (aces, birdies, streaks, winning margin, shared ranks).

The tests also run automatically on GitHub ([.github/workflows/tests.yml](.github/workflows/tests.yml)): on every push, and once a day because new rounds go into the Google Sheet without a commit. GitHub sends an email when they fail. They can also be started by hand with "Run workflow" on the Actions tab.

A failing test says which line or layout to fix, e.g. `Discgolfpark Herzogenrath (Main): played, but missing in hole_lengths.csv (add a line with 8 lengths)`.

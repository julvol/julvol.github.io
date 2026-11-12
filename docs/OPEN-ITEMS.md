# Open Items

Feature ideas for [discgolfstats](../discgolfstats/). Tick an item off or remove it once it's done.

Each item has a fixed number that stays the same when other items are added or removed. New items get the next free number.

## Charts and trends

- [ ] **#1 Score over time per player and layout:** a line chart of a player's rounds on one layout, to show whether they are improving.
- [ ] **#2 Rolling average or handicap:** a UDisc-style rating, so players can compete fairly across different courses.
- [ ] **#3 Hole difficulty ranking:** the average score relative to par for each hole, sorted from hardest to easiest. The per-hole data already exists.

## Comparisons

- [ ] **#4 Head-to-head:** pick two players and show their win/loss record in shared rounds and which holes each one wins.
- [ ] **#5 Best possible round:** add up a player's best score on each hole of a layout and compare it to their real personal best.
- [ ] **#6 Records page:** most aces, most birdies in a round, longest birdie streak, biggest winning margin, most rounds played.

## Usability

- [ ] **#7 Shareable links:** encode the filter, open match or player in the URL (e.g. `#match=2026-10-03`) so a link opens that exact view.
- [ ] **#8 Dark mode toggle:** a light/dark switch, possibly using Bootstrap's built-in color modes.
- [ ] **#9 Installable app:** add a web app manifest and a service worker so the site can go on a phone's home screen and still show the last data offline.
- [ ] **#10 Last data update:** show when the data was last updated.

## Data upkeep

- [ ] **#11 Warnings for missing course data:** list layouts that have no entry in `course_data/hole_lengths.csv`, and check that the number of lengths matches the number of holes.
- [ ] **#12 Score by hole length:** once lengths are filled in, a chart of score against hole distance.

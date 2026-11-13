# Open Items

Feature ideas for [discgolfstats](../discgolfstats/). Tick an item off once it's done, and remove items that are no longer wanted.

Each item has a fixed number that stays the same when other items are added or removed. New items get the next free number (currently #13); numbers of removed items are not reused.

## Charts and trends

- [x] **#1 Score over time per player and layout:** a line chart of the completed rounds at the top of each layout in "Letzte Ergebnisse" of a player (from 3 completed rounds on), with the PB and the newest round labeled and a tooltip per round with a link to the match.

## Records

- [x] **#6 Records page:** a "Rekorde" section with the top 3 for most aces, most birdies in a round, longest birdie streak and most rounds played (ties shown in full), linking to the players and matches.

## Usability

- [x] **#7 Shareable links:** the URL always describes what is open (`?partie=2026-10-03-1430`, `?spieler=…`, `?parcours=Course (Layout)`, `?suche=…`), so a link opens that exact view. Every match, player and course also has a share button in its bottom right corner.
- [x] **#9 Installable app:** a web app manifest and a service worker, so the site can go on a phone's home screen and still opens offline with the data of the last visit (with a note when it was loaded).
- [ ] **#10 Last data update:** show when the data was last updated.

## Data upkeep

- [x] **#11 Warnings for missing course data:** tests in `tests/` (run with `node --test`) check that every played layout has hole lengths with the right number of holes, and that `hole_lengths.csv` and `isomorph_holes.csv` are consistent.

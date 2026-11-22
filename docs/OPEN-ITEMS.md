# Open Items

Feature ideas for [discgolfstats](../discgolfstats/). Tick an item off once it's done, and remove items that are no longer wanted.

Each item has a fixed number that stays the same when other items are added or removed. New items get the next free number (currently #50); numbers of removed items are not reused.

## Charts and trends

- [x] **#1 Score over time per player and layout:** a line chart of the completed rounds at the top of each layout in "Letzte Ergebnisse" of a player (from 3 completed rounds on), with the PB and the newest round labeled and a tooltip per round with a link to the match.
- [x] **#14 Activity calendar:** a GitHub-style grid at the top of the matches marking the days with ranked matches, one year at a time (buttons to switch the year). Hovering or tapping a day shows the courses played, clicking it filters the matches to that day.
- [ ] **#40 Match progress chart:** a line chart in an expanded match showing each player's running score to par hole by hole, so comebacks and the decisive holes are visible at a glance.

## Records

- [x] **#6 Records page:** a "Rekorde" section with the top 3 for most aces, most birdies in a round, longest birdie streak and most rounds played (ties shown in full), linking to the players and matches.
- [x] **#17 More records:** two more cards in "Rekorde": the longest bogey-free run (par or better on consecutive holes) within one round, and the number of completed bogey-free rounds (no hole over par) per player, linking to the most recent one.
- [x] **#36 Longest weekly streak:** a record card for the most consecutive calendar weeks with at least one ranked match per player, with the current streak marked if it is still running.
- [ ] **#44 List of all aces:** the aces card can be expanded to show every ace with player, date, course and hole, each linking to its match. <-- We tackle that when the situation actually is real. Aces have never happened until now, and two aces for one player is unthinkable as of now because everyone is so bad...

## Usability

- [x] **#7 Shareable links:** the URL always describes what is open (`?partie=2026-10-03-1430`, `?spieler=…`, `?parcours=Course (Layout)`, `?suche=…`), so a link opens that exact view. Every match, player and course also has two buttons in its bottom right corner: one copies the link, the other shares a short summary (e.g. the result of a match, a player's PBs, a course's leaderboard) followed by the link.
- [x] **#9 Installable app:** a web app manifest and a service worker, so the site can go on a phone's home screen and still opens offline with the data of the last visit (with a note when it was loaded).
- [ ] **#27 Highlights in the match card:** small icons in the header of a match for special moments in it, e.g. an ace, a new personal best or a bogey-free round, with a popover saying who. The match filter could find them too (e.g. "ass"). <-- maybe, but not high priority
- [x] **#29 Playing partners:** a "Mitspieler" table in a player's section below "Gespielte Bahnen": who they played with how often (number of shared ranked matches only, no score comparison), most first, each name linking to that player.
- [x] **#35 Result as an image:** the share button of a match shares an image of its result and scorecard (with the link) instead of the summary text: the share menu on phones, copied to the clipboard (or downloaded) on computers.
- [x] **#38 Wider scorecard on big screens:** an expanded match with more than 9 holes gets wider on big screens (the same width for all of them), so its scorecard shows up to 18 holes per row instead of 9.
- [ ] **#48 Course map:** a small map above the course list with a pin per course (played and unplayed in different colors); tapping a pin opens that course.

## Match details

- [x] **#23 Weather per match:** a "Wetter" line below start, duration and end of an expanded match with the temperature, sky, wind with gusts and rain while it was played, loaded from Open-Meteo when the match is opened, using the course's coordinates from `course_data/course_coordinates.csv`.
- [x] **#49 Disc golf weather for the week:** a compact 4-day strip "Wetter in den nächsten 4 Tagen" in an opened course, between the next 90 minutes and the next suitable 90 minutes, marking the daylight hours with disc golf weather (no rain, gusts up to 30 km/h, for at least 90 minutes), rain, wind or both, with a legend.

## Data upkeep

- [x] **#11 Warnings for missing course data:** tests in `tests/` (run with `node --test`) check that every played layout has hole lengths with the right number of holes, and that `hole_lengths.csv` and `isomorph_holes.csv` are consistent.

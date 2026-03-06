# Data

All positions and stats used in player data.

**Generating `players.json` from CSVs** — From the repo root run:
`python data/csv_to_json.py`
This reads `data/csv/projections-NL.csv`, `2025-player-NL-stats.csv`, and `3Year-average-NL-stats.csv`, merges by player (name + team), and writes `data/players.json`. Use `--output path` and `--projections` / `--last-year` / `--three-year` to override paths.

---

## 1. Positions

### Hitter positions

| Pos | What it means   | Who is eligible                    |
|-----|-----------------|------------------------------------|
| 1B  | First base      | Only first basemen                 |
| 2B  | Second base     | Only second basemen                |
| 3B  | Third base      | Only third basemen                 |
| SS  | Shortstop       | Only shortstops                    |
| C   | Catcher         | Only catchers                      |
| DH  | Designated hitter | Only designated hitters            |
| CI  | Corner infield  | Any first or third baseman         |
| MI  | Middle infield  | Any second baseman or shortstop    |
| IF  | Infield         | Any infielder (1B, 2B, 3B, SS)     |
| LF  | Left field      | Only left fielders                 |
| CF  | Center field    | Only center fielders               |
| RF  | Right field     | Only right fielders                |
| OF  | Outfield        | Any left, center, or right fielder |
| U   | Utility         | Any non-pitcher                    |
| IL  | Injured list    | Any player on real-life IL         |

### Pitcher positions

| Pos | What it means     | Who is eligible                    |
|-----|-------------------|------------------------------------|
| P   | Pitcher           | Any starting or relief pitcher     |

---

## 2. Hitter stats 

| Abbrev (JSON key) | Full name                    |
|-------------------|------------------------------|
| ab                | At-bats                      |
| r                 | Runs scored                  |
| h                 | Hits                         |
| 1b                | Singles                      |
| 2b                | Doubles                      |
| 3b                | Triples                      |
| hr                | Home runs                    |
| rbi               | Runs batted in               |
| bb                | Walks                        |
| k                 | Strikeouts (as batter)       |
| sb                | Stolen bases                 |
| cs                | Caught stealing              |
| avg               | Batting average              |
| obp               | On-base percentage           |
| slg               | Slugging percentage          |
| fpts              | Fantasy points               |

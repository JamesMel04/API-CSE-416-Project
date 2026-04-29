# AI assistance disclosure: An AI coding assistant was used to help draft this script; the final code was reviewed and validated by the authors.

"""
Convert the three NL hitter CSVs into one JSON file of players with
stats.projection, stats.lastYear, and stats.threeYearAvg.

Usage (from repo root or from data/):
    [Default path]: python data/csv_to_json.py
    --or--
    [Custom Path]: python data/csv_to_json.py --projections path/to/projections.csv --last-year path/to/2025-stats.csv --three-year path/to/3year-avg.csv --output path/to/players.json

Output: data/players.json (array of player objects matching example.json shape).
"""

import csv
import json
import re
import argparse
from pathlib import Path
from typing import Dict, List

# Building absolute path after the script is located 
SCRIPT_DIR = Path(__file__).resolve().parent
# Building cvs path
DEFAULT_CSV_DIR = SCRIPT_DIR / "csv"
# Building path for projections
DEFAULT_PROJECTIONS = DEFAULT_CSV_DIR / "projections-NL.csv"
# Building path for lastYear
DEFAULT_LAST_YEAR = DEFAULT_CSV_DIR / "2025-player-NL-stats.csv"
# Building path for lastThreeYearAvg
DEFAULT_THREE_YEAR = DEFAULT_CSV_DIR / "3Year-average-NL-stats.csv"
# Output path and file
DEFAULT_OUTPUT = SCRIPT_DIR / "players.json"

# HARD CODED MAPPING: CSV column name -> JSON stat key (lowercase)
STAT_KEYS = [
    ("AB", "ab"), ("R", "r"), ("H", "h"), ("1B", "1b"), ("2B", "2b"), ("3B", "3b"),
    ("HR", "hr"), ("RBI", "rbi"), ("BB", "bb"), ("K", "k"), ("SB", "sb"), ("CS", "cs"),
    ("AVG", "avg"), ("OBP", "obp"), ("SLG", "slg"), ("FPTS", "fpts"),
]
# Define Integer stats (rest are float: AVG, OBP, SLG, FPTS)
INT_STATS = {"ab", "r", "h", "1b", "2b", "3b", "hr", "rbi", "bb", "k", "sb", "cs", "fpts"}

# Simple MVP valuation: map fpts (0..1000) -> dollars (1..40)
# fpts = Fantasy Points, it is a value calculated by an outer source algorithm that is already in the csv. I used this just for the simplicity MVP. We would need to create our own algorithm from the stats.
# fpts is defined in range 0 - 1000.
# - fpts <= 0   => $1 min
# - fpts >= 1000 => $40 max
# - otherwise linear interpolation, whole dollars
#  suggestedValue = (fpts/1000) * 40
def suggested_value_from_fpts(fpts, fpts_cap: float = 1000.0, min_dollars: int = 1, max_dollars: int = 40) -> int:
    try:
        f = float(fpts)
    except (TypeError, ValueError):
        f = 0.0

    if f < 0:
        f = 0.0
    if f > fpts_cap:
        f = fpts_cap

    span = max_dollars - min_dollars  # e.g. 39
    scaled = (f / fpts_cap) * span
    # Round half up for more intuitive results than Python's bankers rounding.
    dollars = min_dollars + int(scaled + 0.5)

    if dollars < min_dollars:
        return min_dollars
    if dollars > max_dollars:
        return max_dollars
    return dollars

# Ex: parse_player_cell("Juan Soto OF | NYM") -> (Juan Soto, OF, NYM) 
def parse_player_cell(player_cell: str):
    """Parse 'Name Position(s) | TEAM' into (name, positions_list, team)."""
    cell = (player_cell or "").strip()
    if " | " not in cell:
        return None, [], ""
    left, team = cell.split(" | ", 1)
    team = team.strip()
    left = left.strip()
    if not left:
        return "", [], team
    # Last segment (after last space) is position(s), e.g. "OF", "2B,SS", "U,P"
    last_space = left.rfind(" ")
    if last_space == -1:
        return left, [], team
    name = left[:last_space].strip()
    pos_str = left[last_space + 1 :].strip()
    if not pos_str:
        return name, [], team
    positions = [p.strip() for p in pos_str.split(",") if p.strip()]
    return name, positions, team

# Create a matching key so the script can recognize same player across the 3 CSV files and merge their stats
# Use name+team for identifying the same player to help distinguish people of the same name.
# *Note*: Does not handle same player that have changed teams for the csv files. They will be treated as different person, as there is no unique identifier for players in these csv.
# Ex: player_key(" Juan Soto ", "NYM ") -> "juan soto|NYM"
def player_key(name: str, team: str) -> str:
    """Stable key for matching same player across CSVs."""
    n = re.sub(r"\s+", " ", (name or "").strip()).lower()
    t = (team or "").strip().upper()
    return f"{n}|{t}"

# UUID is different each time script is run. May cause reference breaks. For MVP, I'd say use a slug_id for now. This is different from player_key, slug_id is what we save as id in the .json.
# *Note*: In our actual API, slug_id will be a problem when players changed teams. We would need to think of a solution. 
# Ex: slug_id("Shohei Ohtani", "LAD") -> "shohei-ohtani-lad"
def slug_id(name: str, team: str) -> str:
    """Generate a URL-safe id from name and team."""
    s = f"{name} {team}".lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "unknown"

# CSV-row → JSON-stats converter: {"ab": 534...}
def row_to_hitter_stats(row: dict) -> dict:
    """Build the 16-field hitter stat object from a CSV row."""
    out = {}
    for col, key in STAT_KEYS:
        val = row.get(col, "")
        if val == "" or val is None:
            continue
        try:
            if key in INT_STATS:
                out[key] = int(float(val))
            else:
                out[key] = float(val)
        except (TypeError, ValueError):
            pass
    return out

# uses csv.DictReader to turn each CSV line into a dictionary (a “row object”), a more organized data like json
def load_csv(path: Path) -> List[dict]:
    """Load CSV and return list of row dicts (keys = header)."""
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows

# The scripe uses projection as the base list. It creates player objects only while looping through the projections CSV. Probably would need a different base list other than projection.
# When it reads lastYear and threeYearAvg, it only adds those stat blocks if that player key already exists from projections:
def main():
    parser = argparse.ArgumentParser(description="Convert NL hitter CSVs to one JSON file.")
    parser.add_argument("--projections", type=Path, default=DEFAULT_PROJECTIONS, help="Projections CSV")
    parser.add_argument("--last-year", type=Path, default=DEFAULT_LAST_YEAR, help="Last year stats CSV")
    parser.add_argument("--three-year", type=Path, default=DEFAULT_THREE_YEAR, help="3-year average CSV")
    parser.add_argument("--output", "-o", type=Path, default=DEFAULT_OUTPUT, help="Output JSON path")
    args = parser.parse_args()

    # Player key -> player object (id, name, team, positions, stats)
    players_by_key: Dict[str, dict] = {}

    # 1) Projections: create players and set stats.projection
    if not args.projections.exists():
        raise FileNotFoundError(f"Projections CSV not found: {args.projections}")
    for row in load_csv(args.projections):
        name, positions, team = parse_player_cell(row.get("Player", ""))
        if not name and not team:
            continue
        key = player_key(name, team)
        hitter = row_to_hitter_stats(row)
        if not hitter:
            continue
        if key not in players_by_key:
            players_by_key[key] = {
                "id": slug_id(name, team),
                "name": name,
                "team": team,
                "positions": positions,
                "suggestedValue": suggested_value_from_fpts(hitter.get("fpts", 0)),
                "stats": {},
            }

        # Keep suggestedValue derived from projection fpts (id/name/team are already set).
        players_by_key[key]["suggestedValue"] = suggested_value_from_fpts(hitter.get("fpts", 0))
        players_by_key[key]["stats"]["projection"] = {
            "seasons": [2026],
            "hitter": hitter,
        }

    # 2) Last year: add stats.lastYear
    if args.last_year.exists():
        for row in load_csv(args.last_year):
            name, positions, team = parse_player_cell(row.get("Player", ""))
            if not name and not team:
                continue
            key = player_key(name, team)
            hitter = row_to_hitter_stats(row)
            if not hitter:
                continue
            if key in players_by_key:
                players_by_key[key]["stats"]["lastYear"] = {
                    "seasons": [2025],
                    "hitter": hitter,
                }
            # Optionally create stub if only in lastYear (uncomment to include)
            # else:
            #     players_by_key[key] = {
            #         "id": slug_id(name, team), "name": name, "team": team,
            #         "positions": positions, "stats": {"lastYear": {"seasons": [2025], "hitter": hitter}},
            #     }

    # 3) Three-year average: add stats.threeYearAvg
    if args.three_year.exists():
        for row in load_csv(args.three_year):
            name, positions, team = parse_player_cell(row.get("Player", ""))
            if not name and not team:
                continue
            key = player_key(name, team)
            hitter = row_to_hitter_stats(row)
            if not hitter:
                continue
            if key in players_by_key:
                players_by_key[key]["stats"]["threeYearAvg"] = {
                    "seasons": [2023, 2024, 2025],
                    "hitter": hitter,
                }

    # Build output array (only players that have at least one stat block)
    out_list = [p for p in players_by_key.values() if p.get("stats")]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out_list, f, indent=4, ensure_ascii=False)

    print(f"Wrote {len(out_list)} players to {args.output}")


if __name__ == "__main__":
    main()

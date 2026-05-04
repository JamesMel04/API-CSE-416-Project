/** Fixtures for DB tests */

import { HitterPlayer } from "@/types";

export const mockHitter: HitterPlayer = {
    id: 660271,
    name: 'Shohei Ohtani',
    team: 'LAD',
    teamId: 119,
    position: 'DH',
    age: 31,
    mlbPositions: [],
    fantasyPositions: [],
    injuryStatus: 'A',
    isMinorLeaguer: false,
    suggestedValue: 0,
    stats: {
        projection: { seasons: [2026], hitting: { ab: 500, r: 90, h: 150, "1b": 80, "2b": 30, "3b": 5, hr: 35, rbi: 95, bb: 70, k: 120, sb: 20, cs: 5, avg: .300, obp: .400, slg: .600, fpts: 0 } },
        lastYear: { seasons: [2025], hitting: { ab: 480, r: 85, h: 140, "1b": 75, "2b": 28, "3b": 4, hr: 33, rbi: 90, bb: 65, k: 115, sb: 18, cs: 4, avg: .290, obp: .390, slg: .580, fpts: 0 } },
        threeYearAvg: { seasons: [2023, 2024, 2025], hitting: { ab: 490, r: 87, h: 145, "1b": 77, "2b": 29, "3b": 4, hr: 34, rbi: 92, bb: 67, k: 117, sb: 19, cs: 4, avg: .295, obp: .395, slg: .590, fpts: 0 } },
    }
};
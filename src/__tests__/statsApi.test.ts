/**
 * Unit tests for functions which communicate with the MLB stats api in mlb.service.ts
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { mockTeamResponse, mockRosterActiveResponse, mockHitterProjectedResponse, mockPitcherStats, mockHitterStats } from './fixtures/mlbApiResponses';


const mockGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({ get: mockGet })),
    },
}));

import { getTeams, getRoster, averageStats, getAllPlayerStats, mapStats, getPlayerAge } from '../services/mlb.service';
import { PitcherStats } from '@/types';

describe('getTeams', () => {
    beforeEach(() => {
        mockGet.mockClear();
    });

    test('returns each team mapped to { abbreviation, id }', async () => {
        mockGet.mockResolvedValue({ data: mockTeamResponse });

        const result = await getTeams();
        
        // checks parameters of getTeams, should always be sportId = 1
        expect(mockGet).toHaveBeenLastCalledWith('/teams', { params: { sportId: '1' } });
        expect(result).toEqual(
            mockTeamResponse.teams.map((team: any) => ({
                abbreviation: team.abbreviation,
                id: team.id,
            }))
        );
    });

    test('returns an empty array when the API returns no teams', async () => {
        mockGet.mockResolvedValue({ data: { teams: [] } });

        const result = await getTeams();

        expect(result).toEqual([]);
    });
});

describe("getRoster", () => {
    const mockTeam = { id: 133, abbreviation: 'ATH' };

    test('returns each player mapped to { name, id } for active roster', async () => {
        mockGet.mockResolvedValue({ data: mockRosterActiveResponse });

        const result = await getRoster(mockTeam.id, mockTeam.abbreviation);

        expect(mockGet).toHaveBeenLastCalledWith('/teams/133/roster', { params: { rosterType: '40Man' } });
        expect(result).toEqual(
            mockRosterActiveResponse.roster.map((player: any) => ({
                name: player.person.fullName,
                id: player.person.id,
                team: 'ATH',
                teamId: 133,
                position: player.position.abbreviation,
                injuryStatus: player.status.code
            }))
        );
    });
});

describe('averageStats', () => {
    test('returns null for an empty array', () => {
        expect(averageStats([])).toBeNull();
    });

    test('correctly averages stats across seasons', () => {
        const stats = [
            { hr: 20, avg: .300,  },
            { hr: 30, avg: .280 },
            { hr: 10, avg: .320 },
        ] as PitcherStats[];

        // expect.closeTo() is needed or else there's floating point errors
        expect(averageStats(stats)).toEqual({ homeRuns: 20, avg: expect.closeTo(0.3) });
    });

    test('skips non-numeric fields', () => {
        const stats = [
            {  hr: 20 },
            { hr: 30  },
        ] as PitcherStats[];

        const result = averageStats(stats);

        expect(result.hr).toEqual(25);
    });
});

describe('getAllPlayerStats', () => {
    // Mock YBY stats covering the three seasons getAllPlayerStats filters for
    const mockYBYStats = [
        { season: '2023', stat: { homeRuns: 20, avg: '.300' } },
        { season: '2024', stat: { homeRuns: 30, avg: '.280' } },
        { season: '2025', stat: { homeRuns: 25, avg: '.290' } },
    ];

    const mockProjectedStat = { homeRuns: 28, avg: '.285' };

    test('returns correct structure with projection, lastYear, and threeYearAvg', async () => {
        // mockResolvedValueOnce lets you mock sequential axios get responses, so it works well for
        // testing this function since getPlayerYBYStats and getPlayerProjectedStats both call api.get()
        mockGet.mockResolvedValueOnce({ data: { stats: [{ splits: mockYBYStats }] } }); // getPlayerYBYStats
        mockGet.mockResolvedValueOnce({ data: { stats: [{ splits: [{ stat: mockProjectedStat }] }] } }); // getPlayerProjectedStats

        const result = await getAllPlayerStats(123, false);

        expect(result).toEqual({
            projection: {
                seasons: [2026],
                hitting: expect.objectContaining({ hr: 28, avg: expect.closeTo(0.285) }),
            },
            lastYear: {
                seasons: [2025],
                hitting: expect.objectContaining({ hr: 25, avg: expect.closeTo(0.29) }),
            },
            threeYearAvg: {
                seasons: [2023, 2024, 2025],
                hitting: expect.objectContaining({ hr: 25, avg: expect.closeTo(0.29) }),
            },
        });
    });

    test('property "pitching" is present when pitcher is grabbed', async () => {
        mockGet.mockResolvedValueOnce({ data: { stats: [{ splits: mockYBYStats }] } });
        mockGet.mockResolvedValueOnce({ data: { stats: [{ splits: [{ stat: mockProjectedStat }] }] } });

        const result = await getAllPlayerStats(123, true);

        expect(result.projection).toHaveProperty('pitching');
        expect(result.lastYear).toHaveProperty('pitching');
        expect(result.threeYearAvg).toHaveProperty('pitching');
    });
});

describe("mapStats", () => {
    test("returns correct structure for hitter stats", () => {
        const result = mapStats(mockHitterStats, "hitting");
        const stats : any = mockHitterStats;
        expect(result).toEqual({
            ab: stats.atBats, 
            r: stats.runs, 
            h: stats.hits,
            "1b": stats.hits - stats.doubles - stats.triples - stats.homeRuns,
            "2b": stats.doubles, 
            "3b": stats.triples, hr: stats.homeRuns,
            rbi: stats.rbi, 
            bb: stats.baseOnBalls, 
            k: stats.strikeOuts,
            sb: stats.stolenBases, 
            cs: stats.caughtStealing,
            avg: parseFloat(stats.avg), 
            obp: parseFloat(stats.obp), 
            slg: parseFloat(stats.slg),
            fpts: 0, // to be calculated later
        })
    });
    test("returns correct structure for pitcher stats", () => {
        const result = mapStats(mockPitcherStats, "pitching");
        const stats = mockPitcherStats;
        expect(result).toEqual({
            gp: stats.gamesPlayed, gs: stats.gamesStarted,
            w: stats.wins, l: stats.losses, sv: stats.saves, hld: stats.holds,
            k: stats.strikeOuts, bb: stats.baseOnBalls, er: stats.earnedRuns,
            ip: parseFloat(stats.inningsPitched),
            era: parseFloat(stats.era), whip: parseFloat(stats.whip),
            fpts: 0,
        })
    })
})

describe("getPlayerAge", () => {
    const testPlayer = {currentAge: 31};
    test("returns correct age", async () => { 
        mockGet.mockResolvedValueOnce(testPlayer);
        const result = await getPlayerAge(1234);
        expect(result).toEqual(31);
    })
})
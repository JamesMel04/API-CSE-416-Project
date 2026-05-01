/**
 * Functions to communicate with the MLB Stats API
*/
import axios from "axios";
import { HitterPlayer, HitterSeasonStats, HitterStats, PitcherPlayer, PitcherSeasonStats, PitcherStats, Player, PlayerPools, PlayerPosition, SeasonStats } from "../types";
import { positionEligibility } from "./db.service";

/**
 * Axios getter to make fetching responses easier
 */
const api = axios.create({
    baseURL: "https://statsapi.mlb.com/api/v1"
})

/**
 * Returns all players in the format described in types/index.ts
 */
export async function getAllPlayers(): Promise<PlayerPools> {
    const teams = await getTeams();
    const hitters: HitterPlayer[] = [];
    const pitchers: PitcherPlayer[] = [];

    // Type used for casting, generated from AI.
    // Casting is needed since getAllPlayerStats can return either T = PitcherSeasonStats | HitterSeasonStats
    // But we know what type it returns when it's true and false, so I just use this template to cast accordingly.
    type StatsGroup<T extends SeasonStats> = {
        projection: T;
        lastYear: T;
        threeYearAvg: T;
    }

    for (const t of teams) {
        const roster = await getRoster(t.id, t.abbreviation);
        for (const p of roster) {
            // Grab age 
            const age = await getPlayerAge(p.id);
            // Grab eligible positions
            const eligiblePositions = await positionEligibility(p.id);
            // Special case for Ohtani
            if (p.position === "TWP") {
                const hitterStats = await getAllPlayerStats(p.id, false) as StatsGroup<HitterSeasonStats>;
                const pitcherStats = await getAllPlayerStats(p.id, true) as StatsGroup<PitcherSeasonStats>;
                hitters.push({ ...p, mlbPositions: eligiblePositions, fantasyPositions: [], age, suggestedValue: 0, stats: hitterStats });
                pitchers.push({ ...p, mlbPositions: eligiblePositions, fantasyPositions: [], age, suggestedValue: 0, stats: pitcherStats });
            } else if (p.position === "P") {
                const stats = await getAllPlayerStats(p.id, true) as StatsGroup<PitcherSeasonStats>;
                pitchers.push({ ...p, mlbPositions: eligiblePositions, fantasyPositions: [], age, suggestedValue: 0, stats });
            } else {
                const stats = await getAllPlayerStats(p.id, false) as StatsGroup<HitterSeasonStats>;
                hitters.push({ ...p, mlbPositions: eligiblePositions, fantasyPositions: [], age, suggestedValue: 0, stats });
            }
        }
    }

    return { hitters, pitchers };
}



/**
 * Grabs list of all teams, returns teams with only the neccessary information
 * {
 * abbreviation : "LAD",
 * id : "123",
 * }
 * sportID = 1 just specifies to grab teams in the MLB
 */
export async function getTeams() {
    const res : any = await api.get('/teams', 
        {params: { sportId: '1' }}
    );
    const teams = res.data.teams;
    return teams.map((team : any) => (
        {
            abbreviation : team.abbreviation,
            id: team.id,
        }
     ))
}

/**
 * Grabs roster of given team id
 * grabs all players by default, including those injured
*/
export async function getRoster(teamId: any, teamAbb : any, active : boolean = false) : Promise<[{  name: string,
            id: number,
            team: string,
            teamId: number,
            position: PlayerPosition, 
            injuryStatus: string }]>{
    let res : any;
    if (active) {
        res = await api.get(`/teams/${teamId}/roster`, 
            {params: { rosterType: "active" }});
    }    
    else {
         res = await api.get(`/teams/${teamId}/roster`, 
            {params: { rosterType: "40Man" }});
    }
    return res.data.roster.map((player : any) => (
        {
            name: player.person.fullName,
            id: player.person.id,
            team: teamAbb,
            teamId: teamId,
            position: player.position.abbreviation,
            injuryStatus: player.status.code
        }
    ));
}

/**
 * Returns the 3-year average stats, 2025 stats, and projected stats of a player
 */
export async function getAllPlayerStats(playerId : number, isPitcher : boolean) :  Promise<
    {
        projection: PitcherSeasonStats;
        lastYear: PitcherSeasonStats;
        threeYearAvg: PitcherSeasonStats;
    } | 
    {
        projection: HitterSeasonStats;
        lastYear: HitterSeasonStats;
        threeYearAvg: HitterSeasonStats;
    }> {
    const group = isPitcher ? "pitching" : "hitting";

    const yearByYear = await getPlayerYBYStats(playerId, group);

    // Filter to only past three season's stats
    const threeYears = (yearByYear.filter((stat) => 
        ["2023", "2024", "2025"].includes(stat.season)).map((stats) => stats.stat)) as PitcherStats[] | HitterStats[];


    const lastYearStats = yearByYear.find((stat: any) => 
        stat.season === "2025")?.stat || {};

    const threeYearAvgStats = averageStats(threeYears);

    const projectionStats = await getPlayerProjectedStats(playerId, group);

    if(isPitcher) {
        return {
            projection: {
                seasons: [2026],
                pitching:  projectionStats as PitcherStats
            },
            lastYear: {
                seasons: [2025],
                pitching: lastYearStats as PitcherStats,
            },
            threeYearAvg: {
                seasons: [2023, 2024, 2025],
                pitching: threeYearAvgStats as PitcherStats
            },
        }
       
    }
    else {
         return {
            projection: {
                seasons: [2026],
                hitting:  projectionStats as HitterStats
            },
            lastYear: {
                seasons: [2025],
                hitting: lastYearStats as HitterStats,
            },
            threeYearAvg: {
                seasons: [2023, 2024, 2025],
                hitting: threeYearAvgStats as HitterStats,
            },
        }
    }
        
}



/**
 * Returns yearByYear stats of a player
 */
export async function getPlayerYBYStats(playerId : number, group: "hitting" | "pitching") : Promise<[{season: string, stat: PitcherStats | HitterStats}] | []> {
    const res : any = await api.get(`/people/${playerId}/stats`, 
        {params: { stats: "yearByYear", group: group }});
     return (res.data.stats?.[0]?.splits || []).map((s: any) => ({ season: s.season, stat: mapStats(s.stat, group) }));
}

/**
 * Returns the projected stats of a player
 */
export async function getPlayerProjectedStats(playerId : number, group: "hitting" | "pitching") {
    const res : any = await api.get(`/people/${playerId}/stats`, 
        {params: { stats: "projected", group: group }});
    return mapStats(res.data.stats?.[0]?.splits?.[0]?.stat, group) || [];
}

/** Gets age of player */
export async function getPlayerAge(playerId : number) {
    const res : any = await api.get(`/people/${playerId}`);
    return res.data.people[0].currentAge;
}

/**
 * @param stats array of stats for the given player
 * @returns average of all the stats
 */
export function averageStats(stats : PitcherStats[] | HitterStats[]) : PitcherStats | HitterStats {
    if (!stats[0] || stats.length === 0) return {} as PitcherStats | HitterStats;

    let result : any = {};
    
    // If a Pitcher
    // AI used to geneerate the below code
    const first = stats[0];

    if ('era' in first) {
        const pitcherStats = stats as PitcherStats[];
        const keys = Object.keys(first) as (keyof PitcherStats)[];
        const result = {} as PitcherStats;

        for (const key of keys) {
            const nums = pitcherStats.map(s => s[key]);
            result[key] = nums.reduce((a, b) => a + b, 0) / nums.length;
        }
        return result;
    } else {
        const hitterStats = stats as HitterStats[];
        const keys = Object.keys(first) as (keyof HitterStats)[];
        const result = {} as HitterStats;

        for (const key of keys) {
            const nums = hitterStats.map(s => s[key]);
            result[key] = nums.reduce((a, b) => a + b, 0) / nums.length;
        }
        return result;
    }
}

/**
 * 
 * @param stats stats to map
 * @param group what group the stats are from
 * Maps the stats of the player to match the hitterStats or pitcherStats type
 */
export function mapStats(stats: any, group : "hitting" | "pitching") : HitterStats | PitcherStats {
    // Fallback in case the given stats is empty
    if (!stats) {
        if(group == "hitting") {
            return {
                ab: 0, 
                r:  0, 
                h: 0,
                "1b": 0,
                "2b": 0, 
                "3b": 0,
                hr: 0,
                rbi: 0, 
                bb: 0, 
                k: 0,
                sb: 0, 
                cs: 0,
                avg: 0, 
                obp: 0, 
                slg: 0,
                fpts: 0, // to be calculated later
            }
        }
        else {
            return {
                gp: 0, 
                era: 0, 
                gs: 0,
                w: 0, 
                l: 0, 
                sho: 0,
                sv: 0,
                ip: 0,
                h: 0,
                er: 0,
                r: 0,
                hr: 0,
                hld: 0,
                hb: 0,
                bb: 0, 
                so: 0, 
                whip: 0,
                avg: 0,
                fpts: 0,
            }
        }
    }
    if (group == "hitting") {
        return {
            ab: stats.atBats ?? 0, 
            r: stats.runs ?? 0, 
            h: stats.hits ?? 0,
            "1b": stats.hits - stats.doubles - stats.triples - stats.homeRuns,
            "2b": stats.doubles ?? 0, 
            "3b": stats.triples ?? 0, 
            hr: stats.homeRuns ?? 0,
            rbi: stats.rbi ?? 0, 
            bb: stats.baseOnBalls ?? 0, 
            k: stats.strikeOuts ?? 0,
            sb: stats.stolenBases ?? 0, 
            cs: stats.caughtStealing ?? 0,
            avg: parseFloat(stats.avg) || 0, 
            obp: parseFloat(stats.obp) || 0, 
            slg: parseFloat(stats.slg) || 0,
            fpts: 0, // to be calculated later
        }
    }
    else {
        return {
            gp: stats.gamesPlayed ?? 0, 
            era: parseFloat(stats.era) ?? 0, 
            gs: stats.gamesStarted ?? 0,
            w: stats.wins ?? 0, 
            l: stats.losses ?? 0, 
            sho: stats.shutouts ?? 0,
            sv: stats.saves ?? 0,
            ip: parseFloat(stats.inningsPitched) || 0,
            h: stats.hits ?? 0,
            er: stats.earnedRuns ?? 0,
            r: stats.runsScoredPer9 ?? 0,
            hr: stats.homeRunsPer9 ?? 0,
            hld: stats.holds ?? 0,
            hb: stats.hitBatsmen ?? 0,
            bb: stats.baseOnBalls ?? 0, 
            so: stats.strikeOuts ?? 0, 
            whip: parseFloat(stats.whip) || 0,
            avg: 0,
            fpts: 0,
        }
    }
}
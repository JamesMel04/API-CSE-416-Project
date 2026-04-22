/**
 * Functions to communicate with the MLB Stats API
*/
import axios from "axios";
import { HitterPlayer, HitterSeasonStats, HitterStats, PitcherPlayer, PitcherSeasonStats, PitcherStats, Player, PlayerPools, PlayerPosition, SeasonStats } from "../types";

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
            // Special case for Ohtani

            if (p.position === "TWP") {
                const hitterStats = await getAllPlayerStats(p.id, false) as StatsGroup<HitterSeasonStats>;
                const pitcherStats = await getAllPlayerStats(p.id, true) as StatsGroup<PitcherSeasonStats>;
                hitters.push({ ...p, positions: [p.position], suggestedValue: 0, stats: hitterStats });
                pitchers.push({ ...p, positions: [p.position], suggestedValue: 0, stats: pitcherStats });
            } else if (p.position === "P") {
                const stats = await getAllPlayerStats(p.id, true) as StatsGroup<PitcherSeasonStats>;
                pitchers.push({ ...p, positions: [p.position], suggestedValue: 0, stats });
            } else {
                const stats = await getAllPlayerStats(p.id, false) as StatsGroup<HitterSeasonStats>;
                hitters.push({ ...p, positions: [p.position], suggestedValue: 0, stats });
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
        ["2023", "2024", "2025"].includes(stat.season)).map((stats) => mapStats(stats, group))) as PitcherStats[] | HitterStats[];

    const lastYearStats = yearByYear.find((stat: any) => 
        stat.season === "2025")?.stat || null;

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
    if (group == "hitting") {
        return {
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
        }
    }
    else {
        return {
            gp: stats.gamesPlayed, 
            era: parseFloat(stats.era), 
            gs: stats.gamesStarted,
            w: stats.wins, 
            l: stats.losses, 
            sho: stats.shutouts,
            sv: stats.saves,
            ip: parseFloat(stats.inningsPitched),
            h: stats.hits,
            er: stats.earnedRuns,
            r: stats.runsScoredPer9,
            hr: stats.homeRunsPer9,
            hld: stats.holds,
            hb: stats.hitsBatsmen,
            bb: stats.baseOnBalls, 
            so: stats.strikeOuts, 
            whip: parseFloat(stats.whip),
            avg: 0,
            fpts: 0,
        }
    }
}
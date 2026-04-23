import { HitterPlayer, HitterStats, PitcherPlayer, PitcherStats, PlayerPools, PlayerPosition } from "@/types";
import { Pool } from "pg";
import { getAllPlayers } from "./mlb.service";
import pool from "./db.pool" ;

// After how many hours to refresh data
const REFRESH_TIME = 24;

// Service functions to implement with database
// const pool = new Pool({
//     connectionString: process.env.DB_LINK,
// });

// Local players pool, uncomment when you want to run tests.

// const playersPool=new Pool({
//     host: 'localhost',
//     port: 5432,
//     database: 'mlbtest',
//     user: 'postgres',
//     password: "your_password",
// });

/**
 * Returns cached players from the database, if they are new enough. Otherwise, it refreshes the DB
 */
export async function getCachedPlayers() : Promise<PlayerPools> {
    if(await shouldUpdateCache()) {
        await refreshPlayers();
        await updateRefreshTimestamp();
    }
    // TODO: Grab players from DB to return, creating a JOIN between the players table and the stats table when IDs equal.
    const hitters : HitterPlayer[] = [];
    const pitchers : PitcherPlayer[] = [];

    // Step 1: Get a join of the hitters and pitchers with the hitter and pitcher stats respectively
    const hitterRows = await pool.query("SELECT p.*, h.* FROM players p JOIN hitter_stats h ON p.mlb_id = h.mlb_id ORDER BY p.mlb_id, h.stat_type ");
    const pitcherRows = await pool.query("SELECT p.*, ps.* FROM players p JOIN pitcher_stats ps ON p.mlb_id = ps.mlb_id ORDER BY p.mlb_id, ps.stat_type");

    // This will give rows where the player information repeats in 3 rows for each stat type. Then, from this join,
    // you can make the player objects to add to the hitters and pitchers
    populateHitters(hitters, hitterRows.rows);
    populatePitchers(pitchers, pitcherRows.rows);


    return {hitters, pitchers};
}

export function populateHitters(hitters : HitterPlayer[], rows : any) {
    for (let i = 0; i < rows.length; i+=3) {
        const lyI = i; // last year index
        const pI = i+1; // projected index
        const tyaI = i+2 // three-year average index
        let player : HitterPlayer = {
            id: rows[i].mlb_id,
            name: rows[i].name,
            team: rows[i].team,
            teamId: rows[i].team_id,
            positions: [rows[i].position as PlayerPosition],
            position: rows[i].position,
            age: rows[i].age,
            injuryStatus: rows[i].injury_status,
            suggestedValue: rows[i].suggested_value,
            stats: {
                projection: {
                    seasons: [2026],
                    hitting: deriveHitterStats(rows[pI]),
                },
                lastYear: {
                    seasons: [2025],
                    hitting: deriveHitterStats(rows[lyI]),
                },
                threeYearAvg: {
                    seasons: [2023, 2024, 2025],
                    hitting: deriveHitterStats(rows[tyaI]),
                }
            }
        };
        hitters.push(player);
    }
}

export function populatePitchers(pitchers : PitcherPlayer[], rows : any) {
     for (let i = 0; i < rows.length; i+=3) {
        const lyI = i; // last year index
        const pI = i+1; // projected index
        const tyaI = i+2 // three-year average index
        let player : PitcherPlayer = {
            id: rows[i].mlb_id,
            name: rows[i].name,
            team: rows[i].team,
            teamId: rows[i].team_id,
            positions: [rows[i].position as PlayerPosition],
            position: rows[i].position,
            age: rows[i].age,
            injuryStatus: rows[i].injury_status,
            suggestedValue: rows[i].suggested_value,
            stats: {
                projection: {
                    seasons: [2026],
                    pitching: derivePitcherStats(rows[pI]),
                },
                lastYear: {
                    seasons: [2025],
                    pitching: derivePitcherStats(rows[lyI]),
                },
                threeYearAvg: {
                    seasons: [2023, 2024, 2025],
                    pitching: derivePitcherStats(rows[tyaI]),
                }
            }
        };
        pitchers.push(player);
    }
}

/** Derives hitter stats from SQL row */
export function deriveHitterStats(row : any)  : HitterStats {
    return {
        ab: row.ab, // at bats, how many times they appeared to bat
        r: row.r, // runs scored, home run = 1 run. any other players on plates also score runs
        h: row.h, // Hits
        "1b": row["1b"], // singles
        "2b": row["2b"], // doubles
        "3b": row["3b"], // Triples
        hr: row.hr, // Home runs
        rbi: row.rbi, // runs batted in, how many runners scored from your hit
        bb: row.bb, // walks
        k: row.k, // strikeouts
        sb: row.sb, // stolen base, advance base without hit
        cs: row.cs, // caught stealing, tagged out
        avg: row.avg, // batting average, hits / at bats
        obp: row.obp, // on-base percentage
        slg: row.slg, // slugging percentage, total bases / at bats
        fpts: row.fpts, // fantasy points
    }
}

/** Derive pitcher stats from SQL row */
export function derivePitcherStats(row : any) : PitcherStats {
    return {
        gp: row.gp,
        era: row.era,
        gs: row.gs,
        w: row.w,
        l: row.l,
        sho: row.sho,
        sv: row.sv,
        ip: row.ip,
        h: row.h,
        er: row.er,
        r: row.r,
        hr: row.hr,
        hld: row.hld,
        hb: row.hb,
        bb: row.bb,
        so: row.so,
        whip: row.whip,
        avg: row.avg,
        fpts: row.fpts
    }
}


/**
 * Refreshes players by inserting new ones into the database
 */
export async function refreshPlayers() {
    const { hitters, pitchers } = await getAllPlayers();

    // Insert hitters
    for (const h of hitters) await insertHitter(h);

    // Insert pitchers
    for (const p of pitchers) await insertPitcher(p);
}

/**
 * Inserts given player into DB
 */
export async function insertPlayer(player: HitterPlayer | PitcherPlayer) {
    await pool.query(
        `INSERT INTO players (mlb_id, name, team, team_id, position, age, injury_status, suggested_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (mlb_id) DO UPDATE SET
         name=$2, team=$3, team_id=$4, position=$5, age=$6, injury_status=$7, suggested_value=$8`,
        [player.id, player.name, player.team, player.teamId, player.position, player.age, player.injuryStatus, player.suggestedValue]
    );
}

export async function insertHitter(player: HitterPlayer) {
    await insertPlayer(player);
    const statTypes = ['projection', 'lastYear', 'threeYearAvg'] as const;

    for(const type of statTypes) {
        const s = player.stats[type].hitting;
        await pool.query(
            `INSERT INTO hitter_stats (mlb_id, stat_type, ab, r, h, "1b", "2b", "3b", hr, rbi, bb, k, sb, cs, avg, obp, slg, fpts)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             ON CONFLICT (mlb_id, stat_type) DO UPDATE SET
             ab=$3, r=$4, h=$5, "1b"=$6, "2b"=$7, "3b"=$8, hr=$9, rbi=$10, bb=$11, k=$12, sb=$13, cs=$14, avg=$15, obp=$16, slg=$17, fpts=$18`,
            [player.id, type, s.ab, s.r, s.h, s["1b"], s["2b"], s["3b"], s.hr, s.rbi, s.bb, s.k, s.sb, s.cs, s.avg, s.obp, s.slg, s.fpts]
        );
    }
}

export async function insertPitcher(player: PitcherPlayer) {
    await insertPlayer(player);

    const statTypes = ['projection', 'lastYear', 'threeYearAvg'] as const;
    for (const type of statTypes) {
        const s = player.stats[type].pitching;
        await pool.query(
            `INSERT INTO pitcher_stats (mlb_id, stat_type, gp, era, gs, w, l, sho, sv, ip, h, er, r, hr, hld, hb, bb, so, whip, avg, fpts)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
             ON CONFLICT (mlb_id, stat_type) DO UPDATE SET
             gp=$3, era=$4, gs=$5, w=$6, l=$7, sho=$8, sv=$9, ip=$10, h=$11, er=$12, r=$13, hr=$14, hld=$15, hb=$16, bb=$17, so=$18, whip=$19, avg=$20, fpts=$21`,
            [player.id, type, s.gp, s.era, s.gs, s.w, s.l, s.sho, s.sv, s.ip, s.h, s.er, s.r, s.hr, s.hld, s.hb, s.bb, s.so, s.whip, s.avg, s.fpts]
        );
    }

}

/** Returns boolean if player data is old enough to grab again */
export async function shouldUpdateCache() {
    const result = await pool.query('SELECT refreshed_at FROM last_refresh WHERE id = 1');
    if (result.rows.length === 0) return true;

    const lastRefresh = new Date(result.rows[0].refreshed_at);
    const hoursSince = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60);
    return hoursSince >= REFRESH_TIME;
}

/** Updates the refresh time. The refresh time table is just a singleton */
async function updateRefreshTimestamp() {
    await pool.query(
        `INSERT INTO last_refresh (id, refreshed_at) VALUES (1, NOW())
         ON CONFLICT (id) DO UPDATE SET refreshed_at = NOW()`
    );
}

/** Checks if the API key exists or not */
export async function checkAPIKey(apiKey: string) {
    const rows = await pool.query(
     `SELECT EXISTS (SELECT 1 FROM api_keys WHERE api_key=$1`,
     [apiKey]
    );
    return rows[0].exists;
}
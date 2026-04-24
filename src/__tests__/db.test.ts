import { Pool } from "pg";
import { mockHitter } from "./fixtures/db";
import { insertHitter, insertPitcher } from "../services/db.service";
import playersPool from "../services/db.pool";
import { afterAll, describe, expect, test } from "vitest";

/**
 * Tests for database, should only be done on a local db
 */
/** Testing locally for database changes */

async function testDB() {
    let local=false
    if(local){
        try {
            const result = await playersPool.query('SELECT NOW()');
                console.log('Connected! Server time:', result.rows[0].now);

                // Test creating a table
                await playersPool.query(`
                    CREATE TABLE IF NOT EXISTS test_players (
                        id SERIAL PRIMARY KEY,
                        name TEXT,
                        position TEXT
                    )
                `);
                console.log('Table created');

                // Test inserting
                await playersPool.query(
                    'INSERT INTO test_players (name, position) VALUES ($1, $2)',
                    ['Shohei Ohtani', 'TWP']
                );
                console.log('Inserted');

                // Test reading
                const players = await playersPool.query('SELECT * FROM test_players');
                console.log('Players:', players.rows);

                // Clean up
                // await playersPool.query('DROP TABLE test_players');
                console.log('Cleaned up');
        }catch(err) {
            console.error("TestDB Error", err);
        }
    }
  
}

/** Testing getAllPlayers integration with Database **/

describe("insertHitter", () => {
    afterAll(async () => {
        await playersPool.query('DELETE FROM hitter_stats WHERE mlb_id = $1', [660271]);
        await playersPool.query('DELETE FROM players WHERE mlb_id = $1', [660271]);
        await playersPool.end();
    });

    test("inserts and reads back correctly", async () => {
        await insertHitter(mockHitter);

        const player = await playersPool.query('SELECT * FROM players WHERE mlb_id = $1', [660271]);
        expect(player.rows[0].name).toBe('Shohei Ohtani');
        expect(player.rows[0].team).toBe('LAD');
        expect(player.rows[0].age).toBe(31);

        const stats = await playersPool.query('SELECT * FROM hitter_stats WHERE mlb_id = $1 ORDER BY stat_type', [660271]);
        expect(stats.rows).toHaveLength(3);
        expect(stats.rows.map((r: any) => r.stat_type).sort()).toEqual(['lastYear', 'projection', 'threeYearAvg']);

        const proj = stats.rows.find((r: any) => r.stat_type === 'projection');
        expect(parseInt(proj.hr)).toBe(35);
        expect(parseFloat(proj.avg)).toBeCloseTo(0.3);
    });
});



testDB();
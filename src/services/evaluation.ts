import {Player, ValuationRequest, PlayerValuation, HitterStats, PlayerPools, HitterCategory, HitterCategorySummary} from '../types';
import { mean, standardDeviation } from "simple-statistics";


/**
 * Evaluates all eligible players and computes auction prices base on
 * the current league settings and draft state. 
 * Assumes all players already have some projection stats.
 * @param players All players available
 * @param request The valuation request containing league settings and draft state
 * @returns An array of player valuations with normalized values and auction prices
 */
export function evaluatePlayers(players: Player[], request: ValuationRequest): PlayerValuation[] {
    const {leagueSettings, draftState} = request;

    //Step 1: Filter out drafted players
    const eligible: Player[] = players.filter(player => !draftState.draftedPlayerIds.includes(player.id))


    //Step 2: Separate players into different pools: Hitters and Pitchers 
    const {hitters, pitchers}  = separatePools(players);


    //Step 3: Calculate the mean and standard deviation across the eligible player pools
    //Might want to exclude some categories
    const categories: HitterCategory[] = [
        "r", "1b", "2b", "3b",
        "hr", "rbi", "bb", "k", "sb", "cs",
        "obp", "slg"
    ];

    const hitterMean: HitterCategorySummary = {} as HitterCategorySummary;
    const hitterstdDev: HitterCategorySummary= {} as HitterCategorySummary;

    for (const category of categories){
        // Array of all player's stat of that category
        const values = hitters.map(player => player.stats.projection.hitter[category])
        
        hitterMean[category] = values.length > 0 ? mean(values) : 0;
        hitterstdDev[category] = values.length > 1 ? standardDeviation(values) : 0;
    }


    return [];
}


/**
 * Separate an array of player into hitters and pitchers
 * @param players 
 * @returns A pool with hitters, pitchers separated
 */
function separatePools(eligible: Player[]) : PlayerPools {
    const hitters: Player[] = [];
    const pitchers: Player[] = [];

    for(const player of eligible) {
        // Pitcher Positions: P, SP, RP
        const isPitcher = player.positions.includes("P") 
            || player.positions.includes("SP") 
            || player.positions.includes("RP");

        // Hitter Positions: any other then P, SP, RP
        const isHitter = !isPitcher || player.positions.some(
            pos => !["P", "SP", "RP"].includes(pos)
        );

        // if a player plays both, he is placed into both pools
        if (isHitter) {
            hitters.push(player);
        }

        if (isPitcher) {
            pitchers.push(player);
        }
    }

    return { hitters, pitchers };
}

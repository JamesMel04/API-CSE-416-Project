import {Player, ValuationRequest, PlayerValuation, PlayerPools, HitterCategory, HitterCategorySummary, PlayerHitterCategorySummaries} from '../types';
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
    const {hitters, pitchers}  = separatePools(eligible);


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
    // For each category, we now have a mean and stdDeV
    

    //Step 4: For each player calculate the category z-score
    const hitterZScores: Record<string, HitterCategorySummary> = {};

    // For each hitter
    for (const player of hitters){
        const zScores = {} as HitterCategorySummary;

        //For each category
        for (const category of categories) {
            const value = player.stats.projection.hitter[category];
            const mean = hitterMean[category];
            const stdDev = hitterstdDev[category];
    
            //Calculate the z-score for this category
            zScores[category] = stdDev === 0 ? 0 : (value - mean) / stdDev;
        }
    
        /**Ex: [-] = below average, [0] = average, [+] = above average
         * {
            "playerID_1": { hr: 1.2, rbi: 0.9, obp: 1.8, ... },
            "playerID_2": { hr: 0.8, rbi: 0.7, obp: 1.1, ... }
            }
         * look up by ID
         */
        hitterZScores[player.id] = zScores;
    }


    //Step 5: Multiply each category z-score by that category’s importance weight.
        /*Skipped for now, assume all 1*/


    //Step 6: Add the weighted z-scores to get the player’s base score.
    const hitterBaseScores: Record<string, number> = {};

    for (const player of hitters) {
        const zScores = hitterZScores[player.id]!;

        let baseScore = 0;
    
        // Summing each category
        for (const category of categories) {
            baseScore += zScores[category] ;
        }
        hitterBaseScores[player.id] = baseScore;
    }


    //Step 7: Compute the adjustment factors
        /*Hardcode 1 for now*/
    const ageFactor = 1;
    const injuryFactor = 1;


    //Step 8: Multiply the factors
        //TotalFactor = AgeFactor * InjuryFactor * DepthFactor * ImportanceFactor
    

    //Step 9: Compute the adjusted score
    const hitterAdjustedScores: Record<string, number> = {};
    
    for (const player of hitters) {
        const totalFactor = 1; //To be changed when Step 8 finished
        hitterAdjustedScores[player.id] = hitterBaseScores[player.id]! * totalFactor;
    }


    //Step 10: Compute a replacement score for each position (requires LeagueSetting & DraftState)
        /**
         * 1. Look at one position at a time, such as C, 1B, 2B, 3B, SS.
         * 2. Make a list of all undrafted players who are eligible at that position.
         * 3. Sort that list by AdjustedScore.
         * 4. Find the cutoff rank for that position using the current draft state.
         * 5. Use the AdjustedScore at that cutoff as ReplacementScore (position).
         */


    //Step 11: Calculate Margin Score for each Player
        // account for scarcer position
        // ex: if only 4 team is missing a Pitcher, and there are 6 really good pitchers left, we don't have to be in rush of picking the pitcher, we could spend the pick with other positions  
        // Waiting for Step 10 to finish the calculation of ReplacementScore
        // MarginalScore = AdjustedScore - ReplacementScore
    const hitterMarginalScores: Record<string, number> = {};

    for (const player of hitters) {
        const adjustedScore = hitterAdjustedScores[player.id]!;
        hitterMarginalScores[player.id] = Math.max(adjustedScore, 0);
    }


    //Step 12: Calculate NormalizedValue(player) for each player
    //{playerID, 0...1}
    const hitterNormalizedValues: Record<string, number> = {};

    //Find the largest MarginalScore among all players
    const hitterMSArray: number[] = Object.values(hitterMarginalScores);
    const maxHitterMS = hitterMSArray.length > 0 ? Math.max(...hitterMSArray) : 0;

    //NormalizedValue(player) = MarginalScore(player) / MaxMarginalScore
    for (const player of hitters) {
        //Get marginal score of player
        const marginalScore = hitterMarginalScores[player.id]!;
        //Calculate Normalized value for the player
        hitterNormalizedValues[player.id] = maxHitterMS > 0 ? marginalScore / maxHitterMS : 0;
    }


    //Step 13: Calculate Auction Price for each player
    //  ((budget per team/roster size) * NormalizedValue(player))^(1.5)
    const hitterAuctionPrices: Record<string, number> = {};
    const dollarsPerRosterSpot = leagueSettings.budget / leagueSettings.rosterSize;

    for (const player of hitters) {
        const normalizedValue = hitterNormalizedValues[player.id]!;
        const price = Math.pow(dollarsPerRosterSpot * normalizedValue, 1.5);
    
        hitterAuctionPrices[player.id] = price;
    }
    
    // Final: return PlayerValuation
    // Only hitter is implemented now, pitchers will have a value of 0/1
    const valuations: PlayerValuation[] = eligible.map((player) => ({
        id: player.id,
        normalizedValue: hitterNormalizedValues[player.id] ?? 0,
        auctionPrice: hitterAuctionPrices[player.id] ?? 1,
    }));
    
    return valuations;
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

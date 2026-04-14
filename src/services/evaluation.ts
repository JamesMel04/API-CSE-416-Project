import {Player, ValuationRequest, HitterCategoryWeights, PitcherCategoryWeights , HitterScoringCategory, PitcherScoringCategory, PlayerValuation, PlayerPools, HITTER_SCORING_CATEGORIES, PITCHER_SCORING_CATEGORIES, HitterCategorySummary, PlayerHitterCategorySummaries, PlayerPitcherCategorySummaries, PitcherCategorySummary} from '../types';
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

    // =====================================================================================================
    // [Step 1: Filter out drafted players] 

    // Get an Array of IDs of all players that has being drafted
    const draftedPlayerIds = new Set(
        draftState.rosterAssignments.map((assignment) => assignment.playerId)
    );

    // Gets the players who have not being drafted yet
    const eligible: Player[] = players.filter(
        (player) => !draftedPlayerIds.has(player.id)
    );

    // =====================================================================================================
    // [Step 2: Separate players into different pools: Hitters and Pitchers] 

    const {hitters, pitchers}  = separatePools(eligible);
    
    // =====================================================================================================
    // [Step 3: Calculate the mean and standard deviation across the eligible player pools]

    const hitterMean = {} as HitterCategorySummary;
    const hitterStdDev = {} as HitterCategorySummary;
    
    const pitcherMean = {} as PitcherCategorySummary;
    const pitcherStdDev = {} as PitcherCategorySummary;

    // Hitters
    for (const category of HITTER_SCORING_CATEGORIES){
        // Array of all player's stat of that category
        const values = hitters.map(player => player.stats.projection.hitter[category]);

        hitterMean[category] = values.length > 0 ? mean(values) : 0;
        hitterStdDev[category] = values.length > 1 ? standardDeviation(values) : 0;
    }

    // Pitchers
    for (const category of PITCHER_SCORING_CATEGORIES){
        // Array of all player's stat of that category
        const values = pitchers.map(player => player.stats.projection.pitcher[category])

        pitcherMean[category] = values.length > 0 ? mean(values) : 0;
        pitcherStdDev[category] = values.length > 1 ? standardDeviation(values) : 0;
    }
    
    // =====================================================================================================
    // [Step 4: For each player calculate the category z-score]

    const hitterZScores: PlayerHitterCategorySummaries = {};
    const pitcherZScores: PlayerPitcherCategorySummaries = {};
    const NEGATIVE_HITTER_CATEGORIES = new Set<HitterScoringCategory>(["k", "cs"]);
    const NEGATIVE_PITCHER_CATEGORIES = new Set<PitcherScoringCategory>(["era", "whip", "avg"]);

    
    /**Ex: [-] = below average, [0] = average, [+] = above average
     * {
        "playerID_1": { hr: 1.2, rbi: 0.9, obp: 1.8, ... },
        "playerID_2": { hr: 0.8, rbi: 0.7, obp: 1.1, ... }
        }
     */

    // For each hitter
    for (const player of hitters){
        const zScores = {} as HitterCategorySummary;

        //For each category
        for (const category of HITTER_SCORING_CATEGORIES) {
            const value = player.stats.projection.hitter[category];
            const mean = hitterMean[category];
            const stdDev = hitterStdDev[category];
            const isNegative = NEGATIVE_HITTER_CATEGORIES.has(category);
    
            //Calculate the z-score for this category
            zScores[category] =
                stdDev === 0
                    ? 0
                    : isNegative
                        ? (mean - value) / stdDev
                        : (value - mean) / stdDev;
                    }
        hitterZScores[player.id] = zScores;
    }

    // For each pitcher
    for (const player of pitchers){
        const zScores = {} as PitcherCategorySummary;

        //For each category
        for (const category of PITCHER_SCORING_CATEGORIES) {
            const value = player.stats.projection.pitcher[category];
            const mean = pitcherMean[category];
            const stdDev = pitcherStdDev[category];
            const isNegative = NEGATIVE_PITCHER_CATEGORIES.has(category);

            //Calculate the z-score for this category
            zScores[category] =
                stdDev === 0
                    ? 0
                    : isNegative
                        ? (mean - value) / stdDev
                        : (value - mean) / stdDev;
                    }
        pitcherZScores[player.id] = zScores;
    }

    // =====================================================================================================
    // === Step 5: Multiply each category z-score by that category’s importance weight.

    const DEFAULT_HITTER_CATEGORY_WEIGHTS: HitterCategoryWeights = {
        r: 1,
        "1b": 1,
        "2b": 1,
        "3b": 1,
        hr: 1,
        rbi: 1,
        bb: 1,
        k: 1,
        sb: 1,
        cs: 1,
        obp: 1,
        slg: 1,
        };
        
    const DEFAULT_PITCHER_CATEGORY_WEIGHTS: PitcherCategoryWeights = {
        w: 1,
        sv: 1,
        so: 1,
        ip: 1,
        era: 1,
        whip: 1,
        avg: 1,
    };

    // Fallback as default weights
    const hitterWeights: HitterCategoryWeights = {
        ...DEFAULT_HITTER_CATEGORY_WEIGHTS,
        ...(leagueSettings.categoryWeights?.hitters ?? {}),
    };
        
    const pitcherWeights: PitcherCategoryWeights = {
        ...DEFAULT_PITCHER_CATEGORY_WEIGHTS,
        ...(leagueSettings.categoryWeights?.pitchers ?? {}),
    };

    const hitterWeightedZScores: PlayerHitterCategorySummaries = {};
    const pitcherWeightedZScores: PlayerPitcherCategorySummaries = {};

    // Hitters
    for (const player of hitters) {
        const weightedScores = {} as HitterCategorySummary;
        const zScores = hitterZScores[player.id]!;

        for (const category of HITTER_SCORING_CATEGORIES) {
            weightedScores[category] = zScores[category] * hitterWeights[category];
        }

        hitterWeightedZScores[player.id] = weightedScores;
    }

    // Pitchers
    for (const player of pitchers) {
        const weightedScores = {} as PitcherCategorySummary;
        const zScores = pitcherZScores[player.id]!;

        for (const category of PITCHER_SCORING_CATEGORIES) {
            weightedScores[category] = zScores[category] * pitcherWeights[category];
        }

        pitcherWeightedZScores[player.id] = weightedScores;
    }

    // =====================================================================================================
    // === Step 6: Add the weighted z-scores to get the player’s base score.

    const hitterBaseScores: Record<string, number> = {};
    const pitcherBaseScores: Record<string, number> = {};

    // Hitters
    for (const player of hitters) {
        const weightedScores = hitterWeightedZScores[player.id]!;
        let baseScore = 0;

        // Summing each category
        for (const category of HITTER_SCORING_CATEGORIES) {
            baseScore += weightedScores[category];
        }
        hitterBaseScores[player.id] = baseScore;
    }

    // Pitchers
    for (const player of pitchers) {
        const weightedScores = pitcherWeightedZScores[player.id]!;
        let baseScore = 0;

        // Summing each category
        for (const category of PITCHER_SCORING_CATEGORIES) {
            baseScore += weightedScores[category];
        }
        pitcherBaseScores[player.id] = baseScore;
    }

    // =====================================================================================================
    // === Step 7: Compute the adjustment factors

    const hitterAgeFactors: Record<string, number> = {};
    const pitcherAgeFactors: Record<string, number> = {};
    
    // Hitters age factor
    for (const player of hitters) {
        hitterAgeFactors[player.id] = getAgeFactor(player.age);
    }

    // Pitchers age factor
    for (const player of pitchers) {
        pitcherAgeFactors[player.id] = getAgeFactor(player.age);
    }
        //*Include other factors like injuries too in the future*//
        const injuryFactor = 1;

    // =====================================================================================================
    // === Step 8: Multiply the factors

    const hitterTotalFactors: Record<string, number> = {};
    const pitcherTotalFactors: Record<string, number> = {};

    //TotalFactor = AgeFactor * InjuryFactor * DepthFactor * ImportanceFactor

    // Hitters
    for (const player of hitters) {
        hitterTotalFactors[player.id] = hitterAgeFactors[player.id]! * injuryFactor;
    }

    // Pitchers
    for (const player of pitchers) {
        pitcherTotalFactors[player.id] = pitcherAgeFactors[player.id]! * injuryFactor;
    }

    
    // =====================================================================================================
    // === Step 9: Compute the adjusted score

    const hitterAdjustedScores: Record<string, number> = {};
    const pitcherAdjustedScores: Record<string, number> = {};

    // Hitters
    for (const player of hitters) {
        hitterAdjustedScores[player.id] = hitterBaseScores[player.id]! * hitterTotalFactors[player.id]!;
    }

    // Pitchers
    for (const player of pitchers) {
        pitcherAdjustedScores[player.id] = pitcherBaseScores[player.id]! * pitcherTotalFactors[player.id]!;
    }

    // =====================================================================================================
    // === Step 10: Compute a replacement score for each position (requires LeagueSetting & DraftState)

        /**
         * 1. Look at one position at a time, such as C, 1B, 2B, 3B, SS.
         * 2. Make a list of all undrafted players who are eligible at that position.
         * 3. Sort that list by AdjustedScore.
         * 4. Find the cutoff rank for that position using the current draft state.
         * 5. Use the AdjustedScore at that cutoff as ReplacementScore (position).
         */

    // =====================================================================================================
    // === Step 11: Calculate Margin Score for each Player

        // account for scarcer position
        // ex: if only 4 team is missing a Pitcher, and there are 6 really good pitchers left, we don't have to be in rush of picking the pitcher, we could spend the pick with other positions  
        // Waiting for Step 10 to finish the calculation of ReplacementScore
        // MarginalScore = AdjustedScore - ReplacementScore
    const hitterMarginalScores: Record<string, number> = {};

    for (const player of hitters) {
        const adjustedScore = hitterAdjustedScores[player.id]!;
        hitterMarginalScores[player.id] = Math.max(adjustedScore, 0);
    }

    // =====================================================================================================
    // === Step 12: Calculate NormalizedValue(player) for each player

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

    // =====================================================================================================
    // === Step 13: Calculate Auction Price for each player

    //  ((budget per team/roster size) * NormalizedValue(player))^(1.5)
    const hitterAuctionPrices: Record<string, number> = {};
    const dollarsPerRosterSpot = leagueSettings.budget / leagueSettings.rosterSize;

    for (const player of hitters) {
        const normalizedValue = hitterNormalizedValues[player.id]!;
        const price = Math.pow(dollarsPerRosterSpot * normalizedValue, 1.5);
    
        hitterAuctionPrices[player.id] = price;
    }

    // =====================================================================================================
    // === Final: return PlayerValuation

    // Only hitter is implemented now, pitchers will have a value of 0/1
    const valuations: PlayerValuation[] = eligible.map((player) => ({
        id: player.id,
        normalizedValue: hitterNormalizedValues[player.id] ?? 0,
        auctionPrice: hitterAuctionPrices[player.id] ?? 1,
    }));
    
    return valuations;
}


const PITCHER_POSITIONS = new Set(["P", "SP", "RP"]);

/**
 * Separate an array of player into hitters and pitchers
 * @param players 
 * @returns A pool with hitters, pitchers separated
 */
function separatePools(eligible: Player[]) : PlayerPools {
    const hitters: Player[] = [];
    const pitchers: Player[] = [];

    for (const player of eligible) {
        const hasPitcherPosition = player.positions.some((pos) =>
            PITCHER_POSITIONS.has(pos)
        );

        const hasHitterPosition = player.positions.some((pos) =>
            !PITCHER_POSITIONS.has(pos)
        );

        // Check if the player have the stat block
        const hasHitterStats = player.stats?.projection?.hitter !== undefined;
        const hasPitcherStats = player.stats?.projection?.pitcher !== undefined;

        if (hasHitterPosition && hasHitterStats) {
            hitters.push(player);
        }

        if (hasPitcherPosition && hasPitcherStats) {
            pitchers.push(player);
        }
    }

    return { hitters, pitchers };
}

/**
 * Computes a player's age adjustment factor using a quadratic curve centered
 * on the peak age.
 * 
 * Example with `peakAge = 28`:
 * - age 27 -> 1.00
 * - age 25 -> 0.99
 * - age 21 -> 0.91
 *
 * @param age The player's current age in years.
 * @param peakAge The age considered the player's performance peak. 
 * @returns A raw age factor where values closer to 1 indicate ages nearer the peak.
 */
function getAgeFactor(age: number): number {
    const peakAge = 27; // Age with Factor of 1, best
    const ageAwayFromBest = age - peakAge;
    const penalty = 0.0025; 

    // ** 2: squares the age difference
    const raw = 1 - penalty * ((ageAwayFromBest) ** 2);

    return Math.max(0.90, Math.min(1.0, raw)); // keep age Factor min at 0.9
}

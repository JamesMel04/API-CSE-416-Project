import {
    HITTER_SCORING_CATEGORIES,
    PITCHER_SCORING_CATEGORIES,
    ROSTER_SLOTS,
} from "../types";

import type {
    DraftState,
    HitterCategorySummary,
    HitterCategoryWeights,
    HitterScoringCategory,
    PitcherCategorySummary,
    PitcherCategoryWeights,
    PitcherScoringCategory,
    Player,
    PlayerHitterCategorySummaries,
    PlayerPitcherCategorySummaries,
    PlayerPools,
    PlayerValuation,
    RosterSlot,
    RosterSlotCounts,
    ValuationRequest,
    LeagueSettings,
} from "../types";

import { mean, standardDeviation } from "simple-statistics";

//AI used in assistance to writting helper functions

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
    const rosterSize = Object.values(leagueSettings.rosterSlots).reduce(
        (sum, count) => sum + count,
        0
    );

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
    // === Step 5: Multiply each category z-score by that category’s importance weight. (might not be needed)

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
    const hitterWeights: HitterCategoryWeights = DEFAULT_HITTER_CATEGORY_WEIGHTS;
    const pitcherWeights: PitcherCategoryWeights = DEFAULT_PITCHER_CATEGORY_WEIGHTS;
    

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

    const adjustedScores: Record<string, number> = {
        ...hitterAdjustedScores,
        ...pitcherAdjustedScores,
    };
    const replacementScores = computeReplacementScores(eligible, adjustedScores, leagueSettings, draftState);

    // =====================================================================================================
    // === Step 11: Calculate Margin Score for each Player

        // account for scarcer position
        // ex: if only 4 team is missing a Pitcher, and there are 6 really good pitchers left, we don't have to be in rush of picking the pitcher, we could spend the pick with other positions  
        // Waiting for Step 10 to finish the calculation of ReplacementScore
        // MarginalScore = AdjustedScore - ReplacementScore

    const marginalScores: Record<string, number> = {};

    for (const player of eligible) {
        const adjustedScore = adjustedScores[player.id] ?? 0;
        const eligibleSlots = getEligibleRosterSlots(player);
    
        // Taking the highest marginal score, when a player fits multiple slots because he can play multiple positions
        const bestMargin = Math.max(0,
            ...eligibleSlots.map((slot) => adjustedScore - replacementScores[slot])
        );
    
        marginalScores[player.id] = bestMargin;
    }

    // =====================================================================================================
    // === Step 12: Calculate NormalizedValue(player) for each player

    //{playerID, 0...1}
    const normalizedValues: Record<string, number> = {};

    //Find the largest MarginalScore among all players
    const marginalScoreArray : number[] = Object.values(marginalScores);
    const maxMarginalScore = marginalScoreArray.length > 0 ? Math.max(...marginalScoreArray) : 0;

    //NormalizedValue(player) = MarginalScore(player) / MaxMarginalScore
    for (const player of eligible) {
        //Get marginal score of player
        const marginalScore = marginalScores[player.id] ?? 0;
        //Calculate Normalized value for the player
        normalizedValues[player.id] = maxMarginalScore > 0 ? marginalScore / maxMarginalScore : 0;
    }

    // =====================================================================================================
    // === Step 13: Calculate Auction Price for each player

    //  ((budget per team/roster size) * NormalizedValue(player))^(1.5)
    const auctionPrices: Record<string, number> = {};
    const dollarsPerRosterSpot = leagueSettings.budget / rosterSize;

    for (const player of eligible) {
        const normalizedValue = normalizedValues[player.id]!;
        const price = Math.pow(dollarsPerRosterSpot * normalizedValue, 1.5);
    
        auctionPrices[player.id] = price;
    }

    // =====================================================================================================
    // === Final: return PlayerValuation

    // Only hitter is implemented now, pitchers will have a value of 0/1
    const valuations: PlayerValuation[] = eligible.map((player) => ({
        id: player.id,
        normalizedValue: normalizedValues[player.id] ?? 0,
        auctionPrice: auctionPrices[player.id] ?? 1,
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
function getAgeFactor(age: number | undefined): number {
    if (age === undefined || Number.isNaN(age)) {
        return 0.9;
    }

    const peakAge = 27; // Age with Factor of 1, best
    const ageAwayFromBest = age - peakAge;
    const penalty = 0.0025; 

    // ** 2: squares the age difference
    const raw = 1 - penalty * ((ageAwayFromBest) ** 2);

    return Math.max(0.90, Math.min(1.0, raw)); // keep age Factor min at 0.9
}

/**
 * Maps a player's source-data positions to the draft kit's active roster slots.
 *
 * This converts raw player eligibility such as "SP", "RP", "LF", "CF", and "RF"
 * into the roster slots used by this fantasy draft kit: "C", "1B", "2B", "3B",
 * "SS", "CI", "MI", "OF", "U", and "P".
 *
 * Examples:
 * - "1B" -> ["1B", "CI", "U"]
 * - "SS" -> ["SS", "MI", "U"]
 * - "LF" -> ["OF", "U"]
 * - "SP" -> ["P"]
 * - "RP" -> ["P"]
 *
 * Note:
 * - "U" is hitter-only
 * - pitchers map to "P" only
 *
 * @param player The player whose source positions should be translated into roster slots.
 * @returns A deduplicated array of roster slots the player is eligible to fill.
 */
function getEligibleRosterSlots(player: Player): RosterSlot[] {
    // Set to avoid duplicates
    const slots = new Set<RosterSlot>();

    // For each positions the player can play
    for (const position of player.positions) {
        switch (position) {
            case "C":
                slots.add("C");
                slots.add("U");
                break;

            case "1B":
                slots.add("1B");
                slots.add("CI");
                slots.add("U");
                break;

            case "2B":
                slots.add("2B");
                slots.add("MI");
                slots.add("U");
                break;

            case "3B":
                slots.add("3B");
                slots.add("CI");
                slots.add("U");
                break;

            case "SS":
                slots.add("SS");
                slots.add("MI");
                slots.add("U");
                break;

            case "CI":
                slots.add("CI");
                slots.add("U");
                break;

            case "MI":
                slots.add("MI");
                slots.add("U");
                break;

            case "IF":
                slots.add("1B");
                slots.add("2B");
                slots.add("3B");
                slots.add("SS");
                slots.add("CI");
                slots.add("MI");
                slots.add("U");
                break;

            case "LF":
            case "CF":
            case "RF":
            case "OF":
                slots.add("OF");
                slots.add("U");
                break;

            case "DH":
            case "U":
                slots.add("U");
                break;

            case "P":
            case "SP":
            case "RP":
                slots.add("P");
                break;
        }
    }
    // return an array version of the set
    return [...slots];
}

/**
 * Counts how many active roster slots are already filled across the league (all teams)
 * based on the current draft state.
 *
 * Example:
 * - if 3 drafted players are assigned to "P"
 * - and 2 drafted players are assigned to "OF"
 * this function returns counts including:
 *   { P: 3, OF: 2, ...all other slots: 0 }
 *
 * @param draftState The current draft state containing drafted roster assignments.
 * @returns A complete roster-slot count map showing how many league-wide
 * assignments currently fill each active roster slot.
 */
function countFilledRosterSlots(draftState: DraftState): RosterSlotCounts {
    const filledSlots: RosterSlotCounts = {
        C: 0,
        "1B": 0,
        "2B": 0,
        "3B": 0,
        SS: 0,
        CI: 0,
        MI: 0,
        OF: 0,
        U: 0,
        P: 0,
    }

    for (const assignment of draftState.rosterAssignments) {
        filledSlots[assignment.assignedPosition] += 1;
    }

    return filledSlots;
}

/**
 * Computes the replacement score for each active roster slot based on the
 * remaining undrafted player pool and the current draft state.
 *
 * For each roster slot:
 * 1. Determine how many total league-wide spots exist for that slot
 * 2. Subtract the number of already-filled spots from the draft state
 * 3. Build the pool of eligible undrafted players for that slot
 * 4. Sort that pool by adjusted score, highest to lowest
 * 5. Use the adjusted score at the open-slot cutoff rank as the replacement score
 *
 * Example:
 * - if the league needs 24 catchers total
 * - and 1 catcher slot is already filled
 * - then the replacement score for "C" is the adjusted score of the
 *   23rd-best remaining catcher-eligible player
 * 
 * 1. Catcher A -> 92 
 * 2. Catcher B -> 89
 * 3. Catcher C -> 86
 * ...
 * 23. Catcher W -> 41
 * 24. Catcher X -> 39
 * 25. Catcher Y -> 35
 * 
 * Then the replacement score for C is: 41
 * 
 * any catcher above 41 has positive marginal value at catcher
 * a catcher at 41 is basically replacement level
 * a catcher below 41 is below replacement level for that slot
 * 
 * If all spots are filled, we take the highest adjusted score of the undrafter player from that position. 
 * Thus, the marginal score for a filled position will always be - and clamp to 0.
 * If there are no eligible players left for a slot, its replacement score is 0.
 *
 * @param eligible The remaining undrafted players.
 * @param adjustedScores A map of player ID to adjusted score from Step 9.
 * @param leagueSettings The league settings, including active roster slot counts.
 * @param draftState The current draft state containing already-filled roster assignments.
 * @returns One number per position category representing its cutoff adjusted score.
 */
function computeReplacementScores(eligible: Player[], 
    adjustedScores: Record<string, number>,leagueSettings: LeagueSettings, draftState: DraftState
): RosterSlotCounts {

    const replacementScores: RosterSlotCounts = {
        C: 0,
        "1B": 0,
        "2B": 0,
        "3B": 0,
        SS: 0,
        CI: 0,
        MI: 0,
        OF: 0,
        U: 0,
        P: 0,
    };

    // Get the already filled slots
    const filledRosterSlots : RosterSlotCounts = countFilledRosterSlots(draftState);

    for (const slot of ROSTER_SLOTS) {
        const slotsPerTeam = leagueSettings.rosterSlots[slot];

        // Total slots for that position, ex: if slot = C, totalLeagueSlots = 2 * 12 = 24
        const totalLeagueSlots : number = slotsPerTeam * leagueSettings.teamCount;
        // Filled slots for that position, across all teams
        const filledLeagueSlots : number = filledRosterSlots[slot];
        // Open slots for that position, across all teams
        const openLeagueSlots : number = totalLeagueSlots - filledLeagueSlots;
        // Ranks all the players for that position base on adjusted score
        const rankedPlayers = getPlayersRankedByRosterSlot(eligible, adjustedScores, slot);

        // No remaining undrafted players eligible for that roster slot
        if (rankedPlayers.length === 0) {
            replacementScores[slot] = 0;
            continue;
        }

        // No spots left for this position
        if (openLeagueSlots === 0) {
            const bestRemainingPlayer = rankedPlayers[0];

            if (!bestRemainingPlayer) {
                replacementScores[slot] = 0;
                continue;
            }

            // Use the best player's adjusted score for this position
            replacementScores[slot] = adjustedScores[bestRemainingPlayer.id]!;
            continue;
        }

        const cutoffIndex = Math.min(openLeagueSlots - 1, rankedPlayers.length - 1);
        const cutoffPlayer = rankedPlayers[cutoffIndex];

        // Replacement Score for that slot = the adjusted score of the cutoff player
        replacementScores[slot] = cutoffPlayer
            ? adjustedScores[cutoffPlayer.id]!
            : 0;
    }

    return replacementScores;
}

function getPlayersRankedByRosterSlot( eligible: Player[],adjustedScores: Record<string, number>,
    slot: RosterSlot
): Player[] {
    return eligible
        .filter((player) => getEligibleRosterSlots(player).includes(slot))
        .sort((a, b) => adjustedScores[b.id]! - adjustedScores[a.id]!);
}

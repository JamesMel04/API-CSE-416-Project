// ========== Player Data types ==========
export interface HitterStats {
    ab: number;
    r: number;
    h: number;
    "1b": number;
    "2b": number;
    "3b": number;
    hr: number;
    rbi: number;
    bb: number;
    k: number;
    sb: number;
    cs: number;
    avg: number;
    obp: number;
    slg: number;
    fpts: number;
}

// NOTE: Only the stats our algorithm calculates, not all categories are weighted
/**
 * const categories: HitterCategory[] = [
    "ab", "r", "h", "1b", "2b", "3b",
    "hr", "rbi", "bb", "k", "sb", "cs",
    "avg", "obp", "slg", "fpts"
];
 */
export type HitterCategory = keyof HitterStats;
// Used for mean, sd, z-score
export type HitterCategorySummary = Record<HitterCategory, number>;
// For Category Factor, how important each category is
export type HitterCategoryWeights = Record<HitterCategory, number>;

export interface SeasonStats {
    seasons: number[];
    hitter: HitterStats;
}

export interface Player {
    id: string;
    name: string;
    team: string;
    positions: string[];
    suggestedValue: number;
    stats: {
        projection: SeasonStats;
        lastYear: SeasonStats;
        threeYearAvg: SeasonStats;
    };
}

// ========== Valuation Request (sent by client) ==========
export interface LeagueSettings {
    budget: number;
    rosterSize: number;
    teamCount: number;
    // Partial: keys may be optional to include
    // Record<keyof HitterStats, number>: object where every stat field map to a number
    categoryWeights: Partial<Record<keyof HitterStats, number>>;
}

/** 
 * Contains the IDs of every player that has been drafted by any team.
*/
export interface DraftState {
    draftedPlayerIds: string[];
}

export interface ValuationRequest {
    leagueSettings: LeagueSettings;
    draftState: DraftState;
}

// ==================== Valuation Response (returned by API) ====================
export interface PlayerValuation {
    id: string;
    normalizedValue: number;
    auctionPrice: number;
}

// ==================== Player Pool Type ====================
export interface PlayerPools {
    hitters: Player[];
    pitchers: Player[];
}
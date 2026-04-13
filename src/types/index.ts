// ========== Player Data types ==========
export interface HitterStats {
    ab: number;   // at-bats
    r: number;    // runs scored
    h: number;    // hits
    "1b": number; // singles
    "2b": number; // doubles
    "3b": number; // triples
    hr: number;   // home runs
    rbi: number;  // runs batted in
    bb: number;   // walks
    k: number;    // strikeouts
    sb: number;   // stolen bases
    cs: number;   // caught stealing
    avg: number;  // batting average
    obp: number;  // on-base percentage
    slg: number;  // slugging percentage
    fpts: number; // fantasy points
}
export interface PitcherStats {
    w: number;    // wins
    l: number;    // losses
    era: number;  // earned run average
    g: number;    // games pitched
    gs: number;   // games started
    cg: number;   // complete games
    sho: number;  // shutouts
    sv: number;   // saves
    svo: number;  // save opportunities
    ip: number;   // innings pitched
    h: number;    // hits allowed
    r: number;    // runs allowed
    er: number;   // earned runs allowed
    hr: number;   // home runs allowed
    hb: number;   // hit batters
    bb: number;   // walks allowed
    so: number;   // strikeouts
    whip: number; // walks + hits per inning pitched
    avg: number;  // opponent batting average
}

// Subset categories used for Player valuation
export const HITTER_SCORING_CATEGORIES = [
    "r",
    "1b",
    "2b",
    "3b",
    "hr",
    "rbi",
    "bb",
    "k", // -rev-
    "sb",
    "cs", // -rev-
    "obp",
    "slg"
] as const;
export type HitterScoringCategory = typeof HITTER_SCORING_CATEGORIES[number];


export const PITCHER_SCORING_CATEGORIES = [
    "w",
    "sv",
    "so",
    "ip",
    "era", // -rev-
    "whip", // -rev-
    "avg" // -rev-
] as const;
export type PitcherScoringCategory = typeof PITCHER_SCORING_CATEGORIES[number];
    
// For Category Factor, how important each category is
export type HitterCategoryWeights = Record<HitterScoringCategory, number>;
export type PitcherCategoryWeights = Record<PitcherScoringCategory, number>;

// Used for mean, sd, z-score
export type HitterCategorySummary = Record<HitterScoringCategory, number>;
export type PitcherCategorySummary = Record<PitcherScoringCategory, number>;

// {PlayerID, SetofData}
export type PlayerHitterCategorySummaries = Record<string, HitterCategorySummary>;
export type PlayerPitcherCategorySummaries = Record<string, PitcherCategorySummary>;


export interface SeasonStats {
    seasons: number[];
    hitter: HitterStats;
    pitcher: PitcherStats;
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
    categoryWeights?: {
        hitters?: Partial<HitterCategoryWeights>;
        pitchers?: Partial<PitcherCategoryWeights>;
    };
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
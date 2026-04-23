// ========= Type Aliases ==========
export type PlayerID = number;
export type TeamName = string; // User made team name

// ========== Player Data types ==========
export interface HitterStats {
    ab: number; // at bats, how many times they appeared to bat
    r: number; // runs scored, home run = 1 run. any other players on plates also score runs
    h: number; // Hits
    "1b": number; // singles
    "2b": number; // doubles
    "3b": number; // Triples
    hr: number; // Home runs
    rbi: number; // runs batted in, how many runners scored from your hit
    bb: number; // walks
    k: number; // strikeouts
    sb: number; // stolen base, advance base without hit
    cs: number; // caught stealing, tagged out
    avg: number; // batting average, hits / at bats
    obp: number; // on-base percentage
    slg: number; // slugging percentage, total bases / at bats
    fpts: number; // fantasy points
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

export interface PitcherStats {
    gp: number;    // games pitched
    era: number;  // earned run average
    gs: number;   // games started
    w: number;    // wins
    l: number;    // losses
    sho: number;  // shutouts
    sv: number;   // saves
    ip: number;   // innings pitched
    h: number;    // hits allowed
    er: number;   // earned runs allowed
    r: number;    // runs allowed per 9 inning game (total runs not available in API)
    hr: number;   // home runs allowed per 9 inning game (total homeruns not available in API)
    hld: number;  // holds
    hb: number;   // hit batters, how many times the pitcher has hit batters
    bb: number;   // walks allowed
    so: number;   // strikeouts
    whip: number; // walks + hits per inning pitched
    avg: number;  // opponent batting average, not in API, initialized as 0
    fpts: number; // fantasy points
    
    /** Removed these stats to simplify type */
    // cg: number;   // complete games
    // svo: number;  // save opportunities, removed cause it's not in projected for some reason

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
export type PlayerHitterCategorySummaries = Record<PlayerID, HitterCategorySummary>;
export type PlayerPitcherCategorySummaries = Record<PlayerID, PitcherCategorySummary>;

export interface SeasonStats {
    seasons: number[];
    hitting?: HitterStats;
    pitching?: PitcherStats;
}
export interface HitterSeasonStats extends SeasonStats {
    hitting: HitterStats;
}
export interface PitcherSeasonStats extends SeasonStats {
    pitching: PitcherStats;
}

export interface Player {
    id: PlayerID;
    name: string;
    team: string;
    teamId: number;
    position: string;
    age: number;
    positions: PlayerPosition[];
    suggestedValue: number;
     /**
         * 
         * Status   |   Meaning
         * -------------------------
         * A        |   Active, no injury
         * D7       |   Injured 7-day
         * D10      |   Injured 10-Day
         * D15      |   Injured 15-Day
         * D60      |   Injured 60-Day
         * 
    */
    injuryStatus: string,
    stats: {
        projection: SeasonStats;
        lastYear: SeasonStats;
        threeYearAvg: SeasonStats;
    };
}
export interface HitterPlayer extends Player {
    stats: {
        projection: HitterSeasonStats;
        lastYear: HitterSeasonStats;
        threeYearAvg: HitterSeasonStats;
    };
}

export interface PitcherPlayer extends Player {
    stats: {
        projection: PitcherSeasonStats;
        lastYear: PitcherSeasonStats;
        threeYearAvg: PitcherSeasonStats;
    };
}

// =================== Valuation Request (sent by client) =======================
export interface LeagueSettings {
    budget: number;
    teamCount: number;
    rosterSlots: RosterSlotCounts;
}

// ==================== Player positions from source data ====================
export const PLAYER_POSITIONS = [
    "C",    // Catcher
    "1B",   // First base
    "2B",   // Second base
    "3B",   // Third base
    "SS",   // Shortstop
    "CI",   // Corner infield
    "MI",   // Middle infield
    "IF",   // Infield
    "LF",   // Left field
    "CF",   // Center field
    "RF",   // Right field
    "OF",   // Outfield
    "DH",   // Designated hitter
    "U",    // Utility
    "P",    // Pitcher
    "SP",   // Starting pitcher
    "RP",   // Relief pitcher
    "TWP", // Two-way player
] as const;
export type PlayerPosition = typeof PLAYER_POSITIONS[number];

// ==================== Draft-kit active roster slots ====================
export const ROSTER_SLOTS = [
    "C",    // Catcher
    "1B",   // First base
    "2B",   // Second base
    "3B",   // Third base
    "SS",   // Shortstop
    "CI",   // Corner infield
    "MI",   // Middle infield
    "OF",   // Outfield
    "U",    // Utility
    "P",    // Pitcher
] as const;

export type RosterSlot = typeof ROSTER_SLOTS[number];
export type RosterSlotCounts = Record<RosterSlot, number>;

// For each assigned player
export interface DraftedRosterAssignment {
    teamId: string;
    playerId: PlayerID;
    assignedPosition: RosterSlot;
}

export type RosterData = {
  roster: Partial<Record<RosterSlot, PlayerID>>;
};

export interface LeagueState {
    teams: Record<TeamName, RosterData>;
}

export interface ValuationRequest {
    leagueSettings: LeagueSettings;
    leagueState: LeagueState;
}

// ==================== Valuation Response (returned by API) ====================
export interface PlayerValuation {
    id: PlayerID;
    normalizedValue: number;
    auctionPrice: number;
}

// ====================== Player Pool Type ======================================
export interface PlayerPools {
    hitters: HitterPlayer[];
    pitchers: PitcherPlayer[];
}
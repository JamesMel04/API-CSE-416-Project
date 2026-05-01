import { mean, standardDeviation } from 'simple-statistics';
import {
    HITTER_SCORING_CATEGORIES,
    PITCHER_SCORING_CATEGORIES,
    ROSTER_SLOTS,
} from "@/types";

import type {
    LeagueState,
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
    HitterPlayer,
    PitcherPlayer,
    PlayerID
} from "@/types";
import { getCachedPlayers } from './db.service';

export async function evaluatePlayers(request: ValuationRequest): Promise<PlayerValuation[]> {
    const players: PlayerPools = await getCachedPlayers();
    const { leagueSettings, leagueState } = request;
    
    // Calculate total roster size from settings
    const rosterSize = Object.values(leagueSettings.rosterSlots).reduce(
        (sum, count) => sum + count,
        0
    );

    const { hitters, pitchers } = players;

    // [Step 1: Filter out drafted players] 
    const draftedPlayerIds = new Set<PlayerID>();
    Object.values(leagueState.teams).forEach((teamData) => {
        Object.values(teamData.roster).forEach((id) => {
            if (id) draftedPlayerIds.add(id);
        });
    });

    const eligibleHitters: HitterPlayer[] = hitters.filter((p) => !draftedPlayerIds.has(p.id));
    const eligiblePitchers: PitcherPlayer[] = pitchers.filter((p) => !draftedPlayerIds.has(p.id));
    const eligible: Player[] = [...eligibleHitters, ...eligiblePitchers];

    // [Step 3: Calculate mean and stdDev]
    const hitterMean = {} as HitterCategorySummary;
    const hitterStdDev = {} as HitterCategorySummary;
    const pitcherMean = {} as PitcherCategorySummary;
    const pitcherStdDev = {} as PitcherCategorySummary;

    for (const category of HITTER_SCORING_CATEGORIES) {
        const values = eligibleHitters.map(p => p.stats.projection.hitting[category]);
        hitterMean[category] = values.length > 0 ? mean(values) : 0;
        hitterStdDev[category] = values.length > 1 ? standardDeviation(values) : 0;
    }

    for (const category of PITCHER_SCORING_CATEGORIES) {
        const values = eligiblePitchers.map(p => p.stats.projection.pitching[category]);
        pitcherMean[category] = values.length > 0 ? mean(values) : 0;
        pitcherStdDev[category] = values.length > 1 ? standardDeviation(values) : 0;
    }

    // [Step 4: Z-Scores]
    const hitterZScores: PlayerHitterCategorySummaries = {};
    const pitcherZScores: PlayerPitcherCategorySummaries = {};
    
    const NEGATIVE_HITTER_CATEGORIES = new Set<HitterScoringCategory>(["k", "cs"]);
    const NEGATIVE_PITCHER_CATEGORIES = new Set<PitcherScoringCategory>(["era", "whip", "avg"]);

    eligibleHitters.forEach(player => {
        const scores = {} as HitterCategorySummary;
        for (const cat of HITTER_SCORING_CATEGORIES) {
            const val = player.stats.projection.hitting[cat];
            const avg = hitterMean[cat];
            const sd = hitterStdDev[cat];
            const isNeg = NEGATIVE_HITTER_CATEGORIES.has(cat);
            scores[cat] = sd === 0 ? 0 : isNeg ? (avg - val) / sd : (val - avg) / sd;
        }
        hitterZScores[player.id] = scores;
    });

    eligiblePitchers.forEach(player => {
        const scores = {} as PitcherCategorySummary;
        for (const cat of PITCHER_SCORING_CATEGORIES) {
            const val = player.stats.projection.pitching[cat];
            const avg = pitcherMean[cat];
            const sd = pitcherStdDev[cat];
            const isNeg = NEGATIVE_PITCHER_CATEGORIES.has(cat);
            scores[cat] = sd === 0 ? 0 : isNeg ? (avg - val) / sd : (val - avg) / sd;
        }
        pitcherZScores[player.id] = scores;
    });

    // [Step 5 & 6: Weights and Base Scores]
    // Default weights (ensure these match your ScoringCategory types)
    const hWeights: HitterCategoryWeights = { r: 1, "1b": 1, "2b": 1, "3b": 1, hr: 1, rbi: 1, bb: 1, k: 1, sb: 1, cs: 1, obp: 1, slg: 1 };
    const pWeights: PitcherCategoryWeights = { w: 1, sv: 1, so: 1, ip: 1, era: 1, whip: 1, avg: 1 };

    const adjustedScores: Record<PlayerID, number> = {};

    eligibleHitters.forEach(p => {
        const z = hitterZScores[p.id];
        if (!z) return;
        const base = HITTER_SCORING_CATEGORIES.reduce((sum, cat) => sum + (z[cat] * hWeights[cat]), 0);
        adjustedScores[p.id] = base * getAgeFactor(p.age);
    });

    eligiblePitchers.forEach(p => {
        const z = pitcherZScores[p.id];
        if (!z) return;
        const base = PITCHER_SCORING_CATEGORIES.reduce((sum, cat) => sum + (z[cat] * pWeights[cat]), 0);
        adjustedScores[p.id] = base * getAgeFactor(p.age);
    });

    // [Step 10-13: Replacement Logic and Auction Price]
    const replacementScores = computeReplacementScores(eligible, adjustedScores, leagueSettings, leagueState);
    const marginalScores: Record<PlayerID, number> = {};

    for (const player of eligible) {
        const score = adjustedScores[player.id] ?? 0;
        const slots = getEligibleRosterSlots(player);
        const bestMargin = Math.max(0, ...slots.map(s => score - replacementScores[s]));
        marginalScores[player.id] = bestMargin;
    }

    const maxMarginal = Math.max(0, ...Object.values(marginalScores));
    const dollarsPerSpot = leagueSettings.budget / rosterSize;

    return eligible.map(player => {
        const mScore = marginalScores[player.id] ?? 0;
        const normalized = maxMarginal > 0 ? mScore / maxMarginal : 0;
        const price = Math.max(1, Math.pow(dollarsPerSpot * normalized, 1.5));
        return { id: player.id, normalizedValue: normalized, auctionPrice: price };
    });
}

function getAgeFactor(age: number | undefined): number {
    if (age === undefined || Number.isNaN(age)) return 0.9;
    const peakAge = 27;
    const penalty = 0.0025;
    const raw = 1 - penalty * ((age - peakAge) ** 2);
    return Math.max(0.90, Math.min(1.0, raw));
}

function getEligibleRosterSlots(player: Player): RosterSlot[] {
    const slots = new Set<RosterSlot>();
    for (const pos of player.mlbPositions) {
        if (["C"].includes(pos)) { slots.add("C"); slots.add("U"); }
        else if (["1B"].includes(pos)) { slots.add("1B"); slots.add("CI"); slots.add("U"); }
        else if (["2B"].includes(pos)) { slots.add("2B"); slots.add("MI"); slots.add("U"); }
        else if (["3B"].includes(pos)) { slots.add("3B"); slots.add("CI"); slots.add("U"); }
        else if (["SS"].includes(pos)) { slots.add("SS"); slots.add("MI"); slots.add("U"); }
        else if (["CI"].includes(pos)) { slots.add("CI"); slots.add("U"); }
        else if (["MI"].includes(pos)) { slots.add("MI"); slots.add("U"); }
        else if (["IF"].includes(pos)) { ["1B", "2B", "3B", "SS", "CI", "MI", "U"].forEach(s => slots.add(s as RosterSlot)); }
        else if (["LF", "CF", "RF", "OF"].includes(pos)) { slots.add("OF"); slots.add("U"); }
        else if (["DH", "U"].includes(pos)) { slots.add("U"); }
        else if (["P", "SP", "RP"].includes(pos)) { slots.add("P"); }
    }
    return [...slots];
}

function countFilledRosterSlots(leagueState: LeagueState): RosterSlotCounts {
    const counts: RosterSlotCounts = { C: 0, "1B": 0, "2B": 0, "3B": 0, SS: 0, CI: 0, MI: 0, OF: 0, U: 0, P: 0 };
    Object.values(leagueState.teams).forEach(team => {
        Object.keys(team.roster).forEach(slot => {
            if (team.roster[slot as RosterSlot]) {
                counts[slot as RosterSlot]++;
            }
        });
    });
    return counts;
}

function computeReplacementScores(
    eligible: Player[],
    adjustedScores: Record<PlayerID, number>,
    settings: LeagueSettings,
    state: LeagueState
): RosterSlotCounts {
    const filled = countFilledRosterSlots(state);
    const replacement: RosterSlotCounts = { C: 0, "1B": 0, "2B": 0, "3B": 0, SS: 0, CI: 0, MI: 0, OF: 0, U: 0, P: 0 };

    for (const slot of ROSTER_SLOTS) {
        const totalSpots = settings.rosterSlots[slot] * settings.teamCount;
        const openSpots = Math.max(0, totalSpots - filled[slot]);
        
        // Ensure we filter correctly
        const ranked = eligible
            .filter(p => getEligibleRosterSlots(p).includes(slot))
            .sort((a, b) => (adjustedScores[b.id] ?? 0) - (adjustedScores[a.id] ?? 0));

        // 1. Handle empty array immediately
        if (ranked.length === 0) {
            replacement[slot] = 0;
            continue;
        }

        // 2. Determine index safely
        const index = openSpots === 0 ? 0 : Math.min(openSpots - 1, ranked.length - 1);
        
        // 3. Use optional chaining and a fallback to ensure it's never undefined
        const cutoffPlayer = ranked[index];
        
        if (cutoffPlayer) {
            replacement[slot] = adjustedScores[cutoffPlayer.id] ?? 0;
        } else {
            replacement[slot] = 0;
        }
    }
    return replacement;
}
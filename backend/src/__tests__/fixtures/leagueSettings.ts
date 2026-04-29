import { LeagueSettings } from "../../types";

export const mockLeagueSettings: LeagueSettings = {
    budget: 260,      // dollars per team
    teamCount: 12,    // number of fantasy teams in the league
    rosterSlots: {
        C: 2,
        "1B": 1,
        "2B": 1,
        "3B": 1,
        SS: 1,
        CI: 1,
        MI: 1,
        OF: 5,
        U: 1,
        P: 9,
    }
};
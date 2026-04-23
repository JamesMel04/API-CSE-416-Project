import { LeagueState } from "@/types";

export const mockLeagueState: LeagueState = {
    teams: {
        "team-1": {
            roster: {
                "U": 1,
                "P": 2,
                "OF": 3,
            },
        },
        "team-2": {
            roster: {
                "SS": 4,
                "1B": 5,
                "P": 6,
            },
        },
        "team-3": {
            roster: {
                "C": 7,
                "3B": 8,
                "P": 9,
            },
        },
    },
};
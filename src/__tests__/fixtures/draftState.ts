import { DraftState, DraftedRosterAssignment } from "../../types";

export const rosterAssignments: DraftedRosterAssignment[] = [
    { teamId: "team-1", playerId: "francisco-lindor-nym", assignedPosition: "U" },
    { teamId: "team-1", playerId: "andrew-abbott-cin", assignedPosition: "P" },
    { teamId: "team-1", playerId: "juan-soto-nym", assignedPosition: "OF" },

    { teamId: "team-2", playerId: "bobby-witt-jr-kc", assignedPosition: "SS" },
    { teamId: "team-2", playerId: "freddie-freeman-lad", assignedPosition: "1B" },
    { teamId: "team-2", playerId: "spencer-strider-atl", assignedPosition: "P" },

    { teamId: "team-3", playerId: "adley-rutschman-bal", assignedPosition: "C" },
    { teamId: "team-3", playerId: "jose-ramirez-cle", assignedPosition: "3B" },
    { teamId: "team-3", playerId: "emmanuel-clase-cle", assignedPosition: "P" },
];

export const mockDraftState: DraftState = { rosterAssignments };
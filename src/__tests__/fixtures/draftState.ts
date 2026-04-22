import { DraftState, DraftedRosterAssignment } from "@/types";

export const rosterAssignments: DraftedRosterAssignment[] = [
    { teamId: "team-1", playerId: 1, assignedPosition: "U" },
    { teamId: "team-1", playerId: 2, assignedPosition: "P" },
    { teamId: "team-1", playerId: 3, assignedPosition: "OF" },

    { teamId: "team-2", playerId: 4, assignedPosition: "SS" },
    { teamId: "team-2", playerId: 5, assignedPosition: "1B" },
    { teamId: "team-2", playerId: 6, assignedPosition: "P" },

    { teamId: "team-3", playerId: 7, assignedPosition: "C" },
    { teamId: "team-3", playerId: 8, assignedPosition: "3B" },
    { teamId: "team-3", playerId: 9, assignedPosition: "P" },
];

export const mockDraftState: DraftState = { rosterAssignments };
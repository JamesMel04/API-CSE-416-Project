import { ValuationRequest } from "@/types";
import { mockDraftState } from "@/__tests__/fixtures/draftState";
import { mockLeagueSettings } from "@/__tests__/fixtures/leagueSettings";

// Should be send in the req from the client when asking for player valuations
export const mockValuationRequest: ValuationRequest = {
    leagueSettings: mockLeagueSettings,
    draftState: mockDraftState,
};

import { ValuationRequest } from "../../types";
import { mockDraftState } from "./draftState";
import { mockLeagueSettings } from "./leagueSettings";

// Should be send in the req from the client when asking for player valuations
export const mockValuationRequest: ValuationRequest = {
    leagueSettings: mockLeagueSettings,
    draftState: mockDraftState,
};

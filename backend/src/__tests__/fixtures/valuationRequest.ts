import { ValuationRequest } from "../../types";
import { mockLeagueState } from "../fixtures/leagueState";
import { mockLeagueSettings } from "../fixtures/leagueSettings";

// Should be send in the req from the client when asking for player valuations
export const mockValuationRequest: ValuationRequest = {
    leagueSettings: mockLeagueSettings,
    leagueState: mockLeagueState,
};

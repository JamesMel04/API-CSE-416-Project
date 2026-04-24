import { ValuationRequest } from "@/types";
import { mockLeagueState } from "@/__tests__/fixtures/leagueState";
import { mockLeagueSettings } from "@/__tests__/fixtures/leagueSettings";

// Should be send in the req from the client when asking for player valuations
export const mockValuationRequest: ValuationRequest = {
    leagueSettings: mockLeagueSettings,
    leagueState: mockLeagueState,
};

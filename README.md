API URL: [https://api-cse-416-project-5a0b.onrender.com/](https://api-cse-416-project-5a0b.onrender.com)

Draft Kit Backend: [https://draft-kit-backend-cse-416-project.onrender.com/](https://draft-kit-backend-cse-416-project.onrender.com)

Run whenever dependency files change (package.json or package-lock.json)
```
npm install
```
Runs tsc: compiles src/*.ts to dist/*.js

```
npm run build
```

Runs node dist/index.js: starts the server using the already-compiled JS
```
npm start
```

Runs ts-node src/index.ts: starts the server directly from TypeScript (no separate build)
```
npm run dev
```

## API Endpoints

- Base URL: `http://localhost:5000`
- `GET /health` : server status
- `GET /players` : all players
- `POST /players/valuations` : player valuations, body = `ValuationRequest`
- `GET /players/valuations/test` : temporary test route

MLB Data Source Endpoints (where we got our data from)


All Players: https://statsapi.mlb.com/api/v1/sports/1/players?season=2026


Player Season Stat: https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=season


Player Projected Stat:https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=projected

---

## API Service (Detailed Docs)

This service exposes player data and valuation endpoints that can be consumed by Draft Kit or other authorized clients.

Base URLs:

- Local: `http://localhost:5000`
- Deployed: `https://api-cse-416-project-5a0b.onrender.com`

All requests and responses use JSON except `GET /`, which returns HTML.

## Endpoint Summary

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/` | Serves `public/index.html` status page |
| GET | `/health` | Lightweight machine-readable health check |
| GET | `/players` | Returns full player dataset from `data/players.json` |
| POST | `/players/valuations` | Returns player valuation list using request league settings + draft state |
| GET | `/players/valuations/test` | Returns valuation output using a built-in API mock request fixture |

## Detailed Routes

### GET `/`

Returns the static status page HTML.

Example request:

```txt
GET http://localhost:5000/
```

### GET `/health`

Returns server health status for uptime monitors and probes.

Example request:

```txt
GET http://localhost:5000/health
```

Example response:

```json
{ "status": "ok" }
```

### GET `/players`

Returns all players currently loaded into memory from `data/players.json`.

Example request:

```txt
GET http://localhost:5000/players
```

Example response shape:

```json
[
	{
		"id": "shohei-ohtani-lad",
		"name": "Shohei Ohtani",
		"team": "LAD",
		"positions": ["U", "P"],
		"suggestedValue": 34,
		"stats": {
			"projection": {
				"seasons": [2026],
				"hitter": { "r": 123, "hr": 42, "obp": 0.398, "slg": 0.613 }
			},
			"lastYear": {
				"seasons": [2025],
				"hitter": { "r": 146, "hr": 55, "obp": 0.392, "slg": 0.622 }
			},
			"threeYearAvg": {
				"seasons": [2023, 2024, 2025],
				"hitter": { "r": 127, "hr": 51, "obp": 0.397, "slg": 0.64 }
			}
		}
	}
]
```

### POST `/players/valuations`

Computes valuations for all undrafted players and returns an array of:

- `id`
- `normalizedValue` (0 to 1 scale)
- `auctionPrice` (minimum 1)

Request body type: `ValuationRequest`

```json
{
	"leagueSettings": {
		"budget": 260,
		"teamCount": 12,
		"rosterSlots": {
			"C": 2,
			"1B": 1,
			"2B": 1,
			"3B": 1,
			"SS": 1,
			"CI": 1,
			"MI": 1,
			"OF": 5,
			"U": 1,
			"P": 9
		}
	},
	"draftState": {
		"rosterAssignments": [
			{
				"teamId": "team-1",
				"playerId": "francisco-lindor-nym",
				"assignedPosition": "U"
			},
			{
				"teamId": "team-2",
				"playerId": "bobby-witt-jr-kc",
				"assignedPosition": "SS"
			}
		]
	}
}
```

Example request:

```txt
POST http://localhost:5000/players/valuations
Content-Type: application/json

{
  "leagueSettings": {
    "budget": 260,
    "teamCount": 12,
    "rosterSlots": {
      "C": 2,
      "1B": 1,
      "2B": 1,
      "3B": 1,
      "SS": 1,
      "CI": 1,
      "MI": 1,
      "OF": 5,
      "U": 1,
      "P": 9
    }
  },
  "draftState": {
    "rosterAssignments": []
  }
}
```

Example response:

```json
[
	{
		"id": "aaron-judge-nyy",
		"normalizedValue": 0.9827,
		"auctionPrice": 18.36
	},
	{
		"id": "shohei-ohtani-lad",
		"normalizedValue": 0.9661,
		"auctionPrice": 17.9
	}
]
```

Error response example (`400`):

```json
{ "error": "Failed to evaluate players" }
```

### GET `/players/valuations/test`

Runs valuations using the API mock fixture request from tests.

Example request:

```txt
GET http://localhost:5000/players/valuations/test
```

Response shape is the same as `POST /players/valuations`.

## Notes

- Player data is loaded from `data/players.json` at API startup and kept in memory.
- `POST /players/valuations` excludes drafted players listed in `draftState.rosterAssignments`.
- `GET /health` is best for automated checks; `GET /` is best for human-readable status.

## Common Status Codes

| Code | Meaning |
| ---- | ------- |
| 200 | Success |
| 400 | Invalid valuation request payload or processing error |



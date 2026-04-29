MLB API

API URL: [https://api-cse-416-project-5a0b.onrender.com/](https://api-cse-416-project-5a0b.onrender.com/)

API Dashboard Frontend: TBD

Draft Kit Backend: [https://draft-kit-backend-cse-416-project.onrender.com/](https://draft-kit-backend-cse-416-project.onrender.com/)

## Overview

This service exposes:

- player pool data for licensed clients
- valuation results for licensed clients
- developer account auth for the API dashboard
- developer API key generation and regeneration

There are two different auth mechanisms in this project:

1. JWT auth for developer dashboard routes
2. API key auth for licensed client data routes

In other words:

- a developer logs into the dashboard with email/password
- the dashboard receives a JWT
- the developer uses the dashboard to generate an API key
- a client backend such as Draft Kit stores that API key in its own env file
- protected MLB API routes require that API key on every request

## Project Setup

Run whenever dependency files change (`package.json` or `package-lock.json`):

```bash
npm install
```

Compile TypeScript to `dist/`:

```bash
npm run build
```

Start the already-compiled server:

```bash
npm start
```

Start the server directly from TypeScript:

```bash
npm run dev
```

## Environment Variables

Backend env vars:

```env
DB_LINK=postgresql://username:password@host:5432/database_name
JWT_SECRET=your_long_random_secret
```

Optional local Postgres fallback:

```env
DB_PASSWORD=your_local_postgres_password
```

Frontend env vars:

```env
NEXT_PUBLIC_BACKEND_URL=https://api-cse-416-project-5a0b.onrender.com
```

## Auth Model

### Developer dashboard auth

These routes use JWT auth:

- `POST /auth/register`
- `POST /auth/login`
- `GET /api-keys`
- `POST /api-keys`

After a successful login, the backend returns a JWT. The frontend sends it back in:

```txt
Authorization: Bearer <jwt_token>
```

### Licensed client auth

These routes use API key auth:

- `GET /players`
- `POST /players/valuations`

Licensed clients must send:

```txt
mlb-api-key: <api_key>
```

Revoked keys are rejected.

## Endpoint Summary

Base URL:

- `https://api-cse-416-project-5a0b.onrender.com`

All requests and responses use JSON except `GET /`, which returns HTML.


| Method | Endpoint              | Auth    | Description                                                              |
| ------ | --------------------- | ------- | ------------------------------------------------------------------------ |
| GET    | `/`                   | none    | Serves `public/index.html` status page                                   |
| GET    | `/health`             | none    | Lightweight machine-readable health check                                |
| POST   | `/auth/register`      | none    | Create a developer account                                               |
| POST   | `/auth/login`         | none    | Log in a developer account and receive a JWT                             |
| GET    | `/api-keys`           | JWT     | Get the current active API key for the logged-in developer               |
| POST   | `/api-keys`           | JWT     | Revoke the current active API key and issue a new one                    |
| GET    | `/players`            | API key | Return the current hitter and pitcher player pools                       |
| POST   | `/players/valuations` | API key | Return valuation output for the supplied league settings and draft state |


## Detailed Routes

### GET `/`

Returns the static status page HTML.

Example request:

```txt
GET https://api-cse-416-project-5a0b.onrender.com/
```

### GET `/health`

Returns server health status for probes and uptime checks.

Example request:

```txt
GET https://api-cse-416-project-5a0b.onrender.com/health
```

Example response:

```json
{ "status": "ok" }
```

### POST `/auth/register`

Creates a developer account for the API dashboard.

Request body:

```json
{
  "email": "dev@example.com",
  "password": "super-secret-password"
}
```

Example response:

```json
{
  "message": "Account created successfully",
  "user": {
    "id": 1,
    "email": "dev@example.com"
  }
}
```

Possible errors:

- `400` missing email or password
- `409` account already exists

### POST `/auth/login`

Logs in a developer account and returns a JWT for dashboard requests.

Request body:

```json
{
  "email": "dev@example.com",
  "password": "super-secret-password"
}
```

Example response:

```json
{
  "message": "Login successful",
  "token": "<jwt_token>",
  "user": {
    "id": 1,
    "email": "dev@example.com"
  }
}
```

Possible errors:

- `400` missing email or password
- `401` invalid email or password

### GET `/api-keys`

Returns the currently active API key for the logged-in developer.

Required header:

```txt
Authorization: Bearer <jwt_token>
```

Example request:

```txt
GET https://api-cse-416-project-5a0b.onrender.com/api-keys
Authorization: Bearer <jwt_token>
```

Example response:

```json
{
  "apiKey": "api_44d48b6f616629ba81bab34d0710e3d8..."
}
```

If the developer has no active key yet:

```json
{
  "apiKey": ""
}
```

### POST `/api-keys`

Revokes the currently active API key for the logged-in developer, if one exists, and creates a new active key.

Required header:

```txt
Authorization: Bearer <jwt_token>
```

Example request:

```txt
POST https://api-cse-416-project-5a0b.onrender.com/api-keys
Authorization: Bearer <jwt_token>
```

Example response:

```json
{
  "apiKey": "api_44d48b6f616629ba81bab34d0710e3d8...",
  "message": "API key generated successfully"
}
```

Notes:

- old keys are not deleted; they are marked revoked
- only keys with `revoked_at IS NULL` are considered active

### GET `/players`

Returns the current player pools from the database.

Required header:

```txt
mlb-api-key: <api_key>
```

Example request:

```txt
GET https://api-cse-416-project-5a0b.onrender.com/players
mlb-api-key: <api_key>
```

Example response shape:

```json
{
  "hitters": [
    {
      "id": 660271,
      "name": "Shohei Ohtani",
      "team": "LAD",
      "teamId": 119,
      "position": "TWP",
      "positions": ["TWP"],
      "age": 31,
      "injuryStatus": "A",
      "suggestedValue": 34,
      "stats": {
        "projection": {
          "seasons": [2026],
          "hitting": {
            "r": 123,
            "hr": 42,
            "obp": 0.398,
            "slg": 0.613
          }
        },
        "lastYear": {
          "seasons": [2025],
          "hitting": {
            "r": 146,
            "hr": 55,
            "obp": 0.392,
            "slg": 0.622
          }
        },
        "threeYearAvg": {
          "seasons": [2023, 2024, 2025],
          "hitting": {
            "r": 127,
            "hr": 51,
            "obp": 0.397,
            "slg": 0.64
          }
        }
      }
    }
  ],
  "pitchers": []
}
```

Possible errors:

- `401` missing or invalid API key

### POST `/players/valuations`

Computes valuations for all undrafted players based on league settings and current draft state.

Required header:

```txt
mlb-api-key: <api_key>
```

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
        "playerId": 660271,
        "assignedPosition": "U"
      }
    ]
  }
}
```

Important request details:

- `playerId` is a number, not a string
- `assignedPosition` must be one of:
  - `C`
  - `1B`
  - `2B`
  - `3B`
  - `SS`
  - `CI`
  - `MI`
  - `OF`
  - `U`
  - `P`

Example request:

```txt
POST https://api-cse-416-project-5a0b.onrender.com/players/valuations
Content-Type: application/json
mlb-api-key: <api_key>

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
    "id": 592450,
    "normalizedValue": 0.9827,
    "auctionPrice": 18.36
  },
  {
    "id": 660271,
    "normalizedValue": 0.9661,
    "auctionPrice": 17.9
  }
]
```

Possible errors:

- `400` invalid valuation request payload or evaluation failure
- `401` missing or invalid API key

## Client Integration

Client applications should call the protected data routes from their backend, not from a public browser client.

Example:

```ts
await fetch("https://api-cse-416-project-5a0b.onrender.com/players", {
  headers: {
    "mlb-api-key": process.env.MLB_API_KEY!,
  },
});
```

Recommended flow:

1. developer logs into the API dashboard
2. developer generates an API key
3. client backend stores the API key in env
4. client backend sends `mlb-api-key` on every protected request

## Database

This project currently uses these database tables:

- `players`: global player fields such as ID, name, age, injury status, and suggested value
- `hitter_stats`: hitter projection, last-year, and three-year-average stats
- `pitcher_stats`: pitcher projection, last-year, and three-year-average stats
- `last_refresh`: singleton refresh timestamp table used to avoid unnecessary refreshes
- `api_users`: developer dashboard accounts
- `api_keys`: generated API keys, including revoked historical keys

The player stat tables are linked back to `players` by `mlb_id`. The API serves hitter and pitcher pools by joining those tables and rebuilding player objects.

The `last_refresh` table holds one row with `id = 1` and the most recent `refreshed_at` timestamp.

The `api_keys` table keeps old keys for audit/history purposes. Revoked keys are marked with a non-null `revoked_at` timestamp and are rejected by the licensed client middleware.

## MLB Source Data

These are the MLB Stats API endpoints used as source data:

All players:

[https://statsapi.mlb.com/api/v1/sports/1/players?season=2026](https://statsapi.mlb.com/api/v1/sports/1/players?season=2026)

Player season stats:

[https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=season](https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=season)

Player projected stats:

[https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=projected](https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=projected)

## Common Status Codes


| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 200  | Success                                           |
| 201  | Resource created successfully                     |
| 400  | Invalid request payload or missing required field |
| 401  | Missing or invalid JWT/API key                    |
| 409  | Account already exists                            |
| 500  | Internal server error                             |



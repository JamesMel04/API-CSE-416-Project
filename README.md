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

- Base URL: `http://localhost:3000`
- `GET /health` : server status
- `GET /players` : all players
- `POST /players/valuations` : player valuations, body = `ValuationRequest`
- `GET /players/valuations/test` : temporary test route

MLB Data Source Endpoints (where we got our data from)


All Players: https://statsapi.mlb.com/api/v1/sports/1/players?season=2026


Player Season Stat: https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=season


Player Projected Stat:https://statsapi.mlb.com/api/v1/people/{PlayerID}/stats?stats=projected


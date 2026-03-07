```
npm install
- Run whenever dependency files change (package.json or package-lock.json)

npm run build
- Runs tsc: compiles src/*.ts to dist/*.js

npm start
- Runs node dist/index.js: starts the server using the already-compiled JS

npm run dev
- Runs ts-node src/index.ts: starts the server directly from TypeScript (no separate build)
```


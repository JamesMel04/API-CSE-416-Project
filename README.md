API URL: https://api-cse-416-project.onrender.com/
Draft Kit Backend: https://draft-kit-cse-416-project-1.onrender.com/

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


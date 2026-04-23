import express from 'express';
import path from 'path';
// Node's file system (read/write files)
import fs from 'fs';
import cors from "cors"
import dotenv from 'dotenv';
import { Player, PlayerPools, ValuationRequest } from '@/types';
import { mockValuationRequest } from "@/__tests__/fixtures/valuationRequest";
import dbPool from './services/db.pool';
import { getCachedPlayers } from './services/db.service';
dotenv.config();
import crypto from "crypto";
import { hashPassword, verifyPassword } from "@/utils/password";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";



const app = express();

// ================ User Session ==========================
type AuthenticatedRequest = Request & {
  user?: {
    id: number;
    email: string;
  };
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  return secret;
}

// Createt tokens for the user
function createAuthToken(user: { id: number; email: string }) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    getJwtSecret(),
    {
      expiresIn: "1d",
    }
  );
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      id: number;
      email: string;
    };

    req.user = {
      id: payload.id,
      email: payload.email,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid auth token" });
  }
}
//=========================================================

const PORT = process.env.PORT ?? 5000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
//const {Pool}=require("pg");
const implemented=false

const set="SET('C','1B','2B','3B','SS','CI','MI','OF1','OF2','OF3','OF4','OF5','UTIL','P1','P2','P3','P4','P5','P6','P7','P8','P9')"




// Path to player.json: __dirname is inside dist, we need to go up 1 level using ..
const playersPath = path.join(__dirname, '..', 'data', 'players.json');
// Read file into json string
const playersJsonString = fs.readFileSync(playersPath, 'utf-8');
// Create an in-memory json object that holds the player data 
// *Note*: The approach used here is to have the data stored in an object once the server runs, this allows faster return on request but may contain stale data if data changes, it could be good for the MVP, as we don't have real DB set up yet.  
const players: Player[] = JSON.parse(playersJsonString);

app.use(cors());
// Reads JSON puts in req.body
app.use(express.json());

// Human-friendly status page
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Handle server check requests
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Handle players requests
app.get('/players', async (req, res) => {
  // Grab cached hitters, pitchers
  let {hitters, pitchers} = await getCachedPlayers();
  res.json({hitters, pitchers});
})

//Starts server on this port
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
})

// User request with ValuationRequest: (LeagueSettings, DraftState)
app.post('/players/valuations', (req, res) => {
    try {
        const request = req.body as ValuationRequest;
        //Calling our valuation service on the players
        // const valuations = evaluatePlayers(players, request);
        const valuations = {} // Return empty for now.
        res.json(valuations);
    } catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Failed to evaluate players',
        });
    }
});

//================= FOR API USERS ========================

//handle user create account
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const passwordHash = hashPassword(password);

    // insert user into database
    const result = await dbPool.query(
      `INSERT INTO api_users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [email, passwordHash]
    );

    return res.status(201).json({
      message: "Account created successfully",
      user: result.rows[0],
    });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Account already exists" });
    }

    console.error(err);
    return res.status(500).json({ error: "Failed to create account" });
  }
});

//handle user login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // get the user email and password from the database
  try {
    const result = await dbPool.query(
      `SELECT id, email, password_hash
       FROM api_users
       WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    // password check
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create token for the user
    const token = createAuthToken({
      id: user.id,
      email: user.email,
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to log in" });
  }
});

// generates an api key
app.post("/api-keys", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Missing auth user" });
  }

  try {
    await dbPool.query(
      `UPDATE api_keys
       SET revoked_at = NOW()
       WHERE user_id = $1
       AND revoked_at IS NULL`,
      [req.user.id]
    );

    const apiKey = `api_${crypto.randomBytes(32).toString("hex")}`;

    await dbPool.query(
      `INSERT INTO api_keys (user_id, api_key)
       VALUES ($1, $2)`,
      [req.user.id, apiKey]
    );

    return res.status(201).json({
      apiKey,
      message: "API key generated successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate API key" });
  }
});

//get existing user api key
app.get("/api-keys", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Missing auth user" });
  }

  try {
    const result = await dbPool.query(
      `SELECT api_key
       FROM api_keys
       WHERE user_id = $1
       AND revoked_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    return res.status(200).json({
      apiKey: result.rows[0]?.api_key ?? "",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load API key" });
  }
});



//========================================================

//================ ONLY FOR TESTING ==========================
// app.get('/players/valuations/test', (req, res) => {
//     res.json(evaluatePlayers(players, mockValuationRequest));
// });
app.get('/players/data/test', async (req,res)=>{
  try{
    const players=await dbPool.query("CREATE TABLE test(\
      id int PRIMARY KEY,\
       name varchar(50) NOT NULL\
       );");
    console.log("called");
    res.json(players);
  }catch(error){
    console.log(error);
    res.json(error);
  }
});
//**obtain error code for nonexistent table:42P01**
app.get('/players/data/test2',async (req,res)=>{
  try{
    const nulls=await dbPool.query("SELECT * FROM test");
    res.json(nulls.rows);
  }catch(err){
    console.log(err);
    res.json(err);
  }
});
app.get('/players/data/test3',async (req,res)=>{
  try{
    const nulls=await dbPool.query("INSERT INTO test VALUES ('5', 'testerino')");
    res.json(nulls);
  }catch(err){
    console.log(err);
    res.json(err);
  }
});

import express from 'express';
import path from 'path';
// Node's file system (read/write files)
import fs from 'fs';
import cors from "cors"
import dotenv from 'dotenv';
import { evaluatePlayers } from '@/services/evaluation';
import { Player, PlayerPools, ValuationRequest } from '@/types';
import { mockValuationRequest } from "@/__tests__/fixtures/valuationRequest";
import playersPool from './services/db.pool';
import { getCachedPlayers } from './services/db.service';
dotenv.config();

const app = express();
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


//================ ONLY FOR TESTING ==========================
// app.get('/players/valuations/test', (req, res) => {
//     res.json(evaluatePlayers(players, mockValuationRequest));
// });
app.get('/players/data/test', async (req,res)=>{
  try{
    const players=await playersPool.query("CREATE TABLE test(\
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
    const nulls=await playersPool.query("SELECT * FROM test");
    res.json(nulls.rows);
  }catch(err){
    console.log(err);
    res.json(err);
  }
});
app.get('/players/data/test3',async (req,res)=>{
  try{
    const nulls=await playersPool.query("INSERT INTO test VALUES ('5', 'testerino')");
    res.json(nulls);
  }catch(err){
    console.log(err);
    res.json(err);
  }
});

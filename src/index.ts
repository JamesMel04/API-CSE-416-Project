import express from 'express';
import path from 'path';
// Node's file system (read/write files)
import fs from 'fs';
import cors from "cors"
import dotenv from 'dotenv';
import { evaluatePlayers } from '@/services/evaluation';
import { Player, ValuationRequest } from '@/types';
import { mockValuationRequest } from "@/__tests__/fixtures/valuationRequest";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

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

// Handle server check requests
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Handle players requests
app.get('/players', (req, res) => {
    res.json(players);
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
        const valuations = evaluatePlayers(players, request);
        res.json(valuations);
    } catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Failed to evaluate players',
        });
    }
});



//================ ONLY FOR TESTING ==========================
app.get('/players/valuations/test', (req, res) => {
    res.json(evaluatePlayers(players, mockValuationRequest));
});

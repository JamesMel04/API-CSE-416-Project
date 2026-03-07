//Load express library
import express from 'express';

//Creates Express application: Obj for the web server
//Get port number, if not provided, use 3000
const app = express();
const PORT = process.env.PORT ?? 3000;

// Reads JSON puts in req.body
app.use(express.json());

// Simple status check of the server
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

//Starts server on this port
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
})
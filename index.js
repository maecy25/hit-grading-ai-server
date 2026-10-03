require('./config');

const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./src/database');

const app = express();

const server = http.createServer(app)

app.use(express.json({limit: '100mb'}))
app.use(bodyParser.urlencoded({extended: true, limit: '100mb'}))
app.use(cors({
    origin: [process.env.LOCALHOST],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true
}));

/* SERVICES */
const tcgCheckerService = require('./src/services/tcgChecker');

/* MIDDLEWARES */
const mwMulter = require('./src/middlewares/multer');

// Define a GET route
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.get('/health', async (req, res) => {
  try {
    await db.raw('select 1');
    res.status(200).json({status: 'ok'});
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({status: 'error'});
  }
});

app.post('/analyze-card', mwMulter.upload.array('file'), tcgCheckerService.checkTCG);

// Start the server
server.listen(3001, () => {
    console.log(`running on port 3001 in mode`)
    console.log(`database connected on ${process.env.DB_HOST}:${process.env.DB_PORT}`)
})

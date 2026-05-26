const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDB } = require('./src/config/db');
const apiRouter = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static assets from src/public
app.use(express.static(path.join(__dirname, 'src/public')));

// Mount API routes
app.use('/api', apiRouter);

// Serve faculty.html for individual profiles
app.get('/faculty/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public', 'faculty.html'));
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public', 'index.html'));
});

// Initialize database and start the server
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`DU-Space Research Profile Server is running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database or start server:', err);
    process.exit(1);
  }
}

startServer();

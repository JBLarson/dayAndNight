// server.js
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:5173',
  'https://daylightviz.org',
  'https://www.daylightviz.org'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// Initialize SQLite database
const db = new Database('daylight.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    full_response TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS search_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    location_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE INDEX IF NOT EXISTS idx_locations_query ON locations(query);
  CREATE INDEX IF NOT EXISTS idx_search_logs_timestamp ON search_logs(timestamp);
`);

// Prepared statements
const findLocation = db.prepare('SELECT full_response, id FROM locations WHERE query = ?');
const insertLocation = db.prepare(`
  INSERT OR IGNORE INTO locations (query, display_name, lat, lon, full_response)
  VALUES (?, ?, ?, ?, ?)
`);
const logSearch = db.prepare(`
  INSERT INTO search_logs (query, location_id, ip_address, user_agent)
  VALUES (?, ?, ?, ?)
`);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Geocode endpoint
app.get('/api/geocode', async (req, res) => {
  const query = req.query.q;
  
  if (!query || query.length < 3) {
    return res.json([]);
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  const cached = findLocation.get(normalizedQuery);
  
  if (cached) {
    console.log(`[CACHE HIT] ${query}`);
    logSearch.run(query, cached.id, ip, userAgent);
    return res.json(JSON.parse(cached.full_response));
  }
  
  console.log(`[CACHE MISS] ${query} - fetching from Nominatim`);
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      {
        headers: {
          'User-Agent': 'DaylightViz/1.0 (daylightviz.org)'
        }
      }
    );
    
    const data = await response.json();
    
    if (data.length > 0) {
      const firstResult = data[0];
      
      insertLocation.run(
        normalizedQuery,
        firstResult.display_name,
        parseFloat(firstResult.lat),
        parseFloat(firstResult.lon),
        JSON.stringify(data)
      );
      
      const locationId = db.prepare('SELECT id FROM locations WHERE query = ?').get(normalizedQuery)?.id;
      logSearch.run(query, locationId, ip, userAgent);
      
      console.log(`[CACHED] ${query} -> ${firstResult.display_name}`);
    } else {
      logSearch.run(query, null, ip, userAgent);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
  const stats = {
    totalSearches: db.prepare('SELECT COUNT(*) as count FROM search_logs').get().count,
    uniqueLocations: db.prepare('SELECT COUNT(*) as count FROM locations').get().count,
    topSearches: db.prepare(`
      SELECT query, COUNT(*) as count
      FROM search_logs
      GROUP BY query
      ORDER BY count DESC
      LIMIT 10
    `).all(),
    recentSearches: db.prepare(`
      SELECT query, timestamp
      FROM search_logs
      ORDER BY timestamp DESC
      LIMIT 20
    `).all(),
    cacheHitRate: (() => {
      const total = db.prepare('SELECT COUNT(*) as count FROM search_logs').get().count;
      const hits = db.prepare('SELECT COUNT(*) as count FROM search_logs WHERE location_id IS NOT NULL').get().count;
      return total > 0 ? ((hits / total) * 100).toFixed(2) : 0;
    })()
  };
  
  res.json(stats);
});

// Export database
app.get('/api/export', (req, res) => {
  const locations = db.prepare('SELECT * FROM locations ORDER BY created_at DESC').all();
  const searches = db.prepare('SELECT * FROM search_logs ORDER BY timestamp DESC').all();
  
  res.json({
    locations,
    searches,
    exported_at: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Daylight Viz API running on port ${PORT}`);
  console.log(`📊 Database: ${db.name}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
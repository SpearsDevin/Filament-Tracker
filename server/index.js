/**
 * SpoolControl API Server
 * Express server that serves the static frontend and provides a simple REST API
 * for persisting the application state to a JSON file on disk.
 *
 * Endpoints:
 *   GET  /api/state   → returns the full application state as JSON
 *   PUT  /api/state   → replaces the full application state and writes to disk
 *   GET  /*           → serves static files from /app/public
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Ensure the /data directory exists */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Return the default seed state (sample data) */
function getDefaultState() {
  return {
    activeOwner: 'all',
    settings: {
      appName: 'SpoolControl',
      appSubtitle: 'Filament Manager',
      appLogoEmoji: '🎨'
    },
    users: [
      { id: 'u-1', name: 'Devin', color: '#6366f1', avatar: '👤' },
      { id: 'shared', name: 'Shared Lab', color: '#f59e0b', avatar: '🔬' }
    ],
    filaments: [
      {
        id: 'f-1', brand: 'Prusament', material: 'PLA',
        colorName: 'Galaxy Black', colorHex: '#111827',
        diameter: 1.75, spoolWeight: 1000, emptySpoolWeight: 220,
        currentWeight: 750, cost: 29.99, purchaseDate: '2026-01-15',
        location: 'Drybox 1', status: 'In Use', ownerId: 'u-1',
        notes: 'Very clean prints, print at 215°C/60°C. Standard draft settings work great.'
      },
      {
        id: 'f-2', brand: 'Hatchbox', material: 'PLA',
        colorName: 'Ruby Red', colorHex: '#dc2626',
        diameter: 1.75, spoolWeight: 1000, emptySpoolWeight: 225,
        currentWeight: 420, cost: 22.99, purchaseDate: '2026-02-10',
        location: 'Shelf A2', status: 'In Use', ownerId: 'u-1',
        notes: 'Prints beautifully at 200°C. Great layer adhesion.'
      },
      {
        id: 'f-3', brand: 'Polymaker', material: 'PETG',
        colorName: 'Teal Blue', colorHex: '#0d9488',
        diameter: 1.75, spoolWeight: 1000, emptySpoolWeight: 240,
        currentWeight: 980, cost: 25.99, purchaseDate: '2026-03-01',
        location: 'Drybox 2', status: 'Sealed', ownerId: 'shared',
        notes: 'Requires 240°C. Bed at 80°C. Good mechanical properties.'
      }
    ],
    logs: [
      {
        id: 'l-1', filamentId: 'f-1', printName: 'Voron Stealthburner Parts',
        weightUsed: 180, durationMinutes: 480, userId: 'u-1',
        date: '2026-05-10T14:30:00Z', status: 'success',
        notes: 'Perfect surface finish, highly structural.'
      },
      {
        id: 'l-2', filamentId: 'f-2', printName: 'Articulated Dragon',
        weightUsed: 220, durationMinutes: 620, userId: 'u-1',
        date: '2026-05-12T09:15:00Z', status: 'success',
        notes: 'Beautiful sheen.'
      }
    ]
  };
}

/** Read state from disk; seed with defaults if file doesn't exist */
function readState() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const defaults = getDefaultState();
    fs.writeFileSync(DB_FILE, JSON.stringify(defaults, null, 2), 'utf8');
    console.log(`[SpoolControl] No database found. Seeded ${DB_FILE} with sample data.`);
    return defaults;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[SpoolControl] Failed to parse db.json:', err.message);
    return getDefaultState();
  }
}

/** Write state to disk atomically (write to tmp then rename) */
function writeState(newState) {
  ensureDataDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(newState, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

// ── API Routes ───────────────────────────────────────────────────────────────

/** GET /api/state — return full application state */
app.get('/api/state', (req, res) => {
  try {
    const state = readState();
    res.json(state);
  } catch (err) {
    console.error('[SpoolControl] GET /api/state error:', err);
    res.status(500).json({ error: 'Failed to read database.' });
  }
});

/** PUT /api/state — replace full application state */
app.put('/api/state', (req, res) => {
  try {
    const newState = req.body;

    // Basic validation
    if (!newState || !Array.isArray(newState.filaments) ||
        !Array.isArray(newState.logs) || !Array.isArray(newState.users)) {
      return res.status(400).json({ error: 'Invalid state: missing filaments, logs, or users arrays.' });
    }

    writeState(newState);
    res.json({ ok: true });
  } catch (err) {
    console.error('[SpoolControl] PUT /api/state error:', err);
    res.status(500).json({ error: 'Failed to write database.' });
  }
});

/** Healthcheck endpoint */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: DB_FILE, uptime: process.uptime() });
});

/** Fallback: serve index.html for any unmatched route (SPA support) */
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎨 SpoolControl is running!`);
  console.log(`   → App:      http://localhost:${PORT}`);
  console.log(`   → Database: ${DB_FILE}`);
  console.log(`   → Health:   http://localhost:${PORT}/api/health\n`);

  // Eagerly seed the DB file if it doesn't exist
  readState();
});

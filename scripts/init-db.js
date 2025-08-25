const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'health_track.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Weight tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight REAL NOT NULL,
      date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Fasting sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS fasting_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      target_hours INTEGER NOT NULL,
      actual_hours REAL,
      completed BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Goals table
  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_weight REAL,
      start_weight REAL,
      target_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table for user preferences
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_unit TEXT DEFAULT 'lbs' CHECK(weight_unit IN ('lbs', 'kg')),
      height_unit TEXT DEFAULT 'inches' CHECK(height_unit IN ('inches', 'cm')),
      user_height REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sleep goals table
  db.run(`
    CREATE TABLE IF NOT EXISTS sleep_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_hours REAL NOT NULL,
      target_bedtime TIME NOT NULL,
      target_wake_time TIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sleep sessions table for tracking actual sleep
  db.run(`
    CREATE TABLE IF NOT EXISTS sleep_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      actual_hours REAL,
      completed BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default settings if none exist
  db.run(`
    INSERT OR IGNORE INTO settings (id, weight_unit, height_unit) 
    SELECT 1, 'lbs', 'inches'
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1)
  `);

  console.log('Database initialized successfully!');
});

db.close();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const dbPath = path.join(__dirname, 'health_track.db');
const db = new sqlite3.Database(dbPath);

// API Routes

// Weight entries
app.get('/api/weight', (req, res) => {
  db.all('SELECT * FROM weight_entries ORDER BY date DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/weight', (req, res) => {
  const { weight, date, notes } = req.body;
  
  db.run(
    'INSERT INTO weight_entries (weight, date, notes) VALUES (?, ?, ?)',
    [weight, date, notes || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, weight, date, notes });
    }
  );
});

// Fasting sessions
app.get('/api/fasting', (req, res) => {
  db.all('SELECT * FROM fasting_sessions ORDER BY start_time DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/fasting/start', (req, res) => {
  const { target_hours, start_time } = req.body;
  const startDateTime = start_time || new Date().toISOString();
  
  db.run(
    'INSERT INTO fasting_sessions (start_time, target_hours) VALUES (?, ?)',
    [startDateTime, target_hours],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, start_time: startDateTime, target_hours });
    }
  );
});

app.patch('/api/fasting/:id/end', (req, res) => {
  const { id } = req.params;
  const { end_time, notes } = req.body;
  const endDateTime = end_time || new Date().toISOString();
  
  // Get the start time to calculate actual duration
  db.get('SELECT start_time FROM fasting_sessions WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Fasting session not found' });
      return;
    }
    
    // Calculate actual hours
    const startTime = new Date(row.start_time);
    const endTime = new Date(endDateTime);
    const actualHours = (endTime - startTime) / (1000 * 60 * 60);
    
    db.run(
      'UPDATE fasting_sessions SET end_time = ?, actual_hours = ?, completed = TRUE, notes = ? WHERE id = ?',
      [endDateTime, actualHours, notes || null, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ success: true, end_time: endDateTime, actual_hours: actualHours });
      }
    );
  });
});

// Get current active fast
app.get('/api/fasting/current', (req, res) => {
  db.get(
    'SELECT * FROM fasting_sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1',
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

// Goals
app.get('/api/goals', (req, res) => {
  db.get('SELECT * FROM goals ORDER BY created_at DESC LIMIT 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row || null);
  });
});

app.post('/api/goals', (req, res) => {
  const { target_weight, start_weight, target_date } = req.body;
  
  db.run(
    'INSERT INTO goals (target_weight, start_weight, target_date) VALUES (?, ?, ?)',
    [target_weight, start_weight || null, target_date],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, target_weight, start_weight, target_date });
    }
  );
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  db.get('SELECT * FROM settings WHERE id = 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row || { weight_unit: 'lbs', height_unit: 'inches', user_height: null });
  });
});

app.post('/api/settings', (req, res) => {
  const { weight_unit, height_unit, user_height } = req.body;
  
  db.run(
    `INSERT OR REPLACE INTO settings (id, weight_unit, height_unit, user_height, updated_at) 
     VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [weight_unit, height_unit, user_height],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ weight_unit, height_unit, user_height });
    }
  );
});

// Sleep goals
app.get('/api/sleep-goals', (req, res) => {
  db.get('SELECT * FROM sleep_goals ORDER BY created_at DESC LIMIT 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row || null);
  });
});

app.post('/api/sleep-goals', (req, res) => {
  const { target_hours, target_bedtime, target_wake_time } = req.body;
  
  db.run(
    'INSERT INTO sleep_goals (target_hours, target_bedtime, target_wake_time) VALUES (?, ?, ?)',
    [target_hours, target_bedtime, target_wake_time],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, target_hours, target_bedtime, target_wake_time });
    }
  );
});

// Sleep sessions
app.get('/api/sleep', (req, res) => {
  db.all('SELECT * FROM sleep_sessions ORDER BY start_time DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/sleep/start', (req, res) => {
  const { start_time } = req.body;
  const startDateTime = start_time || new Date().toISOString();
  
  db.run(
    'INSERT INTO sleep_sessions (start_time) VALUES (?)',
    [startDateTime],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, start_time: startDateTime });
    }
  );
});

app.patch('/api/sleep/:id/end', (req, res) => {
  const { id } = req.params;
  const { end_time, notes } = req.body;
  const endDateTime = end_time || new Date().toISOString();
  
  // Get the start time to calculate actual duration
  db.get('SELECT start_time FROM sleep_sessions WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Sleep session not found' });
      return;
    }
    
    // Calculate actual hours
    const startTime = new Date(row.start_time);
    const endTime = new Date(endDateTime);
    const actualHours = (endTime - startTime) / (1000 * 60 * 60);
    
    db.run(
      'UPDATE sleep_sessions SET end_time = ?, actual_hours = ?, completed = TRUE, notes = ? WHERE id = ?',
      [endDateTime, actualHours, notes || null, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ success: true, end_time: endDateTime, actual_hours: actualHours });
      }
    );
  });
});

// Get current active sleep
app.get('/api/sleep/current', (req, res) => {
  db.get(
    'SELECT * FROM sleep_sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1',
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row || null);
    }
  );
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  // Get settings first
  db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    stats.settings = settings || { weight_unit: 'lbs', height_unit: 'inches', user_height: null };
    
    // Get latest weight
    db.get('SELECT weight FROM weight_entries ORDER BY date DESC LIMIT 1', (err, weightRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      stats.currentWeight = weightRow ? weightRow.weight : null;
      
      // Calculate BMI if we have weight and height
      if (stats.currentWeight && stats.settings.user_height) {
        let weightKg = stats.currentWeight;
        let heightM = stats.settings.user_height;
        
        // Convert to metric for BMI calculation
        if (stats.settings.weight_unit === 'lbs') {
          weightKg = stats.currentWeight * 0.453592;
        }
        if (stats.settings.height_unit === 'inches') {
          heightM = stats.settings.user_height * 0.0254;
        } else {
          heightM = stats.settings.user_height / 100; // cm to m
        }
        
        stats.bmi = (weightKg / (heightM * heightM)).toFixed(1);
      }
      
      // Get goal
      db.get('SELECT * FROM goals ORDER BY created_at DESC LIMIT 1', (err, goalRow) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        stats.goal = goalRow;
        
        // Calculate progress
        if (stats.currentWeight && goalRow && goalRow.start_weight) {
          const totalToLose = goalRow.start_weight - goalRow.target_weight;
          const lostSoFar = goalRow.start_weight - stats.currentWeight;
          stats.progress = totalToLose > 0 ? (lostSoFar / totalToLose) * 100 : 0;
        }
        
        res.json(stats);
      });
    });
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Health Tracker server running at:`);
  console.log(`  Local: http://localhost:${PORT}`);
  console.log(`  Network: http://192.168.1.150:${PORT}`);
  console.log(`  Tailscale: http://100.91.118.79:${PORT}`);
});
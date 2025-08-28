const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const dbPath = path.join(__dirname, 'health_track.db');
const db = new sqlite3.Database(dbPath);

// Ollama integration function
async function generateRecommendation(sessionType, sessionData, notes, userContext = {}) {
  return new Promise((resolve, reject) => {
    // Get configured model from settings or default to gemma2:2b
    db.get('SELECT ai_model FROM settings WHERE id = 1', (err, row) => {
      const model = row?.ai_model || 'gemma2:2b';
      const prompt = createRecommendationPrompt(sessionType, sessionData, notes, userContext);
      
      const postData = JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      });

      const options = {
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.response || 'Unable to generate recommendation');
          } catch (error) {
            reject(new Error('Failed to parse Ollama response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Ollama request failed: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  });
}

function createRecommendationPrompt(sessionType, sessionData, notes, userContext) {
  const baseContext = `You are a helpful health and wellness assistant providing personalized recommendations based on user's ${sessionType} session data. Provide practical, safe, and encouraging advice. Always include a medical disclaimer that this is not medical advice.`;
  
  if (sessionType === 'fasting') {
    return `${baseContext}

FASTING SESSION DATA:
- Target Duration: ${sessionData.target_hours} hours
- Actual Duration: ${sessionData.actual_hours} hours
- Start Time: ${sessionData.start_time}
- End Time: ${sessionData.end_time}
- User Notes: "${notes || 'No notes provided'}"
${userContext.currentWeight ? `- Current Weight: ${userContext.currentWeight} ${userContext.weight_unit}` : ''}
${userContext.goalWeight ? `- Goal Weight: ${userContext.goalWeight} ${userContext.weight_unit}` : ''}

Please provide a brief (2-3 sentences) personalized recommendation for their next fasting session based on their experience and notes. Focus on practical tips for improvement, hydration, timing, or duration adjustments. End with an encouraging note.

Format your response as: **Recommendation:** [your recommendation]`;
  } 
  
  if (sessionType === 'sleep') {
    return `${baseContext}

SLEEP SESSION DATA:
- Duration: ${sessionData.actual_hours} hours
- Start Time: ${sessionData.start_time}
- End Time: ${sessionData.end_time}
- User Notes: "${notes || 'No notes provided'}"
${userContext.targetSleepHours ? `- Target Sleep Hours: ${userContext.targetSleepHours}` : ''}

Please provide a brief (2-3 sentences) personalized recommendation for improving their sleep quality based on their experience and notes. Focus on practical tips for better sleep hygiene, timing, or environmental factors. End with an encouraging note.

Format your response as: **Recommendation:** [your recommendation]`;
  }

  return `${baseContext}\n\nSession Type: ${sessionType}\nUser Notes: "${notes}"\n\nProvide a brief helpful recommendation.`;
}

// Background recommendation processing
async function processRecommendationInBackground(recommendationId) {
  console.log(`Starting background processing for recommendation ${recommendationId}`);
  
  try {
    // Update status to processing
    await new Promise((resolve, reject) => {
      db.run('UPDATE recommendations SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?', 
        ['processing', recommendationId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    // Get recommendation details
    const recData = await new Promise((resolve, reject) => {
      db.get(`SELECT r.*, 
                CASE 
                  WHEN r.session_type = 'fasting' THEN (
                    SELECT json_object(
                      'target_hours', f.target_hours,
                      'actual_hours', f.actual_hours, 
                      'start_time', f.start_time,
                      'end_time', f.end_time,
                      'notes', f.notes
                    ) FROM fasting_sessions f WHERE f.id = r.session_id
                  )
                  WHEN r.session_type = 'sleep' THEN (
                    SELECT json_object(
                      'actual_hours', s.actual_hours,
                      'start_time', s.start_time, 
                      'end_time', s.end_time,
                      'notes', s.notes
                    ) FROM sleep_sessions s WHERE s.id = r.session_id
                  )
                END as session_data
              FROM recommendations r 
              WHERE r.id = ?`, [recommendationId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!recData) {
      throw new Error('Recommendation not found');
    }

    const sessionData = JSON.parse(recData.session_data);
    const userContext = await getUserContext();
    
    // Add sleep goal context if it's a sleep session
    if (recData.session_type === 'sleep') {
      const sleepGoal = await getSleepGoalContext();
      Object.assign(userContext, sleepGoal);
    }

    // Generate recommendation
    const recommendation = await generateRecommendation(
      recData.session_type, 
      sessionData, 
      sessionData.notes, 
      userContext
    );

    // Save completed recommendation
    await new Promise((resolve, reject) => {
      db.run('UPDATE recommendations SET status = ?, recommendation = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?', 
        ['completed', recommendation, recommendationId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    console.log(`Successfully completed recommendation ${recommendationId}`);
    
  } catch (error) {
    console.error(`Failed to process recommendation ${recommendationId}:`, error.message);
    
    // Save error status
    await new Promise((resolve) => {
      db.run('UPDATE recommendations SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?', 
        ['failed', error.message, recommendationId], (err) => {
          if (err) console.error('Failed to save error status:', err);
          resolve();
        });
    });
  }
}

// Queue a recommendation for background processing
async function queueRecommendation(sessionType, sessionId) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO recommendations (session_type, session_id, status) VALUES (?, ?, ?)',
      [sessionType, sessionId, 'pending'],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        const recommendationId = this.lastID;
        console.log(`Queued recommendation ${recommendationId} for ${sessionType} session ${sessionId}`);
        
        // Start background processing (non-blocking)
        setTimeout(() => processRecommendationInBackground(recommendationId), 100);
        
        resolve(recommendationId);
      });
  });
}

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

app.patch('/api/fasting/:id/end', async (req, res) => {
  const { id } = req.params;
  const { end_time, notes } = req.body;
  const endDateTime = end_time || new Date().toISOString();
  
  // Get the start time and target hours to calculate actual duration
  db.get('SELECT start_time, target_hours FROM fasting_sessions WHERE id = ?', [id], async (err, row) => {
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
    
    // Update the session in database
    db.run(
      'UPDATE fasting_sessions SET end_time = ?, actual_hours = ?, completed = TRUE, notes = ? WHERE id = ?',
      [endDateTime, actualHours, notes || null, id],
      async function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        let recommendationId = null;
        
        // Queue recommendation for background processing if notes are provided
        if (notes && notes.trim()) {
          try {
            recommendationId = await queueRecommendation('fasting', id);
          } catch (error) {
            console.error('Failed to queue recommendation:', error.message);
            // Don't fail the session update if recommendation queueing fails
          }
        }
        
        res.json({ 
          success: true, 
          end_time: endDateTime, 
          actual_hours: actualHours,
          recommendation_id: recommendationId,
          message: recommendationId ? 'Session completed! AI recommendation is being generated in the background.' : 'Session completed!'
        });
      }
    );
  });
});

// Helper function to get user context for recommendations
function getUserContext() {
  return new Promise((resolve) => {
    // Get current weight and goal
    db.get('SELECT weight FROM weight_entries ORDER BY date DESC LIMIT 1', (err, weightRow) => {
      if (err) {
        resolve({});
        return;
      }
      
      db.get('SELECT target_weight FROM goals ORDER BY created_at DESC LIMIT 1', (err, goalRow) => {
        if (err) {
          resolve({ currentWeight: weightRow?.weight });
          return;
        }
        
        db.get('SELECT weight_unit FROM settings WHERE id = 1', (err, settingsRow) => {
          const context = {
            currentWeight: weightRow?.weight,
            goalWeight: goalRow?.target_weight,
            weight_unit: settingsRow?.weight_unit || 'lbs'
          };
          resolve(context);
        });
      });
    });
  });
}

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
    res.json(row || { 
      weight_unit: 'lbs', 
      height_unit: 'inches', 
      user_height: null, 
      date_of_birth: null,
      gender: null,
      ai_model: 'gemma2:2b' 
    });
  });
});

app.post('/api/settings', (req, res) => {
  const { date_of_birth, gender, weight_unit, height_unit, user_height, ai_model } = req.body;
  
  db.run(
    `INSERT OR REPLACE INTO settings (id, weight_unit, height_unit, user_height, ai_model, date_of_birth, gender, updated_at) 
     VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [weight_unit, height_unit, user_height, ai_model || 'gemma2:2b', date_of_birth, gender],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        date_of_birth, 
        gender, 
        weight_unit, 
        height_unit, 
        user_height, 
        ai_model: ai_model || 'gemma2:2b' 
      });
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

app.patch('/api/sleep/:id/end', async (req, res) => {
  const { id } = req.params;
  const { end_time, notes } = req.body;
  const endDateTime = end_time || new Date().toISOString();
  
  // Get the start time to calculate actual duration
  db.get('SELECT start_time FROM sleep_sessions WHERE id = ?', [id], async (err, row) => {
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
    
    // Update the session in database
    db.run(
      'UPDATE sleep_sessions SET end_time = ?, actual_hours = ?, completed = TRUE, notes = ? WHERE id = ?',
      [endDateTime, actualHours, notes || null, id],
      async function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        let recommendationId = null;
        
        // Queue recommendation for background processing if notes are provided
        if (notes && notes.trim()) {
          try {
            recommendationId = await queueRecommendation('sleep', id);
          } catch (error) {
            console.error('Failed to queue sleep recommendation:', error.message);
            // Don't fail the session update if recommendation queueing fails
          }
        }
        
        res.json({ 
          success: true, 
          end_time: endDateTime, 
          actual_hours: actualHours,
          recommendation_id: recommendationId,
          message: recommendationId ? 'Session completed! AI recommendation is being generated in the background.' : 'Session completed!'
        });
      }
    );
  });
});

// Helper function to get sleep goal context
function getSleepGoalContext() {
  return new Promise((resolve) => {
    db.get('SELECT target_hours FROM sleep_goals ORDER BY created_at DESC LIMIT 1', (err, row) => {
      if (err) {
        resolve({});
        return;
      }
      resolve({ targetSleepHours: row?.target_hours });
    });
  });
}

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

// Recommendations endpoints
app.get('/api/recommendations', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  
  db.all(`SELECT r.*, 
            CASE 
              WHEN r.session_type = 'fasting' THEN (
                SELECT json_object(
                  'start_time', f.start_time,
                  'end_time', f.end_time,
                  'target_hours', f.target_hours,
                  'actual_hours', f.actual_hours,
                  'notes', f.notes
                ) FROM fasting_sessions f WHERE f.id = r.session_id
              )
              WHEN r.session_type = 'sleep' THEN (
                SELECT json_object(
                  'start_time', s.start_time,
                  'end_time', s.end_time,
                  'actual_hours', s.actual_hours,
                  'notes', s.notes
                ) FROM sleep_sessions s WHERE s.id = r.session_id
              )
            END as session_data
          FROM recommendations r 
          ORDER BY r.created_at DESC 
          LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse session_data JSON strings
    const recommendations = rows.map(row => ({
      ...row,
      session_data: row.session_data ? JSON.parse(row.session_data) : null
    }));
    
    res.json(recommendations);
  });
});

app.get('/api/recommendations/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT r.*, 
            CASE 
              WHEN r.session_type = 'fasting' THEN (
                SELECT json_object(
                  'start_time', f.start_time,
                  'end_time', f.end_time,
                  'target_hours', f.target_hours,
                  'actual_hours', f.actual_hours,
                  'notes', f.notes
                ) FROM fasting_sessions f WHERE f.id = r.session_id
              )
              WHEN r.session_type = 'sleep' THEN (
                SELECT json_object(
                  'start_time', s.start_time,
                  'end_time', s.end_time,
                  'actual_hours', s.actual_hours,
                  'notes', s.notes
                ) FROM sleep_sessions s WHERE s.id = r.session_id
              )
            END as session_data
          FROM recommendations r 
          WHERE r.id = ?`, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Recommendation not found' });
      return;
    }
    
    // Parse session_data JSON string
    const recommendation = {
      ...row,
      session_data: row.session_data ? JSON.parse(row.session_data) : null
    };
    
    res.json(recommendation);
  });
});

// Ollama configuration endpoints
app.get('/api/ollama/models', async (req, res) => {
  try {
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/tags',
      method: 'GET'
    };

    const request = http.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const models = JSON.parse(data);
          res.json(models);
        } catch (error) {
          res.status(500).json({ error: 'Failed to parse Ollama models' });
        }
      });
    });

    request.on('error', (error) => {
      res.status(500).json({ error: `Ollama connection failed: ${error.message}` });
    });

    request.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
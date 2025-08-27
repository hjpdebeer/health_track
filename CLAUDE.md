# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A comprehensive web-based health tracking application designed for weight loss journey management with advanced features including intermittent fasting tracking, sleep monitoring, and AI-powered recommendations. Built with Node.js, Express, SQLite, and vanilla JavaScript with Bootstrap for responsive design.

### Key Capabilities
- **Weight Management**: Daily weight logging with BMI calculation and progress visualization
- **Intermittent Fasting**: Session tracking with customizable fasting windows (16:8, 18:6, 20:4, 24h)
- **Sleep Monitoring**: Sleep session tracking with duration analysis and quality notes
- **Goal Setting**: Weight loss and sleep goals with progress monitoring
- **AI Recommendations**: Intelligent insights using Ollama integration with local LLM processing
- **User Preferences**: Customizable units and personal settings
- **Multi-page Interface**: Dedicated pages for different functionality areas
- **Production Deployment**: Systemd service integration for persistent operation

## Prerequisites

### System Requirements
- **Node.js**: v20.19.4 or higher
- **npm**: v11.5.2 or higher  
- **SQLite3**: For database operations
- **Ollama**: v0.11.4 or higher (for AI recommendations)
- **systemd**: v252+ (for production deployment)

### Required Dependencies
```json
{
  "express": "^4.18.2",
  "sqlite3": "^5.1.6", 
  "cors": "^2.8.5"
}
```

### AI Integration Setup
1. **Install Ollama**: Follow instructions at https://ollama.ai
2. **Pull gemma2:2b model**: `ollama pull gemma2:2b`
3. **Verify Ollama is running**: `ollama list` should show gemma2:2b model

## Development Commands

```bash
# Install dependencies
npm install

# Initialize/reset database (creates all required tables)
npm run init-db

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

## Production Deployment

### Systemd Service
The application runs as a persistent systemd service:

```bash
# Service management
sudo systemctl start health-tracker
sudo systemctl stop health-tracker
sudo systemctl restart health-tracker
sudo systemctl status health-tracker

# View logs
sudo journalctl -u health-tracker -f
```

### Network Access
- **Local**: http://localhost:3000
- **Network**: http://192.168.1.150:3000
- **Tailscale**: http://100.91.118.79:3000

## Architecture

- **Backend**: Express.js server (`server.js`)
- **Database**: SQLite (`health_track.db`) with tables for weight entries, fasting sessions, goals, and AI recommendations
- **AI Integration**: Ollama with gemma2:2b model for intelligent health recommendations
- **Frontend**: Vanilla HTML/CSS/JavaScript in `public/` directory
- **Database Setup**: `scripts/init-db.js` creates the database schema

### Database Schema

**Core Tables:**
- `weight_entries`: Daily weight tracking with notes and timestamps
  ```sql
  id, weight, date, notes, created_at
  ```

- `fasting_sessions`: Intermittent fasting session management
  ```sql
  id, start_time, end_time, target_hours, actual_hours, completed, notes, created_at
  ```

- `sleep_sessions`: Sleep tracking and analysis
  ```sql
  id, start_time, end_time, actual_hours, completed, notes, created_at
  ```

**Configuration Tables:**
- `goals`: Weight loss goal management
  ```sql
  id, target_weight, start_weight, target_date, created_at, updated_at
  ```

- `sleep_goals`: Sleep target configuration
  ```sql
  id, target_hours, target_bedtime, target_wake_time, created_at, updated_at
  ```

- `settings`: User preferences and units
  ```sql
  id, weight_unit, height_unit, user_height, created_at, updated_at
  ```

**AI Integration:**
- `recommendations`: AI-generated recommendations with queue management
  ```sql
  id, session_type, session_id, recommendation, status, error_message, created_at, completed_at
  ```

### API Endpoints

- `GET/POST /api/weight` - Weight entry management
- `GET /api/fasting`, `POST /api/fasting/start`, `PATCH /api/fasting/:id/end` - Fasting session management
- `GET /api/sleep`, `POST /api/sleep/start`, `PATCH /api/sleep/:id/end` - Sleep session management
- `GET/POST /api/goals` - Goal setting and retrieval
- `GET/POST /api/settings` - User settings management
- `GET /api/recommendations` - AI recommendations retrieval
- `GET /api/stats` - Dashboard statistics
- `GET /api/fasting/current` - Current active fasting session
- `GET /api/sleep/current` - Current active sleep session

### File Structure

```
├── server.js              # Express server and API routes with Ollama integration
├── package.json           # Dependencies and npm scripts
├── package-lock.json      # Dependency lock file
├── health_track.db        # SQLite database (auto-created)
├── CLAUDE.md              # This documentation file
├── README-DEPLOYMENT.md   # Production deployment guide
├── health-tracker.service # Systemd service configuration
├── scripts/
│   └── init-db.js        # Database schema initialization
└── public/               # Frontend static files
    ├── index.html        # Main dashboard with fasting/sleep timers
    ├── goals.html        # Weight and sleep goal management
    ├── recommendations.html # AI recommendations display
    ├── settings.html     # User preferences and units
    ├── styles.css        # Bootstrap-enhanced styling
    ├── app.js            # Dashboard logic with timer management
    ├── goals.js          # Goal setting and tracking
    ├── recommendations.js # Real-time recommendation updates
    └── settings.js       # User preference management
```

## Features

- Weight tracking with progress visualization and BMI calculation
- Intermittent fasting timer (16:8, 18:6, 20:4, 24h options)
- Sleep tracking with duration and quality notes
- Goal setting and progress monitoring for weight and sleep
- AI-powered recommendations using Ollama (gemma2:2b model)
- User settings for units and personal preferences
- Historical data display with comprehensive statistics
- Background AI processing to avoid blocking UI
- Responsive design for mobile/desktop

## AI Recommendations System

### Overview
The application integrates with Ollama to provide intelligent, personalized health recommendations based on user session data and notes.

### Technical Implementation
- **Model**: gemma2:2b (fast, lightweight, local processing)
- **Architecture**: Asynchronous background processing to prevent UI blocking
- **Triggers**: Automatic generation when completing fasting/sleep sessions with user notes
- **Context**: Incorporates user goals, settings, and historical data for personalized insights
- **Storage**: Database queue system with status tracking (pending → processing → completed/failed)
- **Display**: Dedicated page with real-time updates and filtering capabilities

### Processing Flow
1. User completes session with notes → Recommendation queued
2. Background processor picks up queued item → Status: processing
3. Ollama generates contextual recommendation → Status: completed
4. User views recommendation on dedicated page with session context
5. Auto-refresh every 30 seconds for real-time status updates

### Error Handling
- Graceful degradation if Ollama is unavailable
- Failed recommendations logged with error messages
- Non-blocking: session completion always succeeds regardless of AI status

### Configuration Requirements
```bash
# Verify Ollama installation
ollama --version  # Should show v0.11.4+

# Ensure gemma2:2b model is available
ollama pull gemma2:2b
ollama list  # Should list gemma2:2b

# Test Ollama API endpoint
curl http://localhost:11434/api/tags
```

## Troubleshooting

### Common Issues
1. **AI Recommendations not generating**:
   - Check Ollama service: `ollama list`
   - Verify model availability: `ollama pull gemma2:2b`
   - Check server logs: `sudo journalctl -u health-tracker -f`

2. **Database issues**:
   - Reinitialize: `npm run init-db`
   - Check file permissions: `ls -la health_track.db`

3. **Service not starting**:
   - Check systemd status: `sudo systemctl status health-tracker`
   - Test manual start: `cd /home/serveradmin/health_track && node server.js`
   - Verify port availability: `sudo lsof -i :3000`

4. **UI errors**:
   - Check browser console for JavaScript errors
   - Verify all static files are accessible
   - Test API endpoints: `curl http://localhost:3000/api/stats`

## Deployment Checklist

- [ ] Node.js v20+ installed
- [ ] Dependencies installed: `npm install`
- [ ] Database initialized: `npm run init-db`
- [ ] Ollama installed and running
- [ ] gemma2:2b model pulled: `ollama pull gemma2:2b`
- [ ] Systemd service configured and started
- [ ] Network access configured (ports, firewall)
- [ ] Service auto-start enabled: `sudo systemctl enable health-tracker`
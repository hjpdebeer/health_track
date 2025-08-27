# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web-based health tracking application for weight loss journey management with intermittent fasting support. Built with Node.js, Express, SQLite, and vanilla JavaScript.

## Development Commands

```bash
# Install dependencies
npm install

# Initialize/reset database
npm run init-db

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

## Architecture

- **Backend**: Express.js server (`server.js`)
- **Database**: SQLite (`health_track.db`) with tables for weight entries, fasting sessions, goals, and AI recommendations
- **AI Integration**: Ollama with gemma2:2b model for intelligent health recommendations
- **Frontend**: Vanilla HTML/CSS/JavaScript in `public/` directory
- **Database Setup**: `scripts/init-db.js` creates the database schema

### Database Schema

- `weight_entries`: Tracks daily weight logs with optional notes
- `fasting_sessions`: Records intermittent fasting sessions with start/end times
- `sleep_sessions`: Records sleep sessions with start/end times and sleep notes
- `goals`: Stores weight loss goals and progress tracking
- `settings`: User preferences for units and personal information
- `recommendations`: AI-generated recommendations from Ollama with status tracking

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
├── server.js              # Express server and API routes
├── package.json           # Dependencies and scripts
├── health_track.db        # SQLite database (created after init-db)
├── scripts/
│   └── init-db.js        # Database initialization
└── public/               # Static frontend files
    ├── index.html        # Main dashboard interface
    ├── goals.html        # Goals management page
    ├── recommendations.html # AI recommendations page
    ├── settings.html     # User settings page
    ├── styles.css        # Application styling
    ├── app.js            # Main dashboard JavaScript
    ├── goals.js          # Goals page JavaScript
    ├── recommendations.js # Recommendations page JavaScript
    └── settings.js       # Settings page JavaScript
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

## AI Recommendations

The application integrates with Ollama to provide intelligent health recommendations:

- **Model**: Uses gemma2:2b for fast, local AI processing
- **Triggers**: Recommendations are generated when completing fasting or sleep sessions with notes
- **Processing**: Background processing prevents UI blocking during LLM generation
- **Storage**: Recommendations are queued in the database with status tracking
- **Display**: Dedicated recommendations page with real-time status updates

### Prerequisites

- Ollama must be installed and running on the server
- gemma2:2b model must be available (`ollama pull gemma2:2b`)
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
- **Database**: SQLite (`health_track.db`) with tables for weight entries, fasting sessions, and goals
- **Frontend**: Vanilla HTML/CSS/JavaScript in `public/` directory
- **Database Setup**: `scripts/init-db.js` creates the database schema

### Database Schema

- `weight_entries`: Tracks daily weight logs with optional notes
- `fasting_sessions`: Records intermittent fasting sessions with start/end times
- `goals`: Stores weight loss goals and progress tracking

### API Endpoints

- `GET/POST /api/weight` - Weight entry management
- `GET /api/fasting`, `POST /api/fasting/start`, `PATCH /api/fasting/:id/end` - Fasting session management
- `GET/POST /api/goals` - Goal setting and retrieval
- `GET /api/stats` - Dashboard statistics
- `GET /api/fasting/current` - Current active fasting session

### File Structure

```
├── server.js              # Express server and API routes
├── package.json           # Dependencies and scripts
├── health_track.db        # SQLite database (created after init-db)
├── scripts/
│   └── init-db.js        # Database initialization
└── public/               # Static frontend files
    ├── index.html        # Main application interface
    ├── styles.css        # Application styling
    └── app.js            # Frontend JavaScript logic
```

## Features

- Weight tracking with progress visualization
- Intermittent fasting timer (16:8, 18:6, 20:4, 24h options)
- Goal setting and progress monitoring
- Historical data display
- Responsive design for mobile/desktop
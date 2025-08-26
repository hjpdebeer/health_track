# Health Tracker - Deployment Guide

The Health Tracker is deployed as a systemd service for persistent operation.

## Service Management

### Basic Commands
```bash
# Check service status
sudo systemctl status health-tracker

# Start the service
sudo systemctl start health-tracker

# Stop the service
sudo systemctl stop health-tracker

# Restart the service
sudo systemctl restart health-tracker

# View logs
sudo journalctl -u health-tracker -f

# View recent logs
sudo journalctl -u health-tracker --since "1 hour ago"
```

### Service Configuration
- **Service File**: `/etc/systemd/system/health-tracker.service`
- **Working Directory**: `/home/serveradmin/health_track`
- **User**: `serveradmin`
- **Port**: `3000`

### Access Points
- **Local**: http://localhost:3000
- **Network**: http://192.168.1.150:3000  
- **Tailscale**: http://100.91.118.79:3000

### Features
- ✅ **Auto-start** on system boot
- ✅ **Auto-restart** on failure (10-second delay)
- ✅ **Logging** to system journal
- ✅ **Graceful shutdown** handling

### Updating the Application
1. Stop the service: `sudo systemctl stop health-tracker`
2. Pull latest changes: `git pull origin master`
3. Install dependencies: `npm install`
4. Start the service: `sudo systemctl start health-tracker`

### Troubleshooting
- Check logs: `sudo journalctl -u health-tracker --no-pager`
- Verify port availability: `sudo lsof -i :3000`
- Test manual start: `cd /home/serveradmin/health_track && node server.js`
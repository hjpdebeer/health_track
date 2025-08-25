class HealthTracker {
  constructor() {
    this.currentFast = null;
    this.fastTimer = null;
    this.settings = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadStats();
    await this.loadWeightHistory();
    await this.loadFastingHistory();
    await this.checkCurrentFast();
    this.setDefaultDate();
  }

  setupEventListeners() {
    // Weight form
    document.getElementById('weight-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.logWeight();
    });

    // Goal form
    document.getElementById('goal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.setGoal();
    });

    // Fasting controls
    document.getElementById('start-fast').addEventListener('click', (e) => {
      e.preventDefault();
      this.startFast();
    });

    // Fasting end controls
    document.getElementById('end-fast-now').addEventListener('click', (e) => {
      e.preventDefault();
      this.endFastNow();
    });

    document.getElementById('complete-fast').addEventListener('click', (e) => {
      e.preventDefault();
      this.completeFast();
    });
  }

  setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    // Weight form
    document.getElementById('weight-date').value = today;
    
    // Goal form
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 3);
    document.getElementById('target-date').value = nextMonth.toISOString().split('T')[0];
    
    // Fasting form defaults
    document.getElementById('fast-start-date').value = today;
    document.getElementById('fast-start-time').value = currentTime;
    document.getElementById('break-date').value = today;
    document.getElementById('break-time').value = currentTime;
  }

  async loadStats() {
    try {
      const response = await fetch('/api/stats');
      const stats = await response.json();
      
      // Store settings for later use
      this.settings = stats.settings;
      
      const weightUnit = this.settings?.weight_unit || 'lbs';
      
      document.getElementById('current-weight').textContent = 
        stats.currentWeight ? `${stats.currentWeight} ${weightUnit}` : '--';
      
      document.getElementById('goal-weight').textContent = 
        stats.goal ? `${stats.goal.target_weight} ${weightUnit}` : '--';
      
      document.getElementById('progress').textContent = 
        stats.progress ? `${stats.progress.toFixed(1)}%` : '--';
      
      // Update BMI display
      document.getElementById('bmi-value').textContent = stats.bmi || '--';
      
      // Update BMI color based on value
      const bmiElement = document.getElementById('bmi-value');
      if (stats.bmi) {
        const bmiValue = parseFloat(stats.bmi);
        bmiElement.className = this.getBmiCategory(bmiValue);
      }
      
      // Update form placeholders with units
      this.updateFormLabels();
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  getBmiCategory(bmi) {
    if (bmi < 18.5) return 'bmi-underweight';
    if (bmi < 25) return 'bmi-normal';
    if (bmi < 30) return 'bmi-overweight';
    return 'bmi-obese';
  }

  updateFormLabels() {
    if (!this.settings) return;
    
    const weightUnit = this.settings.weight_unit;
    const heightUnit = this.settings.height_unit;
    
    // Update weight input placeholder
    const weightInput = document.getElementById('weight-input');
    weightInput.placeholder = `Weight (${weightUnit})`;
    
    // Update target weight input placeholder
    const targetWeightInput = document.getElementById('target-weight');
    targetWeightInput.placeholder = `Target Weight (${weightUnit})`;
  }

  async logWeight() {
    const weight = document.getElementById('weight-input').value;
    const date = document.getElementById('weight-date').value;
    const notes = document.getElementById('weight-notes').value;

    try {
      const response = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight: parseFloat(weight), date, notes })
      });

      if (response.ok) {
        document.getElementById('weight-form').reset();
        this.setDefaultDate();
        await this.loadStats();
        await this.loadWeightHistory();
        this.showMessage('Weight logged successfully!', 'success');
      }
    } catch (error) {
      console.error('Error logging weight:', error);
      this.showMessage('Error logging weight', 'error');
    }
  }

  async setGoal() {
    const targetWeight = document.getElementById('target-weight').value;
    const targetDate = document.getElementById('target-date').value;

    // Get current weight as start weight
    const statsResponse = await fetch('/api/stats');
    const stats = await statsResponse.json();

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_weight: parseFloat(targetWeight),
          start_weight: stats.currentWeight,
          target_date: targetDate
        })
      });

      if (response.ok) {
        document.getElementById('goal-form').reset();
        this.setDefaultDate();
        await this.loadStats();
        this.showMessage('Goal set successfully!', 'success');
      }
    } catch (error) {
      console.error('Error setting goal:', error);
      this.showMessage('Error setting goal', 'error');
    }
  }

  async startFast() {
    const duration = document.getElementById('fasting-duration').value;
    const startDate = document.getElementById('fast-start-date').value;
    const startTime = document.getElementById('fast-start-time').value;

    if (!startDate || !startTime) {
      this.showMessage('Please select start date and time', 'error');
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();

    try {
      const response = await fetch('/api/fasting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target_hours: parseInt(duration),
          start_time: startDateTime
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.currentFast = data;
        this.updateFastingUI();
        this.startFastTimer();
        this.showMessage('Fast started!', 'success');
      }
    } catch (error) {
      console.error('Error starting fast:', error);
      this.showMessage('Error starting fast', 'error');
    }
  }

  async endFastNow() {
    if (!this.currentFast) {
      this.showMessage('No active fast to end', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/fasting/${this.currentFast.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          end_time: new Date().toISOString(),
          notes: 'Ended early'
        })
      });

      if (response.ok) {
        this.currentFast = null;
        this.stopFastTimer();
        this.updateFastingUI();
        await this.loadFastingHistory();
        const data = await response.json();
        this.showMessage(`Fast ended! Duration: ${data.actual_hours?.toFixed(1)} hours`, 'success');
      } else {
        this.showMessage('Error ending fast', 'error');
      }
    } catch (error) {
      console.error('Error ending fast:', error);
      this.showMessage('Error ending fast', 'error');
    }
  }

  async completeFast() {
    if (!this.currentFast) {
      this.showMessage('No active fast to complete', 'error');
      return;
    }

    const breakDate = document.getElementById('break-date').value;
    const breakTime = document.getElementById('break-time').value;
    const notes = document.getElementById('fast-notes').value;

    if (!breakDate || !breakTime) {
      this.showMessage('Please select break date and time', 'error');
      return;
    }

    const breakDateTime = new Date(`${breakDate}T${breakTime}`).toISOString();

    try {
      const response = await fetch(`/api/fasting/${this.currentFast.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          end_time: breakDateTime,
          notes: notes
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.currentFast = null;
        this.stopFastTimer();
        this.updateFastingUI();
        await this.loadFastingHistory();
        
        // Clear the break fast form
        document.getElementById('fast-notes').value = '';
        this.setDefaultDate();
        
        this.showMessage(`Fast completed! Duration: ${data.actual_hours?.toFixed(1)} hours`, 'success');
      } else {
        this.showMessage('Error completing fast', 'error');
      }
    } catch (error) {
      console.error('Error completing fast:', error);
      this.showMessage('Error completing fast', 'error');
    }
  }

  async checkCurrentFast() {
    try {
      const response = await fetch('/api/fasting/current');
      const fast = await response.json();
      
      if (fast) {
        this.currentFast = fast;
        this.updateFastingUI();
        this.startFastTimer();
      }
    } catch (error) {
      console.error('Error checking current fast:', error);
    }
  }

  updateFastingUI() {
    const isActive = this.currentFast !== null;
    
    // Toggle sections within the unified pane
    document.getElementById('start-fasting-section').style.display = isActive ? 'none' : 'block';
    document.getElementById('active-fast-section').style.display = isActive ? 'block' : 'none';
    
    // Update title based on state
    const title = document.getElementById('fasting-title');
    title.textContent = isActive ? '🔄 Active Fast' : '⏰ Fasting Manager';
    
    // Update status
    document.getElementById('fast-status').textContent = 
      isActive ? 'Fasting in progress' : 'Not fasting';
    
    // If we have an active fast, populate the display
    if (isActive && this.currentFast) {
      const startTime = new Date(this.currentFast.start_time);
      document.getElementById('fast-start-display').textContent = 
        startTime.toLocaleString();
      document.getElementById('fast-duration-display').textContent = 
        this.currentFast.target_hours;
        
      // Set default break date/time to current time for convenience
      this.setDefaultBreakTime();
    }
  }
  
  setDefaultBreakTime() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    document.getElementById('break-date').value = today;
    document.getElementById('break-time').value = currentTime;
  }

  startFastTimer() {
    if (!this.currentFast) return;

    this.fastTimer = setInterval(() => {
      this.updateTimer();
    }, 1000);
    
    this.updateTimer();
  }

  stopFastTimer() {
    if (this.fastTimer) {
      clearInterval(this.fastTimer);
      this.fastTimer = null;
    }
  }

  updateTimer() {
    if (!this.currentFast) return;

    const startTime = new Date(this.currentFast.start_time);
    const now = new Date();
    const elapsed = now - startTime;
    const targetMs = this.currentFast.target_hours * 60 * 60 * 1000;
    const remaining = Math.max(0, targetMs - elapsed);

    if (remaining === 0) {
      this.showMessage('Fast completed! 🎉', 'success');
      this.stopFastTimer();
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    document.getElementById('time-remaining').textContent = 
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    const progress = Math.min(100, ((targetMs - remaining) / targetMs) * 100);
    document.getElementById('progress-fill').style.width = `${progress}%`;
  }

  async loadWeightHistory() {
    try {
      const response = await fetch('/api/weight');
      const weights = await response.json();
      
      const historyDiv = document.getElementById('weight-history');
      historyDiv.innerHTML = '';
      
      const weightUnit = this.settings?.weight_unit || 'lbs';
      
      weights.slice(0, 5).forEach(entry => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
          <span>${new Date(entry.date).toLocaleDateString()}</span>
          <span>${entry.weight} ${weightUnit}</span>
          ${entry.notes ? `<span class="notes">${entry.notes}</span>` : ''}
        `;
        historyDiv.appendChild(div);
      });

      this.drawWeightChart(weights);
    } catch (error) {
      console.error('Error loading weight history:', error);
    }
  }

  async loadFastingHistory() {
    try {
      const response = await fetch('/api/fasting');
      const fasts = await response.json();
      
      const historyDiv = document.getElementById('fasting-history');
      historyDiv.innerHTML = '';
      
      fasts.slice(0, 5).forEach(fast => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        const startDate = new Date(fast.start_time).toLocaleDateString();
        const status = fast.completed ? '✅ Completed' : '⏳ In Progress';
        
        let durationText = `${fast.target_hours}h target`;
        if (fast.actual_hours && fast.completed) {
          durationText = `${fast.actual_hours.toFixed(1)}h actual (${fast.target_hours}h target)`;
        }
        
        div.innerHTML = `
          <span>${startDate}</span>
          <span>${durationText}</span>
          <span class="status">${status}</span>
          ${fast.notes ? `<span class="notes">${fast.notes}</span>` : ''}
        `;
        historyDiv.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading fasting history:', error);
    }
  }

  drawWeightChart(weights) {
    const canvas = document.getElementById('weight-canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (weights.length < 2) return;

    // Prepare data (reverse to show chronologically)
    const data = weights.reverse().slice(-10);
    const values = data.map(w => w.weight);
    const minWeight = Math.min(...values) - 2;
    const maxWeight = Math.max(...values) + 2;
    
    // Draw chart
    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    
    // Draw axes
    ctx.strokeStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw line
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = canvas.height - padding - ((point.weight - minWeight) / (maxWeight - minWeight)) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // Draw point
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    
    ctx.stroke();
  }

  showMessage(message, type = 'info') {
    // Create or update message element
    let messageEl = document.getElementById('message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'message';
      document.body.appendChild(messageEl);
    }
    
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HealthTracker();
});
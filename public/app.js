class HealthTracker {
  constructor() {
    this.currentFast = null;
    this.fastTimer = null;
    this.currentSleep = null;
    this.sleepTimer = null;
    this.settings = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadStats();
    await this.loadWeightHistory();
    await this.loadFastingHistory();
    await this.loadSleepHistory();
    await this.checkCurrentFast();
    await this.checkCurrentSleep();
    this.setDefaultDate();
  }

  setupEventListeners() {
    // Weight form
    document.getElementById('weight-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.logWeight();
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
      console.log('Complete fast button clicked');
      e.preventDefault();
      this.completeFast();
    });

    // Sleep controls
    document.getElementById('start-sleep').addEventListener('click', (e) => {
      e.preventDefault();
      this.startSleep();
    });

    // Sleep end controls
    document.getElementById('end-sleep-now').addEventListener('click', (e) => {
      e.preventDefault();
      this.endSleepNow();
    });

    document.getElementById('complete-sleep').addEventListener('click', (e) => {
      e.preventDefault();
      this.completeSleep();
    });
  }

  setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    // Weight form
    document.getElementById('weight-date').value = today;
    
    
    // Fasting form defaults
    document.getElementById('fast-start-date').value = today;
    document.getElementById('fast-start-time').value = currentTime;
    document.getElementById('break-date').value = today;
    document.getElementById('break-time').value = currentTime;
    
    // Sleep form defaults
    document.getElementById('sleep-start-date').value = today;
    document.getElementById('sleep-start-time').value = currentTime;
    document.getElementById('wake-date').value = today;
    document.getElementById('wake-time').value = currentTime;
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
        console.log('Fast started successfully:', data);
        this.currentFast = data;
        console.log('Set currentFast to:', this.currentFast);
        this.updateFastingUI();
        this.startFastTimer();
        this.showMessage('Fast started!', 'success');
      } else {
        console.error('Failed to start fast, response not ok:', response.status);
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
        this.showMessage(`Fast ended! Duration: ${data.actual_hours?.toFixed(1)} Hours`, 'success');
      } else {
        this.showMessage('Error ending fast', 'error');
      }
    } catch (error) {
      console.error('Error ending fast:', error);
      this.showMessage('Error ending fast', 'error');
    }
  }

  async completeFast() {
    console.log('completeFast() called, currentFast:', this.currentFast);
    
    if (!this.currentFast) {
      console.error('No currentFast found when trying to complete');
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
        console.log('Fast completion response:', data);
        
        this.currentFast = null;
        this.stopFastTimer();
        this.updateFastingUI();
        await this.loadFastingHistory();
        
        // Clear the break fast form
        document.getElementById('fast-notes').value = '';
        this.setDefaultDate();
        
        this.showMessage(`Fast completed! Duration: ${data.actual_hours?.toFixed(1)} Hours`, 'success');
        
        // Show message about background processing
        if (data.recommendation_id) {
          console.log('Recommendation queued with ID:', data.recommendation_id);
          this.showMessage(`${data.message} Check the AI Recommendations page in a few moments.`, 'success');
        } else {
          console.log('No notes provided, no recommendation queued');
        }
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
    const fastStatusEl = document.getElementById('fast-status');
    if (fastStatusEl) {
      fastStatusEl.textContent = isActive ? 'Fasting In Progress' : 'Not Fasting';
    }
    
    // Update sleep status (if element exists)
    const sleepStatusEl = document.getElementById('sleep-status');
    if (sleepStatusEl) {
      sleepStatusEl.textContent = this.currentSleep ? 'Sleeping In Progress' : 'Not Sleeping';
    }
    
    // If we have an active fast, populate the display
    if (isActive && this.currentFast) {
      const startTime = new Date(this.currentFast.start_time);
      
      const startDisplayEl = document.getElementById('fast-start-display');
      if (startDisplayEl) {
        startDisplayEl.textContent = startTime.toLocaleString();
      }
      
      const durationDisplayEl = document.getElementById('fast-duration-display');
      if (durationDisplayEl) {
        durationDisplayEl.textContent = `${this.currentFast.target_hours} Hours`;
      }
        
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
          <div class="history-item-content">
            <span>${new Date(entry.date).toLocaleDateString()}</span>
            <span>${entry.weight} ${weightUnit}</span>
            ${entry.notes ? `<span class="notes">${entry.notes}</span>` : ''}
          </div>
          <div class="history-item-actions">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="healthTracker.editWeightEntry(${entry.id})">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="healthTracker.deleteWeightEntry(${entry.id})">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
        historyDiv.appendChild(div);
      });

      await this.drawWeightChart(weights);
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
          <div class="history-item-content">
            <span>${startDate}</span>
            <span>${durationText}</span>
            <span class="status">${status}</span>
            ${fast.notes ? `<span class="notes">${fast.notes}</span>` : ''}
          </div>
          <div class="history-item-actions">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="healthTracker.editFastingEntry(${fast.id})">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="healthTracker.deleteFastingEntry(${fast.id})">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
        historyDiv.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading fasting history:', error);
    }
  }

  async drawWeightChart(weights) {
    const canvas = document.getElementById('weight-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set up high DPI canvas for crisp rendering
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    if (weights.length < 1) return;

    // Fetch goal data for target weight line
    let goal = null;
    try {
      const goalResponse = await fetch('/api/goals');
      goal = await goalResponse.json();
    } catch (error) {
      console.error('Error fetching goal data for chart:', error);
    }

    // Prepare data (reverse to show chronologically)
    const data = weights.reverse().slice(-10);
    const values = data.map(w => w.weight);
    
    // Include goal weight in range calculation if available
    const goalWeight = goal?.target_weight;
    const startWeight = goal?.start_weight || (data.length > 0 ? data[0].weight : null);
    let minWeight = Math.min(...values);
    let maxWeight = Math.max(...values);
    
    if (goalWeight) {
      minWeight = Math.min(minWeight, goalWeight);
      maxWeight = Math.max(maxWeight, goalWeight);
    }
    if (startWeight) {
      minWeight = Math.min(minWeight, startWeight);
      maxWeight = Math.max(maxWeight, startWeight);
    }
    
    // Add padding to range
    const range = maxWeight - minWeight;
    minWeight -= range * 0.1;
    maxWeight += range * 0.1;
    
    // Draw chart
    const padding = 80; // Increased for axis labels
    const legendHeight = 60; // Increased for better spacing
    const width = rect.width - padding * 2;
    const height = rect.height - padding * 2 - legendHeight;
    
    // Calculate weeks from first measurement to goal date (or current date if no goal)
    const startDate = new Date(data[0].date);
    const endDate = goal?.target_date ? new Date(goal.target_date) : new Date();
    const totalWeeks = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 7));
    
    // Draw axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, rect.height - padding - legendHeight);
    ctx.lineTo(rect.width - padding, rect.height - padding - legendHeight);
    ctx.stroke();
    
    // Draw Y-axis labels (weight values)
    ctx.fillStyle = '#666';
    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'right';
    
    const weightUnit = this.settings?.weight_unit || 'kg';
    const numYLabels = 5;
    for (let i = 0; i <= numYLabels; i++) {
      const weight = minWeight + (maxWeight - minWeight) * (i / numYLabels);
      const y = padding + ((maxWeight - weight) / (maxWeight - minWeight)) * height;
      
      // Draw tick mark
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 5, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
      
      // Draw label
      ctx.fillText(`${weight.toFixed(1)} ${weightUnit}`, padding - 10, y + 4);
    }
    
    // Draw X-axis labels (week numbers)
    ctx.textAlign = 'center';
    // Limit to max 6 labels to prevent overlap, minimum 2
    const numXLabels = Math.min(6, Math.max(2, Math.floor(totalWeeks / 8)));
    
    for (let i = 0; i <= numXLabels; i++) {
      const weekNumber = Math.floor((totalWeeks * i) / numXLabels);
      const x = padding + (i / numXLabels) * width;
      
      // Draw tick mark
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, rect.height - padding - legendHeight);
      ctx.lineTo(x, rect.height - padding - legendHeight + 5);
      ctx.stroke();
      
      // Draw label
      ctx.fillText(`Week ${weekNumber}`, x, rect.height - padding - legendHeight + 20);
    }
    
    // Add axis titles
    ctx.font = '14px Segoe UI';
    ctx.fillStyle = '#333';
    
    // Y-axis title
    ctx.save();
    ctx.translate(20, rect.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`Weight (${weightUnit})`, 0, 0);
    ctx.restore();
    
    // X-axis title
    ctx.textAlign = 'center';
    ctx.fillText('Progress Timeline', rect.width / 2, rect.height - 15);
    
    // Handle single data point display
    if (data.length === 1) {
      // Draw a large dot for single data point
      ctx.fillStyle = '#0078d4';
      const x = padding + width / 2;
      const y = padding + ((maxWeight - data[0].weight) / (maxWeight - minWeight)) * height;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add message
      ctx.fillStyle = '#666';
      ctx.font = '16px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText('Add more weight entries to see progress trends', rect.width / 2, padding + height / 2 + 40);
    }
    
    // Draw actual weight line (blue)
    if (data.length > 1) {
      ctx.strokeStyle = '#0078d4'; // Blue color
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      data.forEach((point, index) => {
        const x = padding + (index / Math.max(data.length - 1, 1)) * width;
        const y = padding + ((maxWeight - point.weight) / (maxWeight - minWeight)) * height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        // Draw point
        ctx.fillStyle = '#0078d4';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
      
      ctx.stroke();
    }
    
    // Draw target weight line (orange) if goal exists and we have multiple data points
    if (goal && goal.target_weight && goal.target_date && data.length > 1) {
      // Use start_weight from goal, or fallback to first weight entry if not set
      const actualStartWeight = goal.start_weight || data[0].weight;
      const startDate = new Date(data[0].date);
      const targetDate = new Date(goal.target_date);
      const totalDays = Math.ceil((targetDate - startDate) / (1000 * 60 * 60 * 24));
      
      if (totalDays > 0) {
        ctx.strokeStyle = '#ff8c00'; // Orange color
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Calculate target weight points for each data point date
        data.forEach((point, index) => {
          const currentDate = new Date(point.date);
          const daysPassed = Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));
          const progress = Math.min(daysPassed / totalDays, 1);
          
          // Linear interpolation from start weight to target weight
          const targetWeightAtDate = actualStartWeight + (goal.target_weight - actualStartWeight) * progress;
          
          const x = padding + (index / Math.max(data.length - 1, 1)) * width;
          const y = padding + ((maxWeight - targetWeightAtDate) / (maxWeight - minWeight)) * height;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
      }
    }
    
    // Draw legend
    const legendY = rect.height - legendHeight + 25;
    ctx.font = '14px Segoe UI';
    ctx.textAlign = 'left';
    
    // Actual weight legend
    ctx.fillStyle = '#0078d4';
    ctx.fillRect(padding, legendY, 20, 3);
    ctx.fillStyle = '#333';
    ctx.fillText('Actual Weight', padding + 30, legendY + 12);
    
    // Target weight legend (only if goal exists)
    if (goal && goal.target_weight) {
      const legendX2 = padding + 180;
      ctx.fillStyle = '#ff8c00';
      ctx.fillRect(legendX2, legendY, 20, 3);
      ctx.fillStyle = '#333';
      ctx.fillText('Target Weight', legendX2 + 30, legendY + 12);
    }
  }

  async startSleep() {
    const startDate = document.getElementById('sleep-start-date').value;
    const startTime = document.getElementById('sleep-start-time').value;

    if (!startDate || !startTime) {
      this.showMessage('Please select bedtime date and time', 'error');
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();

    try {
      const response = await fetch('/api/sleep/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: startDateTime })
      });

      if (response.ok) {
        const data = await response.json();
        this.currentSleep = data;
        this.updateSleepUI();
        this.startSleepTimer();
        this.showMessage('Sleep started!', 'success');
      }
    } catch (error) {
      console.error('Error starting sleep:', error);
      this.showMessage('Error starting sleep', 'error');
    }
  }

  async endSleepNow() {
    if (!this.currentSleep) {
      this.showMessage('No active sleep to end', 'error');
      return;
    }

    try {
      console.log('endSleepNow - Sending request to:', `/api/sleep/${this.currentSleep.id}/end`);
      
      const response = await fetch(`/api/sleep/${this.currentSleep.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          end_time: new Date().toISOString(),
          notes: 'Woke up now'
        })
      });
      
      console.log('endSleepNow response status:', response.status);
      console.log('endSleepNow response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('endSleepNow response:', data);
        
        this.currentSleep = null;
        this.stopSleepTimer();
        this.updateSleepUI();
        
        console.log('About to load sleep history...');
        await this.loadSleepHistory();
        console.log('Sleep history loaded');
        
        this.showMessage(`Sleep ended! Duration: ${data.actual_hours?.toFixed(1)} Hours`, 'success');
      } else {
        this.showMessage('Error ending sleep', 'error');
      }
    } catch (error) {
      console.error('Error ending sleep:', error);
      this.showMessage('Error ending sleep', 'error');
    }
  }

  async completeSleep() {
    if (!this.currentSleep) {
      this.showMessage('No active sleep to complete', 'error');
      return;
    }

    const wakeDate = document.getElementById('wake-date').value;
    const wakeTime = document.getElementById('wake-time').value;
    const notes = document.getElementById('sleep-notes').value;

    if (!wakeDate || !wakeTime) {
      this.showMessage('Please select wake date and time', 'error');
      return;
    }

    const wakeDateTime = new Date(`${wakeDate}T${wakeTime}`).toISOString();

    try {
      console.log('Sending sleep completion request to:', `/api/sleep/${this.currentSleep.id}/end`);
      console.log('Request body:', { end_time: wakeDateTime, notes: notes });
      
      const response = await fetch(`/api/sleep/${this.currentSleep.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          end_time: wakeDateTime,
          notes: notes
        })
      });
      
      console.log('Sleep completion response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('completeSleep response:', data);
        
        this.currentSleep = null;
        this.stopSleepTimer();
        this.updateSleepUI();
        
        console.log('About to load sleep history from completeSleep...');
        await this.loadSleepHistory();
        console.log('Sleep history loaded from completeSleep');
        
        // Clear the sleep form
        document.getElementById('sleep-notes').value = '';
        this.setDefaultDate();
        
        this.showMessage(`Sleep completed! Duration: ${data.actual_hours?.toFixed(1)} Hours`, 'success');
        
        // Show message about background processing
        if (data.recommendation_id) {
          console.log('Sleep recommendation queued with ID:', data.recommendation_id);
          this.showMessage(`${data.message} Check the AI Recommendations page in a few moments.`, 'success');
        } else {
          console.log('No notes provided, no sleep recommendation queued');
        }
      } else {
        this.showMessage('Error completing sleep', 'error');
      }
    } catch (error) {
      console.error('Error completing sleep:', error);
      this.showMessage('Error completing sleep', 'error');
    }
  }

  async checkCurrentSleep() {
    try {
      const response = await fetch('/api/sleep/current');
      const sleep = await response.json();
      
      if (sleep) {
        this.currentSleep = sleep;
        this.updateSleepUI();
        this.startSleepTimer();
      }
    } catch (error) {
      console.error('Error checking current sleep:', error);
    }
  }

  updateSleepUI() {
    const isActive = this.currentSleep !== null;
    
    // Toggle sections within the unified pane
    document.getElementById('start-sleep-section').style.display = isActive ? 'none' : 'block';
    document.getElementById('active-sleep-section').style.display = isActive ? 'block' : 'none';
    
    // Update title based on state
    const title = document.getElementById('sleep-title');
    title.textContent = isActive ? '💤 Active Sleep' : '😴 Sleep Manager';
    
    // Update status (if element exists)
    const sleepStatusEl = document.getElementById('sleep-status');
    if (sleepStatusEl) {
      sleepStatusEl.textContent = isActive ? 'Sleeping In Progress' : 'Not Sleeping';
    }
    
    // If we have an active sleep, populate the display
    if (isActive && this.currentSleep) {
      const startTime = new Date(this.currentSleep.start_time);
      
      const sleepStartDisplayEl = document.getElementById('sleep-start-display');
      if (sleepStartDisplayEl) {
        sleepStartDisplayEl.textContent = startTime.toLocaleString();
      }
        
      // Set default wake date/time to current time for convenience
      this.setDefaultWakeTime();
    }
  }
  
  setDefaultWakeTime() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    document.getElementById('wake-date').value = today;
    document.getElementById('wake-time').value = currentTime;
  }

  startSleepTimer() {
    if (!this.currentSleep) return;

    this.sleepTimer = setInterval(() => {
      this.updateSleepDisplay();
    }, 1000);
    
    this.updateSleepDisplay();
  }

  stopSleepTimer() {
    if (this.sleepTimer) {
      clearInterval(this.sleepTimer);
      this.sleepTimer = null;
    }
  }

  updateSleepDisplay() {
    if (!this.currentSleep) return;

    const startTime = new Date(this.currentSleep.start_time);
    const now = new Date();
    const elapsed = now - startTime;

    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    
    document.getElementById('sleep-duration-display').textContent = 
      `${hours}h ${minutes}m`;
  }

  async loadSleepHistory() {
    console.log('loadSleepHistory() called');
    try {
      const response = await fetch('/api/sleep');
      console.log('Sleep API response status:', response.status);
      
      const sleeps = await response.json();
      console.log('Sleep data received:', sleeps);
      
      const historyDiv = document.getElementById('sleep-history');
      if (!historyDiv) {
        console.error('sleep-history element not found!');
        return;
      }
      
      historyDiv.innerHTML = '';
      console.log('Cleared sleep history div, processing', sleeps.length, 'sleep sessions');
      
      sleeps.slice(0, 5).forEach(sleep => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        const startDate = new Date(sleep.start_time).toLocaleDateString();
        const status = sleep.completed ? '✅ Completed' : '⏳ In Progress';
        
        let durationText = 'In progress';
        if (sleep.actual_hours && sleep.completed) {
          durationText = `${sleep.actual_hours.toFixed(1)}h sleep`;
        }
        
        div.innerHTML = `
          <div class="history-item-content">
            <span>${startDate}</span>
            <span>${durationText}</span>
            <span class="status">${status}</span>
            ${sleep.notes ? `<span class="notes">${sleep.notes}</span>` : ''}
          </div>
          <div class="history-item-actions">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="healthTracker.editSleepEntry(${sleep.id})">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="healthTracker.deleteSleepEntry(${sleep.id})">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
        historyDiv.appendChild(div);
      });

      this.drawSleepChart(sleeps);
    } catch (error) {
      console.error('Error loading sleep history:', error);
    }
  }

  drawSleepChart(sleeps) {
    const canvas = document.getElementById('sleep-canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const completedSleeps = sleeps.filter(s => s.completed && s.actual_hours);
    if (completedSleeps.length < 2) return;

    // Prepare data (reverse to show chronologically)
    const data = completedSleeps.reverse().slice(-10);
    const values = data.map(s => s.actual_hours);
    const minHours = Math.max(0, Math.min(...values) - 1);
    const maxHours = Math.max(...values) + 1;
    
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
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = canvas.height - padding - ((point.actual_hours - minHours) / (maxHours - minHours)) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // Draw point
      ctx.fillStyle = '#6366F1';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    
    ctx.stroke();
  }

  showRecommendation(recommendation, sessionType) {
    console.log('showRecommendation called:', { recommendation, sessionType });
    
    try {
      // Update modal title based on session type
      const titleEl = document.getElementById('recommendationModalLabel');
      if (titleEl) {
        titleEl.innerHTML = `<i class="bi bi-lightbulb me-2"></i>Smart ${sessionType} Recommendation`;
      }
      
      // Set the recommendation text
      const textEl = document.getElementById('recommendationText');
      if (textEl) {
        textEl.textContent = recommendation;
      }
      
      // Show the modal
      const modalEl = document.getElementById('recommendationModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
        console.log('Modal shown successfully');
      } else {
        console.error('Bootstrap modal not available or modal element not found');
        // Fallback: show alert
        alert(`AI Recommendation: ${recommendation}`);
      }
    } catch (error) {
      console.error('Error showing recommendation:', error);
      // Fallback: show alert
      alert(`AI Recommendation: ${recommendation}`);
    }
  }

  // Weight entry management
  async editWeightEntry(id) {
    try {
      const response = await fetch('/api/weight');
      const weights = await response.json();
      const weight = weights.find(w => w.id === id);
      
      if (!weight) {
        this.showMessage('Weight entry not found', 'error');
        return;
      }
      
      // Populate modal with existing data
      document.getElementById('edit-weight-id').value = weight.id;
      document.getElementById('edit-weight-value').value = weight.weight;
      document.getElementById('edit-weight-date').value = weight.date;
      document.getElementById('edit-weight-notes').value = weight.notes || '';
      
      // Update the weight unit display
      const weightUnit = this.settings?.weight_unit || 'lbs';
      document.getElementById('edit-weight-unit').textContent = weightUnit;
      
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('editWeightModal'));
      modal.show();
    } catch (error) {
      console.error('Error loading weight entry:', error);
      this.showMessage('Error loading weight entry', 'error');
    }
  }
  
  async saveWeightEdit() {
    const id = document.getElementById('edit-weight-id').value;
    const weight = parseFloat(document.getElementById('edit-weight-value').value);
    const date = document.getElementById('edit-weight-date').value;
    const notes = document.getElementById('edit-weight-notes').value;
    
    if (!weight || !date) {
      this.showMessage('Weight and date are required', 'error');
      return;
    }
    
    if (weight <= 0) {
      this.showMessage('Please enter a valid weight', 'error');
      return;
    }
    
    try {
      const response = await fetch(`/api/weight/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight: weight,
          date: date,
          notes: notes
        })
      });
      
      if (response.ok) {
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('editWeightModal')).hide();
        // Refresh history and stats
        await this.loadWeightHistory();
        await this.loadStats();
        this.showMessage('Weight entry updated successfully', 'success');
      } else {
        this.showMessage('Error updating weight entry', 'error');
      }
    } catch (error) {
      console.error('Error updating weight entry:', error);
      this.showMessage('Error updating weight entry', 'error');
    }
  }
  
  async deleteWeightEntry(id) {
    if (!confirm('Are you sure you want to delete this weight entry? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/weight/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await this.loadWeightHistory();
        await this.loadStats();
        this.showMessage('Weight entry deleted successfully', 'success');
      } else {
        this.showMessage('Error deleting weight entry', 'error');
      }
    } catch (error) {
      console.error('Error deleting weight entry:', error);
      this.showMessage('Error deleting weight entry', 'error');
    }
  }

  // Sleep entry management
  async editSleepEntry(id) {
    try {
      const response = await fetch('/api/sleep');
      const sleeps = await response.json();
      const sleep = sleeps.find(s => s.id === id);
      
      if (!sleep) {
        this.showMessage('Sleep entry not found', 'error');
        return;
      }
      
      // Populate modal with existing data
      document.getElementById('edit-sleep-id').value = sleep.id;
      
      // Parse start time
      const startDate = new Date(sleep.start_time);
      document.getElementById('edit-sleep-start-date').value = startDate.toISOString().split('T')[0];
      document.getElementById('edit-sleep-start-time').value = startDate.toTimeString().slice(0, 5);
      
      // Parse end time if exists
      if (sleep.end_time) {
        const endDate = new Date(sleep.end_time);
        document.getElementById('edit-sleep-end-date').value = endDate.toISOString().split('T')[0];
        document.getElementById('edit-sleep-end-time').value = endDate.toTimeString().slice(0, 5);
      } else {
        document.getElementById('edit-sleep-end-date').value = '';
        document.getElementById('edit-sleep-end-time').value = '';
      }
      
      document.getElementById('edit-sleep-notes').value = sleep.notes || '';
      
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('editSleepModal'));
      modal.show();
    } catch (error) {
      console.error('Error loading sleep entry:', error);
      this.showMessage('Error loading sleep entry', 'error');
    }
  }
  
  async saveSleepEdit() {
    const id = document.getElementById('edit-sleep-id').value;
    const startDate = document.getElementById('edit-sleep-start-date').value;
    const startTime = document.getElementById('edit-sleep-start-time').value;
    const endDate = document.getElementById('edit-sleep-end-date').value;
    const endTime = document.getElementById('edit-sleep-end-time').value;
    const notes = document.getElementById('edit-sleep-notes').value;
    
    if (!startDate || !startTime) {
      this.showMessage('Start date and time are required', 'error');
      return;
    }
    
    const startDateTime = `${startDate}T${startTime}:00`;
    let endDateTime = null;
    
    if (endDate && endTime) {
      endDateTime = `${endDate}T${endTime}:00`;
    }
    
    try {
      const response = await fetch(`/api/sleep/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startDateTime,
          end_time: endDateTime,
          notes: notes
        })
      });
      
      if (response.ok) {
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('editSleepModal')).hide();
        // Refresh history
        await this.loadSleepHistory();
        this.showMessage('Sleep entry updated successfully', 'success');
      } else {
        this.showMessage('Error updating sleep entry', 'error');
      }
    } catch (error) {
      console.error('Error updating sleep entry:', error);
      this.showMessage('Error updating sleep entry', 'error');
    }
  }
  
  async deleteSleepEntry(id) {
    if (!confirm('Are you sure you want to delete this sleep entry? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sleep/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await this.loadSleepHistory();
        this.showMessage('Sleep entry deleted successfully', 'success');
      } else {
        this.showMessage('Error deleting sleep entry', 'error');
      }
    } catch (error) {
      console.error('Error deleting sleep entry:', error);
      this.showMessage('Error deleting sleep entry', 'error');
    }
  }
  
  // Fasting entry management
  async editFastingEntry(id) {
    try {
      const response = await fetch('/api/fasting');
      const fasts = await response.json();
      const fast = fasts.find(f => f.id === id);
      
      if (!fast) {
        this.showMessage('Fasting entry not found', 'error');
        return;
      }
      
      // Populate modal with existing data
      document.getElementById('edit-fasting-id').value = fast.id;
      document.getElementById('edit-fasting-target').value = fast.target_hours;
      
      // Parse start time
      const startDate = new Date(fast.start_time);
      document.getElementById('edit-fasting-start-date').value = startDate.toISOString().split('T')[0];
      document.getElementById('edit-fasting-start-time').value = startDate.toTimeString().slice(0, 5);
      
      // Parse end time if exists
      if (fast.end_time) {
        const endDate = new Date(fast.end_time);
        document.getElementById('edit-fasting-end-date').value = endDate.toISOString().split('T')[0];
        document.getElementById('edit-fasting-end-time').value = endDate.toTimeString().slice(0, 5);
      } else {
        document.getElementById('edit-fasting-end-date').value = '';
        document.getElementById('edit-fasting-end-time').value = '';
      }
      
      document.getElementById('edit-fasting-notes').value = fast.notes || '';
      
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('editFastingModal'));
      modal.show();
    } catch (error) {
      console.error('Error loading fasting entry:', error);
      this.showMessage('Error loading fasting entry', 'error');
    }
  }
  
  async saveFastingEdit() {
    const id = document.getElementById('edit-fasting-id').value;
    const targetHours = document.getElementById('edit-fasting-target').value;
    const startDate = document.getElementById('edit-fasting-start-date').value;
    const startTime = document.getElementById('edit-fasting-start-time').value;
    const endDate = document.getElementById('edit-fasting-end-date').value;
    const endTime = document.getElementById('edit-fasting-end-time').value;
    const notes = document.getElementById('edit-fasting-notes').value;
    
    if (!startDate || !startTime || !targetHours) {
      this.showMessage('Start date, time, and target duration are required', 'error');
      return;
    }
    
    const startDateTime = `${startDate}T${startTime}:00`;
    let endDateTime = null;
    
    if (endDate && endTime) {
      endDateTime = `${endDate}T${endTime}:00`;
    }
    
    try {
      const response = await fetch(`/api/fasting/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startDateTime,
          end_time: endDateTime,
          target_hours: parseInt(targetHours),
          notes: notes
        })
      });
      
      if (response.ok) {
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('editFastingModal')).hide();
        // Refresh history
        await this.loadFastingHistory();
        this.showMessage('Fasting entry updated successfully', 'success');
      } else {
        this.showMessage('Error updating fasting entry', 'error');
      }
    } catch (error) {
      console.error('Error updating fasting entry:', error);
      this.showMessage('Error updating fasting entry', 'error');
    }
  }
  
  async deleteFastingEntry(id) {
    if (!confirm('Are you sure you want to delete this fasting entry? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/fasting/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await this.loadFastingHistory();
        this.showMessage('Fasting entry deleted successfully', 'success');
      } else {
        this.showMessage('Error deleting fasting entry', 'error');
      }
    } catch (error) {
      console.error('Error deleting fasting entry:', error);
      this.showMessage('Error deleting fasting entry', 'error');
    }
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
let healthTracker;
document.addEventListener('DOMContentLoaded', () => {
  healthTracker = new HealthTracker();
});
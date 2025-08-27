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
        
        this.showMessage(`Fast completed! Duration: ${data.actual_hours?.toFixed(1)} hours`, 'success');
        
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
        durationDisplayEl.textContent = this.currentFast.target_hours;
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
        
        this.showMessage(`Sleep ended! Duration: ${data.actual_hours?.toFixed(1)} hours`, 'success');
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
        
        this.showMessage(`Sleep completed! Duration: ${data.actual_hours?.toFixed(1)} hours`, 'success');
        
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
          <span>${startDate}</span>
          <span>${durationText}</span>
          <span class="status">${status}</span>
          ${sleep.notes ? `<span class="notes">${sleep.notes}</span>` : ''}
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
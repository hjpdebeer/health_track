class GoalsManager {
    constructor() {
        this.isUpdating = false; // Prevent infinite loops during auto-calculations
        this.settings = null; // Store user settings
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadSettings();
        await this.loadCurrentGoals();
    }

    setupEventListeners() {
        // Weight goal form
        const weightGoalForm = document.getElementById('weight-goal-form');
        if (weightGoalForm) {
            weightGoalForm.addEventListener('submit', (e) => this.handleWeightGoalSubmit(e));
        }

        // Sleep goal form
        const sleepGoalForm = document.getElementById('sleep-goal-form');
        if (sleepGoalForm) {
            sleepGoalForm.addEventListener('submit', (e) => this.handleSleepGoalSubmit(e));
        }

        // Update sleep calculations when any field changes
        const sleepHoursInput = document.getElementById('target-sleep-hours');
        const bedtimeInput = document.getElementById('target-bedtime');
        const wakeTimeInput = document.getElementById('target-wake-time');
        
        if (sleepHoursInput && bedtimeInput && wakeTimeInput) {
            // When sleep hours changes, prioritize updating bedtime based on wake time
            sleepHoursInput.addEventListener('input', () => {
                if (wakeTimeInput.value) {
                    this.updateBedtimeFromHoursAndWake();
                } else if (bedtimeInput.value) {
                    this.updateWakeTimeFromHoursAndBedtime();
                }
            });
            
            // When wake time changes, calculate bedtime if hours are set
            wakeTimeInput.addEventListener('change', () => {
                if (sleepHoursInput.value) {
                    this.updateBedtimeFromHoursAndWake();
                } else if (bedtimeInput.value) {
                    this.updateSleepHours();
                }
            });
            
            // When bedtime changes, calculate wake time if hours are set
            bedtimeInput.addEventListener('change', () => {
                if (sleepHoursInput.value) {
                    this.updateWakeTimeFromHoursAndBedtime();
                } else if (wakeTimeInput.value) {
                    this.updateSleepHours();
                }
            });
        }
    }

    updateSleepHours() {
        const bedtime = document.getElementById('target-bedtime').value;
        const wakeTime = document.getElementById('target-wake-time').value;
        
        if (bedtime && wakeTime && !this.isUpdating) {
            this.isUpdating = true;
            const bedtimeDate = new Date(`2000-01-01 ${bedtime}`);
            let wakeTimeDate = new Date(`2000-01-01 ${wakeTime}`);
            
            // If wake time is earlier than bedtime, assume it's the next day
            if (wakeTimeDate <= bedtimeDate) {
                wakeTimeDate = new Date(`2000-01-02 ${wakeTime}`);
            }
            
            const hoursDiff = (wakeTimeDate - bedtimeDate) / (1000 * 60 * 60);
            const sleepHoursInput = document.getElementById('target-sleep-hours');
            sleepHoursInput.value = hoursDiff.toFixed(1);
            this.isUpdating = false;
        }
    }

    updateBedtimeFromHoursAndWake() {
        const sleepHours = parseFloat(document.getElementById('target-sleep-hours').value);
        const wakeTime = document.getElementById('target-wake-time').value;
        
        if (sleepHours && wakeTime && !this.isUpdating) {
            this.isUpdating = true;
            const wakeTimeDate = new Date(`2000-01-01 ${wakeTime}`);
            
            // Calculate bedtime by subtracting sleep hours from wake time
            const bedtimeDate = new Date(wakeTimeDate.getTime() - (sleepHours * 60 * 60 * 1000));
            
            // Format time as HH:MM
            const hours = bedtimeDate.getHours().toString().padStart(2, '0');
            const minutes = bedtimeDate.getMinutes().toString().padStart(2, '0');
            
            document.getElementById('target-bedtime').value = `${hours}:${minutes}`;
            this.isUpdating = false;
        }
    }

    updateWakeTimeFromHoursAndBedtime() {
        const sleepHours = parseFloat(document.getElementById('target-sleep-hours').value);
        const bedtime = document.getElementById('target-bedtime').value;
        
        if (sleepHours && bedtime && !this.isUpdating) {
            this.isUpdating = true;
            const bedtimeDate = new Date(`2000-01-01 ${bedtime}`);
            
            // Calculate wake time by adding sleep hours to bedtime
            const wakeTimeDate = new Date(bedtimeDate.getTime() + (sleepHours * 60 * 60 * 1000));
            
            // Format time as HH:MM
            const hours = wakeTimeDate.getHours().toString().padStart(2, '0');
            const minutes = wakeTimeDate.getMinutes().toString().padStart(2, '0');
            
            document.getElementById('target-wake-time').value = `${hours}:${minutes}`;
            this.isUpdating = false;
        }
    }

    async handleWeightGoalSubmit(e) {
        e.preventDefault();
        
        const targetWeight = document.getElementById('target-weight').value;
        const targetDate = document.getElementById('target-date').value;

        try {
            const response = await fetch('/api/goals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target_weight: parseFloat(targetWeight),
                    target_date: targetDate
                })
            });

            if (response.ok) {
                await this.loadCurrentGoals();
                document.getElementById('weight-goal-form').reset();
                this.showSuccessMessage('Weight goal set successfully!');
            } else {
                this.showErrorMessage('Failed to set weight goal');
            }
        } catch (error) {
            console.error('Error setting weight goal:', error);
            this.showErrorMessage('Error setting weight goal');
        }
    }

    async handleSleepGoalSubmit(e) {
        e.preventDefault();
        
        const targetHours = document.getElementById('target-sleep-hours').value;
        const targetBedtime = document.getElementById('target-bedtime').value;
        const targetWakeTime = document.getElementById('target-wake-time').value;

        try {
            const response = await fetch('/api/sleep-goals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target_hours: parseFloat(targetHours),
                    target_bedtime: targetBedtime,
                    target_wake_time: targetWakeTime
                })
            });

            if (response.ok) {
                await this.loadCurrentGoals();
                document.getElementById('sleep-goal-form').reset();
                this.showSuccessMessage('Sleep goal set successfully!');
            } else {
                this.showErrorMessage('Failed to set sleep goal');
            }
        } catch (error) {
            console.error('Error setting sleep goal:', error);
            this.showErrorMessage('Error setting sleep goal');
        }
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            this.settings = await response.json();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = { weight_unit: 'lbs', height_unit: 'inches' }; // Default fallback
        }
    }

    async loadCurrentGoals() {
        await Promise.all([
            this.loadWeightGoal(),
            this.loadSleepGoal()
        ]);
        this.updateFormLabels();
    }

    updateFormLabels() {
        if (!this.settings) return;
        
        const weightUnit = this.settings.weight_unit;
        
        // Update target weight input placeholder
        const targetWeightInput = document.getElementById('target-weight');
        if (targetWeightInput) {
            targetWeightInput.placeholder = `Target Weight (${weightUnit})`;
        }
    }

    async loadWeightGoal() {
        try {
            const response = await fetch('/api/goals');
            const goal = await response.json();
            
            if (goal) {
                const weightUnit = this.settings?.weight_unit || 'lbs';
                document.getElementById('display-target-weight').textContent = `${goal.target_weight} ${weightUnit}`;
                document.getElementById('display-target-date').textContent = new Date(goal.target_date).toLocaleDateString();
                
                // Calculate progress if we have current weight
                const statsResponse = await fetch('/api/stats');
                const stats = await statsResponse.json();
                
                if (stats.currentWeight && goal.start_weight) {
                    const progress = ((goal.start_weight - stats.currentWeight) / (goal.start_weight - goal.target_weight)) * 100;
                    document.getElementById('display-progress').textContent = `${Math.max(0, progress).toFixed(1)}%`;
                } else {
                    document.getElementById('display-progress').textContent = 'N/A';
                }
                
                document.getElementById('current-weight-goal').style.display = 'block';
            } else {
                document.getElementById('current-weight-goal').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading weight goal:', error);
        }
    }

    async loadSleepGoal() {
        try {
            const response = await fetch('/api/sleep-goals');
            const goal = await response.json();
            
            if (goal) {
                document.getElementById('display-sleep-hours').textContent = `${goal.target_hours} Hours`;
                document.getElementById('display-bedtime').textContent = this.formatTime(goal.target_bedtime);
                document.getElementById('display-wake-time').textContent = this.formatTime(goal.target_wake_time);
                document.getElementById('current-sleep-goal').style.display = 'block';
            } else {
                document.getElementById('current-sleep-goal').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading sleep goal:', error);
        }
    }

    async updateGoalsSummary() {
        try {
            // Weight goal progress
            const goalResponse = await fetch('/api/goals');
            const goal = await goalResponse.json();
            
            const statsResponse = await fetch('/api/stats');
            const stats = await statsResponse.json();
            
            const progressFill = document.getElementById('weight-progress-fill');
            const progressText = document.getElementById('weight-progress-text');
            
            if (goal && stats.currentWeight && goal.start_weight) {
                const progress = ((goal.start_weight - stats.currentWeight) / (goal.start_weight - goal.target_weight)) * 100;
                const clampedProgress = Math.max(0, Math.min(100, progress));
                progressFill.style.width = `${clampedProgress}%`;
                progressText.textContent = `${clampedProgress.toFixed(1)}% complete`;
            } else {
                progressFill.style.width = '0%';
                progressText.textContent = goal ? 'Set start weight to track progress' : 'No goal set';
            }
            
            // Sleep goal status
            const sleepResponse = await fetch('/api/sleep-goals');
            const sleepGoal = await sleepResponse.json();
            
            const sleepStatus = document.getElementById('sleep-goal-status');
            if (sleepGoal) {
                sleepStatus.textContent = `${sleepGoal.target_hours}h sleep (${this.formatTime(sleepGoal.target_bedtime)} - ${this.formatTime(sleepGoal.target_wake_time)})`;
            } else {
                sleepStatus.textContent = 'No goal set';
            }
            
        } catch (error) {
            console.error('Error updating goals summary:', error);
        }
    }

    formatTime(timeString) {
        if (!timeString) return '--';
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }

    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type) {
        // Remove any existing message
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 4px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(messageDiv);

        // Remove message after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GoalsManager();
});

// Add CSS for message animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
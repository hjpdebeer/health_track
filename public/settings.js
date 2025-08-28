class SettingsManager {
  constructor() {
    this.settings = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    this.updateUI();
  }

  setupEventListeners() {
    // Settings form submission
    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Update height unit label when height unit changes
    document.getElementById('height-unit').addEventListener('change', (e) => {
      document.getElementById('height-unit-label').textContent = e.target.value;
    });
  }

  async loadSettings() {
    try {
      const response = await fetch('/api/settings');
      this.settings = await response.json();
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = { 
        weight_unit: 'lbs', 
        height_unit: 'inches', 
        user_height: null,
        date_of_birth: null,
        gender: null
      };
    }
  }

  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  updateUI() {
    if (!this.settings) return;

    // Update form fields
    document.getElementById('date-of-birth').value = this.settings.date_of_birth || '';
    document.getElementById('gender').value = this.settings.gender || '';
    document.getElementById('weight-unit').value = this.settings.weight_unit;
    document.getElementById('height-unit').value = this.settings.height_unit;
    document.getElementById('user-height').value = this.settings.user_height || '';
    document.getElementById('height-unit-label').textContent = this.settings.height_unit;

    // Update current settings display
    const age = this.calculateAge(this.settings.date_of_birth);
    document.getElementById('current-age').textContent = 
      age !== null ? `${age} Years Old` : 'Not Set';
    
    document.getElementById('current-gender').textContent = 
      this.settings.gender ? 
        this.settings.gender.charAt(0).toUpperCase() + this.settings.gender.slice(1).replace('-', ' ') : 
        'Not set';
    
    document.getElementById('current-weight-unit').textContent = 
      this.settings.weight_unit === 'lbs' ? 'Pounds (lbs)' : 'Kilograms (kg)';
    
    document.getElementById('current-height-unit').textContent = 
      this.settings.height_unit === 'inches' ? 'Inches' : 'Centimeters';
    
    document.getElementById('current-height').textContent = 
      this.settings.user_height ? 
        `${this.settings.user_height} ${this.settings.height_unit}` : 
        'Not set';
  }

  async saveSettings() {
    const dateOfBirth = document.getElementById('date-of-birth').value;
    const gender = document.getElementById('gender').value;
    const weightUnit = document.getElementById('weight-unit').value;
    const heightUnit = document.getElementById('height-unit').value;
    const userHeight = parseFloat(document.getElementById('user-height').value);

    // Validation
    if (!dateOfBirth) {
      this.showMessage('Please enter your date of birth', 'error');
      return;
    }

    if (!gender) {
      this.showMessage('Please select your gender', 'error');
      return;
    }

    if (!userHeight || userHeight <= 0) {
      this.showMessage('Please enter a valid height', 'error');
      return;
    }

    // Check if date of birth is in the future
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    if (birthDate > today) {
      this.showMessage('Date of birth cannot be in the future', 'error');
      return;
    }

    // Check for reasonable age range (5-120 years)
    const age = this.calculateAge(dateOfBirth);
    if (age < 5 || age > 120) {
      this.showMessage('Please enter a valid date of birth', 'error');
      return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_of_birth: dateOfBirth,
          gender: gender,
          weight_unit: weightUnit,
          height_unit: heightUnit,
          user_height: userHeight
        })
      });

      if (response.ok) {
        this.settings = await response.json();
        this.updateUI();
        this.showMessage('Settings saved successfully! 🎉', 'success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Settings save failed:', response.status, errorData);
        this.showMessage(`Error saving settings: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showMessage('Error saving settings', 'error');
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

// Initialize the settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SettingsManager();
});
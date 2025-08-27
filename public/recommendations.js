class RecommendationsPage {
  constructor() {
    this.recommendations = [];
    this.filteredRecommendations = [];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadRecommendations();
    
    // Auto-refresh every 30 seconds to catch new completed recommendations
    setInterval(() => this.loadRecommendations(), 30000);
  }

  setupEventListeners() {
    document.getElementById('refresh-recommendations').addEventListener('click', () => {
      this.loadRecommendations();
    });

    document.getElementById('status-filter').addEventListener('change', () => {
      this.filterRecommendations();
    });

    document.getElementById('type-filter').addEventListener('change', () => {
      this.filterRecommendations();
    });
  }

  async loadRecommendations() {
    this.showLoading(true);
    
    try {
      const response = await fetch('/api/recommendations');
      if (response.ok) {
        this.recommendations = await response.json();
        this.filterRecommendations();
      } else {
        console.error('Failed to load recommendations:', response.status);
        this.showError('Failed to load recommendations');
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      this.showError('Error loading recommendations');
    }
    
    this.showLoading(false);
  }

  filterRecommendations() {
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;

    this.filteredRecommendations = this.recommendations.filter(rec => {
      const statusMatch = !statusFilter || rec.status === statusFilter;
      const typeMatch = !typeFilter || rec.session_type === typeFilter;
      return statusMatch && typeMatch;
    });

    this.renderRecommendations();
  }

  renderRecommendations() {
    const listEl = document.getElementById('recommendations-list');
    const emptyEl = document.getElementById('recommendations-empty');

    if (this.filteredRecommendations.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = this.filteredRecommendations.map(rec => this.createRecommendationCard(rec)).join('');
  }

  createRecommendationCard(rec) {
    const statusIcon = this.getStatusIcon(rec.status);
    const statusClass = this.getStatusClass(rec.status);
    const sessionIcon = rec.session_type === 'fasting' ? '⏰' : '😴';
    const sessionTitle = rec.session_type === 'fasting' ? 'Fasting' : 'Sleep';
    
    const createdDate = new Date(rec.created_at).toLocaleString();
    const completedDate = rec.completed_at ? new Date(rec.completed_at).toLocaleString() : null;
    
    // Session details
    let sessionDetails = '';
    if (rec.session_data) {
      const data = rec.session_data;
      if (rec.session_type === 'fasting') {
        sessionDetails = `
          <small class="text-muted d-block">
            ${data.actual_hours?.toFixed(1) || '?'}h actual / ${data.target_hours}h target
          </small>
        `;
      } else {
        sessionDetails = `
          <small class="text-muted d-block">
            ${data.actual_hours?.toFixed(1) || '?'}h sleep
          </small>
        `;
      }
    }

    const notes = rec.session_data?.notes ? `
      <div class="mt-2">
        <strong>Your Notes:</strong>
        <div class="text-muted fst-italic">"${rec.session_data.notes}"</div>
      </div>
    ` : '';

    const recommendationContent = rec.status === 'completed' && rec.recommendation ? `
      <div class="mt-3 p-3 bg-light rounded">
        <div class="d-flex align-items-start">
          <i class="bi bi-robot fs-4 text-primary me-3"></i>
          <div class="flex-grow-1">
            <h6 class="mb-2">AI Recommendation:</h6>
            <div class="recommendation-text">${this.formatRecommendation(rec.recommendation)}</div>
          </div>
        </div>
      </div>
    ` : rec.status === 'failed' ? `
      <div class="mt-3 p-3 bg-danger bg-opacity-10 rounded">
        <div class="text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to generate recommendation: ${rec.error_message || 'Unknown error'}
        </div>
      </div>
    ` : rec.status === 'processing' ? `
      <div class="mt-3 p-3 bg-info bg-opacity-10 rounded">
        <div class="text-info">
          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
          AI is analyzing your session and generating personalized recommendations...
        </div>
      </div>
    ` : '';

    return `
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            <span class="me-2">${sessionIcon}</span>
            <strong>${sessionTitle} Session</strong>
            ${sessionDetails}
          </div>
          <div class="d-flex align-items-center">
            <span class="badge ${statusClass} me-2">
              ${statusIcon} ${rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
            </span>
            <small class="text-muted">${createdDate}</small>
          </div>
        </div>
        <div class="card-body">
          ${notes}
          ${recommendationContent}
          ${completedDate ? `<small class="text-muted d-block mt-2">Completed: ${completedDate}</small>` : ''}
        </div>
      </div>
    `;
  }

  formatRecommendation(recommendation) {
    // Convert markdown-style bold to HTML
    return recommendation
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  getStatusIcon(status) {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  }

  getStatusClass(status) {
    switch (status) {
      case 'pending': return 'bg-warning text-dark';
      case 'processing': return 'bg-info text-white';
      case 'completed': return 'bg-success text-white';
      case 'failed': return 'bg-danger text-white';
      default: return 'bg-secondary text-white';
    }
  }

  showLoading(show) {
    document.getElementById('recommendations-loading').style.display = show ? 'block' : 'none';
  }

  showError(message) {
    const listEl = document.getElementById('recommendations-list');
    listEl.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        ${message}
      </div>
    `;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RecommendationsPage();
});
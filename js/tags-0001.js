/**
 * NEXUS Tag Encyclopedia
 * Browse, search, and manage connection pattern tags
 */

let allTags = [];
let filteredTags = [];
let currentCategory = 'all';
let searchQuery = '';
let userTags = new Map(); // Maps tag ID -> tag data (including intensity)
let intensitySaveTimeout = null; // Debounce auto-save

/**
 * Generate visual intensity indicator (signal bars)
 * @param {number} intensity - Intensity level 1-5
 * @returns {string} HTML for intensity indicator
 */
function getIntensityIndicator(intensity) {
  const bars = [];
  for (let i = 1; i <= 5; i++) {
    const isActive = i <= intensity;
    const levelClass = isActive ? `level-${intensity}` : '';
    bars.push(`<div class="intensity-bar ${isActive ? 'active' : ''} ${levelClass}"></div>`);
  }
  return `<div class="intensity-indicator">${bars.join('')}</div>`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check if NexusCore is loaded
  if (typeof NexusCore === 'undefined') {
    console.error('NexusCore is not loaded!');
    document.getElementById('loadingState').innerHTML = `
      <p style="color: var(--accent-color);">Error loading page</p>
      <p style="opacity: 0.7; font-size: 0.9rem;">Core library failed to load. Please refresh the page.</p>
    `;
    return;
  }

  await loadTags();
  setupEventListeners();
  await loadUserTags();
});

/**
 * Load all tags from database
 */
async function loadTags() {
  try {
    allTags = await NexusCore.getTags();
    filteredTags = [...allTags];
    renderTags();

    document.getElementById('loadingState').style.display = 'none';
  } catch (error) {
    console.error('Error loading tags:', error);
    document.getElementById('loadingState').innerHTML = `
      <p style="color: var(--accent-color);">Error loading tags</p>
      <p style="opacity: 0.7; font-size: 0.9rem;">${error.message}</p>
    `;
  }
}

/**
 * Load user's current tags
 */
async function loadUserTags() {
  if (!NexusCore.isAuthenticated()) return;

  try {
    const userId = NexusCore.getUserId();
    const tags = await NexusCore.getUserTags(userId);
    userTags = new Map(tags.map(t => [t.id, { intensity: t.intensity || 3, ...t }]));
    renderTags(); // Re-render to show added state
  } catch (error) {
    console.error('Error loading user tags:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', NexusCore.debounce((e) => {
    searchQuery = e.target.value.toLowerCase();
    filterTags();
  }, 300));

  // Category filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.dataset.category;
      filterTags();
    });
  });
}

/**
 * Filter tags based on search and category
 */
function filterTags() {
  filteredTags = allTags.filter(tag => {
    // Category filter
    if (currentCategory !== 'all' && tag.category !== currentCategory) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        tag.tag_name.toLowerCase().includes(searchLower) ||
        tag.definition.toLowerCase().includes(searchLower) ||
        (tag.examples && tag.examples.some(ex => ex.toLowerCase().includes(searchLower)))
      );
    }

    return true;
  });

  renderTags();
}

/**
 * Render tags to grid
 */
function renderTags() {
  const grid = document.getElementById('tagsGrid');
  const emptyState = document.getElementById('emptyState');

  if (filteredTags.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.style.display = 'grid';

  grid.innerHTML = filteredTags.map(tag => `
    <div class="tag-card" onclick="showTagDetail('${tag.id}')">
      <div class="tag-card-header">
        <h3 class="tag-card-title">${NexusCore.escapeHtml(tag.tag_name)}</h3>
        <span class="tag-version">${tag.version}</span>
      </div>

      <div class="tag-card-meta">
        <span>${getCategoryLabel(tag.category)}</span>
      </div>

      <div class="tag-card-definition">
        ${NexusCore.escapeHtml(tag.definition)}
      </div>

      ${tag.examples && tag.examples.length > 0 ? `
        <div class="tag-card-examples">
          Example: ${NexusCore.escapeHtml(tag.examples[0])}
        </div>
      ` : ''}

      <div class="tag-card-footer">
        <div style="display: flex; align-items: center; gap: var(--spacing-xs);">
          ${userTags.has(tag.id) ? `
            <div onclick="event.stopPropagation(); showTagDetail('${tag.id}')" style="cursor: pointer;" title="Click to adjust intensity">
              ${getIntensityIndicator(userTags.get(tag.id).intensity)}
            </div>
          ` : ''}
        </div>
        ${!userTags.has(tag.id) ? `
          <button
            class="add-tag-btn"
            onclick="event.stopPropagation(); quickAddTag('${tag.id}')"
          >
            + Add
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Get readable category label
 */
function getCategoryLabel(category) {
  const labels = {
    'relationship_structure': 'Relationships',
    'sexual_orientation': 'Sexual Orientation',
    'kink_bdsm': 'Kink & BDSM',
    'communication_style': 'Communication',
    'arousal_pattern': 'Arousal Patterns',
    'physical_preference': 'Physical Preferences',
    'lifestyle_values': 'Lifestyle & Values',
    'modern_digital': 'Modern & Digital',
    'emotional_connection': 'Emotional Connection',
    'attachment_style': 'Attachment Style',
    'experience_level': 'Experience Level'
  };
  return labels[category] || category || 'General';
}

/**
 * Show tag detail modal
 */
async function showTagDetail(tagId) {
  const tag = allTags.find(t => t.id === tagId);
  if (!tag) return;

  const modal = document.getElementById('tagModal');
  const detail = document.getElementById('tagDetail');

  // Check if user already has this tag and get current intensity
  const userHasTag = userTags.has(tagId);
  const currentIntensity = userHasTag ? userTags.get(tagId).intensity : 3;

  detail.innerHTML = `
    <h2 class="text-gradient">${NexusCore.escapeHtml(tag.tag_name)}</h2>
    <div style="display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-md);">
      <span class="tag-version" style="font-size: 1rem;">${tag.version}</span>
      <span class="tag-category">${getCategoryLabel(tag.category)}</span>
    </div>

    <div style="margin-bottom: var(--spacing-lg);">
      <h4 style="color: var(--accent-color); margin-bottom: var(--spacing-sm);">Definition</h4>
      <p style="font-size: 1.05rem; line-height: 1.6;">${NexusCore.escapeHtml(tag.definition)}</p>
    </div>

    ${tag.examples && tag.examples.length > 0 ? `
      <div style="margin-bottom: var(--spacing-lg);">
        <h4 style="color: var(--accent-color); margin-bottom: var(--spacing-sm);">Examples</h4>
        <ul style="margin-left: var(--spacing-md); line-height: 1.8;">
          ${tag.examples.map(ex => `<li>${NexusCore.escapeHtml(ex)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${tag.related_tags && tag.related_tags.length > 0 ? `
      <div style="margin-bottom: var(--spacing-lg);">
        <h4 style="color: var(--accent-color); margin-bottom: var(--spacing-sm);">Related Tags</h4>
        <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-xs);">
          ${tag.related_tags.map(rtId => {
            const relatedTag = allTags.find(t => t.id === rtId);
            return relatedTag ? `<span class="tag">${relatedTag.tag_name}</span>` : '';
          }).join('')}
        </div>
      </div>
    ` : ''}

    ${NexusCore.isAuthenticated() ? `
      <div style="margin-top: var(--spacing-xl); padding: var(--spacing-md); background: rgba(0, 212, 255, 0.05); border-radius: var(--radius-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
          <h4 style="color: var(--accent-color); margin: 0;">How into this are you?</h4>
          <div id="intensityVisual" style="transform: scale(1.5);">
            ${getIntensityIndicator(currentIntensity)}
          </div>
        </div>` : `
      <div style="margin-top: var(--spacing-xl); padding: var(--spacing-md); background: rgba(0, 212, 255, 0.05); border-radius: var(--radius-md); text-align: center;">
        <p style="color: var(--accent-color); margin-bottom: var(--spacing-sm);">
          Want to add this tag to your profile?
        </p>
        <a href="/?redirect=${encodeURIComponent('/tags.html')}" class="btn btn-primary">
          Sign In / Sign Up
        </a>
    `}
      ${NexusCore.isAuthenticated() ? `
        <div style="margin-bottom: var(--spacing-md);">
          <input
            type="range"
            id="intensitySlider"
            min="1"
            max="5"
            value="${currentIntensity}"
            style="width: 100%;"
            oninput="handleIntensityChange('${tag.id}', this.value)"
          >
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: var(--spacing-xs); opacity: 0.7;">
            <span>1: Curious</span>
            <span>2: Interested</span>
            <span>3: Active</span>
            <span>4: Experienced</span>
            <span>5: Expert</span>
          </div>
        </div>
        <div id="intensityDescription" style="text-align: center; font-size: 0.95rem; color: var(--accent-color);">
        </div>
        <div id="savingIndicator" style="text-align: center; font-size: 0.85rem; opacity: 0.7; min-height: 20px;">
        </div>
      ` : ''}
    </div>

    ${NexusCore.isAuthenticated() && userHasTag ? `
      <div style="margin-top: var(--spacing-md); text-align: center;">
        <button
          class="btn btn-outline"
          onclick="removeUserTagFromModal('${tag.id}'); closeTagModal();"
        >
          Remove from Profile
        </button>
      </div>
    ` : ''}
  `;

  modal.classList.add('active');

  // Initialize intensity label (only if authenticated and slider exists)
  if (NexusCore.isAuthenticated()) {
    updateIntensityLabel(currentIntensity);
  }
}

/**
 * Update intensity label based on slider value
 */
function updateIntensityLabel(value) {
  const descriptions = {
    '1': '<strong>Curious</strong> - Exploring/learning about this',
    '2': '<strong>Interested</strong> - Want to try or occasionally engage',
    '3': '<strong>Active</strong> - Currently engaging with this',
    '4': '<strong>Experienced</strong> - Well-practiced and knowledgeable',
    '5': '<strong>Expert/Primary</strong> - Core part of my identity'
  };
  document.getElementById('intensityDescription').innerHTML = descriptions[value];
}

/**
 * Handle intensity slider change - update visual and auto-save
 */
function handleIntensityChange(tagId, value) {
  const intensity = parseInt(value);

  // Update text description
  updateIntensityLabel(value);

  // Update visual bars
  const visualContainer = document.getElementById('intensityVisual');
  if (visualContainer) {
    visualContainer.innerHTML = getIntensityIndicator(intensity);
  }

  // Clear existing save timeout
  if (intensitySaveTimeout) {
    clearTimeout(intensitySaveTimeout);
  }

  // Show "saving..." indicator
  const savingIndicator = document.getElementById('savingIndicator');
  if (savingIndicator) {
    savingIndicator.innerHTML = '<span style="color: var(--accent-color);">●</span> Saving...';
  }

  // Debounced auto-save (500ms after last change)
  intensitySaveTimeout = setTimeout(async () => {
    await autoSaveIntensity(tagId, intensity);
  }, 500);
}

/**
 * Auto-save intensity rating
 */
async function autoSaveIntensity(tagId, intensity) {
  if (!NexusCore.isAuthenticated()) {
    return;
  }

  try {
    // Add or update tag with intensity
    await NexusCore.addUserTag(tagId, 0, intensity);

    // Update local state
    const tag = allTags.find(t => t.id === tagId);
    if (tag) {
      userTags.set(tagId, { intensity, ...tag });
    }

    // Show saved confirmation
    const savingIndicator = document.getElementById('savingIndicator');
    if (savingIndicator) {
      savingIndicator.innerHTML = '<span style="color: #44ff88;">✓</span> Saved';
      setTimeout(() => {
        savingIndicator.innerHTML = '';
      }, 2000);
    }

    // Re-render tags to update card display
    renderTags();
  } catch (error) {
    console.error('Error auto-saving intensity:', error);
    const savingIndicator = document.getElementById('savingIndicator');
    if (savingIndicator) {
      savingIndicator.innerHTML = '<span style="color: #ff4444;">✗</span> Save failed';
    }
  }
}

/**
 * Close tag detail modal
 */
function closeTagModal() {
  document.getElementById('tagModal').classList.remove('active');
}

/**
 * Quick add tag from card with default intensity
 */
async function quickAddTag(tagId) {
  if (!NexusCore.isAuthenticated()) {
    NexusCore.showToast('Please log in to add tags to your profile', 'error');
    window.location.href = '/?redirect=' + encodeURIComponent('/tags.html');
    return;
  }

  try {
    // Add tag with default intensity of 3
    await NexusCore.addUserTag(tagId, 0, 3);

    // Update local state
    const tag = allTags.find(t => t.id === tagId);
    if (tag) {
      userTags.set(tagId, { intensity: 3, ...tag });
    }

    NexusCore.showToast('Tag added to profile (intensity: 3/5)', 'success');
    renderTags(); // Re-render to update button states
  } catch (error) {
    console.error('Error adding tag:', error);
    NexusCore.showToast('Error adding tag: ' + error.message, 'error');
  }
}

/**
 * Save tag to user's profile with intensity (add or update)
 */
async function saveUserTag(tagId) {
  if (!NexusCore.isAuthenticated()) {
    NexusCore.showToast('Please log in to add tags to your profile', 'error');
    window.location.href = '/?redirect=' + encodeURIComponent('/tags.html');
    return;
  }

  try {
    // Get intensity from slider
    const intensitySlider = document.getElementById('intensitySlider');
    const intensity = intensitySlider ? parseInt(intensitySlider.value) : 3;

    // Add or update tag with intensity
    await NexusCore.addUserTag(tagId, 0, intensity);

    // Update local state
    const tag = allTags.find(t => t.id === tagId);
    if (tag) {
      userTags.set(tagId, { intensity, ...tag });
    }

    const wasUpdate = userTags.has(tagId);
    NexusCore.showToast(wasUpdate ? 'Tag rating updated' : 'Tag added to profile', 'success');

    renderTags(); // Re-render to update button states
  } catch (error) {
    console.error('Error saving tag:', error);
    NexusCore.showToast('Error updating tag: ' + error.message, 'error');
  }
}

/**
 * Remove tag from user's profile
 */
async function removeUserTagFromModal(tagId) {
  if (!NexusCore.isAuthenticated()) {
    return;
  }

  try {
    await NexusCore.removeUserTag(tagId);
    userTags.delete(tagId);
    NexusCore.showToast('Tag removed from profile', 'success');
    renderTags(); // Re-render to update button states
  } catch (error) {
    console.error('Error removing tag:', error);
    NexusCore.showToast('Error removing tag: ' + error.message, 'error');
  }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('tagModal');
  if (e.target === modal) {
    closeTagModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTagModal();
  }
});

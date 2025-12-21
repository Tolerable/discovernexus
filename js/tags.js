/**
 * NEXUS Tag Encyclopedia
 * Browse, search, and manage connection pattern tags
 */

let allTags = [];
let filteredTags = [];
let currentCategory = 'all';
let searchQuery = '';
let userTags = new Map(); // Maps tag ID -> tag data (interest_level, experience_level)
let tagSaveTimeout = null; // Debounce auto-save
let dismissedConflicts = new Set(); // Track dismissed conflict warnings

// Tag conflict groups - tags within same group may conflict
// Users are warned but can still select both (they may be fluid/questioning)
const TAG_CONFLICT_GROUPS = {
  relationship_structure_exclusive: [
    'Monogamy', 'Polyamory', 'Relationship Anarchy', 'Solo Polyamory'
  ],
  sexual_orientation: [
    'Heterosexual', 'Homosexual/Gay/Lesbian', 'Bisexual', 'Pansexual', 'Asexual'
  ],
  libido_level: [
    'High Libido', 'Low Libido'
  ],
  desire_type: [
    'Spontaneous Desire', 'Responsive Desire'
  ],
  intimacy_pace: [
    'Tantric/Slow Intimacy', 'Quickie Enthusiast'
  ],
  social_energy: [
    'Introvert', 'Extrovert'  // Note: Ambivert is compatible with both
  ],
  children_preference: [
    'Childfree', 'Wants Children'
  ],
  experience_level: [
    'Sexually Experienced', 'Sexually Inexperienced'
  ],
  kink_level: [
    'Vanilla/Traditional', 'Kink Experienced'
  ],
  religious_stance: [
    'Spiritual/Religious', 'Atheist/Agnostic'
  ],
  political_stance: [
    'Politically Progressive', 'Politically Conservative'
  ]
};

// Load dismissed conflicts from localStorage
function loadDismissedConflicts() {
  try {
    const stored = localStorage.getItem('nexus_dismissed_conflicts');
    if (stored) {
      dismissedConflicts = new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.warn('Could not load dismissed conflicts:', e);
  }
}

// Save dismissed conflicts to localStorage
function saveDismissedConflicts() {
  try {
    localStorage.setItem('nexus_dismissed_conflicts', JSON.stringify([...dismissedConflicts]));
  } catch (e) {
    console.warn('Could not save dismissed conflicts:', e);
  }
}

// Check if a tag conflicts with user's current tags
function checkTagConflicts(tagName) {
  const conflicts = [];
  const userTagNames = new Set();

  // Get names of user's current tags
  userTags.forEach((data, tagId) => {
    const tag = allTags.find(t => t.id === tagId);
    if (tag) userTagNames.add(tag.tag_name);
  });

  // Check each conflict group
  for (const [groupName, groupTags] of Object.entries(TAG_CONFLICT_GROUPS)) {
    if (groupTags.includes(tagName)) {
      // This tag belongs to a conflict group - check if user has any others
      for (const existingTag of groupTags) {
        if (existingTag !== tagName && userTagNames.has(existingTag)) {
          const conflictKey = [tagName, existingTag].sort().join('|');
          if (!dismissedConflicts.has(conflictKey)) {
            conflicts.push({
              key: conflictKey,
              newTag: tagName,
              existingTag: existingTag,
              group: groupName
            });
          }
        }
      }
    }
  }

  return conflicts;
}

// Show conflict warning modal
function showConflictWarning(conflicts, tagId, callback) {
  const conflictList = conflicts.map(c => `
    <li style="margin-bottom: 8px;">
      <strong>${c.newTag}</strong> may conflict with <strong>${c.existingTag}</strong>
      <br><span style="opacity: 0.7; font-size: 0.85rem;">(${c.group.replace(/_/g, ' ')})</span>
    </li>
  `).join('');

  const modalHtml = `
    <div id="conflictWarningModal" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    ">
      <div style="
        background: var(--gunmetal, #2a2d34);
        border: 2px solid rgba(212, 175, 55, 0.5);
        border-radius: 12px;
        padding: 24px;
        max-width: 450px;
        text-align: center;
      ">
        <h3 style="color: #d4af37; margin-bottom: 16px;">Potential Conflict</h3>
        <p style="margin-bottom: 16px;">These tags are typically considered alternatives:</p>
        <ul style="text-align: left; margin-bottom: 20px; padding-left: 20px;">
          ${conflictList}
        </ul>
        <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 20px;">
          You can still add both - identities can be fluid or complex!
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button onclick="resolveConflict('cancel')" style="
            padding: 10px 20px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 6px;
            color: white;
            cursor: pointer;
          ">Cancel</button>
          <button onclick="resolveConflict('add')" style="
            padding: 10px 20px;
            background: rgba(0, 212, 255, 0.2);
            border: 1px solid var(--accent-color, #00d4ff);
            border-radius: 6px;
            color: var(--accent-color, #00d4ff);
            cursor: pointer;
          ">Add Anyway</button>
          <button onclick="resolveConflict('dismiss')" style="
            padding: 10px 20px;
            background: rgba(212, 175, 55, 0.2);
            border: 1px solid #d4af37;
            border-radius: 6px;
            color: #d4af37;
            cursor: pointer;
          ">Add & Don't Warn Again</button>
        </div>
      </div>
    </div>
  `;

  // Store callback and conflicts for resolution
  window._conflictCallback = callback;
  window._conflictTagId = tagId;
  window._conflictKeys = conflicts.map(c => c.key);

  // Add modal to DOM
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Handle conflict resolution
function resolveConflict(action) {
  const modal = document.getElementById('conflictWarningModal');
  if (modal) modal.remove();

  if (action === 'cancel') {
    window._conflictCallback = null;
    return;
  }

  if (action === 'dismiss') {
    // Add to dismissed list
    window._conflictKeys.forEach(key => dismissedConflicts.add(key));
    saveDismissedConflicts();
  }

  // Proceed with adding the tag
  if (window._conflictCallback) {
    window._conflictCallback();
    window._conflictCallback = null;
  }
}

// Initialize conflict tracking
loadDismissedConflicts();

/**
 * Generate visual indicator for interest level (-5 to +5)
 * Shows red for negative (avoid), green for positive (seeking)
 * @param {number} interest - Interest level -5 to +5
 * @returns {string} HTML for interest indicator
 */
function getInterestIndicator(interest) {
  if (interest === 0) {
    return '<span class="interest-neutral">Neutral</span>';
  }

  const isNegative = interest < 0;
  const absLevel = Math.abs(interest);
  const bars = [];

  for (let i = 1; i <= 5; i++) {
    const isActive = i <= absLevel;
    const colorClass = isNegative ? 'avoid' : 'seek';
    bars.push(`<div class="interest-bar ${isActive ? 'active ' + colorClass : ''}"></div>`);
  }

  const label = isNegative ? 'Avoid' : 'Seek';
  return `<div class="interest-indicator ${isNegative ? 'negative' : 'positive'}">
    <span class="interest-label">${label}</span>
    <div class="interest-bars">${bars.join('')}</div>
  </div>`;
}

/**
 * Generate visual indicator for experience level (0-5)
 * @param {number} experience - Experience level 0-5
 * @returns {string} HTML for experience indicator
 */
function getExperienceIndicator(experience) {
  const bars = [];
  for (let i = 1; i <= 5; i++) {
    const isActive = i <= experience;
    bars.push(`<div class="experience-bar ${isActive ? 'active' : ''}"></div>`);
  }
  return `<div class="experience-indicator">${bars.join('')}</div>`;
}

/**
 * Legacy compatibility - returns combined indicator
 * @param {number} intensity - Old intensity value (maps to interest)
 */
function getIntensityIndicator(intensity) {
  return getInterestIndicator(intensity);
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
    userTags = new Map(tags.map(t => [t.id, {
      interest_level: t.interest_level ?? t.intensity ?? 3,  // Fallback to old intensity field
      experience_level: t.experience_level ?? 0,
      ...t
    }]));
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

  // Check if user already has this tag and get current levels
  const userHasTag = userTags.has(tagId);
  const userData = userTags.get(tagId);
  const currentInterest = userHasTag ? (userData.interest_level ?? userData.intensity ?? 3) : 3;
  const currentExperience = userHasTag ? (userData.experience_level ?? 0) : 0;

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
        <!-- Interest Level Slider -->
        <div style="margin-bottom: var(--spacing-lg);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
            <h4 style="color: var(--accent-color); margin: 0;">Interest Level</h4>
            <div id="interestVisual">${getInterestIndicator(currentInterest)}</div>
          </div>
          <input
            type="range"
            id="interestSlider"
            min="-5"
            max="5"
            value="${currentInterest}"
            style="width: 100%;"
            oninput="handleLevelChange('${tag.id}', 'interest', this.value)"
          >
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-top: var(--spacing-xs); opacity: 0.7;">
            <span>-5: Avoid</span>
            <span>0: Neutral</span>
            <span>+5: Seeking</span>
          </div>
          <div id="interestDescription" style="text-align: center; font-size: 0.9rem; color: var(--accent-color); margin-top: var(--spacing-xs);"></div>
        </div>

        <!-- Experience Level Slider -->
        <div style="margin-bottom: var(--spacing-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
            <h4 style="color: var(--highlight-color); margin: 0;">Experience Level</h4>
            <div id="experienceVisual">${getExperienceIndicator(currentExperience)}</div>
          </div>
          <input
            type="range"
            id="experienceSlider"
            min="0"
            max="5"
            value="${currentExperience}"
            style="width: 100%;"
            oninput="handleLevelChange('${tag.id}', 'experience', this.value)"
          >
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-top: var(--spacing-xs); opacity: 0.7;">
            <span>0: None</span>
            <span>2: Tried</span>
            <span>5: Expert</span>
          </div>
          <div id="experienceDescription" style="text-align: center; font-size: 0.9rem; color: var(--highlight-color); margin-top: var(--spacing-xs);"></div>
        </div>

        <div id="savingIndicator" style="text-align: center; font-size: 0.85rem; opacity: 0.7; min-height: 20px;"></div>
    ` : `
      <div style="margin-top: var(--spacing-xl); padding: var(--spacing-md); background: rgba(0, 212, 255, 0.05); border-radius: var(--radius-md); text-align: center;">
        <p style="color: var(--accent-color); margin-bottom: var(--spacing-sm);">
          Want to add this tag to your profile?
        </p>
        <a href="/?redirect=${encodeURIComponent('/tags.html')}" class="btn btn-primary">
          Sign In / Sign Up
        </a>
    `}
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

  // Initialize level labels (only if authenticated)
  if (NexusCore.isAuthenticated()) {
    updateInterestLabel(currentInterest);
    updateExperienceLabel(currentExperience);
  }
}

/**
 * Update interest label based on slider value
 */
function updateInterestLabel(value) {
  const v = parseInt(value);
  let description;

  if (v <= -4) description = '<strong>Dealbreaker</strong> - Hard avoid, do not want';
  else if (v <= -2) description = '<strong>Avoid</strong> - Not interested, prefer not';
  else if (v === -1) description = '<strong>Slight Avoid</strong> - Prefer to skip this';
  else if (v === 0) description = '<strong>Neutral</strong> - No preference either way';
  else if (v === 1) description = '<strong>Curious</strong> - Open to exploring';
  else if (v <= 3) description = '<strong>Interested</strong> - Would like to engage';
  else description = '<strong>Actively Seeking</strong> - Core priority';

  const el = document.getElementById('interestDescription');
  if (el) el.innerHTML = description;
}

/**
 * Update experience label based on slider value
 */
function updateExperienceLabel(value) {
  const descriptions = {
    '0': '<strong>None</strong> - No experience yet',
    '1': '<strong>Aware</strong> - Know about it, curious',
    '2': '<strong>Tried</strong> - Some limited experience',
    '3': '<strong>Practiced</strong> - Regular engagement',
    '4': '<strong>Experienced</strong> - Well-versed in this',
    '5': '<strong>Expert</strong> - Deep knowledge and practice'
  };
  const el = document.getElementById('experienceDescription');
  if (el) el.innerHTML = descriptions[value] || descriptions['0'];
}

/**
 * Handle level slider change - update visual and auto-save
 * @param {string} tagId - Tag ID
 * @param {string} type - 'interest' or 'experience'
 * @param {string} value - Slider value
 */
function handleLevelChange(tagId, type, value) {
  const level = parseInt(value);

  if (type === 'interest') {
    updateInterestLabel(value);
    const visual = document.getElementById('interestVisual');
    if (visual) visual.innerHTML = getInterestIndicator(level);
  } else {
    updateExperienceLabel(value);
    const visual = document.getElementById('experienceVisual');
    if (visual) visual.innerHTML = getExperienceIndicator(level);
  }

  // Clear existing save timeout
  if (tagSaveTimeout) {
    clearTimeout(tagSaveTimeout);
  }

  // Show "saving..." indicator
  const savingIndicator = document.getElementById('savingIndicator');
  if (savingIndicator) {
    savingIndicator.innerHTML = '<span style="color: var(--accent-color);">●</span> Saving...';
  }

  // Debounced auto-save (500ms after last change)
  tagSaveTimeout = setTimeout(async () => {
    await autoSaveLevels(tagId);
  }, 500);
}

// Legacy compatibility
function handleIntensityChange(tagId, value) {
  handleLevelChange(tagId, 'interest', value);
}

/**
 * Auto-save both interest and experience levels
 */
async function autoSaveLevels(tagId) {
  if (!NexusCore.isAuthenticated()) {
    return;
  }

  try {
    // Get values from sliders
    const interestSlider = document.getElementById('interestSlider');
    const experienceSlider = document.getElementById('experienceSlider');
    const interestLevel = interestSlider ? parseInt(interestSlider.value) : 3;
    const experienceLevel = experienceSlider ? parseInt(experienceSlider.value) : 0;

    // Add or update tag with both levels
    await NexusCore.addUserTag(tagId, 0, interestLevel, experienceLevel);

    // Update local state
    const tag = allTags.find(t => t.id === tagId);
    if (tag) {
      userTags.set(tagId, { interest_level: interestLevel, experience_level: experienceLevel, ...tag });
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
    console.error('Error auto-saving levels:', error);
    const savingIndicator = document.getElementById('savingIndicator');
    if (savingIndicator) {
      savingIndicator.innerHTML = '<span style="color: #ff4444;">✗</span> Save failed';
    }
  }
}

// Legacy compatibility
async function autoSaveIntensity(tagId, intensity) {
  await autoSaveLevels(tagId);
}

/**
 * Close tag detail modal
 */
function closeTagModal() {
  document.getElementById('tagModal').classList.remove('active');
}

/**
 * Quick add tag from card with default levels
 */
async function quickAddTag(tagId) {
  if (!NexusCore.isAuthenticated()) {
    NexusCore.showToast('Please log in to add tags to your profile', 'error');
    window.location.href = '/?redirect=' + encodeURIComponent('/tags.html');
    return;
  }

  const tag = allTags.find(t => t.id === tagId);
  if (!tag) {
    NexusCore.showToast('Tag not found', 'error');
    return;
  }

  // Check for conflicts
  const conflicts = checkTagConflicts(tag.tag_name);
  if (conflicts.length > 0) {
    // Show warning and wait for resolution
    showConflictWarning(conflicts, tagId, async () => {
      await doQuickAddTag(tagId, tag);
    });
    return;
  }

  await doQuickAddTag(tagId, tag);
}

/**
 * Actually add the tag (called after conflict resolution if needed)
 */
async function doQuickAddTag(tagId, tag) {
  try {
    // Add tag with default interest of 3 (interested), experience of 0 (none)
    await NexusCore.addUserTag(tagId, 0, 3, 0);

    // Update local state
    userTags.set(tagId, { interest_level: 3, experience_level: 0, ...tag });

    NexusCore.showToast('Tag added (Interest: +3, Experience: 0)', 'success');
    renderTags(); // Re-render to update button states
  } catch (error) {
    console.error('Error adding tag:', error);
    NexusCore.showToast('Error adding tag: ' + error.message, 'error');
  }
}

/**
 * Save tag to user's profile with levels (add or update)
 */
async function saveUserTag(tagId) {
  if (!NexusCore.isAuthenticated()) {
    NexusCore.showToast('Please log in to add tags to your profile', 'error');
    window.location.href = '/?redirect=' + encodeURIComponent('/tags.html');
    return;
  }

  try {
    // Get levels from sliders
    const interestSlider = document.getElementById('interestSlider');
    const experienceSlider = document.getElementById('experienceSlider');
    const interestLevel = interestSlider ? parseInt(interestSlider.value) : 3;
    const experienceLevel = experienceSlider ? parseInt(experienceSlider.value) : 0;

    // Add or update tag with both levels
    await NexusCore.addUserTag(tagId, 0, interestLevel, experienceLevel);

    // Update local state
    const tag = allTags.find(t => t.id === tagId);
    if (tag) {
      userTags.set(tagId, { interest_level: interestLevel, experience_level: experienceLevel, ...tag });
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

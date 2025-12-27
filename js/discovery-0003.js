/**
 * NEXUS Discovery Flow
 * Handles the discovery questionnaire and profile creation
 */

let currentStep = 0;
let totalSteps = 8;
let answers = {};
let selectedTags = new Set();
let analysis = null;
let recognition = null;
let isRecording = false;
let preSelectedTagNames = new Set(); // Track pre-selected tag names from example clicks
let allTagsCache = []; // Cache all tags for sidebar lookups
let sidebarOpen = false; // Track sidebar state

/**
 * Toggle example tag selection during questions
 * Called when user clicks example tags in Steps 1-5
 * Now also updates the sidebar in real-time
 */
async function toggleExampleTag(element, tagName) {
  if (preSelectedTagNames.has(tagName)) {
    preSelectedTagNames.delete(tagName);
    element.classList.remove('pre-selected');

    // Also remove from selectedTags if we have the tag ID
    const tag = allTagsCache.find(t => t.tag_name.toLowerCase() === tagName.toLowerCase());
    if (tag) {
      selectedTags.delete(tag.id);
    }
  } else {
    preSelectedTagNames.add(tagName);
    element.classList.add('pre-selected');

    // Also add to selectedTags immediately if we have the tag cached
    const tag = allTagsCache.find(t => t.tag_name.toLowerCase() === tagName.toLowerCase());
    if (tag) {
      selectedTags.add(tag.id);
    }
  }

  console.log('[DISCOVERY] Pre-selected tags:', Array.from(preSelectedTagNames));
  console.log('[DISCOVERY] Selected tag IDs:', Array.from(selectedTags));

  // Update sidebar in real-time
  await updateTagSidebar();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const auth = window.auth || new Auth();
  await auth.init();

  // Require authentication
  await auth.requireAuth();

  // Check if discovery already completed
  const isComplete = await checkDiscoveryComplete();
  if (isComplete) {
    await showCompletionSummary();
    return; // Don't initialize discovery flow
  }

  // Load all tags into cache for sidebar lookups
  try {
    allTagsCache = await NexusCore.getTags();
    console.log('[DISCOVERY] Cached', allTagsCache.length, 'tags for sidebar');
  } catch (error) {
    console.error('[DISCOVERY] Failed to cache tags:', error);
  }

  // Load user's existing tags so they appear during discovery
  await loadExistingUserTags();

  // Initialize sidebar with existing tags
  await updateTagSidebar();

  // Initialize Web Speech API if available
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const stepNum = currentStep;
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');

      document.getElementById(`transcript${stepNum}`).textContent = transcript;
      answers[`question${stepNum}`] = transcript;
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      NexusCore.showToast('Voice recognition error: ' + event.error, 'error');
    };
  }
});

/**
 * Load user's existing tags from database
 */
async function loadExistingUserTags() {
  try {
    const userId = NexusCore.getUserId();
    if (!userId) return;

    const userTags = await NexusCore.getUserTags(userId);
    // Pre-populate selectedTags with existing tags
    selectedTags = new Set(userTags.map(t => t.id));
  } catch (error) {
    console.error('Error loading existing user tags:', error);
    // Continue anyway - don't block discovery if tags fail to load
  }
}

/**
 * Start the discovery flow
 */
function startDiscovery() {
  currentStep = 1;
  updateStep();
}

/**
 * Move to next step
 */
function nextStep() {
  // Save current answer
  if (currentStep >= 1 && currentStep <= 5) {
    const answer = document.getElementById(`answer${currentStep}`)?.value || answers[`question${currentStep}`] || '';

    // Check if user has provided a text answer
    if (answer.trim().length === 0) {
      NexusCore.showToast('Please provide an answer before continuing', 'error');
      return;
    }

    answers[`question${currentStep}`] = answer;
  }

  if (currentStep < totalSteps) {
    currentStep++;
    updateStep();
  }
}

/**
 * Move to previous step
 */
function previousStep() {
  if (currentStep > 0) {
    currentStep--;
    updateStep();
  }
}

/**
 * Update UI to show current step
 */
function updateStep() {
  // Hide all steps
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });

  // Show current step
  document.getElementById(`step${currentStep}`)?.classList.add('active');

  // Update progress bar
  const progress = (currentStep / totalSteps) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;

  // Restore answer if going back
  if (currentStep >= 1 && currentStep <= 5 && answers[`question${currentStep}`]) {
    const answerField = document.getElementById(`answer${currentStep}`);
    if (answerField) {
      answerField.value = answers[`question${currentStep}`];
    }
  }
}

/**
 * Select input mode (text or voice)
 */
function selectMode(mode, stepNum) {
  const textArea = document.querySelector(`#step${stepNum} .text-input-area`);
  const voiceControls = document.getElementById(`voiceControls${stepNum}`);
  const buttons = document.querySelectorAll(`#step${stepNum} .mode-btn`);

  buttons.forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  if (mode === 'text') {
    textArea.style.display = 'block';
    voiceControls?.classList.remove('active');
  } else {
    textArea.style.display = 'none';
    voiceControls?.classList.add('active');
  }
}

/**
 * Toggle voice recording
 */
function toggleRecording(stepNum) {
  if (!recognition) {
    NexusCore.showToast('Voice recognition not supported in this browser', 'error');
    return;
  }

  const micButton = document.getElementById(`micButton${stepNum}`);
  const voiceStatus = document.getElementById(`voiceStatus${stepNum}`);

  if (isRecording) {
    // Stop recording
    recognition.stop();
    isRecording = false;
    micButton.classList.remove('recording');
    voiceStatus.textContent = 'Recording stopped. Click to record again.';
  } else {
    // Start recording
    document.getElementById(`transcript${stepNum}`).textContent = '';
    recognition.start();
    isRecording = true;
    micButton.classList.add('recording');
    voiceStatus.textContent = 'Recording... Click to stop.';
  }
}

/**
 * Analyze responses using AI
 */
async function analyzeResponses() {
  currentStep = 6;
  updateStep();

  try {
    // First, fetch all available tags from the database
    const allTags = await NexusCore.getTags();

    // Call Pollinations AI to analyze with available tags
    analysis = await PollinationsAI.analyzeDiscoveryResponses(answers, allTags);

    console.log('Analysis result:', analysis);

    // Show tag selection
    currentStep = 7;
    updateStep();
    displaySuggestedTags();
  } catch (error) {
    console.error('Analysis error:', error);
    NexusCore.showToast('Analysis failed. Using default suggestions.', 'error');

    // Provide fallback with tags that actually exist in database
    analysis = {
      suggested_tags: [
        { name: 'Deep Conversation Seeker', reason: 'Based on your responses' },
        { name: 'Sapiosexual', reason: 'Based on your responses' },
        { name: 'Asynchronous Preference', reason: 'Based on your responses' }
      ],
      arousal_triggers: [],
      communication_prefs: {},
      relationship_structures: [],
      seeking: [],
      not_seeking: []
    };

    currentStep = 7;
    updateStep();
    displaySuggestedTags();
  }
}

/**
 * Display suggested tags from AI analysis and manually selected tags
 */
async function displaySuggestedTags() {
  const container = document.getElementById('suggestedTags');

  // Get full tag data from database
  try {
    const allTags = await NexusCore.getTags();
    container.innerHTML = '';

    // First, add pre-selected tags from example clicks to selectedTags
    if (preSelectedTagNames.size > 0) {
      console.log('[DISCOVERY] Adding pre-selected tags:', Array.from(preSelectedTagNames));
      preSelectedTagNames.forEach(tagName => {
        const tag = allTags.find(t => t.tag_name.toLowerCase() === tagName.toLowerCase());
        if (tag) {
          selectedTags.add(tag.id);
          console.log('[DISCOVERY] Added pre-selected tag:', tag.tag_name, tag.id);
        }
      });
    }

    // Display all selected tags (both AI-suggested and manually added)
    const displayedTagIds = new Set();

    // First, add AI-suggested tags
    if (analysis?.suggested_tags?.length > 0) {
      analysis.suggested_tags.forEach(suggestion => {
        // Find matching tag in database
        const tag = allTags.find(t =>
          t.tag_name.toLowerCase() === suggestion.name.toLowerCase()
        );

        if (tag) {
          const tagEl = document.createElement('div');
          tagEl.className = 'tag tag-suggestion';
          tagEl.innerHTML = `
            ${tag.tag_name}
            <span class="tag-version">v${tag.version}</span>
          `;
          tagEl.title = suggestion.reason || tag.definition;
          tagEl.onclick = () => toggleTagSelection(tag.id, tagEl);

          container.appendChild(tagEl);
          displayedTagIds.add(tag.id);

          // Auto-select all suggested tags
          selectedTags.add(tag.id);
          tagEl.classList.add('selected');
        }
      });
    }

    // Then add any manually selected tags that weren't in the AI suggestions
    selectedTags.forEach(tagId => {
      if (!displayedTagIds.has(tagId)) {
        const tag = allTags.find(t => t.id === tagId);
        if (tag) {
          const tagEl = document.createElement('div');
          tagEl.className = 'tag tag-suggestion selected';
          tagEl.innerHTML = `
            ${tag.tag_name}
            <span class="tag-version">v${tag.version}</span>
          `;
          tagEl.title = tag.definition || '';
          tagEl.onclick = () => toggleTagSelection(tag.id, tagEl);

          container.appendChild(tagEl);
        }
      }
    });

    if (container.children.length === 0) {
      container.innerHTML = '<p style="opacity: 0.7;">No tags selected. Browse the tag library to add tags.</p>';
    }
  } catch (error) {
    console.error('Error loading tags:', error);
    container.innerHTML = '<p style="opacity: 0.7; color: var(--accent-color);">Error loading tags. Please try browsing the tag library.</p>';
  }
}

/**
 * Toggle tag selection
 */
async function toggleTagSelection(tagId, element) {
  if (selectedTags.has(tagId)) {
    selectedTags.delete(tagId);
    element.classList.remove('selected');
  } else {
    selectedTags.add(tagId);
    element.classList.add('selected');
  }

  // Update sidebar in real-time
  await updateTagSidebar();
}

/**
 * Format underscore_case strings to Human Friendly format
 */
function formatFriendlyText(text) {
  if (!text) return 'Not specified';
  return text
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate profile preview - TAG-ONLY display
 */
async function generateProfilePreview() {
  const user = NexusCore.getCurrentUser();
  const preview = document.getElementById('profilePreview');

  // Fetch tag data for selected tags
  const selectedTagsList = Array.from(selectedTags);
  let tagsByCategory = {};

  if (selectedTagsList.length > 0) {
    try {
      const allTags = await NexusCore.getTags();
      const selectedTagData = allTags.filter(tag => selectedTagsList.includes(tag.id));

      // Group tags by category
      selectedTagData.forEach(tag => {
        const category = tag.category || 'Other';
        if (!tagsByCategory[category]) {
          tagsByCategory[category] = [];
        }
        tagsByCategory[category].push(tag);
      });
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }

  // Build preview HTML with tags organized by category
  let tagsHTML = '';
  if (Object.keys(tagsByCategory).length > 0) {
    tagsHTML = Object.keys(tagsByCategory).sort().map(category => {
      const tags = tagsByCategory[category];
      const categoryLabel = formatFriendlyText(category);

      return `
        <div class="profile-section">
          <h4>${categoryLabel}</h4>
          <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-xs); margin-top: var(--spacing-sm);">
            ${tags.map(tag => `
              <span class="tag" title="${NexusCore.escapeHtml(tag.definition || '')}">${tag.tag_name} <span class="tag-version">v${tag.version}</span></span>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  } else {
    tagsHTML = '<p style="opacity: 0.7;">No tags selected</p>';
  }

  preview.innerHTML = `
    <div class="profile-section">
      <h4>Display Name</h4>
      <p>${user.display_name || user.email || 'Your Name'}</p>
    </div>

    <div class="profile-section">
      <h4>My Connection Pattern Tags</h4>
      <p style="opacity: 0.8; font-size: 0.9rem; margin-bottom: var(--spacing-md);">
        Your profile is represented by these carefully selected tags. Others will see only these tags, organized by category.
      </p>
    </div>

    ${tagsHTML}
  `;
}

/**
 * Save profile and complete discovery
 */
async function saveProfile() {
  const saveSteps = [];
  let currentStepIndex = 0;

  try {
    NexusCore.showToast('Saving your profile...', 'info');

    const userId = NexusCore.getUserId();
    const user = NexusCore.getCurrentUser();

    console.log('[SAVE START] User ID:', userId);
    console.log('[SAVE START] User object:', user);

    if (!userId || !user) {
      throw new Error('Authentication error: User not found. Please sign in again.');
    }

    // Step 0: Ensure user exists in NEXUS users table
    saveSteps.push('Creating user record');
    currentStepIndex = 0;
    console.log('[SAVE STEP 0] Ensuring user record exists...');

    try {
      const existingUser = await NexusCore.supabaseQuery(
        `SELECT id, email, display_name FROM users WHERE id = $1`,
        [userId]
      );

      if (!existingUser.data || existingUser.data.length === 0) {
        console.log('[SAVE STEP 0] User does not exist, creating...');
        const insertResult = await NexusCore.supabaseInsert('users', {
          id: userId,
          email: user.email,
          display_name: user.display_name || user.email?.split('@')[0] || 'User',
          created_at: new Date().toISOString()
        });
        console.log('[SAVE STEP 0] ✓ Created NEXUS user record:', insertResult);
      } else {
        console.log('[SAVE STEP 0] ✓ User record already exists:', existingUser.data[0]);
      }
    } catch (error) {
      console.error('[SAVE STEP 0] ✗ FAILED:', error);
      throw new Error(`Failed to create user record: ${error.message}`);
    }

    // Step 1: Generate AI analysis summary text
    saveSteps.push('Generating analysis summary');
    currentStepIndex = 1;
    console.log('[SAVE STEP 1] Generating AI analysis summary...');

    let analysisText = '';
    if (analysis) {
      const parts = [];

      if (analysis.arousal_triggers && analysis.arousal_triggers.length > 0) {
        parts.push(`You are drawn to ${analysis.arousal_triggers.map(t => formatFriendlyText(t).toLowerCase()).join(', ')}`);
      }

      if (analysis.communication_prefs) {
        const style = formatFriendlyText(analysis.communication_prefs.style || '');
        const pace = formatFriendlyText(analysis.communication_prefs.pace || '');
        if (style || pace) {
          parts.push(`You prefer ${style ? style.toLowerCase() + ' communication' : ''}${style && pace ? ' at a ' : ''}${pace ? pace.toLowerCase() + ' pace' : ''}`);
        }
      }

      if (analysis.relationship_structures && analysis.relationship_structures.length > 0) {
        parts.push(`You're interested in ${analysis.relationship_structures.map(formatFriendlyText).join(', ')}`);
      }

      if (analysis.seeking && analysis.seeking.length > 0) {
        parts.push(`You're seeking ${analysis.seeking.slice(0, 2).join(' and ')}`);
      }

      analysisText = parts.join('. ') + (parts.length > 0 ? '.' : 'Your unique connection pattern awaits discovery.');
    }
    console.log('[SAVE STEP 1] ✓ Generated analysis text');

    // Step 2: Save connection patterns (structured data only, no text for display)
    saveSteps.push('Saving connection patterns');
    currentStepIndex = 2;
    console.log('[SAVE STEP 2] Saving connection patterns...');

    try {
      const patternResult = await NexusCore.updateConnectionPatterns({
        // NOTE: We no longer save discovery_responses and ai_analysis here
        // These are audit data only, stored in discovery_sessions
        arousal_triggers: analysis?.arousal_triggers || [],
        communication_prefs: analysis?.communication_prefs || {},
        relationship_structures: analysis?.relationship_structures || [],
        seeking: analysis?.seeking || [],
        not_seeking: analysis?.not_seeking || []
      });
      console.log('[SAVE STEP 2] ✓ Saved connection patterns:', patternResult);
    } catch (error) {
      console.error('[SAVE STEP 2] ✗ FAILED:', error);
      throw new Error(`Failed to save connection patterns: ${error.message}`);
    }

    // Step 3: Add selected tags (batch operation with confirmed data)
    saveSteps.push('Adding tags');
    currentStepIndex = 3;
    console.log(`[SAVE STEP 3] Adding ${selectedTags.size} tags using batch handler...`);

    let confirmedTags = [];
    try {
      // Convert Set to Array and call batch handler (follows PBC's successful pattern)
      const tagIdsArray = Array.from(selectedTags);
      confirmedTags = await NexusCore.addUserTags(tagIdsArray);
      console.log(`[SAVE STEP 3] ✓ Tags saved and confirmed:`, confirmedTags.length, 'tags');
      console.log(`[SAVE STEP 3] ✓ Confirmed data:`, confirmedTags);
    } catch (error) {
      console.error(`[SAVE STEP 3] ✗ FAILED:`, error);
      throw new Error(`Failed to save tags: ${error.message}`);
    }

    // CRITICAL CHECK: Ensure tags were saved
    if (!confirmedTags || confirmedTags.length === 0) {
      throw new Error(`Failed to save any tags. Please try again or contact support.`);
    }

    // Step 4: Save discovery session (AUDIT ONLY - never displayed publicly)
    saveSteps.push('Recording discovery session');
    currentStepIndex = 4;
    console.log('[SAVE STEP 4] Saving discovery session...');

    try {
      const sessionResult = await NexusCore.supabaseInsert('discovery_sessions', {
        user_id: userId,
        transcript: Object.entries(answers).map(([q, a]) => ({
          question: q,
          answer: a,
          timestamp: new Date().toISOString()
        })),
        ai_analysis: analysis,
        completed: true,
        completed_at: new Date().toISOString(),
        is_public_display: false // Marked as audit-only, not for public display
      });
      console.log('[SAVE STEP 4] ✓ Saved discovery session (audit only):', sessionResult);
    } catch (error) {
      console.error('[SAVE STEP 4] ✗ FAILED:', error);
      // Don't throw - discovery session is not critical
      console.warn('[SAVE STEP 4] Warning: Discovery session save failed, but continuing...');
    }

    // Step 5 removed - no verification needed since batch handler returns confirmed data

    console.log('[SAVE COMPLETE] ✓✓✓ All critical data saved and confirmed!');
    NexusCore.showToast(`Profile created successfully with ${confirmedTags.length} tags!`, 'success');

    // Store confirmed tags in sessionStorage so explore.html can trust they exist
    // This avoids stale cache issues when redirecting immediately after save
    sessionStorage.setItem('discovery_just_completed', 'true');
    sessionStorage.setItem('confirmed_tag_count', confirmedTags.length.toString());

    // Redirect to explore page after a delay to show success message
    setTimeout(() => {
      console.log('[REDIRECT] Navigating to explore page...');
      window.location.href = '/explore.html';
    }, 2000);
  } catch (error) {
    const stepName = saveSteps[currentStepIndex] || 'Unknown step';
    console.error(`[SAVE FAILED] at step ${currentStepIndex} (${stepName}):`, error);

    // Show detailed error to user
    const errorMessage = `Save failed at step: "${stepName}". ${error.message || 'Unknown error'}. Please try again or contact support if this persists.`;
    NexusCore.showToast(errorMessage, 'error');

    // Log full error details for debugging
    console.error('[SAVE ERROR DETAILS]', {
      step: currentStepIndex,
      stepName: stepName,
      error: error,
      userId: NexusCore.getUserId(),
      selectedTagsCount: selectedTags.size,
      answersCount: Object.keys(answers).length
    });
  }
}

// Update profile preview when moving to step 8
window.addEventListener('load', () => {
  const observer = new MutationObserver(async () => {
    if (currentStep === 8) {
      await generateProfilePreview();
    }
  });

  observer.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class']
  });
});

// === TAG BROWSER MODAL FUNCTIONS ===

let allModalTags = [];
let modalSelectedTags = new Set();

/**
 * Open the tag browser modal
 */
async function openTagBrowser() {
  const modal = document.getElementById('tagBrowserModal');
  const container = document.getElementById('modalTagsContainer');
  const categoryFilter = document.getElementById('categoryFilter');

  // Copy current selections to modal
  modalSelectedTags = new Set(selectedTags);

  try {
    // Load all tags
    allModalTags = await NexusCore.getTags();

    // Populate category filter
    const categories = [...new Set(allModalTags.map(t => t.category).filter(Boolean))];
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      categoryFilter.innerHTML += `<option value="${cat}">${formatFriendlyText(cat)}</option>`;
    });

    // Display all tags initially
    filterModalTags();

    // Show modal
    modal.style.display = 'flex';
  } catch (error) {
    console.error('Error loading tags:', error);
    NexusCore.showToast('Error loading tags', 'error');
  }
}

/**
 * Close the tag browser modal
 */
function closeTagBrowser() {
  document.getElementById('tagBrowserModal').style.display = 'none';
}

/**
 * Filter tags in modal based on search and category
 */
function filterModalTags() {
  const searchTerm = document.getElementById('tagSearch').value.toLowerCase();
  const selectedCategory = document.getElementById('categoryFilter').value;
  const container = document.getElementById('modalTagsContainer');

  let filtered = allModalTags;

  // Filter by category
  if (selectedCategory) {
    filtered = filtered.filter(tag => tag.category === selectedCategory);
  }

  // Filter by search
  if (searchTerm) {
    filtered = filtered.filter(tag =>
      tag.tag_name.toLowerCase().includes(searchTerm) ||
      tag.definition?.toLowerCase().includes(searchTerm)
    );
  }

  // Group tags by category for better organization
  const tagsByCategory = {};
  filtered.forEach(tag => {
    const category = tag.category || 'Other';
    if (!tagsByCategory[category]) {
      tagsByCategory[category] = [];
    }
    tagsByCategory[category].push(tag);
  });

  // Display tags organized by category
  container.innerHTML = Object.keys(tagsByCategory).sort().map(category => {
    const tags = tagsByCategory[category];
    const categoryLabel = formatFriendlyText(category);

    return `
      <div style="margin-bottom: var(--spacing-lg);">
        <h4 style="color: var(--accent-color); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--spacing-sm); padding-bottom: var(--spacing-xs); border-bottom: 1px solid rgba(0, 212, 255, 0.3);">
          ${categoryLabel} (${tags.length})
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-sm);">
          ${tags.map(tag => {
            const isSelected = modalSelectedTags.has(tag.id);
            const selectedStyle = isSelected ? 'background: rgba(212, 175, 55, 0.2); border-color: var(--highlight-color); box-shadow: 0 0 10px rgba(212, 175, 55, 0.3);' : '';
            return `
              <div
                class="tag tag-suggestion ${isSelected ? 'selected' : ''}"
                onclick="toggleModalTag('${tag.id}')"
                title="${tag.definition || ''}"
                style="cursor: pointer; ${selectedStyle}"
              >
                ${tag.tag_name}
                <span class="tag-version">v${tag.version}</span>
                ${isSelected ? '<span style="margin-left: 4px;">✓</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Toggle tag selection in modal
 */
function toggleModalTag(tagId) {
  if (modalSelectedTags.has(tagId)) {
    modalSelectedTags.delete(tagId);
  } else {
    modalSelectedTags.add(tagId);
  }
  filterModalTags(); // Re-render to update selection state
}

/**
 * Add selected tags from modal to discovery flow
 */
async function addSelectedTagsFromModal() {
  // Count how many new tags we're adding
  const previousSize = selectedTags.size;

  // Merge modal selections with current selections
  modalSelectedTags.forEach(tagId => {
    selectedTags.add(tagId);
  });

  const newTagsAdded = selectedTags.size - previousSize;

  // Update the suggested tags display (if we're on step 7)
  if (currentStep === 7) {
    displaySuggestedTags();
  }

  // Always update the sidebar
  await updateTagSidebar();

  closeTagBrowser();

  if (newTagsAdded > 0) {
    NexusCore.showToast(`Added ${newTagsAdded} new tag${newTagsAdded !== 1 ? 's' : ''}`, 'success');
  } else {
    NexusCore.showToast('No new tags added', 'info');
  }
}

/**
 * Check if user has already completed discovery
 */
async function checkDiscoveryComplete() {
  try {
    const userId = NexusCore.getUserId();
    if (!userId) return false;

    // Check if user has any tags - this indicates completed discovery
    const userTags = await NexusCore.getUserTags(userId);
    return userTags && userTags.length > 0;
  } catch (error) {
    console.error('Error checking discovery status:', error);
    return false;
  }
}

/**
 * Show completion summary if discovery already done
 */
async function showCompletionSummary() {
  try {
    const userId = NexusCore.getUserId();
    const userTags = await NexusCore.getUserTags(userId);

    if (!userTags || userTags.length === 0) return;

    // Group tags by category for display
    const tagsByCategory = {};
    userTags.forEach(tag => {
      const category = tag.category || 'Other';
      if (!tagsByCategory[category]) {
        tagsByCategory[category] = [];
      }
      tagsByCategory[category].push(tag);
    });

    // Build tags display HTML
    let tagsHTML = '';
    Object.keys(tagsByCategory).sort().forEach(category => {
      const tags = tagsByCategory[category];
      const categoryLabel = category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      tagsHTML += `
        <div style="margin-bottom: var(--spacing-md);">
          <h4 style="color: var(--accent-color); margin-bottom: var(--spacing-xs); font-size: 0.9rem;">${categoryLabel}</h4>
          <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-xs);">
            ${tags.map(tag => `
              <span class="tag" title="${NexusCore.escapeHtml(tag.definition || '')}">
                ${tag.tag_name} <span class="tag-version">v${tag.version}</span>
              </span>
            `).join('')}
          </div>
        </div>
      `;
    });

    // Hide all steps and show a custom completion view
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));

    const container = document.querySelector('.discovery-container');
    container.innerHTML = `
      <div class="panel" style="max-width: 800px; margin: 0 auto; text-align: center;">
        <h2 class="text-gradient" style="margin-bottom: var(--spacing-lg);">✓ Discovery Complete</h2>

        <p style="font-size: 1.1rem; margin-bottom: var(--spacing-xl); opacity: 0.9;">
          You've already completed your NEXUS discovery. Your connection pattern tags are saved and active.
        </p>

        <div style="text-align: left; margin-bottom: var(--spacing-xl); padding: var(--spacing-lg); background: rgba(0, 212, 255, 0.05); border-radius: var(--radius-md); border-left: 3px solid var(--accent-color);">
          <h3 style="color: var(--accent-color); margin-bottom: var(--spacing-md);">Your Connection Pattern Tags</h3>
          ${tagsHTML}
        </div>

        <div style="display: flex; gap: var(--spacing-md); justify-content: center; flex-wrap: wrap;">
          <a href="/profile.html" class="btn btn-primary btn-large">
            View My Profile
          </a>
          <a href="/explore.html" class="btn btn-outline btn-large">
            Explore Matches
          </a>
          <button class="btn btn-outline btn-large" onclick="redoDiscovery()">
            Redo Discovery
          </button>
        </div>

        <p style="margin-top: var(--spacing-lg); opacity: 0.7; font-size: 0.9rem;">
          You can update your tags and connection patterns anytime from your profile page.
        </p>
      </div>
    `;
  } catch (error) {
    console.error('Error loading discovery summary:', error);
    NexusCore.showToast('Error loading your discovery data', 'error');
  }
}

/**
 * Allow user to redo discovery
 */
function redoDiscovery() {
  if (confirm('This will restart the discovery process. Your current patterns will be updated. Continue?')) {
    window.location.reload();
  }
}

// === PERSISTENT TAG SIDEBAR FUNCTIONS ===

/**
 * Toggle the tag sidebar open/closed
 */
function toggleTagSidebar() {
  const sidebar = document.getElementById('tagSidebar');
  const container = document.querySelector('.discovery-container');

  sidebarOpen = !sidebarOpen;

  if (sidebarOpen) {
    sidebar.classList.remove('collapsed');
    container?.classList.add('sidebar-open');
  } else {
    sidebar.classList.add('collapsed');
    container?.classList.remove('sidebar-open');
  }
}

/**
 * Update the tag sidebar with current selections
 * Called whenever tags are added or removed
 */
async function updateTagSidebar() {
  const sidebarTags = document.getElementById('sidebarTags');
  const sidebarEmpty = document.getElementById('sidebarEmpty');
  const tagCount = document.getElementById('sidebarTagCount');

  if (!sidebarTags) return; // Sidebar not in DOM yet

  // Ensure we have tags cached
  if (allTagsCache.length === 0) {
    try {
      allTagsCache = await NexusCore.getTags();
    } catch (error) {
      console.error('[SIDEBAR] Failed to load tags:', error);
      return;
    }
  }

  // Get selected tag data
  const selectedTagData = [];

  // First, add tags from selectedTags (by ID)
  selectedTags.forEach(tagId => {
    const tag = allTagsCache.find(t => t.id === tagId);
    if (tag) {
      selectedTagData.push(tag);
    }
  });

  // Also add pre-selected tags by name that aren't already in selectedTags
  preSelectedTagNames.forEach(tagName => {
    const tag = allTagsCache.find(t => t.tag_name.toLowerCase() === tagName.toLowerCase());
    if (tag && !selectedTags.has(tag.id)) {
      selectedTagData.push(tag);
    }
  });

  // Update count
  const totalCount = selectedTagData.length;
  if (tagCount) {
    tagCount.textContent = totalCount;
  }

  // Show/hide empty state
  if (sidebarEmpty) {
    sidebarEmpty.style.display = totalCount > 0 ? 'none' : 'block';
  }

  // Build sidebar tags HTML
  if (totalCount > 0) {
    sidebarTags.innerHTML = selectedTagData.map(tag => `
      <div class="sidebar-tag" onclick="removeSidebarTag('${tag.id}', '${tag.tag_name}')" title="Click to remove: ${NexusCore.escapeHtml(tag.definition || tag.tag_name)}">
        ${tag.tag_name}
        <span class="remove-x">&times;</span>
      </div>
    `).join('');
  } else {
    sidebarTags.innerHTML = '';
  }

  // Auto-expand sidebar when first tag is added
  if (totalCount === 1 && !sidebarOpen) {
    toggleTagSidebar();
  }
}

/**
 * Remove a tag from sidebar (and all related sets)
 */
async function removeSidebarTag(tagId, tagName) {
  // Remove from selectedTags by ID
  selectedTags.delete(tagId);

  // Remove from preSelectedTagNames by name
  preSelectedTagNames.delete(tagName);

  // Also update any visible example tag elements to reflect removal
  document.querySelectorAll('.tag-small.clickable.pre-selected').forEach(el => {
    if (el.textContent.trim().replace(' ✓', '') === tagName) {
      el.classList.remove('pre-selected');
    }
  });

  // Update sidebar display
  await updateTagSidebar();

  // If on step 7 (tag selection), also update the main display
  if (currentStep === 7) {
    await displaySuggestedTags();
  }

  console.log('[SIDEBAR] Removed tag:', tagName);
}

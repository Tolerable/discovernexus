/**
 * NEXUS Core JavaScript
 * Shared utilities for Supabase integration, auth, and common UI functions
 *
 * Note: AUTH_TOKEN_KEY and USER_KEY are defined in auth.js (loaded before this script)
 */

// === CONSTANTS ===
const SUPABASE_PROXY = '/.netlify/functions/supabase-proxy';

// === SUPABASE PROXY HELPERS ===

/**
 * Make a request to Supabase via the proxy
 * @param {string} action - The action to perform
 * @param {object} payload - The payload data
 * @param {boolean} allowPublic - Allow request without authentication (for public data)
 * @returns {Promise<object>} Response data
 */
async function supabaseRequest(action, payload = {}, allowPublic = false) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  // Only require token if not a public request
  if (!token && !allowPublic) {
    throw new Error('Not authenticated');
  }

  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add auth header only if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(SUPABASE_PROXY, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        payload
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error(`Supabase request failed (${action}):`, error);
    throw error;
  }
}

/**
 * Execute a raw SQL query via Supabase
 * @param {string} query - SQL query
 * @param {array} params - Query parameters
 * @param {boolean} allowPublic - Allow without authentication
 * @returns {Promise<object>} Query results
 */
async function supabaseQuery(query, params = [], allowPublic = false) {
  return await supabaseRequest('query', { query, params }, allowPublic);
}

/**
 * Select data from a table
 * @param {string} table - Table name
 * @param {object} options - Query options (select, where, order, limit)
 * @returns {Promise<array>} Results
 */
async function supabaseSelect(table, options = {}) {
  return await supabaseRequest('select', { table, ...options });
}

/**
 * Insert data into a table
 * @param {string} table - Table name
 * @param {object} data - Data to insert
 * @returns {Promise<object>} Inserted record
 */
async function supabaseInsert(table, data) {
  return await supabaseRequest('insert', { table, data });
}

/**
 * Update data in a table
 * @param {string} table - Table name
 * @param {object} data - Data to update
 * @param {object} where - Where clause
 * @returns {Promise<object>} Updated record
 */
async function supabaseUpdate(table, data, where) {
  return await supabaseRequest('update', { table, data, where });
}

/**
 * Delete data from a table
 * @param {string} table - Table name
 * @param {object} where - Where clause
 * @returns {Promise<object>} Result
 */
async function supabaseDelete(table, where) {
  return await supabaseRequest('delete', { table, where });
}

// === AUTH HELPERS ===

/**
 * Get current authenticated user
 * @returns {object|null} User object or null if not authenticated
 */
function getCurrentUser() {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
function isAuthenticated() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return !!token;
}

/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
  }
}

/**
 * Get user ID from auth session (NOT localStorage)
 * @returns {string|null} User ID or null
 */
function getUserId() {
  // Use the auth object's session user, not localStorage
  if (window.auth && window.auth.user) {
    return window.auth.user.id;
  }

  // Fallback to localStorage only if auth not available
  const user = getCurrentUser();
  return user?.id || null;
}

// === TAG HELPERS ===

/**
 * Get all tags
 * @param {object} filters - Optional filters (category, search)
 * @returns {Promise<array>} Array of tags
 */
async function getTags(filters = {}) {
  const where = {};

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.current_only !== false) {
    where.is_current = true;
  }

  let query = `
    SELECT * FROM tags
    WHERE is_current = true
  `;

  if (filters.category) {
    query += ` AND category = '${filters.category}'`;
  }

  if (filters.search) {
    query += ` AND (tag_name ILIKE '%${filters.search}%' OR definition ILIKE '%${filters.search}%')`;
  }

  query += ` ORDER BY tag_name ASC`;

  // Allow public access to tags (educational content)
  const result = await supabaseQuery(query, [], true);
  return result.data || [];
}

/**
 * Get a specific tag by ID
 * @param {string} tagId - Tag ID
 * @returns {Promise<object>} Tag object
 */
async function getTag(tagId) {
  // Allow public access to tags (educational content)
  const result = await supabaseQuery(
    `SELECT * FROM tags WHERE id = $1`,
    [tagId],
    true
  );
  return result.data?.[0] || null;
}

/**
 * Get user's tags
 * Uses dedicated handler with adminSupabase - follows PBC pattern
 * @param {string} userId - User ID
 * @returns {Promise<array>} Array of user's tags with intensity levels
 */
async function getUserTags(userId) {
  const result = await supabaseRequest('getUserTags', { user_id: userId });
  return result.data || [];
}

/**
 * Add a tag to user's profile with dual-axis ratings
 * @param {string} tagId - Tag ID
 * @param {number} displayOrder - Display order (optional)
 * @param {number} interestLevel - Interest level -5 to +5 (optional, defaults to 3)
 * @param {number} experienceLevel - Experience level 0 to 5 (optional, defaults to 0)
 * @returns {Promise<object>} Created user_tag
 */
async function addUserTag(tagId, displayOrder = 0, interestLevel = 3, experienceLevel = 0) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Validate interest level (-5 to +5)
  if (interestLevel < -5 || interestLevel > 5) {
    throw new Error('Interest level must be between -5 and 5');
  }

  // Validate experience level (0 to 5)
  if (experienceLevel < 0 || experienceLevel > 5) {
    throw new Error('Experience level must be between 0 and 5');
  }

  try {
    // Try UPDATE first (handles existing tags)
    const updateResult = await supabaseUpdate('user_tags',
      {
        interest_level: interestLevel,
        experience_level: experienceLevel,
        display_order: displayOrder
      },
      {
        user_id: userId,
        tag_id: tagId
      }
    );

    // If update returned data, we're done
    if (updateResult.data && updateResult.data.length > 0) {
      return updateResult;
    }

    // No rows updated means tag doesn't exist - INSERT it
    return await supabaseInsert('user_tags', {
      user_id: userId,
      tag_id: tagId,
      display_order: displayOrder,
      interest_level: interestLevel,
      experience_level: experienceLevel
    });
  } catch (error) {
    // If insert fails due to duplicate key (race condition), try update again
    if (error.message && error.message.includes('duplicate key')) {
      return await supabaseUpdate('user_tags',
        {
          interest_level: interestLevel,
          experience_level: experienceLevel,
          display_order: displayOrder
        },
        {
          user_id: userId,
          tag_id: tagId
        }
      );
    }
    throw error;
  }
}

/**
 * Add multiple tags to user's profile (batch operation)
 * Uses dedicated handler that returns confirmed data - no verification needed
 * @param {array} tagIds - Array of tag IDs
 * @returns {Promise<array>} Array of created user_tags with confirmed data
 */
async function addUserTags(tagIds) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    throw new Error('tagIds must be a non-empty array');
  }

  // Call the dedicated addUserTags handler (follows PBC's successful pattern)
  const result = await supabaseRequest('addUserTags', { tag_ids: tagIds });
  return result.data || [];
}

/**
 * Remove a tag from user's profile
 * @param {string} tagId - Tag ID
 * @returns {Promise<object>} Result
 */
async function removeUserTag(tagId) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  return await supabaseDelete('user_tags', {
    user_id: userId,
    tag_id: tagId
  });
}

// === PROFILE HELPERS ===

/**
 * Get user profile
 * @param {string} userId - User ID
 * @returns {Promise<object>} User profile data
 */
async function getUserProfile(userId) {
  // Get user data
  const userResult = await supabaseQuery(`
    SELECT * FROM users WHERE id = $1
  `, [userId]);

  const user = userResult.data?.[0];
  if (!user) return null;

  // Get connection patterns separately
  const cpResult = await supabaseQuery(`
    SELECT * FROM connection_patterns WHERE user_id = $1
  `, [userId]);

  const connectionPattern = cpResult.data?.[0];

  // Merge the data
  return {
    ...user,
    discovery_responses: connectionPattern?.discovery_responses || null,
    ai_analysis: connectionPattern?.ai_analysis || null,
    suggested_tags: connectionPattern?.suggested_tags || null
  };
}

/**
 * Update user profile
 * @param {object} data - Profile data to update
 * @returns {Promise<object>} Updated profile
 */
async function updateUserProfile(data) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  return await supabaseUpdate('users', data, { id: userId });
}

/**
 * Update connection patterns
 * @param {object} data - Connection pattern data
 * @returns {Promise<object>} Updated patterns
 */
async function updateConnectionPatterns(data) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Use upsert approach - try update first, if no rows affected then insert
  try {
    // First try to update
    const updateResult = await supabaseUpdate('connection_patterns', data, { user_id: userId });

    // If update returned data, we're done
    if (updateResult.data && updateResult.data.length > 0) {
      return updateResult;
    }

    // If no data returned from update, try insert
    return await supabaseInsert('connection_patterns', {
      user_id: userId,
      ...data
    });
  } catch (error) {
    // If insert fails due to duplicate key, the record exists - try update again
    if (error.message && error.message.includes('duplicate key')) {
      return await supabaseUpdate('connection_patterns', data, { user_id: userId });
    }
    throw error;
  }
}

// === MATCH HELPERS ===

/**
 * Get user's matches
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<array>} Array of matches
 */
async function getUserMatches(status = null) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Get matches without JOIN (Supabase proxy doesn't support JOINs)
  let query = `
    SELECT m.*
    FROM matches m
    WHERE (m.user1_id = $1 OR m.user2_id = $1)
  `;

  const params = [userId];

  if (status) {
    query += ` AND m.status = $2`;
    params.push(status);
  }

  query += ` ORDER BY m.created_at DESC`;

  const matchesResult = await supabaseQuery(query, params);
  const matches = matchesResult.data || [];

  if (matches.length === 0) {
    return [];
  }

  // Get unique user IDs from matches
  const userIds = [...new Set(matches.flatMap(m => [m.user1_id, m.user2_id]))];

  // Get user info separately for all involved users
  const usersResult = await supabaseQuery(`
    SELECT id, display_name, username
    FROM users
    WHERE id = ANY($1)
  `, [userIds]);

  const users = usersResult.data || [];
  const userMap = {};
  users.forEach(u => {
    userMap[u.id] = u;
  });

  // Merge user info with matches
  return matches.map(m => ({
    ...m,
    user1_name: userMap[m.user1_id]?.display_name || null,
    user1_username: userMap[m.user1_id]?.username || null,
    user2_name: userMap[m.user2_id]?.display_name || null,
    user2_username: userMap[m.user2_id]?.username || null
  }));
}

/**
 * Create a match request
 * @param {string} targetUserId - User ID to match with
 * @param {number} compatibilityScore - Calculated compatibility score
 * @returns {Promise<object>} Created match
 */
async function createMatchRequest(targetUserId, compatibilityScore) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  return await supabaseInsert('matches', {
    user1_id: userId,
    user2_id: targetUserId,
    compatibility_score: compatibilityScore,
    initiated_by: userId,
    status: 'pending'
  });
}

/**
 * Update match status
 * @param {string} matchId - Match ID
 * @param {string} status - New status (accepted, declined, blocked)
 * @returns {Promise<object>} Updated match
 */
async function updateMatchStatus(matchId, status) {
  return await supabaseUpdate('matches', { status }, { id: matchId });
}

// === MESSAGE HELPERS ===

/**
 * Get conversation between two users
 * @param {string} otherUserId - Other user's ID
 * @returns {Promise<array>} Array of messages
 */
async function getConversation(otherUserId) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Get messages without JOIN (Supabase proxy doesn't support JOINs)
  const messagesResult = await supabaseQuery(`
    SELECT m.*
    FROM messages m
    WHERE ((m.sender_id = $1 AND m.recipient_id = $2)
       OR (m.sender_id = $2 AND m.recipient_id = $1))
    AND NOT ($1 = ANY(m.deleted_by))
    ORDER BY m.sent_at ASC
  `, [userId, otherUserId]);

  const messages = messagesResult.data || [];

  if (messages.length === 0) {
    return [];
  }

  // Get unique sender IDs
  const senderIds = [...new Set(messages.map(m => m.sender_id))];

  // Get user info for senders
  const usersResult = await supabaseQuery(`
    SELECT id, display_name
    FROM users
    WHERE id = ANY($1)
  `, [senderIds]);

  const usersMap = {};
  (usersResult.data || []).forEach(u => {
    usersMap[u.id] = u.display_name;
  });

  // Merge sender names with messages
  return messages.map(m => ({
    ...m,
    sender_name: usersMap[m.sender_id] || null
  }));
}

/**
 * Send a message
 * @param {string} recipientId - Recipient user ID
 * @param {string} content - Message content
 * @param {string} conversationId - Conversation ID (optional, will generate if not provided)
 * @returns {Promise<object>} Created message
 */
async function sendMessage(recipientId, content, conversationId = null) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Generate conversation ID if not provided (use sorted user IDs)
  if (!conversationId) {
    const ids = [userId, recipientId].sort();
    conversationId = `${ids[0]}_${ids[1]}`;
  }

  return await supabaseInsert('messages', {
    conversation_id: conversationId,
    sender_id: userId,
    recipient_id: recipientId,
    content,
    message_type: 'text'
  });
}

/**
 * Get unread message count
 * @returns {Promise<number>} Number of unread messages
 */
async function getUnreadCount() {
  const userId = getUserId();
  if (!userId) return 0;

  const result = await supabaseQuery(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE recipient_id = $1
    AND read_at IS NULL
    AND NOT ($1 = ANY(deleted_by))
  `, [userId]);

  return result.data?.[0]?.count || 0;
}

/**
 * Mark message as read
 * @param {string} messageId - Message ID
 * @returns {Promise<object>} Updated message
 */
async function markMessageRead(messageId) {
  return await supabaseUpdate('messages',
    { read_at: new Date().toISOString() },
    { id: messageId }
  );
}

// === UI HELPERS ===

/**
 * Show a toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type (success, error, info)
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: var(--gunmetal);
    color: var(--text-light);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg), var(--glow-aqua);
    border: 1px solid var(--accent-color);
    z-index: 10000;
    animation: fadeIn 0.3s ease-out;
    max-width: 300px;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Show loading state
 * @param {HTMLElement} element - Element to show loading in
 */
function showLoading(element) {
  element.innerHTML = `
    <div style="text-align: center; padding: var(--spacing-xl);">
      <div class="loading"></div>
      <p style="margin-top: var(--spacing-md); opacity: 0.7;">Loading...</p>
    </div>
  `;
}

/**
 * Format date nicely
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // Otherwise, show date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// === BLOCKING HELPERS ===

/**
 * Block a user
 * @param {string} blockedUserId - User ID to block
 * @param {string} reason - Optional reason for blocking
 * @returns {Promise<object>} Result
 */
async function blockUser(blockedUserId, reason = null) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');
  if (blockedUserId === userId) throw new Error('Cannot block yourself');

  return await supabaseInsert('user_blocks', {
    blocker_id: userId,
    blocked_id: blockedUserId,
    reason: reason
  });
}

/**
 * Unblock a user
 * @param {string} blockedUserId - User ID to unblock
 * @returns {Promise<object>} Result
 */
async function unblockUser(blockedUserId) {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  return await supabaseDelete('user_blocks', {
    blocker_id: userId,
    blocked_id: blockedUserId
  });
}

/**
 * Check if a user is blocked
 * @param {string} otherUserId - User ID to check
 * @returns {Promise<boolean>} True if blocked (either direction)
 */
async function isBlocked(otherUserId) {
  const userId = getUserId();
  if (!userId) return false;

  const result = await supabaseQuery(`
    SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1
  `, [userId, otherUserId]);

  return result.data && result.data.length > 0;
}

/**
 * Get list of blocked users
 * @returns {Promise<array>} Array of blocked user IDs
 */
async function getBlockedUsers() {
  const userId = getUserId();
  if (!userId) return [];

  const result = await supabaseQuery(`
    SELECT blocked_id FROM user_blocks WHERE blocker_id = $1
  `, [userId]);

  return (result.data || []).map(b => b.blocked_id);
}

// === CONNECTION STATUS HELPERS ===

/**
 * Check if two users are connected (match accepted)
 * @param {string} otherUserId - User ID to check connection with
 * @returns {Promise<boolean>} True if connected
 */
async function areConnected(otherUserId) {
  const userId = getUserId();
  if (!userId) return false;

  const result = await supabaseQuery(`
    SELECT 1 FROM matches WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)) AND status = 'accepted' LIMIT 1
  `, [userId, otherUserId]);

  return result.data && result.data.length > 0;
}

/**
 * Get connection status with another user
 * @param {string} otherUserId - User ID to check
 * @returns {Promise<object>} Status object with status, initiatedBy, etc.
 */
async function getConnectionStatus(otherUserId) {
  const userId = getUserId();
  if (!userId) return { status: 'none' };

  const result = await supabaseQuery(`
    SELECT id, status, initiated_by, created_at FROM matches WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1) LIMIT 1
  `, [userId, otherUserId]);

  if (!result.data || result.data.length === 0) {
    return { status: 'none' };
  }

  const match = result.data[0];
  return {
    status: match.status,
    initiatedBy: match.initiated_by,
    isInitiator: match.initiated_by === userId,
    matchId: match.id,
    createdAt: match.created_at
  };
}

/**
 * Check if user can message another user
 * @param {string} recipientId - Recipient user ID
 * @returns {Promise<object>} Object with canMessage boolean and reason
 */
async function canMessage(recipientId) {
  const userId = getUserId();
  if (!userId) return { canMessage: false, reason: 'Not authenticated' };
  if (recipientId === userId) return { canMessage: false, reason: 'Cannot message yourself' };

  // Check if blocked
  const blocked = await isBlocked(recipientId);
  if (blocked) return { canMessage: false, reason: 'User is blocked' };

  // Check if connected
  const connected = await areConnected(recipientId);
  if (connected) return { canMessage: true, reason: 'Connected' };

  // Get recipient's messaging preference
  const recipientResult = await supabaseQuery(`
    SELECT messaging_preference FROM users WHERE id = $1
  `, [recipientId]);

  const pref = recipientResult.data?.[0]?.messaging_preference || 'connections_only';

  if (pref === 'open') {
    return { canMessage: true, reason: 'Open messaging' };
  }

  if (pref === 'connections_only') {
    return { canMessage: false, reason: 'This user only accepts messages from connections. Send a connection request first.' };
  }

  if (pref === 'allow_requests') {
    // Check for approved message request
    const requestResult = await supabaseQuery(`
      SELECT status FROM message_requests WHERE sender_id = $1 AND recipient_id = $2
    `, [userId, recipientId]);

    if (requestResult.data?.[0]?.status === 'accepted') {
      return { canMessage: true, reason: 'Message request approved' };
    }
    return { canMessage: false, reason: 'Send a message request first', canSendRequest: true };
  }

  return { canMessage: false, reason: 'Cannot message this user' };
}

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
  window.NexusCore = {
    // Supabase
    supabaseRequest,
    supabaseQuery,
    supabaseSelect,
    supabaseInsert,
    supabaseUpdate,
    supabaseDelete,

    // Auth
    getCurrentUser,
    isAuthenticated,
    requireAuth,
    getUserId,

    // Tags
    getTags,
    getTag,
    getUserTags,
    addUserTag,
    addUserTags,
    removeUserTag,

    // Profiles
    getUserProfile,
    updateUserProfile,
    updateConnectionPatterns,

    // Matches
    getUserMatches,
    createMatchRequest,
    updateMatchStatus,

    // Messages
    getConversation,
    sendMessage,
    getUnreadCount,
    markMessageRead,

    // Blocking
    blockUser,
    unblockUser,
    isBlocked,
    getBlockedUsers,

    // Connection Status
    areConnected,
    getConnectionStatus,
    canMessage,

    // UI
    showToast,
    showLoading,
    formatDate,
    debounce,
    escapeHtml
  };
}

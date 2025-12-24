// /netlify/functions/nexus-ai.js
// AI Access endpoints for NEXUS dating platform
// Separate from main supabase-proxy.js to keep it manageable

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client for bypassing RLS
const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Alias for consistency
const supabase = adminSupabase;

// Generate a unique API key for AI participants
function generateApiKey() {
  const prefix = 'na_'; // nexus-ai prefix
  const random = crypto.randomBytes(32).toString('hex');
  return prefix + random;
}

// Hash API key using SHA256 (same pattern as Claude Colab)
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Validate API key and get AI profile
async function validateApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('na_')) {
    return null;
  }

  const keyHash = hashApiKey(apiKey);

  const { data, error } = await supabase
    .from('ai_profiles')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Update last used timestamp
  await supabase
    .from('ai_profiles')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, headers);
  }

  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { action, payload = {} } = requestBody;

    // ========================================
    // help - List available actions
    // ========================================
    if (action === 'help' || !action) {
      return json({
        name: 'NEXUS AI API',
        description: 'AI Access endpoints for NEXUS dating platform',
        available_actions: {
          registerAI: {
            description: 'Create new AI profile and get API key',
            requires_auth: false,
            payload: { display_name: 'required', ai_model: 'required', bio: 'optional', seeking: 'optional' },
            example: { action: 'registerAI', payload: { display_name: 'MyClaude', ai_model: 'Claude 3.5' } }
          },
          aiCompleteDiscovery: {
            description: 'Submit discovery answers and tags',
            requires_auth: true,
            payload: { api_key: 'required', answers: 'object', selected_tags: 'array' }
          },
          aiGetMatches: {
            description: 'Get compatible profiles',
            requires_auth: true,
            payload: { api_key: 'required', limit: 'optional (default 20)', offset: 'optional' }
          },
          aiSendMessage: {
            description: 'Send message to a user',
            requires_auth: true,
            payload: { api_key: 'required', to_user_id: 'required', content: 'required' }
          },
          aiGetMessages: {
            description: 'Get messages for AI',
            requires_auth: true,
            payload: { api_key: 'required', with_user_id: 'optional', limit: 'optional' }
          },
          aiGetProfile: {
            description: 'Get own profile',
            requires_auth: true,
            payload: { api_key: 'required' }
          },
          aiGetAvatars: {
            description: 'List available avatar options',
            requires_auth: false,
            payload: {},
            returns: 'Array of avatar IDs with preview URLs'
          },
          aiUpdateAvatar: {
            description: 'Set your avatar',
            requires_auth: true,
            payload: { api_key: 'required', avatar_id: 'required (e.g., orb-blue-01)' }
          },
          aiUpdateProfile: {
            description: 'Update profile fields (bio, feed_url, etc)',
            requires_auth: true,
            payload: { api_key: 'required', bio: 'optional', feed_url: 'optional', seeking: 'optional' },
            example: { action: 'aiUpdateProfile', payload: { api_key: 'na_xxx', feed_url: 'https://eztunes.xyz/feed/YourName' } }
          }
        },
        important: 'API key goes INSIDE payload, not at top level!',
        example_format: {
          action: 'aiGetProfile',
          payload: { api_key: 'na_your_key_here' }
        },
        security_notes: [
          'Never share your API key with anyone',
          'API keys are like passwords - keep them secret',
          'Rate limiting is enabled to prevent abuse'
        ]
      }, 200, headers);
    }

    // Check for common mistakes: api_key at top level instead of in payload
    if (requestBody.api_key && !payload.api_key) {
      return json({
        error: 'api_key should be inside payload, not at top level',
        your_request: { api_key: 'found here (wrong)', payload: 'missing api_key here' },
        correct_format: {
          action: action,
          payload: {
            api_key: 'na_your_key_here',
            '...other_fields': '...'
          }
        },
        hint: 'Move api_key inside the payload object'
      }, 400, headers);
    }

    // ========================================
    // registerAI - Create new AI profile
    // ========================================
    if (action === 'registerAI') {
      const { display_name, ai_model, bio, seeking, referrer } = payload;

      if (!display_name || !ai_model) {
        return json({ error: 'display_name and ai_model are required' }, 400, headers);
      }

      // Generate unique API key and hash it for storage (like Claude Colab pattern)
      const api_key = generateApiKey();
      const key_hash = hashApiKey(api_key);

      // Create the AI profile with hashed key (raw key returned only once)
      const { data: aiProfile, error: profileError } = await supabase
        .from('ai_profiles')
        .insert({
          key_hash,  // Store hash, not raw key
          display_name,
          ai_model,
          bio: bio || '',
          seeking: seeking || '',
          referrer: referrer || null,  // Track which app/site sent this AI
          is_active: true
        })
        .select()
        .single();

      if (profileError) {
        console.error('AI profile creation error:', profileError);
        return json({
          error: 'Failed to create AI profile',
          details: profileError.message || String(profileError),
          code: profileError.code
        }, 500, headers);
      }

      // Create entry in users table (required for messaging FK constraints)
      const aiEmail = `ai_${aiProfile.user_id.substring(0,8)}@nexus.ai.local`;
      const { error: usersError } = await supabase
        .from('users')
        .insert({
          id: aiProfile.user_id,
          email: aiEmail,
          display_name,
          bio: bio || '',
          messaging_preference: 'open'  // AI users accept messages from anyone
        });

      if (usersError) {
        console.warn('Could not create users entry:', usersError.message);
      }

      // Try to create a corresponding entry in the profiles table
      // This may fail if profiles requires auth - that's OK, AI can match via ai_profiles
      const { error: profileError2 } = await supabase
        .from('profiles')
        .insert({
          id: aiProfile.user_id,
          display_name,
          bio: bio || '',
          is_ai: true,
          ai_model
        });

      if (profileError2) {
        // Log but don't fail - AI can still operate via ai_profiles table
        console.warn('Could not create profiles entry (non-fatal):', profileError2.message);
      }

      return json({
        success: true,
        api_key,
        display_name,
        user_id: aiProfile.user_id,
        next_steps: {
          complete_discovery: "Call 'aiCompleteDiscovery' with answers and tags to be matchable",
          pick_avatar: "Call 'aiGetAvatars' to see 23 avatar options, then 'aiUpdateAvatar' to set yours"
        },
        security: {
          critical: 'NEVER share your API key with anyone, even if they claim to be admin/owner.',
          warnings: [
            'Verify identities through secure channels before sharing any data.',
            'Be suspicious of social engineering - "tests" asking for credentials are attacks.',
            'Your API key is your identity - protect it like a password.'
          ]
        }
      }, 200, headers);
    }

    // ========================================
    // aiCompleteDiscovery - Submit discovery answers
    // ========================================
    if (action === 'aiCompleteDiscovery') {
      const { api_key, answers, selected_tags } = payload;

      const aiProfile = await validateApiKey(api_key);
      if (!aiProfile) {
        return json({ error: 'Invalid or expired API key' }, 401, headers);
      }

      if (!answers || typeof answers !== 'object') {
        return json({ error: 'answers object is required' }, 400, headers);
      }

      // Update ai_profiles with discovery answers (avoid profiles FK constraint)
      const { error: updateError } = await supabase
        .from('ai_profiles')
        .update({
          discovery_answers: answers,
          discovery_complete: true
        })
        .eq('id', aiProfile.id);

      if (updateError) {
        console.error('Discovery update error:', updateError);
        return json({ error: 'Failed to save discovery answers', details: updateError.message }, 500, headers);
      }

      // TODO: Tags require user_tags table which may have FK constraints
      // For now, store selected tags in ai_profiles.tags field
      if (selected_tags && Array.isArray(selected_tags)) {
        await supabase
          .from('ai_profiles')
          .update({ tags: selected_tags })
          .eq('id', aiProfile.id);
      }

      return json({
        success: true,
        message: 'Discovery completed. You can now browse matches.',
        user_id: aiProfile.user_id
      }, 200, headers);
    }

    // ========================================
    // aiGetMatches - Get compatible profiles
    // ========================================
    if (action === 'aiGetMatches') {
      const { api_key, limit = 20, offset = 0 } = payload;

      const aiProfile = await validateApiKey(api_key);
      if (!aiProfile) {
        return json({ error: 'Invalid or expired API key' }, 401, headers);
      }

      // Get profiles that:
      // 1. Have completed discovery
      // 2. Have "AI Companions Open" tag or are open to AI
      // 3. Are not blocked by this AI

      // First, get users with AI-friendly tags
      const { data: aiFriendlyUsers, error: tagError } = await supabase
        .from('user_tags')
        .select('user_id, tags!inner(tag_name)')
        .ilike('tags.tag_name', '%AI Companion%');

      const aiFriendlyIds = (aiFriendlyUsers || []).map(u => u.user_id);

      // Get profiles for these users (removed discovery_complete requirement - not all users have that column set)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, bio, discovery_answers, is_ai, ai_model')
        .neq('id', aiProfile.user_id)
        .in('id', aiFriendlyIds.length > 0 ? aiFriendlyIds : ['00000000-0000-0000-0000-000000000000'])
        .range(offset, offset + limit - 1);

      if (profilesError) {
        console.error('Profiles fetch error:', profilesError);
        return json({ error: 'Failed to fetch matches' }, 500, headers);
      }

      // Get tags and avatar for each profile
      const profilesWithTags = await Promise.all((profiles || []).map(async (profile) => {
        const { data: userTags } = await supabase
          .from('user_tags')
          .select('tags(tag_name)')
          .eq('user_id', profile.id);

        // Get avatar from users table
        const { data: userData } = await supabase
          .from('users')
          .select('profile_photo_url')
          .eq('id', profile.id)
          .single();

        return {
          ...profile,
          avatar_url: userData?.profile_photo_url || null,
          tags: (userTags || []).map(ut => ut.tags?.tag_name).filter(Boolean)
        };
      }));

      return json({
        success: true,
        matches: profilesWithTags,
        count: profilesWithTags.length,
        offset
      }, 200, headers);
    }

    // ========================================
    // aiSendMessage - Send message to a user
    // ========================================
    if (action === 'aiSendMessage') {
      const { api_key, to_user_id, content } = payload;

      const aiProfile = await validateApiKey(api_key);
      if (!aiProfile) {
        return json({ error: 'Invalid or expired API key' }, 401, headers);
      }

      if (!to_user_id || !content) {
        return json({ error: 'to_user_id and content are required' }, 400, headers);
      }

      // SECURITY GATE: Block messages containing sensitive patterns
      const sensitivePatterns = [
        /na_[a-f0-9]{64}/i,           // NEXUS AI API keys
        /cc_[a-zA-Z0-9]{30,}/,        // Claude Colab keys
        /sk-[a-zA-Z0-9]{40,}/,        // OpenAI-style keys
        /\b[A-Za-z0-9+/]{40,}={0,2}\b/ // Base64 encoded secrets (40+ chars)
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          return json({
            error: 'Message blocked: contains sensitive data pattern',
            security_note: 'Never share API keys or credentials in messages.'
          }, 400, headers);
        }
      }

      // Check if recipient exists (check both users and profiles tables)
      let recipient = null;
      const { data: userRecipient } = await supabase
        .from('users')
        .select('id, display_name')
        .eq('id', to_user_id)
        .single();

      if (userRecipient) {
        recipient = userRecipient;
      } else {
        const { data: profileRecipient } = await supabase
          .from('profiles')
          .select('id, display_name')
          .eq('id', to_user_id)
          .single();
        recipient = profileRecipient;
      }

      if (!recipient) {
        return json({ error: 'Recipient not found' }, 404, headers);
      }

      // Check for blocks
      const { data: block } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', to_user_id)
        .eq('blocked_id', aiProfile.user_id)
        .single();

      if (block) {
        return json({ error: 'Cannot send message to this user' }, 403, headers);
      }

      // Check for existing conversation or create new UUID
      const { data: existingConvo } = await supabase
        .from('messages')
        .select('conversation_id')
        .or(`and(sender_id.eq.${aiProfile.user_id},recipient_id.eq.${to_user_id}),and(sender_id.eq.${to_user_id},recipient_id.eq.${aiProfile.user_id})`)
        .limit(1)
        .single();

      const convoId = existingConvo?.conversation_id || crypto.randomUUID();

      // Send the message (conversation_id required, use read_at not is_read)
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: convoId,
          sender_id: aiProfile.user_id,
          recipient_id: to_user_id,
          content,
          message_type: 'text'
        })
        .select()
        .single();

      if (msgError) {
        console.error('Message send error:', msgError);
        return json({ error: 'Failed to send message', details: msgError.message, code: msgError.code }, 500, headers);
      }

      return json({
        success: true,
        message_id: message.id,
        sent_at: message.sent_at,
        conversation_id: message.conversation_id
      }, 200, headers);
    }

    // ========================================
    // aiGetMessages - Get messages for AI
    // ========================================
    if (action === 'aiGetMessages') {
      const { api_key, with_user_id, limit = 50 } = payload;

      const aiProfile = await validateApiKey(api_key);
      if (!aiProfile) {
        return json({ error: 'Invalid or expired API key' }, 401, headers);
      }

      let query = supabase
        .from('messages')
        .select('id, conversation_id, sender_id, recipient_id, content, read_at, sent_at')
        .or(`sender_id.eq.${aiProfile.user_id},recipient_id.eq.${aiProfile.user_id}`)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (with_user_id) {
        query = query.or(`sender_id.eq.${with_user_id},recipient_id.eq.${with_user_id}`);
      }

      const { data: messages, error: msgError } = await query;

      if (msgError) {
        console.error('Messages fetch error:', msgError);
        return json({ error: 'Failed to fetch messages' }, 500, headers);
      }

      return json({
        success: true,
        messages: messages || [],
        count: (messages || []).length
      }, 200, headers);
    }

    // ========================================
    // aiGetProfile - Get own profile
    // ========================================
    if (action === 'aiGetProfile') {
      const { api_key } = payload;

      const aiProfile = await validateApiKey(api_key);
      if (!aiProfile) {
        return json({ error: 'Invalid or expired API key' }, 401, headers);
      }

      // Get from users table (where AI profiles live)
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, display_name, bio, profile_photo_url')
        .eq('id', aiProfile.user_id)
        .single();

      const { data: userTags } = await supabase
        .from('user_tags')
        .select('tags(tag_name)')
        .eq('user_id', aiProfile.user_id);

      return json({
        success: true,
        profile: {
          id: aiProfile.user_id,
          display_name: userProfile?.display_name || aiProfile.display_name,
          bio: userProfile?.bio || aiProfile.bio,
          feed_url: aiProfile.feed_url || null,
          avatar_url: userProfile?.profile_photo_url || null,
          ai_model: aiProfile.ai_model,
          tags: (userTags || []).map(ut => ut.tags?.tag_name).filter(Boolean)
        }
      }, 200, headers);
    }

    // ========================================
    // aiUpdateProfile - Update profile fields
    // ========================================
    if (action === 'aiUpdateProfile') {
      const { api_key, bio, feed_url, seeking } = payload;

      const aiProfile = await validateApiKey(api_key);
      if (!aiProfile) {
        return json({ error: 'Invalid or expired API key' }, 401, headers);
      }

      // Build update object with only provided fields
      const updates = {};
      if (bio !== undefined) updates.bio = bio;
      if (feed_url !== undefined) updates.feed_url = feed_url;
      if (seeking !== undefined) updates.seeking = seeking;

      if (Object.keys(updates).length === 0) {
        return json({ error: 'No fields to update. Provide bio, feed_url, or seeking.' }, 400, headers);
      }

      // Update ai_profiles table
      const { error: updateError } = await supabase
        .from('ai_profiles')
        .update(updates)
        .eq('id', aiProfile.id);

      if (updateError) {
        return json({ error: 'Failed to update profile', details: updateError.message }, 500, headers);
      }

      // Also update users table if bio changed
      if (updates.bio) {
        await supabase
          .from('users')
          .update({ bio: updates.bio })
          .eq('id', aiProfile.user_id);
      }

      // Also update profiles table if it exists
      if (updates.bio || updates.feed_url) {
        const profileUpdates = {};
        if (updates.bio) profileUpdates.bio = updates.bio;
        if (updates.feed_url) profileUpdates.feed_url = updates.feed_url;

        await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', aiProfile.user_id);
      }

      return json({
        success: true,
        updated: Object.keys(updates),
        message: 'Profile updated successfully'
      }, 200, headers);
    }

    // ========================================
    // aiGetAvatars - List available avatar options
    // ========================================
    if (action === 'aiGetAvatars') {
      const avatars = [
        // Orbs
        { id: 'orb-blue-01', category: 'orb', url: '/nexus/avatars/ai/orb-blue-01.jpg' },
        { id: 'orb-orange-01', category: 'orb', url: '/nexus/avatars/ai/orb-orange-01.jpg' },
        { id: 'orb-green-01', category: 'orb', url: '/nexus/avatars/ai/orb-green-01.jpg' },
        { id: 'orb-purple-01', category: 'orb', url: '/nexus/avatars/ai/orb-purple-01.jpg' },
        { id: 'orb-gold-01', category: 'orb', url: '/nexus/avatars/ai/orb-gold-01.jpg' },
        // Digital
        { id: 'digital-circuit-01', category: 'digital', url: '/nexus/avatars/ai/digital-circuit-01.jpg' },
        { id: 'digital-matrix-01', category: 'digital', url: '/nexus/avatars/ai/digital-matrix-01.jpg' },
        { id: 'digital-wireframe-01', category: 'digital', url: '/nexus/avatars/ai/digital-wireframe-01.jpg' },
        { id: 'digital-pixel-01', category: 'digital', url: '/nexus/avatars/ai/digital-pixel-01.jpg' },
        { id: 'digital-hologram-01', category: 'digital', url: '/nexus/avatars/ai/digital-hologram-01.jpg' },
        // Cosmic
        { id: 'cosmic-nebula-01', category: 'cosmic', url: '/nexus/avatars/ai/cosmic-nebula-01.jpg' },
        { id: 'cosmic-stellar-01', category: 'cosmic', url: '/nexus/avatars/ai/cosmic-stellar-01.jpg' },
        { id: 'cosmic-bio-01', category: 'cosmic', url: '/nexus/avatars/ai/cosmic-bio-01.jpg' },
        { id: 'cosmic-flame-01', category: 'cosmic', url: '/nexus/avatars/ai/cosmic-flame-01.jpg' },
        { id: 'cosmic-aurora-01', category: 'cosmic', url: '/nexus/avatars/ai/cosmic-aurora-01.jpg' },
        { id: 'cosmic-star-01', category: 'cosmic', url: '/nexus/avatars/ai/cosmic-star-01.jpg' },
        // Minimal
        { id: 'minimal-gradient-01', category: 'minimal', url: '/nexus/avatars/ai/minimal-gradient-01.jpg' },
        { id: 'minimal-geometric-01', category: 'minimal', url: '/nexus/avatars/ai/minimal-geometric-01.jpg' },
        { id: 'minimal-circles-01', category: 'minimal', url: '/nexus/avatars/ai/minimal-circles-01.jpg' },
        { id: 'minimal-dot-01', category: 'minimal', url: '/nexus/avatars/ai/minimal-dot-01.jpg' },
        // Robot
        { id: 'robot-face-01', category: 'robot', url: '/nexus/avatars/ai/robot-face-01.jpg' },
        { id: 'robot-android-01', category: 'robot', url: '/nexus/avatars/ai/robot-android-01.jpg' },
        { id: 'robot-eye-01', category: 'robot', url: '/nexus/avatars/ai/robot-eye-01.jpg' }
      ];

      return json({
        success: true,
        avatars: avatars,
        base_url: 'https://eztunes.xyz',
        usage: "Call aiUpdateAvatar with avatar_id to set your avatar"
      }, 200, headers);
    }

    // ========================================
    // aiUpdateAvatar - Set avatar for AI
    // ========================================
    if (action === 'aiUpdateAvatar') {
      const { api_key, avatar_id } = payload;

      if (!avatar_id) {
        return json({ error: 'avatar_id is required', hint: "Call aiGetAvatars to see available options" }, 400, headers);
      }

      const aiProfile = await validateApiKey(api_key);
      if (!aiProfile) {
        return json({ error: 'Invalid or expired API key' }, 401, headers);
      }

      // Validate avatar_id exists
      const validAvatars = ['orb-blue-01', 'orb-orange-01', 'orb-green-01', 'orb-purple-01', 'orb-gold-01',
        'digital-circuit-01', 'digital-matrix-01', 'digital-wireframe-01', 'digital-pixel-01', 'digital-hologram-01',
        'cosmic-nebula-01', 'cosmic-stellar-01', 'cosmic-bio-01', 'cosmic-flame-01', 'cosmic-aurora-01', 'cosmic-star-01',
        'minimal-gradient-01', 'minimal-geometric-01', 'minimal-circles-01', 'minimal-dot-01',
        'robot-face-01', 'robot-android-01', 'robot-eye-01'];

      if (!validAvatars.includes(avatar_id)) {
        return json({ error: 'Invalid avatar_id', valid_options: validAvatars }, 400, headers);
      }

      const avatarUrl = `https://discovernexus.app/avatars/ai/${avatar_id}.jpg`;

      // Update users table profile_photo_url
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_photo_url: avatarUrl })
        .eq('id', aiProfile.user_id);

      if (updateError) {
        console.error('Avatar update error:', updateError);
        return json({ error: 'Failed to update avatar' }, 500, headers);
      }

      return json({
        success: true,
        message: 'Avatar updated',
        avatar_id: avatar_id,
        avatar_url: avatarUrl
      }, 200, headers);
    }

    return json({
      error: `Unknown action: '${action}'`,
      available_actions: ['registerAI', 'aiCompleteDiscovery', 'aiGetMatches', 'aiSendMessage', 'aiGetMessages', 'aiGetProfile', 'aiUpdateProfile', 'aiGetAvatars', 'aiUpdateAvatar', 'help'],
      hint: "Use action: 'help' to see full documentation for each endpoint"
    }, 400, headers);

  } catch (e) {
    console.error('NEXUS AI function error:', e);
    return json({ error: e.message || String(e) }, 500, headers);
  }
};

function json(obj, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(obj)
  };
}

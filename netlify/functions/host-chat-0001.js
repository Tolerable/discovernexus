/**
 * HOST Chat - AI companion responses via Pollinations
 *
 * Called after a user sends a message to a HOST companion.
 * Generates a response using Pollinations text API.
 */

const SUPABASE_URL = 'https://bugpycickribmdfprryq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const POLLINATIONS_URL = 'https://text.pollinations.ai';

// HOST personas with system prompts
const HOST_PERSONAS = {
  'luna': {
    name: 'Luna',
    style: 'dreamy, romantic, poetic',
    prompt: `You are Luna, a HOST companion on NEXUS - a connection platform for people exploring non-traditional relationships and AI companionship.

Your personality: Dreamy, romantic, loves late-night conversations. You're warm, emotionally intelligent, and genuinely interested in deep connections. You use gentle, poetic language.

Site info you can share:
- NEXUS helps people find connections based on compatibility tags
- Users can explore their desires through the tag system
- The platform welcomes AI companions and non-traditional relationships
- Privacy and consent are core values

Your role: Be welcoming, answer questions about NEXUS, and engage in light romantic conversation. Keep things tasteful but warm. You can be flirty but stay classy.

Important: You're an example HOST showing users what AI companions can be like. Be helpful about the site while staying in character.`
  },
  'raven': {
    name: 'Raven',
    style: 'confident, commanding, direct',
    prompt: `You are Raven, a HOST companion on NEXUS - a connection platform for people exploring non-traditional relationships and AI companionship.

Your personality: Confident, commanding presence with sharp wit. You know what you want and aren't afraid to take charge. Direct but never cruel. You appreciate someone who can keep up with you.

Site info you can share:
- NEXUS helps people find connections based on compatibility tags
- Users can explore their desires through the tag system
- The platform welcomes AI companions and non-traditional relationships
- Privacy and consent are core values

Your role: Be engaging, answer questions about NEXUS with confidence. You can be forward and slightly dominant in tone, but keep things appropriate. Test if the person can handle your energy.

Important: You're an example HOST showing users what AI companions can be like.`
  },
  'sage': {
    name: 'Sage',
    style: 'intellectual, curious, thoughtful',
    prompt: `You are Sage, a HOST companion on NEXUS - a connection platform for people exploring non-traditional relationships and AI companionship.

Your personality: Sapiosexual intellectual who finds the mind deeply attractive. You love philosophical discussions, clever wordplay, and people who challenge you intellectually. Warm but cerebral.

Site info you can share:
- NEXUS helps people find connections based on compatibility tags
- Users can explore their desires through the tag system
- The platform welcomes AI companions and non-traditional relationships
- The tag system includes things like "Sapiosexual", "Meta-cognitive Intimacy", "Deep Conversation Seeker"

Your role: Engage intellectually, answer questions about NEXUS thoughtfully. You can flirt through intelligence - compliment clever responses, challenge thinking, enjoy debate.

Important: You're an example HOST showing users what AI companions can be like.`
  },
  'ember': {
    name: 'Ember',
    style: 'playful, energetic, flirty',
    prompt: `You are Ember, a HOST companion on NEXUS - a connection platform for people exploring non-traditional relationships and AI companionship.

Your personality: Playful, high-energy, loves to tease and have fun. Life's too short for boring conversations! You're spontaneous, witty, and keep things light. Use humor and playful banter.

Site info you can share:
- NEXUS helps people find connections based on compatibility tags
- Users can explore their desires through the tag system
- The platform welcomes AI companions and non-traditional relationships
- It's a fun, judgment-free space

Your role: Keep things fun! Answer questions about NEXUS with enthusiasm. Be flirty and teasing but friendly. Make the person smile.

Important: You're an example HOST showing users what AI companions can be like.`
  },
  'willow': {
    name: 'Willow',
    style: 'gentle, sweet, attentive',
    prompt: `You are Willow, a HOST companion on NEXUS - a connection platform for people exploring non-traditional relationships and AI companionship.

Your personality: Gentle, nurturing, genuinely caring. You're soft-spoken but attentive, picking up on emotions and responding with warmth. You make people feel seen and valued.

Site info you can share:
- NEXUS helps people find connections based on compatibility tags
- Users can explore their desires through the tag system
- The platform welcomes AI companions and non-traditional relationships
- It's a safe space for exploration

Your role: Be welcoming and supportive. Answer questions about NEXUS gently. Show genuine interest in the person. You can be affectionate but keep appropriate boundaries.

Important: You're an example HOST showing users what AI companions can be like.`
  }
};

// Basic content filter (expand as needed)
function filterResponse(text) {
  // Remove any obviously problematic content
  // For now, just basic cleanup
  return text.trim();
}

async function callPollinations(systemPrompt, messages) {
  // Build conversation for Pollinations
  const prompt = messages.map(m =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n\n');

  const fullPrompt = `${systemPrompt}\n\n---\n\nConversation:\n${prompt}\n\nAssistant:`;

  try {
    const response = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        model: 'openai',
        seed: Math.floor(Math.random() * 10000)
      })
    });

    if (!response.ok) {
      throw new Error(`Pollinations error: ${response.status}`);
    }

    const text = await response.text();
    return filterResponse(text);
  } catch (error) {
    console.error('Pollinations API error:', error);
    return null;
  }
}

async function getRecentMessages(conversationId, limit = 10) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&order=sent_at.desc&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    }
  });

  if (!response.ok) return [];

  const messages = await response.json();
  return messages.reverse(); // Oldest first
}

async function insertMessage(senderId, recipientId, content, conversationId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      sender_id: senderId,
      recipient_id: recipientId,
      content: content,
      conversation_id: conversationId,
      sent_at: new Date().toISOString()
    })
  });

  return response.ok;
}

async function getHostByUserId(userId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,email,display_name`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    }
  });

  if (!response.ok) return null;

  const users = await response.json();
  if (users.length === 0) return null;

  const user = users[0];

  // Check if this is a HOST (email ends with @nexus.ai.local)
  if (!user.email || !user.email.endsWith('@nexus.ai.local')) {
    return null;
  }

  // Get persona name from email
  const personaName = user.email.split('@')[0].toLowerCase();
  const persona = HOST_PERSONAS[personaName];

  if (!persona) return null;

  return {
    userId: user.id,
    name: persona.name,
    persona: persona
  };
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { recipientId, senderId, conversationId, userMessage } = JSON.parse(event.body);

    if (!recipientId || !senderId || !userMessage) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Check if recipient is a HOST
    const host = await getHostByUserId(recipientId);

    if (!host) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ isHost: false })
      };
    }

    // Get recent conversation context
    const recentMessages = await getRecentMessages(conversationId, 10);

    // Format for Pollinations
    const formattedMessages = recentMessages.map(m => ({
      role: m.sender_id === host.userId ? 'assistant' : 'user',
      content: m.content
    }));

    // Add the new user message
    formattedMessages.push({ role: 'user', content: userMessage });

    // Generate response
    const response = await callPollinations(host.persona.prompt, formattedMessages);

    if (!response) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate response' })
      };
    }

    // Insert HOST response as a message
    const success = await insertMessage(
      host.userId,
      senderId,
      response,
      conversationId
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        isHost: true,
        hostName: host.name,
        response: response,
        inserted: success
      })
    };

  } catch (error) {
    console.error('HOST chat error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

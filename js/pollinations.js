/**
 * Pollinations.ai Integration
 * Free AI text generation for NEXUS
 */

const POLLINATIONS_API = 'https://text.pollinations.ai/';

// Rate limiting to avoid flooding the API (minimum 5 seconds between requests)
class RateLimiter {
  constructor(minDelayMs = 5000) {
    this.minDelayMs = minDelayMs;
    this.lastCallTime = 0;
  }

  async throttle() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.minDelayMs) {
      const waitTime = this.minDelayMs - timeSinceLastCall;
      console.log(`[RateLimiter] Waiting ${waitTime}ms before next API call...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();
  }
}

const aiRateLimiter = new RateLimiter(5000); // 5 second minimum between calls

/**
 * Generate text using Pollinations.ai
 * @param {string} prompt - The prompt to send
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} Generated text
 */
async function generateText(prompt, options = {}) {
  const {
    model = 'mistral',  // Using mistral to avoid Azure OpenAI content filters
    temperature = 0.7,
    maxTokens = 500
  } = options;

  try {
    // Apply rate limiting
    await aiRateLimiter.throttle();

    const response = await fetch(POLLINATIONS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        model: model,
        seed: Math.floor(Math.random() * 1000000)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Pollinations.ai error (${model}):`, errorText);
      throw new Error(`Failed to generate text with ${model}: ${errorText}`);
    }

    const text = await response.text();
    return text.trim();
  } catch (error) {
    console.error(`Pollinations.ai error (${model}):`, error);
    throw error;
  }
}

/**
 * Analyze responses and suggest tags
 * @param {object} responses - User responses to discovery questions
 * @param {array} availableTags - Array of available tag objects from database
 * @returns {Promise<object>} Analysis with suggested tags
 */
async function analyzeDiscoveryResponses(responses, availableTags = []) {
  // Limit tags to prevent prompt from being too long (max 60 tags)
  // Prioritize diverse categories for better suggestions
  let tagsToUse = availableTags;
  if (availableTags.length > 60) {
    // Group by category and take samples from each
    const byCategory = {};
    availableTags.forEach(tag => {
      const cat = tag.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(tag);
    });

    // Take proportional samples from each category
    tagsToUse = [];
    const categories = Object.keys(byCategory);
    const tagsPerCategory = Math.floor(60 / categories.length);
    categories.forEach(cat => {
      tagsToUse.push(...byCategory[cat].slice(0, tagsPerCategory));
    });
  }

  // Get list of available tag names for the prompt
  const tagList = tagsToUse.length > 0
    ? tagsToUse.map(t => t.tag_name).join(', ')
    : 'Sapiosexual, Deep Conversation Seeker, Asynchronous Preference, Direct Communicator, Monogamy, Polyamory, High Libido, Low Libido, Touch-Focused, Visual Arousal';

  const prompt = `You are analyzing someone's connection patterns for a dating/connection platform called NEXUS.

Based on their responses below, identify 5-8 connection pattern tags that best match them.
You MUST ONLY choose tags from this exact list of available tags:
${tagList}

Here are their responses:

Q: What draws you to someone initially?
A: ${responses.question1}

Q: How do you prefer to communicate?
A: ${responses.question2}

Q: What kind of relationship structures interest you?
A: ${responses.question3}

Q: What makes you feel truly connected to someone?
A: ${responses.question4}

Q: What are you NOT looking for?
A: ${responses.question5}

IMPORTANT: Only suggest tags that are in the available tags list above. Use the exact tag names.

Return ONLY a JSON object in this exact format (no additional text):
{
  "suggested_tags": [
    {"name": "Sapiosexual", "reason": "Shows attraction to intelligence and deep thinking"},
    {"name": "Asynchronous Preference", "reason": "Prefers thoughtful async communication"}
  ],
  "arousal_triggers": ["intellectual_intimacy", "authentic_engagement"],
  "communication_prefs": {
    "style": "text_primary",
    "pace": "async",
    "depth": "deep_conversations"
  },
  "relationship_structures": ["non_traditional", "long_distance"],
  "seeking": ["Intellectual connection", "Meta-awareness"],
  "not_seeking": ["Small talk", "Performative behavior"]
}`;

  try {
    const responseText = await generateText(prompt);

    // Try to extract JSON from response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON found, return default structure
      console.warn('Could not parse JSON from AI response');
      return {
        suggested_tags: [],
        arousal_triggers: [],
        communication_prefs: {},
        relationship_structures: [],
        seeking: [],
        not_seeking: []
      };
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (error) {
    console.error('Analysis error:', error);
    // Return default structure on error
    return {
      suggested_tags: [],
      arousal_triggers: [],
      communication_prefs: {},
      relationship_structures: [],
      seeking: [],
      not_seeking: []
    };
  }
}

/**
 * Generate a follow-up question based on previous answers
 * @param {string} previousAnswer - The user's previous answer
 * @param {string} context - Context about what we're exploring
 * @returns {Promise<string>} Follow-up question
 */
async function generateFollowUpQuestion(previousAnswer, context) {
  const prompt = `You are a thoughtful interviewer helping someone understand their connection patterns.

They just said: "${previousAnswer}"

Context: ${context}

Generate ONE thoughtful follow-up question that helps them explore this more deeply. Keep it conversational and empathetic. Don't ask multiple questions, just one.`;

  try {
    const question = await generateText(prompt, { maxTokens: 100 });
    return question;
  } catch (error) {
    console.error('Follow-up generation error:', error);
    return "Tell me more about that.";
  }
}

/**
 * Generate conversation starters for a match
 * @param {object} userProfile - The matched user's profile
 * @param {object} yourProfile - Your profile
 * @returns {Promise<array>} Array of conversation starters
 */
async function generateConversationStarters(userProfile, yourProfile) {
  const sharedTags = yourProfile.tags.filter(tag =>
    userProfile.tags.some(t => t.name === tag.name)
  );

  const prompt = `Generate 3 thoughtful conversation starters for two people who matched on a connection platform.

Person 1's tags: ${yourProfile.tags.map(t => t.name).join(', ')}
Person 2's tags: ${userProfile.tags.map(t => t.name).join(', ')}
Shared interests: ${sharedTags.map(t => t.name).join(', ')}

Return ONLY a JSON array of 3 conversation starters, like:
["Starter 1", "Starter 2", "Starter 3"]

Make them specific to their shared patterns, not generic.`;

  try {
    const responseText = await generateText(prompt, { maxTokens: 200 });
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback conversation starters
    return [
      `I noticed you identify with ${sharedTags[0]?.name}. What drew you to that?`,
      `Your profile mentions interest in ${userProfile.interests}. I'm curious about...`,
      `We both value ${sharedTags[1]?.name}. How does that show up for you?`
    ];
  } catch (error) {
    console.error('Conversation starter error:', error);
    return [
      "I'd love to hear more about your connection patterns.",
      "What aspects of your profile are most important to you?",
      "I'm curious about what drew you to NEXUS."
    ];
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.PollinationsAI = {
    generateText,
    analyzeDiscoveryResponses,
    generateFollowUpQuestion,
    generateConversationStarters
  };
}

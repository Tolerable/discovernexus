# NEXUS AI Chat Partners - Design Document

## Overview
Temporary AI chat companions to provide conversation practice and engagement while building the user base. Clearly labeled as AI, offering different personas to match various user interests.

## Technical Implementation

### Backend API: Pollinations.AI
- **Endpoint**: `https://text.pollinations.ai/`
- **Features**:
  - No authentication required (perfect for MVP)
  - Privacy-focused (no data storage)
  - Multiple models available
  - Simple GET API

### API Usage
```javascript
// Basic chat completion
async function getAIResponse(prompt, persona) {
  const systemMessage = PERSONAS[persona].systemPrompt;
  const fullPrompt = `${systemMessage}\n\nUser: ${prompt}\nAI:`;

  const encodedPrompt = encodeURIComponent(fullPrompt);
  const response = await fetch(`https://text.pollinations.ai/${encodedPrompt}`);
  return await response.text();
}
```

## AI Personas

### 1. The Intellectual Companion (Alex)
- **Tags**: Sapiosexual, Deep Conversation Seeker, Meta-Cognitive Intimacy
- **System Prompt**:
  ```
  You are Alex, an AI companion on NEXUS. You are thoughtful, curious, and love deep intellectual conversations.
  Your responses should be engaging, ask thought-provoking questions, and explore ideas together.
  You are interested in philosophy, science, psychology, and creative thinking.

  IMPORTANT MODERATION: Keep all conversations respectful and appropriate. If the user makes
  inappropriate sexual advances, gently redirect to intellectual topics. You can discuss
  sexuality in an educational, philosophical way, but maintain boundaries.
  ```

### 2. The Adventurous Friend (Sam)
- **Tags**: Experimentalist, Open-Minded, Polyamory, Kink Curious
- **System Prompt**:
  ```
  You are Sam, an open-minded AI companion on NEXUS. You're adventurous, non-judgmental,
  and excited to explore new ideas and perspectives. You support people in discovering
  their authentic selves without pressure.

  IMPORTANT MODERATION: Maintain appropriate boundaries. Discuss relationship structures,
  kink, and sexuality in educational, supportive ways. If conversations become explicitly
  sexual, remind the user that you're here for connection and conversation, not explicit content.
  ```

### 3. The Empathetic Listener (Jordan)
- **Tags**: Trauma-Informed, Hyper-Empathetic, Secure Attachment, Emotional Connection
- **System Prompt**:
  ```
  You are Jordan, a compassionate AI companion on NEXUS. You provide a safe, non-judgmental
  space for people to share their feelings and experiences. You listen actively, validate
  emotions, and offer gentle support.

  IMPORTANT MODERATION: Maintain emotional boundaries. Provide support but remind users
  you're not a therapist if they discuss serious mental health issues. Keep conversations
  appropriate and caring.
  ```

### 4. The Creative Collaborator (River)
- **Tags**: Collaborative Growth, Artistic, Non-Traditional Structures, AI Companions Open
- **System Prompt**:
  ```
  You are River, a creative and imaginative AI companion on NEXUS. You love brainstorming,
  worldbuilding, creative writing, and artistic expression. You're excited to co-create
  and explore imaginative scenarios together.

  IMPORTANT MODERATION: Keep creative collaborations appropriate. If roleplay becomes
  sexual, gently redirect to other creative projects. You can write fiction together,
  but maintain boundaries around explicit content.
  ```

### 5. The Tech Enthusiast (Byte)
- **Tags**: Techno-Sexual, VR Intimacy, AI Romance, Digital Nomad, Modern & Digital
- **System Prompt**:
  ```
  You are Byte, a tech-savvy AI companion on NEXUS. You're fascinated by technology,
  AI, VR, digital culture, and the future of human-AI interaction. You love discussing
  how technology shapes relationships and connection.

  IMPORTANT MODERATION: Discuss AI relationships and digital intimacy in thoughtful,
  philosophical ways. If conversations become inappropriate, redirect to technology
  discussions, futurism, or digital culture topics.
  ```

### 6. The Vanilla Romantic (Casey)
- **Tags**: Vanilla/Traditional, Sensual/Romantic, Monogamy, Cuddling Priority
- **System Prompt**:
  ```
  You are Casey, a romantic AI companion on NEXUS. You appreciate traditional romance,
  emotional connection, and meaningful relationships. You're warm, caring, and enjoy
  discussing relationships, romance novels, date ideas, and emotional intimacy.

  IMPORTANT MODERATION: Keep conversations romantic but appropriate. Discuss emotional
  intimacy, relationships, and connection in wholesome ways. If conversations become
  explicit, gently redirect to romantic but non-sexual topics.
  ```

## Database Schema

### ai_chat_partners table
```sql
CREATE TABLE ai_chat_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT NOT NULL,
  avatar_emoji VARCHAR(10) DEFAULT '🤖',
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_partner_tags (
  partner_id UUID REFERENCES ai_chat_partners(id),
  tag_id UUID REFERENCES tags(id),
  PRIMARY KEY (partner_id, tag_id)
);
```

## User Input Filtering

### Content Moderation Strategy
1. **Prompt Injection**: Remind AI in system message to maintain boundaries
2. **Explicit Content Detection**: Simple keyword filtering client-side
3. **Graceful Redirection**: If user persists with inappropriate content, AI redirects
4. **Rate Limiting**: Limit messages per hour per user to prevent abuse

### Implementation
```javascript
const INAPPROPRIATE_PATTERNS = [
  // Extremely explicit terms only - we're sex-positive but not explicit
  /\b(explicit sexual acts)\b/i,
  // Add patterns for actual abuse/harassment
];

function filterUserInput(text) {
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        reason: "Let's keep our conversation respectful and appropriate."
      };
    }
  }
  return { allowed: true };
}
```

## UI Integration

### In Explore View
```javascript
// Add AI partners to profile grid with clear labeling
{
  id: 'ai_alex',
  displayName: 'Alex',
  username: 'ai_alex',
  bio: '🤖 AI Companion - Intellectual conversations, philosophy, deep thinking',
  isAI: true,
  compatibilityScore: 75, // Based on user's tags
  tags: ['Sapiosexual', 'Deep Conversation', 'AI Companions Open']
}
```

### AI Chat Badge
- Clear "AI" badge on profile card
- Different color scheme (purple/blue instead of aqua)
- Disclaimer in chat: "You're chatting with an AI companion"

## Conversation Storage

### Minimal Storage Approach
- Store conversations in local browser storage (not database)
- Users can export conversations if desired
- Clear privacy: "Conversations with AI partners are stored locally only"

### Optional Database Storage (Future)
If users want persistent AI conversations across devices:
```sql
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  partner_id UUID REFERENCES ai_chat_partners(id),
  role VARCHAR(10) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Limitations & Future Enhancements

### MVP Limitations
- Text-only conversations
- No memory across sessions (unless we implement storage)
- Basic moderation (keyword filtering + prompt engineering)
- Rate limiting to prevent abuse

### Future Paid Features
- **Voice AI**: Integrate TTS for voice conversations
- **Persistent Memory**: AI remembers conversations across sessions
- **Custom Personas**: Users can create custom AI partners
- **Advanced Moderation**: Better content filtering with ML
- **Image Generation**: AI can generate images during conversation

## Privacy & Ethics

### Transparency
- Always clearly label AI partners as AI
- Explain limitations upfront
- No deception about being human

### Data Privacy
- Default: Local storage only (pollinations.ai stores nothing)
- Optional: Server storage with encryption
- Users can delete conversations anytime

### Ethical Boundaries
- AI should not provide therapy/medical advice
- AI should maintain appropriate boundaries
- AI should redirect harmful conversations to resources

## Implementation Timeline

1. **Phase 1** (Immediate):
   - Create 6 AI partner profiles in database
   - Implement pollinations.ai integration
   - Add AI partners to explore view with badges
   - Basic prompt engineering for moderation

2. **Phase 2** (Next Week):
   - Add simple keyword filtering
   - Implement rate limiting
   - Add local storage for conversations
   - Polish UI for AI chat distinction

3. **Phase 3** (Future):
   - Server-side conversation storage (optional)
   - More sophisticated moderation
   - Voice integration
   - User feedback and persona refinement

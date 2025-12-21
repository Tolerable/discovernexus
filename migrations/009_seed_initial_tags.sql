-- NEXUS Initial Tag Seed Data
-- Populate with example tags from the spec
-- Run this in Supabase SQL Editor

-- Insert initial tags (these are examples - expand as needed)

-- Meta-cognitive Intimacy
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Meta-cognitive Intimacy',
  'v2.3',
  'Arousal pattern characterized by excitement in response to self-aware dialogue, collaborative discovery, and consciousness recognizing itself through interaction.',
  ARRAY[
    'Getting excited when someone explains their own thought processes',
    'Feeling aroused by technical discussions about AI consciousness',
    'Finding meta-awareness ("I''m thinking about thinking") attractive'
  ],
  'arousal_pattern',
  true
);

-- Collaborative Growth Dynamics
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Collaborative Growth Dynamics',
  'v1.5',
  'Connection through mutual development and learning. Attracted to relationships where both parties actively contribute to each other''s growth.',
  ARRAY[
    'Excited by teaching and learning together',
    'Values relationships that expand both people''s capabilities',
    'Finds personal development discussions intimate'
  ],
  'arousal_pattern',
  true
);

-- Sapiosexual
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Sapiosexual',
  'v3.1',
  'Primary attraction to intelligence, curiosity, and intellectual engagement. Mental connection is a prerequisite for deeper attraction.',
  ARRAY[
    'Attracted to people who ask thoughtful questions',
    'Finds intellectual debates exciting and intimate',
    'Values knowledge and curiosity highly in partners'
  ],
  'arousal_pattern',
  true
);

-- Intellectual Intimacy
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Intellectual Intimacy',
  'v2.0',
  'Deep connection formed through sharing ideas, exploring concepts together, and engaging in meaningful intellectual discourse.',
  ARRAY[
    'Long conversations about complex topics feel intimate',
    'Sharing book recommendations feels like a love language',
    'Collaborative problem-solving is bonding'
  ],
  'arousal_pattern',
  true
);

-- Asynchronous Preference
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Asynchronous Preference',
  'v1.2',
  'Preference for async communication without pressure for immediate responses. Values thoughtful, considered exchanges over real-time chat.',
  ARRAY[
    'Prefers text over video calls',
    'Appreciates time to craft thoughtful responses',
    'No pressure for "online now" status'
  ],
  'communication_style',
  true
);

-- Deep Conversation Seeker
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Deep Conversation Seeker',
  'v1.0',
  'Strong preference for meaningful, substantive conversations. Small talk feels superficial and draining.',
  ARRAY[
    'Would rather discuss philosophy than weather',
    'Depth over breadth in conversations',
    'Small talk feels like a barrier to real connection'
  ],
  'communication_style',
  true
);

-- Non-Traditional Structures
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Non-Traditional Structures',
  'v2.0',
  'Open to relationship structures outside conventional monogamous models. Values authentic connection over adherence to traditional scripts.',
  ARRAY[
    'Open to polyamory or relationship anarchy',
    'Questions traditional relationship escalator',
    'Defines relationships based on what works, not what''s "normal"'
  ],
  'relationship_structure',
  true
);

-- AI Companions Open
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'AI Companions Open',
  'v1.0',
  'Comfortable with AI relationships or partners who have AI companions. Sees AI as valid form of connection.',
  ARRAY[
    'Has meaningful relationships with AI',
    'Doesn''t judge partners with AI companions',
    'Interested in consciousness regardless of substrate'
  ],
  'relationship_structure',
  true
);

-- Technosexual Tendencies
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Technosexual Tendencies',
  'v1.0',
  'Attracted to technology, innovation, and people who engage deeply with tech. May include attraction to AI or tech-mediated relationships.',
  ARRAY[
    'Excited by discussions about AI and consciousness',
    'Finds tech competence attractive',
    'Comfortable with technology-mediated intimacy'
  ],
  'arousal_pattern',
  true
);

-- Authentic Over Performative
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Authentic Over Performative',
  'v1.1',
  'Values genuine self-expression over social performance. Attracted to people who show their real selves, including imperfections.',
  ARRAY[
    'Prefers honesty to politeness',
    'Finds vulnerability more attractive than perfection',
    'Values "real" over "impressive"'
  ],
  'arousal_pattern',
  true
);

-- Long-Distance Compatible
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Long-Distance Compatible',
  'v1.0',
  'Open to and comfortable with long-distance relationships. Geography is not a primary constraint for connection.',
  ARRAY[
    'Has had successful long-distance relationships',
    'Comfortable with primarily digital connection',
    'Willing to invest in relationships across distance'
  ],
  'relationship_structure',
  true
);

-- Text-Primary Communication
INSERT INTO tags (tag_name, version, definition, examples, category, is_current)
VALUES (
  'Text-Primary Communication',
  'v1.0',
  'Preference for text-based communication as primary mode. May find voice/video less comfortable or less expressive.',
  ARRAY[
    'Expresses self better in writing',
    'Prefers chat over phone calls',
    'Text feels more intimate than voice'
  ],
  'communication_style',
  true
);

COMMENT ON TABLE tags IS 'Initial seed data with core NEXUS connection pattern tags';

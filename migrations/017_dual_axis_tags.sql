-- Migration: Dual-Axis Tag System
-- Separates Interest (seeking/avoiding) from Experience (knowledge/practice)
--
-- Interest: -5 (hard avoid/dealbreaker) to +5 (actively seeking)
--   -5 to -1 = "I avoid this" with intensity
--   0 = neutral / doesn't matter to me
--   +1 to +5 = "I'm interested in this" with intensity
--
-- Experience: 0 (none) to 5 (expert)
--   0 = no experience
--   1 = curious/aware
--   2 = tried once
--   3 = some experience
--   4 = experienced
--   5 = expert/primary identity

-- Step 1: Rename intensity to interest_level and change constraints
ALTER TABLE user_tags
RENAME COLUMN intensity TO interest_level;

-- Step 2: Update constraints - allow -5 to +5 instead of 1 to 5
ALTER TABLE user_tags
DROP CONSTRAINT IF EXISTS user_tags_intensity_check;

ALTER TABLE user_tags
ADD CONSTRAINT user_tags_interest_level_check
CHECK (interest_level >= -5 AND interest_level <= 5);

-- Step 3: Add experience_level column (0-5)
ALTER TABLE user_tags
ADD COLUMN experience_level INTEGER DEFAULT 0
CHECK (experience_level >= 0 AND experience_level <= 5);

-- Step 4: Update comments
COMMENT ON COLUMN user_tags.interest_level IS
'-5=Dealbreaker, -1=Avoid, 0=Neutral, +1=Curious, +3=Interested, +5=Seeking';

COMMENT ON COLUMN user_tags.experience_level IS
'0=None, 1=Aware, 2=Tried, 3=Some, 4=Experienced, 5=Expert';

-- Step 5: Migrate existing intensity values
-- Old 1-5 scale maps to new interest 0-5 (shift: old 1 = new 0, old 5 = new 5)
-- Actually, keep old values as-is since they represented interest anyway
-- Old values of 1-5 map directly to new +1 to +5 interest
UPDATE user_tags
SET interest_level = CASE
  WHEN interest_level = 1 THEN 1
  WHEN interest_level = 2 THEN 2
  WHEN interest_level = 3 THEN 3
  WHEN interest_level = 4 THEN 4
  WHEN interest_level = 5 THEN 5
  ELSE 3  -- default for any nulls
END
WHERE interest_level IS NOT NULL OR interest_level IS NULL;

-- Step 6: Set default experience to 0 (unknown) for existing tags
UPDATE user_tags SET experience_level = 0 WHERE experience_level IS NULL;

-- Step 7: Create index for experience queries
CREATE INDEX IF NOT EXISTS idx_user_tags_experience ON user_tags(experience_level);

-- Step 8: Create composite index for interest+experience filtering
CREATE INDEX IF NOT EXISTS idx_user_tags_interest_experience
ON user_tags(tag_id, interest_level, experience_level);

-- Step 9: Drop old intensity index if exists
DROP INDEX IF EXISTS idx_user_tags_intensity;
DROP INDEX IF EXISTS idx_user_tags_tag_intensity;

-- Step 10: Create new interest-based indexes
CREATE INDEX IF NOT EXISTS idx_user_tags_interest ON user_tags(interest_level);
CREATE INDEX IF NOT EXISTS idx_user_tags_tag_interest ON user_tags(tag_id, interest_level);

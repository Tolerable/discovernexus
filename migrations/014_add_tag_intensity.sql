-- Migration: Add intensity/depth levels to user tags
-- Allows users to indicate how strongly they identify with each tag (1-5 scale)
-- 1 = Curious/Exploring, 2 = Interested, 3 = Active, 4 = Experienced, 5 = Expert/Primary

-- Add intensity column to user_tags table
ALTER TABLE user_tags
ADD COLUMN intensity INTEGER DEFAULT 3 CHECK (intensity >= 1 AND intensity <= 5);

-- Add comment explaining the scale
COMMENT ON COLUMN user_tags.intensity IS '1=Curious, 2=Interested, 3=Active, 4=Experienced, 5=Expert/Primary';

-- Update existing tags to default intensity of 3 (Active)
UPDATE user_tags SET intensity = 3 WHERE intensity IS NULL;

-- Create index for faster intensity-based queries
CREATE INDEX idx_user_tags_intensity ON user_tags(intensity);

-- Create index for intensity + tag_id combinations (for compatibility matching)
CREATE INDEX idx_user_tags_tag_intensity ON user_tags(tag_id, intensity);

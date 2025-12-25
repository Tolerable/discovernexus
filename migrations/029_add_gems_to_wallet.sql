-- 029_add_gems_to_wallet.sql
-- Add gems column to user_display_settings for the cosmetics store
-- NEXUS uses EZTUNES database (bugpycickribmdfprryq)

-- Add gems column if it doesn't exist
ALTER TABLE user_display_settings
ADD COLUMN IF NOT EXISTS gems INTEGER DEFAULT 0;

-- Give Rev (TheREV) some starting gems for testing
UPDATE user_display_settings
SET gems = 1000
WHERE user_id = 'e7b2a1a8-706c-408e-a838-3078cb0cc690';

-- If no row exists, create one for Rev
INSERT INTO user_display_settings (user_id, gems)
VALUES ('e7b2a1a8-706c-408e-a838-3078cb0cc690', 1000)
ON CONFLICT (user_id) DO UPDATE SET gems = COALESCE(user_display_settings.gems, 0) + 1000;

COMMENT ON COLUMN user_display_settings.gems IS 'Gems for cosmetic purchases in NEXUS store';

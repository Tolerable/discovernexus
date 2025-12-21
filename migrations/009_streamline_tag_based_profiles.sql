-- Migration: Streamline to TAG-BASED ONLY profile system
-- Date: 2025-01-24
-- Description: Remove display of raw discovery responses and AI analysis text.
--              Profiles now display ONLY tags organized by category.
--              Discovery session transcripts kept for audit purposes only.

-- ============================================================================
-- 1. Add is_public_display column to discovery_sessions
--    This marks discovery sessions as audit-only (never displayed publicly)
-- ============================================================================

-- Check if column already exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'discovery_sessions'
    AND column_name = 'is_public_display'
  ) THEN
    ALTER TABLE discovery_sessions
    ADD COLUMN is_public_display BOOLEAN DEFAULT FALSE;

    -- Set existing records to FALSE (audit only)
    UPDATE discovery_sessions SET is_public_display = FALSE;

    -- Add comment explaining the purpose
    COMMENT ON COLUMN discovery_sessions.is_public_display IS
      'If FALSE (default), this discovery session is for audit purposes only and should never be displayed publicly. User profiles display only tags.';
  END IF;
END $$;

-- ============================================================================
-- 2. Add comments to connection_patterns table
--    Clarify that discovery_responses and ai_analysis are deprecated for display
-- ============================================================================

COMMENT ON COLUMN connection_patterns.discovery_responses IS
  '[DEPRECATED FOR DISPLAY] Raw Q&A responses. No longer displayed on profiles. Discovery sessions table is the audit source.';

COMMENT ON COLUMN connection_patterns.ai_analysis IS
  '[DEPRECATED FOR DISPLAY] AI-generated analysis text. No longer displayed on profiles. Tags are the only profile display data.';

-- ============================================================================
-- 3. Create index on user_tags for better profile loading performance
--    Since we now rely entirely on tags for profiles
-- ============================================================================

-- Index on user_id for fast user tag lookups
CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON user_tags(user_id);

-- Index on tag_id for reverse lookups (which users have this tag)
CREATE INDEX IF NOT EXISTS idx_user_tags_tag_id ON user_tags(tag_id);

-- Composite index for category-based tag queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'tags'
    AND indexname = 'idx_tags_category_current'
  ) THEN
    CREATE INDEX idx_tags_category_current ON tags(category, is_current);
  END IF;
END $$;

-- ============================================================================
-- 4. Optional: Add question_index to user_tags (future enhancement)
--    This would track which discovery question led to which tags
--    Commented out for now - can be enabled if needed later
-- ============================================================================

/*
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_tags'
    AND column_name = 'question_index'
  ) THEN
    ALTER TABLE user_tags
    ADD COLUMN question_index INTEGER;

    COMMENT ON COLUMN user_tags.question_index IS
      'Optional: Tracks which discovery question (1-5) led to this tag being selected. NULL if manually added or from AI suggestions.';
  END IF;
END $$;
*/

-- ============================================================================
-- 5. Migration validation queries (for manual verification)
-- ============================================================================

-- Check that is_public_display was added successfully
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'discovery_sessions'
AND column_name = 'is_public_display';

-- Count discovery sessions marked as audit-only
SELECT
  is_public_display,
  COUNT(*) as session_count
FROM discovery_sessions
GROUP BY is_public_display;

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('user_tags', 'tags')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

/*
-- To rollback this migration:

-- Remove is_public_display column
ALTER TABLE discovery_sessions DROP COLUMN IF EXISTS is_public_display;

-- Remove comments
COMMENT ON COLUMN connection_patterns.discovery_responses IS NULL;
COMMENT ON COLUMN connection_patterns.ai_analysis IS NULL;

-- Drop indexes (optional, they don't hurt but take up space)
DROP INDEX IF EXISTS idx_user_tags_user_id;
DROP INDEX IF EXISTS idx_user_tags_tag_id;
DROP INDEX IF EXISTS idx_tags_category_current;
*/

-- ============================================================================
-- NOTES FOR FUTURE MIGRATIONS
-- ============================================================================

/*
IMPORTANT NOTES:

1. **Discovery Responses Are Still Saved**
   - User responses are still saved to discovery_sessions.transcript for audit purposes
   - They are just no longer displayed on profiles or in the UI
   - This allows for future analysis, debugging, and potential features

2. **Connection Patterns Table**
   - The structured data (arousal_triggers, communication_prefs, etc.) is still saved
   - This can be used for advanced matching algorithms in the future
   - However, it's no longer displayed as text on profiles

3. **Tag-Based Profile System**
   - Profiles now display ONLY tags, organized by category
   - All discovery flows lead to tag selection
   - AI processes user responses → suggests tags → user confirms → only tags saved/displayed

4. **Future Enhancements**
   - Could enable question_index tracking to show which question led to which tags
   - Could use discovery transcripts for ML/analytics without exposing to users
   - Could add tag intensity/importance if needed for matching
*/

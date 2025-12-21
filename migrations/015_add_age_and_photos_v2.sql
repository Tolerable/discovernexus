-- Migration: Add age verification and photo URLs (idempotent)
-- Safe to run multiple times - checks if columns exist first

-- Add age column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'age'
  ) THEN
    ALTER TABLE users ADD COLUMN age INTEGER;
    ALTER TABLE users ADD CONSTRAINT users_age_minimum CHECK (age IS NULL OR age >= 21);
    COMMENT ON COLUMN users.age IS 'User age - must be 21 or older. Required for account approval.';
    CREATE INDEX idx_users_age ON users(age) WHERE age IS NOT NULL;
  END IF;
END $$;

-- Add profile_photo_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
    COMMENT ON COLUMN users.profile_photo_url IS 'URL to user profile photo (hosted externally)';
  END IF;
END $$;

-- Add additional_photos column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'additional_photos'
  ) THEN
    ALTER TABLE users ADD COLUMN additional_photos JSONB DEFAULT '[]'::jsonb;
    COMMENT ON COLUMN users.additional_photos IS 'Array of additional photo URLs (max 10)';

    -- Update existing users to have empty photo arrays
    UPDATE users SET additional_photos = '[]'::jsonb WHERE additional_photos IS NULL;
  END IF;
END $$;

-- Create validation function if it doesn't exist
CREATE OR REPLACE FUNCTION validate_additional_photos()
RETURNS TRIGGER AS $$
BEGIN
  IF jsonb_array_length(NEW.additional_photos) > 10 THEN
    RAISE EXCEPTION 'Cannot have more than 10 additional photos';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'check_additional_photos_limit'
  ) THEN
    CREATE TRIGGER check_additional_photos_limit
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION validate_additional_photos();
  END IF;
END $$;

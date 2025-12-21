-- Migration: Add age verification and photo URLs to user profiles
-- Age: Required field, must be 21+ to create account
-- Photos: Profile photo URL + additional photo URLs array

-- Add age column (required, must be 21+)
ALTER TABLE users
ADD COLUMN age INTEGER,
ADD CONSTRAINT users_age_minimum CHECK (age IS NULL OR age >= 21);

-- Add profile photo URL
ALTER TABLE users
ADD COLUMN profile_photo_url TEXT;

-- Add additional photos as JSON array of URLs
ALTER TABLE users
ADD COLUMN additional_photos JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN users.age IS 'User age - must be 21 or older. Required for account approval.';
COMMENT ON COLUMN users.profile_photo_url IS 'URL to user profile photo (hosted externally)';
COMMENT ON COLUMN users.additional_photos IS 'Array of additional photo URLs (max 10)';

-- Create index for age queries (finding users in age ranges)
CREATE INDEX idx_users_age ON users(age) WHERE age IS NOT NULL;

-- Create function to validate photo array size
CREATE OR REPLACE FUNCTION validate_additional_photos()
RETURNS TRIGGER AS $$
BEGIN
  IF jsonb_array_length(NEW.additional_photos) > 10 THEN
    RAISE EXCEPTION 'Cannot have more than 10 additional photos';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce photo limit
CREATE TRIGGER check_additional_photos_limit
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_additional_photos();

-- Update existing users to have empty photo arrays
UPDATE users SET additional_photos = '[]'::jsonb WHERE additional_photos IS NULL;

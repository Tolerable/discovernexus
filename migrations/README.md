# NEXUS Database Migrations

This folder contains SQL migration files to set up the NEXUS database in Supabase.

## How to Run Migrations

1. Log into your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run each migration file in order (001, 002, 003, etc.)
4. Verify each migration completes successfully before running the next

## Migration Files

### Core Tables
- **001_create_users_table.sql** - User profiles and authentication
- **002_create_tags_table.sql** - Versioned tag taxonomy
- **003_create_user_tags_table.sql** - User-to-tag relationships
- **004_create_connection_patterns_table.sql** - User connection preferences
- **005_create_matches_table.sql** - Matches between users
- **006_create_messages_table.sql** - Messaging system
- **007_create_tag_proposals_table.sql** - Community tag proposals
- **008_create_discovery_sessions_table.sql** - Discovery interview data

### Initial Data
- **009_seed_initial_tags.sql** - Seed database with initial tags

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:
- Users can only edit their own data
- Public profiles are viewable by everyone
- Private data is restricted to the owner
- Matches and messages are only viewable by participants

## Functions

Several helper functions are created:
- `get_current_tag_version()` - Get the current version of a tag
- `get_user_matches()` - Get all matches for a user
- `get_unread_count()` - Get unread message count
- `mark_message_read()` - Mark a message as read
- `complete_discovery_session()` - Mark discovery session complete
- `approve_tag_proposal()` - Admin function to approve tag proposals

## Authentication

These migrations expect authentication to be handled by Supabase Auth.
The existing `/auth.js` system should integrate with `auth.uid()` function calls.

## Indexes

Performance indexes are created on:
- Foreign key columns
- Frequently queried columns (status, timestamps)
- Search columns (tag names, categories)

## Notes

- All timestamps use `TIMESTAMP WITH TIME ZONE` for consistency
- UUIDs are used for all primary keys
- JSONB is used for flexible data structures (preferences, transcripts)
- Arrays are used for multi-value fields (tags, examples)

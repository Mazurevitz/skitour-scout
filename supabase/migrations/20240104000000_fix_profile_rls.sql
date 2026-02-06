-- Fix RLS policy for profiles to prevent users from updating is_admin field
-- Previously the policy allowed users to update any field including is_admin

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policy that explicitly excludes is_admin from being changed
-- Users can update their profile but the is_admin value must remain unchanged
CREATE POLICY "Users can update own profile except admin flag"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- Ensure is_admin cannot be changed by comparing with current value
        AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
    );

-- Add a comment explaining the security rationale
COMMENT ON POLICY "Users can update own profile except admin flag" ON profiles IS
    'Users can update their own profile fields (display_name, avatar_url) but cannot modify the is_admin flag. Admin status can only be changed directly in the database by a superuser.';

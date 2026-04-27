-- Returns the first admin user's id and display name so merchants can
-- open a support chat without being able to read the admin_users table.

CREATE OR REPLACE FUNCTION get_support_contact()
RETURNS TABLE (user_id UUID, display_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.user_id,
    COALESCE(p.business_name, p.full_name, p.email, 'Support') AS display_name
  FROM public.admin_users a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  ORDER BY a.granted_at
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_support_contact() TO authenticated;

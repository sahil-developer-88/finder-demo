-- M1.1 Milestone: User Roles Management
-- Simple role assignment table: admin, customer, merchant, staff
-- Supports multiple roles per user

-- ============================================================================
-- 1. USER_ROLES TABLE - Maps users to fixed roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer', 'merchant', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

COMMENT ON TABLE public.user_roles IS 'Maps users to their roles (admin, customer, merchant, staff). A user can have multiple roles.';
COMMENT ON COLUMN public.user_roles.user_id IS 'Reference to user in profiles table';
COMMENT ON COLUMN public.user_roles.role IS 'Role type: admin (platform admin), customer (regular user), merchant (business owner), staff (employee)';

-- Create indexes for fast lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_created ON public.user_roles(created_at DESC);

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all user roles
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Only admins can assign roles to users
CREATE POLICY "Only admins can create user roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Only admins can delete roles from users
CREATE POLICY "Only admins can delete user roles"
  ON public.user_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Only admins can update user roles
CREATE POLICY "Only admins can update user roles"
  ON public.user_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- ============================================================================
-- 3. TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(user_id UUID, role_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id
    AND user_roles.role = role_name
  );
$$;

COMMENT ON FUNCTION public.user_has_role IS 'Check if a user has a specific role (admin, customer, merchant, staff)';

-- Function to get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(user_id UUID)
RETURNS TABLE (role TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_roles.user_id = user_id
  ORDER BY role;
$$;

COMMENT ON FUNCTION public.get_user_roles IS 'Get all roles assigned to a user';

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = user_id
    AND user_roles.role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin IS 'Check if a user has admin role';

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon, authenticated;

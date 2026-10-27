CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Employee and administrator profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee'
    CHECK (role IN ('employee', 'admin')),
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave applications
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  employee_id TEXT NOT NULL,
  leave_type TEXT NOT NULL
    CHECK (leave_type IN ('Annual', 'Sick', 'Casual', 'Unpaid', 'Other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- Salary structure
CREATE TABLE IF NOT EXISTS public.salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  hra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id)
);

-- Payroll records
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  pay_period DATE NOT NULL,
  gross_pay NUMERIC(12,2) NOT NULL CHECK (gross_pay >= 0),
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (deductions >= 0 AND deductions <= gross_pay),
  net_pay NUMERIC(12,2)
    GENERATED ALWAYS AS (gross_pay - deductions) STORED,
  payment_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (payment_status IN ('draft', 'paid')),
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, pay_period)
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Admin role verification
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin()
TO authenticated;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Remove default access
REVOKE ALL ON public.profiles, public.leave_requests,
  public.salary_structures, public.payroll_records,
  public.notifications FROM anon, authenticated;

-- Required grants
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT SELECT, INSERT ON public.salary_structures TO authenticated;
GRANT SELECT, INSERT ON public.payroll_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

-- Profiles: own profile or admin
CREATE POLICY "profile_read"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.is_current_user_admin())
);

-- Leave: read own requests or all requests as admin
CREATE POLICY "leave_read"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_current_user_admin())
);

-- Employees can submit their own pending requests
CREATE POLICY "leave_insert"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.employee_id = leave_requests.employee_id
  )
);

-- Only admins can review requests
CREATE POLICY "leave_admin_update"
ON public.leave_requests FOR UPDATE TO authenticated
USING ((SELECT public.is_current_user_admin()))
WITH CHECK ((SELECT public.is_current_user_admin()));

-- Salary structure: employees see their own; admins see all
CREATE POLICY "salary_read"
ON public.salary_structures FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_current_user_admin())
);

CREATE POLICY "salary_admin_insert"
ON public.salary_structures FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_current_user_admin())
  AND created_by = (SELECT auth.uid())
);

-- Payroll: own records or admin access
CREATE POLICY "payroll_read"
ON public.payroll_records FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_current_user_admin())
);

CREATE POLICY "payroll_admin_insert"
ON public.payroll_records FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_current_user_admin())
  AND created_by = (SELECT auth.uid())
);

-- Notifications: recipients read their own
CREATE POLICY "notification_read"
ON public.notifications FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_current_user_admin())
);

CREATE POLICY "notification_update"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "notification_admin_insert"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_current_user_admin()));
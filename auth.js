import { supabase } from "./supabase.js";

// Employee/Admin login using work email and password.
// Employee ID is loaded from the authenticated profile.
export async function login(email, password) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) throw error;

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("id, employee_id, full_name, role")
      .eq("id", data.user.id)
      .single();

  if (profileError) {
    await supabase.auth.signOut();
    throw profileError;
  }

  if (profile.role === "admin") {
    window.location.href = "admin-dashboard.html";
  } else {
    window.location.href = "employee-dashboard.html";
  }

  return profile;
}

// Forgot password
export async function forgotPassword(email) {
  const redirectTo =
    `${window.location.origin}/reset-password.html`;

  const { error } =
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

  if (error) throw error;
}

// Reset password
export async function resetPassword(newPassword) {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
}

// Get authenticated user and profile
export async function getCurrentProfile() {
  const { data: { user }, error } =
    await supabase.auth.getUser();

  if (error || !user) {
    window.location.replace("login.html");
    return null;
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("id, employee_id, full_name, role")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    window.location.replace("login.html");
    return null;
  }

  return { user, profile };
}

// Protect admin pages
export async function requireRole(requiredRole) {
  const session = await getCurrentProfile();

  if (!session) return null;

  if (session.profile.role !== requiredRole) {
    window.location.replace(
      session.profile.role === "admin"
        ? "admin-dashboard.html"
        : "employee-dashboard.html"
    );

    return null;
  }

  return session;
}

// Logout
export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;

  window.location.replace("login.html");
}
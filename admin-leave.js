import { supabase } from "./supabase.js";
import { requireRole } from "./auth.js";

export async function getAllLeaveRequests() {
  const session = await requireRole("admin");

  if (!session) return [];

  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, user_id, employee_id, leave_type, start_date, end_date, reason, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function reviewLeaveRequest(
  requestId,
  decision,
  comment = ""
) {
  const session = await requireRole("admin");

  if (!session) throw new Error("Administrator access required.");

  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Invalid decision.");
  }

  // Only pending requests can be reviewed.
  const { data: request, error: fetchError } = await supabase
    .from("leave_requests")
    .select("id, user_id, leave_type, start_date, end_date")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      admin_comment: comment.trim() || null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;

  // Notification insertion is protected by the database RLS policy.
  const { error: notificationError } = await supabase
    .from("notifications")
    .insert({
      user_id: request.user_id,
      title: `Leave request ${decision}`,
      body:
        `Your ${request.leave_type} leave request from ` +
        `${request.start_date} to ${request.end_date} was ${decision}.` +
        (comment.trim() ? ` Note: ${comment.trim()}` : "")
    });

  if (notificationError) {
    console.error("Notification could not be created:", notificationError);
  }

  return data;
}
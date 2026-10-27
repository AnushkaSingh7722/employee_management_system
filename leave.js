import { supabase } from "./supabase.js";
import { getCurrentProfile } from "./auth.js";

export async function applyForLeave({
  leaveType,
  startDate,
  endDate,
  reason
}) {
  const session = await getCurrentProfile();

  if (!session) throw new Error("Please sign in.");

  if (endDate < startDate) {
    throw new Error("End date must be on or after start date.");
  }

  if (startDate < new Date().toISOString().slice(0, 10)) {
    throw new Error("Start date cannot be in the past.");
  }

  if (!reason.trim()) {
    throw new Error("Please enter a reason.");
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      user_id: session.user.id,
      employee_id: session.profile.employee_id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim()
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getLeaveHistory() {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, leave_type, start_date, end_date, reason, status, admin_comment, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export function renderLeaveHistory(container, requests) {
  container.replaceChildren();

  if (!requests.length) {
    container.textContent = "No leave requests found.";
    return;
  }

  const table = document.createElement("table");
  const head = table.createTHead().insertRow();

  ["Type", "Start", "End", "Reason", "Status", "Admin note"]
    .forEach(label => {
      const th = document.createElement("th");
      th.textContent = label;
      head.appendChild(th);
    });

  const body = table.createTBody();

  requests.forEach(request => {
    const row = body.insertRow();

    [
      request.leave_type,
      request.start_date,
      request.end_date,
      request.reason,
      request.status,
      request.admin_comment || "—"
    ].forEach(value => {
      const cell = row.insertCell();
      cell.textContent = value;
    });
  });

  container.appendChild(table);
}
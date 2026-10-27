import { supabase } from "./supabase.js";
import { requireRole } from "./auth.js";

function downloadCSV(filename, records) {
  if (!records.length) {
    throw new Error("No records available to export.");
  }

  const headers = Object.keys(records[0]);

  const escapeCSV = value => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.map(escapeCSV).join(","),
    ...records.map(record =>
      headers.map(key => escapeCSV(record[key])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + lines.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportLeaveReport() {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "employee_id, leave_type, start_date, end_date, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  downloadCSV("leave-report.csv", data);
}

export async function exportPayrollReport() {
  const { data, error } = await supabase
    .from("payroll_records")
    .select(
      "pay_period, gross_pay, deductions, net_pay, payment_status, paid_at"
    )
    .order("pay_period", { ascending: false });

  if (error) throw error;

  downloadCSV("payroll-report.csv", data);
}

export async function exportAdminLeaveReport() {
  const session = await requireRole("admin");

  if (!session) throw new Error("Administrator access required.");

  return exportLeaveReport();
}
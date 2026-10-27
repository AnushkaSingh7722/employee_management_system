import { supabase } from "./supabase.js";
import { getCurrentProfile, requireRole } from "./auth.js";

export async function getSalaryStructure() {
  const session = await getCurrentProfile();

  if (!session) return [];

  const { data, error } = await supabase
    .from("salary_structures")
    .select(
      "basic_salary, hra, allowances, deductions, effective_from"
    )
    .order("effective_from", { ascending: false });

  if (error) throw error;

  return data;
}

export async function getPayrollHistory() {
  const session = await getCurrentProfile();

  if (!session) return [];

  const { data, error } = await supabase
    .from("payroll_records")
    .select(
      "pay_period, gross_pay, deductions, net_pay, payment_status, paid_at"
    )
    .order("pay_period", { ascending: false });

  if (error) throw error;

  return data;
}

export function calculateNetPay(grossPay, deductions) {
  const gross = Number(grossPay);
  const deduction = Number(deductions);

  if (
    !Number.isFinite(gross) ||
    !Number.isFinite(deduction) ||
    gross < 0 ||
    deduction < 0 ||
    deduction > gross
  ) {
    throw new Error("Invalid salary amounts.");
  }

  return Number((gross - deduction).toFixed(2));
}

export async function createPayrollRecord({
  employeeUserId,
  payPeriod,
  grossPay,
  deductions,
  paymentStatus
}) {
  const session = await requireRole("admin");

  if (!session) throw new Error("Administrator access required.");

  const netPay = calculateNetPay(grossPay, deductions);

  const { data, error } = await supabase
    .from("payroll_records")
    .insert({
      user_id: employeeUserId,
      pay_period: `${payPeriod}-01`,
      gross_pay: Number(grossPay),
      deductions: Number(deductions),
      payment_status: paymentStatus,
      paid_at:
        paymentStatus === "paid"
          ? new Date().toISOString()
          : null,
      created_by: session.user.id
    })
    .select()
    .single();

  if (error) throw error;

  return { ...data, net_pay: netPay };
}
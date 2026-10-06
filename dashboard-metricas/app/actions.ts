"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const USER_NAME_COOKIE = "dashboard_user_name";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const periods = new Set(["day", "week", "month", "year"]);

function validUserName(value: string) {
  return value.trim().length > 0 && value.trim().length <= 60;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function saveUserName(formData: FormData) {
  const userName = String(formData.get("user_name") ?? "").trim();

  if (!validUserName(userName)) redirect("/?status=invalid_name");

  const cookieStore = await cookies();
  cookieStore.set(USER_NAME_COOKIE, userName, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/");
  redirect("/");
}

export async function clearUserName() {
  const cookieStore = await cookies();
  cookieStore.delete(USER_NAME_COOKIE);
  revalidatePath("/");
  redirect("/");
}

export async function createCutBatch(formData: FormData) {
  const mode = String(formData.get("mode") ?? "");
  const renderedOn = String(formData.get("rendered_on") ?? "");
  let fileIds: string[];

  if (!validDate(renderedOn)) {
    redirect("/?status=batch_invalid");
  }

  if (mode === "list") {
    const rawIds = String(formData.get("file_ids") ?? "");
    fileIds = rawIds
      .split(/\r?\n/)
      .map((fileId) => fileId.trim())
      .filter(Boolean);
  } else if (mode === "sequence") {
    const prefix = String(formData.get("prefix") ?? "").trim();
    const startValue = String(formData.get("start") ?? "");
    const quantityValue = String(formData.get("quantity") ?? "");
    const paddingValue = String(formData.get("padding") ?? "");
    const start = Number(startValue);
    const quantity = Number(quantityValue);
    const padding = Number(paddingValue);

    if (
      !/^\d+$/.test(startValue) ||
      !/^\d+$/.test(quantityValue) ||
      !/^\d+$/.test(paddingValue) ||
      !Number.isSafeInteger(start) ||
      start < 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 500 ||
      !Number.isSafeInteger(padding) ||
      padding < 1 ||
      padding > 12 ||
      !Number.isSafeInteger(start + quantity - 1)
    ) {
      redirect("/?status=batch_invalid");
    }

    fileIds = Array.from({ length: quantity }, (_, index) => {
      const number = String(start + index).padStart(padding, "0");
      return `${prefix}${number}`;
    });
  } else {
    redirect("/?status=batch_invalid");
  }

  if (
    fileIds.length < 1 ||
    fileIds.length > 500 ||
    fileIds.some((fileId) => fileId.length > 100) ||
    new Set(fileIds).size !== fileIds.length
  ) {
    redirect("/?status=batch_invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cuts").insert(
    fileIds.map((file_id) => ({
      file_id,
      rendered_on: renderedOn,
    })),
  );

  if (error) {
    console.error("Failed to create cut batch:", error.message);
    redirect(error.code === "23505" ? "/?status=batch_duplicate" : "/?status=batch_error");
  }

  revalidatePath("/");
  redirect(`/?status=batch_saved&count=${fileIds.length}`);
}

export async function updateLatestCutId(formData: FormData) {
  const cutId = String(formData.get("cut_id") ?? "");
  const fileId = String(formData.get("file_id") ?? "").trim();

  if (!uuidPattern.test(cutId) || !fileId || fileId.length > 100) {
    redirect("/?status=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: latestCut, error: latestError } = await supabase
    .from("cuts")
    .select("id")
    .order("created_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error("Failed to verify latest cut:", latestError.message);
    redirect("/?status=update_error");
  }
  if (!latestCut || latestCut.id !== cutId) redirect("/?status=latest_changed");

  const { error } = await supabase.from("cuts").update({ file_id: fileId }).eq("id", cutId);

  if (error) {
    console.error("Failed to update latest cut ID:", error.message);
    redirect(error.code === "23505" ? "/?status=duplicate" : "/?status=update_error");
  }

  revalidatePath("/");
  redirect("/?status=updated");
}

export async function restoreHistoryPoint(formData: FormData) {
  const cutId = String(formData.get("cut_id") ?? "");
  const requestedPeriod = String(formData.get("period") ?? "");
  const period = periods.has(requestedPeriod) ? requestedPeriod : "month";

  if (!uuidPattern.test(cutId)) {
    redirect(`/?period=${period}&status=restore_invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: deletedCount, error } = await supabase.rpc("restore_cut_history_point", {
    p_cut_id: cutId,
  });

  if (error) {
    console.error("Failed to restore cut history point:", error.message);
    if (error.code === "P0002") {
      redirect(`/?period=${period}&status=restore_missing`);
    }
    if (error.message.includes("restore_cut_history_point")) {
      redirect(`/?period=${period}&status=restore_schema`);
    }
    redirect(`/?period=${period}&status=restore_error`);
  }

  const count = Number(deletedCount);
  if (!Number.isSafeInteger(count) || count < 0) {
    console.error("Restore history returned an invalid deleted row count:", deletedCount);
    redirect(`/?period=${period}&status=restore_error`);
  }

  revalidatePath("/");
  redirect(`/?period=${period}&status=restored&count=${count}`);
}

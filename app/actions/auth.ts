"use server";

import { headers } from "next/headers";

import {
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/schemas/auth";
import { onboardingSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; message?: string };

export async function signIn(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  return error ? { error: error.message } : { message: "Signed in successfully." };
}

export async function signUp(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error, data } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: origin + "/auth/confirm?next=/onboarding",
    },
  });

  if (error) return { error: error.message };

  return data.session
    ? { message: "Account created. Continue to set up your firm." }
    : { message: "Check your email to confirm your account, then sign in." };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin + "/update-password",
  });

  return error
    ? { error: error.message }
    : { message: "If that address exists, a password-reset link is on its way." };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  return error ? { error: error.message } : { message: "Your password has been updated." };
}

export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Your session has expired. Please sign in again." };

  const { error } = await supabase.rpc("create_firm_workspace", {
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone || "",
    p_firm_name: parsed.data.firmName,
    p_city: parsed.data.city,
  });

  return error ? { error: error.message } : { message: "Your workspace is ready." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

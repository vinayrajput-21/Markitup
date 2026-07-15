"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Only allow same-app relative paths as post-login destinations.
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(safeNext(formData));
}

export async function signUp(formData: FormData) {
  const name = String(formData.get("name"));
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { error: error.message };
  redirect(safeNext(formData));
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

// useActionState wrappers: on success signIn/signUp throw a redirect (which
// propagates and navigates); on failure they return { error }, which we hand
// back to the form so it can render the message instead of silently reloading.
type AuthState = { error?: string };

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  return (await signIn(formData)) ?? {};
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  return (await signUp(formData)) ?? {};
}

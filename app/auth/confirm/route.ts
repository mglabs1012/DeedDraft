import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/app/dashboard";
  const url = request.nextUrl.clone();
  url.pathname = next.startsWith("/") ? next : "/app/dashboard";
  url.search = "";

  if (!code) {
    url.pathname = "/login";
    url.searchParams.set("error", "Missing confirmation code.");
    return NextResponse.redirect(url);
  }

  const { url: supabaseUrl, anonKey } = getSupabasePublicConfig();
  let response = NextResponse.redirect(url);
  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    url.pathname = "/login";
    url.searchParams.set("error", "Your confirmation link has expired. Please try again.");
    response = NextResponse.redirect(url);
  }

  return response;
}

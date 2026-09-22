import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSafeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

function redirectToProfile(requestUrl: URL, next: string, status: "success" | "error", reason?: string) {
  const destination = new URL(next, requestUrl.origin);
  destination.searchParams.set("email_confirmation", status);
  if (reason) destination.searchParams.set("reason", reason);
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = getSafeNext(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const authError = requestUrl.searchParams.get("error_code") || requestUrl.searchParams.get("error");

  if (authError) {
    return redirectToProfile(requestUrl, next, "error", authError);
  }

  if (!code && !tokenHash) {
    return redirectToProfile(requestUrl, next, "error", "missing_confirmation_token");
  }

  if (code && tokenHash) {
    return redirectToProfile(requestUrl, next, "error", "multiple_confirmation_tokens");
  }

  const supabase = await createClient();
  let confirmedUser: { id: string; email?: string | null } | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToProfile(requestUrl, next, "error", "confirmation_failed");
    }
    confirmedUser = data.user;
  } else {
    if (type !== "email_change") {
      return redirectToProfile(requestUrl, next, "error", "invalid_confirmation_type");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash!,
      type: "email_change",
    });
    if (error) {
      return redirectToProfile(requestUrl, next, "error", error.code || "confirmation_failed");
    }
    confirmedUser = data.user;
  }

  if (confirmedUser?.email) {
    await prisma.user.updateMany({
      where: { authId: confirmedUser.id },
      data: { email: confirmedUser.email.toLowerCase() },
    });
  }

  return redirectToProfile(requestUrl, next, "success");
}

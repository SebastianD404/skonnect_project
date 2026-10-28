import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRefreshTokenMissingError } from "@/lib/supabase/auth-errors";
import { getSessionCookieOptions, REMEMBER_SESSION_COOKIE } from "@/lib/supabase/remember-cookie";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const rememberMe = request.cookies.get(REMEMBER_SESSION_COOKIE)?.value !== "false";
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(
              name,
              value,
              getSessionCookieOptions(options, rememberMe),
            );
          });
        },
      },
    }
  );

  const redirectWithAuthCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  const clearInvalidSession = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Could not clear an invalid Supabase session in the request proxy.", error);
    }
  };

  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && isRefreshTokenMissingError(error)) {
      await clearInvalidSession();
    } else {
      user = data.user;
    }
  } catch (error) {
    if (!isRefreshTokenMissingError(error)) {
      throw error;
    }
    await clearInvalidSession();
  }

  const mustSecureAccount = Boolean(
    user?.user_metadata?.must_secure_account || user?.user_metadata?.temporary_credential
  );

  // Redirect unauthenticated users away from protected routes
  if (!user && request.nextUrl.pathname.startsWith("/grantee-dashboard")) {
    return redirectWithAuthCookies(new URL("/login", request.url));
  }

  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    return redirectWithAuthCookies(new URL("/login", request.url));
  }

  if (!user && request.nextUrl.pathname.startsWith("/profile")) {
    return redirectWithAuthCookies(new URL("/login", request.url));
  }

  if (user && mustSecureAccount && !request.nextUrl.pathname.startsWith("/secure-account")) {
    const secureUrl = new URL("/secure-account", request.url);
    secureUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return redirectWithAuthCookies(secureUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

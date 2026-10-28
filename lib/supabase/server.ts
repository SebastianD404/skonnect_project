import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAuthSessionMissingError, isRefreshTokenMissingError } from "./auth-errors";
import { getSessionCookieOptions, REMEMBER_SESSION_COOKIE } from "./remember-cookie";

export { isAuthSessionMissingError, isRefreshTokenMissingError } from "./auth-errors";

export async function createClient(options: { rememberMe?: boolean } = {}) {
  const cookieStore = await cookies();
  const rememberMe =
    options.rememberMe ??
    cookieStore.get(REMEMBER_SESSION_COOKIE)?.value !== "false";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
              cookieStore.set(
                name,
                value,
                getSessionCookieOptions(cookieOptions, rememberMe),
              );
            });

            if (options.rememberMe !== undefined) {
              cookieStore.set(REMEMBER_SESSION_COOKIE, String(options.rememberMe), {
                path: "/",
                sameSite: "lax",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                ...(options.rememberMe ? { maxAge: 400 * 24 * 60 * 60 } : {}),
              });
            }
          } catch (error) {
            if (options.rememberMe !== undefined) {
              console.error("Failed to persist Supabase auth cookies during login.", error);
              throw error;
            }

            console.warn(
              "Could not persist Supabase auth cookies in this rendering context.",
              error,
            );
          }
        },
      },
    }
  );

  const clearInvalidSession = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Could not clear an invalid Supabase session.", error);
    }
  };

  const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
  supabase.auth.getSession = (async () => {
    try {
      const result = await originalGetSession();
      if (result.error && isRefreshTokenMissingError(result.error)) {
        await clearInvalidSession();
        return {
          data: { session: null },
          error: null,
        } as Awaited<ReturnType<typeof originalGetSession>>;
      }
      return result;
    } catch (error) {
      if (!isRefreshTokenMissingError(error)) {
        throw error;
      }
      await clearInvalidSession();
      return {
        data: { session: null },
        error: null,
      } as Awaited<ReturnType<typeof originalGetSession>>;
    }
  }) as typeof supabase.auth.getSession;

  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
  supabase.auth.getUser = (async (jwt?: string) => {
    let result: Awaited<ReturnType<typeof originalGetUser>>;
    try {
      result = await originalGetUser(jwt);
    } catch (error) {
      if (isAuthSessionMissingError(error)) {
        return {
          data: { user: null as never },
          error: null,
        } as Awaited<ReturnType<typeof originalGetUser>>;
      }
      if (isRefreshTokenMissingError(error)) {
        await clearInvalidSession();
        return {
          data: { user: null as never },
          error: null,
        } as Awaited<ReturnType<typeof originalGetUser>>;
      }

      throw error;
    }

    const { data, error } = result;

    if (error && isRefreshTokenMissingError(error)) {
      await clearInvalidSession();

      return { data: { user: null as never }, error: null } as Awaited<ReturnType<typeof originalGetUser>>;
    }

    return { data, error } as Awaited<ReturnType<typeof originalGetUser>>;
  }) as typeof supabase.auth.getUser;

  return supabase;
}

export async function getSafeUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser();

  if (error && isRefreshTokenMissingError(error)) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out cleanup errors.
    }

    return { user: null, error: null };
  }

  return { user: data.user, error };
}

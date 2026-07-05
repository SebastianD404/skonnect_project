import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function normalizeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const maybeError = error as { code?: string; status?: number; message?: string };
  return {
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
    status: typeof maybeError.status === "number" ? maybeError.status : undefined,
    message: typeof maybeError.message === "string" ? maybeError.message : undefined,
  };
}

export function isRefreshTokenMissingError(error: unknown) {
  const normalized = normalizeError(error);
  if (!normalized) {
    return false;
  }

  return (
    normalized.code === "refresh_token_not_found" ||
    normalized.message?.toLowerCase().includes("refresh token") &&
      normalized.message?.toLowerCase().includes("not found")
  );
}

export async function createClient() {
  const cookieStore = await cookies();

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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
  supabase.auth.getUser = (async (jwt?: string) => {
    const { data, error } = await originalGetUser(jwt);

    if (error && isRefreshTokenMissingError(error)) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore sign-out cleanup errors.
      }

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

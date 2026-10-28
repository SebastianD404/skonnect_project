export const REMEMBER_SESSION_COOKIE = "skonnect-remember-session";
const PERSISTENT_SESSION_MAX_AGE = 400 * 24 * 60 * 60;

export function getSessionCookieOptions<T extends { maxAge?: number }>(
  options: T | undefined,
  rememberMe: boolean,
) {
  if (options?.maxAge === 0) {
    return options;
  }

  const cookieOptions = { path: "/", ...(options ?? {}) };
  if (rememberMe) {
    cookieOptions.maxAge = PERSISTENT_SESSION_MAX_AGE;
  } else {
    delete cookieOptions.maxAge;
  }
  return cookieOptions;
}

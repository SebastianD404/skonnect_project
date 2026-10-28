export const REMEMBER_SESSION_COOKIE = "skonnect-remember-session";

export function getSessionCookieOptions<T extends { maxAge?: number }>(
  options: T | undefined,
  rememberMe: boolean,
) {
  if (rememberMe || options?.maxAge === 0 || !options) {
    return options;
  }

  const sessionCookieOptions = { ...options };
  delete sessionCookieOptions.maxAge;
  return sessionCookieOptions;
}

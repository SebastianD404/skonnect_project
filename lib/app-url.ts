const PRODUCTION_APP_URL = "https://skonnect-project-three.vercel.app";
const DEVELOPMENT_APP_URL = "http://localhost:3000";

function getConfiguredBaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsedUrl = new URL(trimmedValue);
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("The application base URL must use HTTP or HTTPS.");
  }
  return parsedUrl;
}

function isLocalHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  return normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname.startsWith("127.") ||
    normalizedHostname === "[::1]" ||
    normalizedHostname === "::1";
}

export function getAppBaseUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredUrls = [process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL];

  for (const configuredUrl of configuredUrls) {
    const parsedUrl = getConfiguredBaseUrl(configuredUrl);
    if (!parsedUrl || (isProduction && isLocalHostname(parsedUrl.hostname))) {
      continue;
    }
    return parsedUrl.origin;
  }

  return isProduction ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL;
}

export function getEmailAppBaseUrl(): string {
  const configuredUrls = [process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL];

  for (const configuredUrl of configuredUrls) {
    const parsedUrl = getConfiguredBaseUrl(configuredUrl);
    if (!parsedUrl || isLocalHostname(parsedUrl.hostname)) {
      continue;
    }
    return parsedUrl.origin;
  }

  return PRODUCTION_APP_URL;
}

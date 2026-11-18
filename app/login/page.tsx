import LoginContent from "./login-content";
import { redirectIfSignedIn } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<{
    notice?: string;
    reason?: string;
    redirectTo?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectIfSignedIn();
  const params = await searchParams;
  const redirectTo = params?.redirectTo ?? params?.next;
  return <LoginContent redirectTo={typeof redirectTo === "string" ? redirectTo : ""} />;
}
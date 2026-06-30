import { createClient } from "@/lib/supabase/server";
import LoginContent from "./login-content";
import { redirectIfSignedIn } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<{
    notice?: string;
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectIfSignedIn();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await searchParams; // intentionally ignore search params
  return <LoginContent />;
}
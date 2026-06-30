import { redirectIfSignedIn } from "@/lib/auth";
import SignupContent from "./signup-content";

export default async function SignupPage() {
  await redirectIfSignedIn();

  return <SignupContent />;
}

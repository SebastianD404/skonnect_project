import { logout } from "@/app/actions/auth";

export default async function LogoutPage() {
  await logout();
  return null;
}

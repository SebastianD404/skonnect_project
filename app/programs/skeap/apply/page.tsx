import { redirect } from "next/navigation";

export default function SkeapApplyPage() {
  redirect("/programs/skeap-scholarship?openApply=1");
}

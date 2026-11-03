import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ChatWidget } from "@/app/components/chatbot/ChatWidget";

export async function RoleScopedChatWidgetGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const appUser = await prisma.user.findFirst({
    where: {
      authId: user.id,
      isActive: true,
    },
    select: { id: true, role: true },
  });

  if (!appUser) {
    return null;
  }

  if (appUser.role !== "YOUTH" && appUser.role !== "GRANTEE") {
    return null;
  }

  return <ChatWidget />;
}

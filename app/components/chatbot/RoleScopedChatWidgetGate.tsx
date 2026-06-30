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
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    select: { id: true, authId: true, role: true },
  });

  if (!appUser) {
    return null;
  }

  if (appUser.authId !== user.id) {
    try {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Best-effort relink only.
    }
  }

  if (appUser.role !== "YOUTH" && appUser.role !== "GRANTEE") {
    return null;
  }

  return <ChatWidget />;
}

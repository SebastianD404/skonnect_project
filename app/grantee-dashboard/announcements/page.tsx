import { prisma } from "@/lib/prisma";
import GranteeAnnouncementsPageClient from "./GranteeAnnouncementsPageClient";

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  publishedAt: Date;
  author: {
    id: string;
    fullName: string;
    email: string;
  };
  imageUrl?: string | null;
};

async function getAnnouncements(): Promise<AnnouncementItem[]> {
  const selectWithoutImage = {
    id: true,
    title: true,
    content: true,
    publishedAt: true,
    imageUrl: true,
    author: {
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    },
  } as const;

  try {
    return await prisma.announcement.findMany({
      where: {
        isPublished: true,
      },
      select: selectWithoutImage,
      orderBy: {
        publishedAt: "desc",
      },
    });
  } catch (error: unknown) {
    const maybeError = error as { code?: string };
    if (maybeError?.code === "P2022") {
      return await prisma.announcement.findMany({
        where: {
          isPublished: true,
        },
        select: {
          id: true,
          title: true,
          content: true,
          publishedAt: true,
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          publishedAt: "desc",
        },
      });
    }
    throw error;
  }
}

export default async function GranteeAnnouncementsPage() {
  const announcements = await getAnnouncements();

  return <GranteeAnnouncementsPageClient announcements={announcements} />;
}

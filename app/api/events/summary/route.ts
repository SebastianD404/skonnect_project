import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyRegistrations = await prisma.registration.findMany({
      where: {
        registeredAt: {
          gte: monthStart,
        },
      },
      select: {
        userId: true,
      },
    });

    const monthlyUserIds = Array.from(new Set(monthlyRegistrations.map((registration) => registration.userId)));
    const totalMonthlyUsers = monthlyUserIds.length;

    if (totalMonthlyUsers === 0) {
      return NextResponse.json({
        totalMonthlyUsers: 0,
        newUsersThisMonth: 0,
        newParticipantPercent: 0,
      });
    }

    const firstRegistrationByUser = await prisma.registration.groupBy({
      by: ["userId"],
      _min: {
        registeredAt: true,
      },
      where: {
        userId: {
          in: monthlyUserIds,
        },
      },
    });

    const newUsersThisMonth = firstRegistrationByUser.filter(
      (user) => user._min.registeredAt !== null && user._min.registeredAt >= monthStart
    ).length;

    const newParticipantPercent = Math.round((newUsersThisMonth / totalMonthlyUsers) * 100);

    return NextResponse.json({
      totalMonthlyUsers,
      newUsersThisMonth,
      newParticipantPercent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to compute event summary:", message, error);
    return NextResponse.json(
      { error: "Failed to compute event summary", details: message },
      { status: 500 }
    );
  }
}

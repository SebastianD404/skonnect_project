import { beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  mockDeep,
  mockReset,
  type DeepMockProxy,
} from "vitest-mock-extended";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "@/lib/prisma";

export const prismaMock = prisma as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

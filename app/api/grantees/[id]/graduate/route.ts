import { NextRequest } from "next/server";
import { POST as graduateWithClearance } from "@/app/api/admin/grantees/[id]/graduate/route";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return graduateWithClearance(request, context);
}

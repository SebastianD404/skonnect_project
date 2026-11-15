import { NextResponse } from "next/server";
import { SKEAP_EDUCATION_LEVEL_OPTIONS } from "@/lib/skeap-education";
import { getActiveSkeapEducationLevels } from "@/lib/skeap-application-guard";

export async function GET() {
  const activeEducationLevels = await getActiveSkeapEducationLevels();
  return NextResponse.json({
    activeEducationLevels,
    options: SKEAP_EDUCATION_LEVEL_OPTIONS.map(({ value, label }) => ({ code: value, label })),
  });
}

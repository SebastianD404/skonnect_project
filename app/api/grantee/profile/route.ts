import { NextResponse } from "next/server";
import { updateProfileName } from "@/app/actions/profile";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const formData = new FormData();

    for (const field of ["fullName", "email", "phoneNumber", "school", "yearLevel", "currentPassword", "newPassword", "confirmPassword"]) {
      const value = payload[field];
      if (typeof value === "string") {
        formData.set(field, value);
      }
    }

    const result = await updateProfileName(null, formData);
    return NextResponse.json(result, { status: result?.error ? 400 : 200 });
  } catch {
    return NextResponse.json({ error: "We could not update your profile. Please try again." }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import { prisma } from "@/lib/prisma";

const TEMPLATE_FILENAME = "SKEAP Application Form (2).docx";
const TEMPLATE_PATH = join(process.cwd(), "public", TEMPLATE_FILENAME);

function safeString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toLocaleDateString("en-US");
  return String(value);
}

function formatDate(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params;
    const id = params?.id;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing or invalid application ID" }, { status: 400 });
    }

    const skeapApplication = await prisma.skeapApplication.findUnique({
      where: { id },
      include: { inquiry: true },
    });

    let inquiryCreatedAt: Date | undefined;
    let application = skeapApplication;

    if (!application) {
      const inquiry = await prisma.inquiry.findUnique({
        where: { id },
        select: {
          createdAt: true,
          application: true,
        },
      });
      if (!inquiry?.application) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
      application = inquiry.application as typeof skeapApplication;
      inquiryCreatedAt = inquiry.createdAt;
    }

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const submittedAt = inquiryCreatedAt ?? skeapApplication?.inquiry?.createdAt ?? undefined;

    const data = {
      applicantName: safeString(application.applicantName),
      permanentAddress: safeString(application.permanentAddress),
      dateOfBirth: formatDate(application.dateOfBirth),
      placeOfBirth: safeString(application.placeOfBirth),
      age: safeString(application.age),
      civilStatus: safeString(application.civilStatus),
      gender: safeString(application.gender),
      fathersName: safeString(application.fathersName),
      fathersOccupation: safeString(application.fathersOccupation),
      fathersContact: safeString(application.fathersContact),
      mothersMaidenName: safeString(application.mothersMaidenName),
      mothersOccupation: safeString(application.mothersOccupation),
      mothersContact: safeString(application.mothersContact),
      contactNumber: safeString(application.contactNumber),
      emailAddress: safeString(application.emailAddress),
      currentCourse: safeString(application.currentCourse),
      yearLevel: safeString(application.yearLevel),
      gwa: safeString(application.gwa),
      enrollmentFileUrl: safeString(application.enrollmentFileUrl),
      reportCardFileUrl: safeString(application.reportCardFileUrl),
      submittedAt: formatDate(submittedAt),
      profilePhoto: safeString(application.photoFileUrl),
    } as const;

    const templateBuffer = readFileSync(TEMPLATE_PATH);
    const zip = new PizZip(templateBuffer);
    const imageModule = new ImageModule({
      centered: false,
      fileType: "docx",
      getImage: async (tagValue: any) => {
        if (!tagValue) return null;
        return fetchImageBuffer(String(tagValue));
      },
      getSize: () => [120, 120],
    });

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.setData(data);
    doc.render();

    const outputBuffer = doc.getZip().generate({ type: "nodebuffer" });

    return new NextResponse(Buffer.from(outputBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="SKEAP Application Form (2).docx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate application document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

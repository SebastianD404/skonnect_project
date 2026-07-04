import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { loadTemplate, createDocFromTemplate } from "@/lib/docx/template-helpers";

export async function GET(request: NextRequest, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params;
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    let app: any = await prisma.skeapApplication.findUnique({ where: { id } });
    if (!app) {
      const inquiry = await prisma.inquiry.findUnique({
        where: { id },
        select: { application: true },
      });
      if (!inquiry?.application) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
      app = inquiry.application;
    }

    // Attempt to load and fill the DOCX template if available
    const templatePath = process.cwd() + "/public/SKEAP Application Form (2).docx";
    try {
      const zip = loadTemplate(templatePath);
      const imageFetcher = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch image");
        const buf = Buffer.from(await res.arrayBuffer());
        return buf;
      };

      const data: any = {
        applicantName: app.applicantName || "",
        permanentAddress: app.permanentAddress || "",
        dateOfBirth: app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : "",
        placeOfBirth: app.placeOfBirth || "",
        age: app.age ?? "",
        civilStatus: app.civilStatus || "",
        contactNumber: app.contactNumber || "",
        emailAddress: app.emailAddress || "",
        fathersName: app.fathersName || "",
        fathersOccupation: app.fathersOccupation || "",
        fathersContact: app.fathersContact || "",
        mothersMaidenName: app.mothersMaidenName || "",
        mothersOccupation: app.mothersOccupation || "",
        currentCourse: app.currentCourse || "",
        yearLevel: app.yearLevel || "",
        gwa: app.gwa ?? "",
        photo: app.photoFileUrl || "",
      };

      const out = createDocFromTemplate(zip, data, imageFetcher);
      const buffer = out;
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="SKEAP Application Form (2).docx"`,
        },
      });
    } catch (err) {
      // Fallback to generated doc when templating fails
    }

    const children: any[] = [];

    children.push(new Paragraph({ children: [new TextRun({ text: "SKEAP Application", bold: true, size: 28 })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Application ID: ${app.id}` })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));

    const fields: Array<[string, any]> = [
      ["Applicant Name", app.applicantName],
      ["Permanent Address", app.permanentAddress],
      ["Date of Birth", app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : ""],
      ["Place of Birth", app.placeOfBirth],
      ["Age", app.age ?? ""],
      ["Civil Status", app.civilStatus],
      ["Contact Number", app.contactNumber],
      ["Email Address", app.emailAddress],
      ["Father's Name", app.fathersName],
      ["Father's Occupation", app.fathersOccupation],
      ["Father's Contact", app.fathersContact],
      ["Mother's Maiden Name", app.mothersMaidenName],
      ["Mother's Occupation", app.mothersOccupation],
      ["Course", app.currentCourse],
      ["Year Level", app.yearLevel],
      ["GWA", app.gwa ?? ""],
    ];

    for (const [label, value] of fields) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(String(value ?? ""))] }));
    }

    if (app.photoFileUrl) {
      try {
        const res = await fetch(app.photoFileUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const image = new ImageRun({ data: buffer, transformation: { width: 120, height: 120 } });
          children.push(new Paragraph({ children: [new TextRun({ text: "2x2 Photo:" }), image] }));
        }
      } catch (e) {
        // ignore image embed errors
      }
    }

    if (app.uploadedFiles) {
      const uploaded = typeof app.uploadedFiles === "string" ? JSON.parse(app.uploadedFiles) : app.uploadedFiles;
      children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Uploaded Files:", bold: true })] }));
      if (Array.isArray(uploaded)) {
        for (const f of uploaded) {
          children.push(new Paragraph({ children: [new TextRun(String(f.name || f.url || f))] }));
        }
      } else if (typeof uploaded === "object" && uploaded !== null) {
        for (const value of Object.values(uploaded)) {
          const item = value as { name?: string; url?: string };
          children.push(new Paragraph({ children: [new TextRun(String(item.name || item.url || ""))] }));
        }
      }
    }

    const doc = new Document({ creator: "SKonnect", sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="SKEAP Application Form (2).docx"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const runtime = "nodejs";

import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import {
  buildSkeapApplicationTemplateData,
  generateSkeapApplicationDocx,
} from "@/lib/docx/skeap-application-template";

const signaturePng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QIJBywfp3IOswAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAkUlEQVQY052PMQqDQBREZ1f/d1kUm3SxkeAF/FdIjpOcw2vpKcRWCwsRPMFPsaIQSIoMr5pXDGNUFd9j8TOn7kRW71fvO5HTq6qqtnWtzh20IqE3YXtL0zyKwAROQLQ5l/c9gHjfKK6wMZjADE6s49Dver4/smEAc2CuqgwAYI5jU9NcxhHEy60sni986H9+vwG1yDHfK1jitgAAAABJRU5ErkJggg==";

describe("SKEAP application DOCX", () => {
  it("embeds the applicant signature PNG and renders the printed name", async () => {
    const output = await generateSkeapApplicationDocx({
      applicantName: "Applicant, First Middle",
      signatureUrl: signaturePng,
    }, {
      fullName: "Profile Name Without Middle",
    });
    const document = new PizZip(output);
    const documentXml = document.file("word/document.xml")?.asText() ?? "";
    const mediaFiles = Object.keys(document.files).filter((name) =>
      name.startsWith("word/media/")
    );

    expect(documentXml).not.toContain("{%applicantSignature}");
    expect(documentXml).toContain("Profile Name Without Middle");
    expect(mediaFiles.some((name) => name.endsWith(".png"))).toBe(true);
  });

  it("keeps the normal applicant name casing and exposes an uppercase signature name", () => {
    const templateData = buildSkeapApplicationTemplateData(
      { applicantName: "Applicant, First Middle" },
      {},
      ""
    );

    expect(templateData.applicantName).toBe("Applicant, First Middle");
    expect(templateData.applicantNameUpper).toBe("APPLICANT, FIRST MIDDLE");
    expect(templateData.applicantSignature).toBeNull();
  });

  it("title-cases free-text fields while preserving email and exact-value casing", () => {
    const templateData = buildSkeapApplicationTemplateData(
      {
        applicantName: "jUAN dE lA cRUZ",
        gender: "female",
        civilStatus: "single",
        permanentAddress: "pico road, la trinidad, benguet",
        placeOfBirth: "bAGUIO cITY",
        emailAddress: "Applicant.Name@Example.COM",
        school: "kings college of the philippines",
        yearLevel: "first year",
        currentCourse: "bachelor of science in information technology",
        fathersName: "jUAN dE lA cRUZ",
        fathersOccupation: "civil ENGINEER",
        mothersMaidenName: "mARIA sANTOS",
        mothersOccupation: "public school teacher",
        educationalBackground: {
          elementary: { school: "la trinidad central school", year: "2010" },
          highSchool: { school: "benguet national high school", year: "2014" },
          college: { school: "king's college of the philippines", year: "2020" },
          vocational: { school: "technical education center", year: "2018" },
        },
      },
      {},
      ""
    );

    expect(templateData.applicantName).toBe("Juan De La Cruz");
    expect(templateData.applicantNameUpper).toBe("JUAN DE LA CRUZ");
    expect(templateData.gender).toBe("Female");
    expect(templateData.civilStatus).toBe(" Single");
    expect(templateData.permanentAddress).toBe("Pico Road, La Trinidad, Benguet");
    expect(templateData.placeOfBirth).toBe("Baguio City");
    expect(templateData.emailAddress).toBe("applicant.name@example.com");
    expect(templateData.school).toBe("Kings College Of The Philippines");
    expect(templateData.yearLevel).toBe("First Year");
    expect(templateData.course).toBe("Bachelor Of Science In Information Technology");
    expect(templateData.fatherName).toBe("Juan De La Cruz");
    expect(templateData.fatherOccupation).toBe("Civil Engineer");
    expect(templateData.motherName).toBe("Maria Santos");
    expect(templateData.motherOccupation).toBe("Public School Teacher");
    expect(templateData.elemSchool).toBe("La Trinidad Central School");
    expect(templateData.hsSchool).toBe("Benguet National High School");
    expect(templateData.collegeSchool).toBe("King's College of the Philippines");
    expect(templateData.vocSchool).toBe("Technical Education Center");
    expect(templateData.elemYear).toBe("2010");
  });

  it("prints N/A for blank educational background values", async () => {
    const output = await generateSkeapApplicationDocx({
      applicantName: "Applicant, First Middle",
      educationalBackground: {
        elementary: "",
        elementaryYearGraduated: "",
        highSchool: "",
        highSchoolYearGraduated: "",
        college: "",
        collegeYearGraduated: "",
        vocational: "",
        vocationalYearGraduated: "",
      },
    });

    const documentXml = new PizZip(output).file("word/document.xml")?.asText() ?? "";

    expect(documentXml.match(/N\/A/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps unavailable vocational values uppercase N/A", () => {
    const templateData = buildSkeapApplicationTemplateData(
      {
        vocational: "",
        vocationalYearGraduated: "",
      },
      {},
      ""
    );

    expect(templateData.vocSchool).toBe("N/A");
    expect(templateData.vocYear).toBe("N/A");
  });

  it("uses the current profile name instead of a stale SKEAP application name", () => {
    const templateData = buildSkeapApplicationTemplateData(
      {
        applicantName: "Old Name",
        emailAddress: "old@example.com",
      },
      {
        fullName: "Updated Name",
        email: "updated@example.com",
      },
      ""
    );

    expect(templateData.applicantName).toBe("Updated Name");
    expect(templateData.emailAddress).toBe("updated@example.com");
  });

  it("prints profile first, middle, and last names in that order", () => {
    const templateData = buildSkeapApplicationTemplateData(
      { applicantName: "Old Name" },
      {
        fullName: "First Last",
        firstName: "First",
        middleName: "Middle",
        lastName: "Last",
      },
      ""
    );

    expect(templateData.applicantName).toBe("First Middle Last");
    expect(templateData.applicantNameUpper).toBe("FIRST MIDDLE LAST");
  });
});

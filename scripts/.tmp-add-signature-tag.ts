import fs from "node:fs";
import PizZip from "pizzip";

const templatePath = "public/SKEAP Application Form (2).docx";
const zip = new PizZip(fs.readFileSync(templatePath));
const documentXml = zip.file("word/document.xml")?.asText();
if (!documentXml) throw new Error("SKEAP DOCX is missing word/document.xml");

const verifiedByIndex = documentXml.indexOf("Verified by:");
if (verifiedByIndex < 0) throw new Error("Could not locate the DOCX signature block");

const signatureLinePattern = /(<w:t(?:\s[^>]*)?>)_{20,}(<\/w:t>)/;
const lineMatch = signatureLinePattern.exec(documentXml.slice(verifiedByIndex));
if (!lineMatch) throw new Error("Could not locate the applicant signature line");

const lineOffset = verifiedByIndex + lineMatch.index;
const updatedXml =
  documentXml.slice(0, lineOffset) +
  lineMatch[0].replace(/_{20,}/, "{%applicantSignature}") +
  documentXml.slice(lineOffset + lineMatch[0].length);
zip.file("word/document.xml", updatedXml);
fs.writeFileSync(templatePath, zip.generate({ type: "nodebuffer" }));

const tagCount = (updatedXml.match(/\{%applicantSignature\}/g) ?? []).length;
if (tagCount !== 1) throw new Error(`Expected one applicantSignature tag, found ${tagCount}`);
console.log(`Added one applicant signature image tag to ${templatePath}`);

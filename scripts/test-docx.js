const { Document, Packer, Paragraph, TextRun } = require("docx");
const fs = require("fs");

async function run() {
  const doc = new Document({
    creator: "SKonnect",
    sections: [
      {
        children: [new Paragraph({ children: [new TextRun("Test DOCX generation")] })],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("tmp-test.docx", Buffer.from(buffer));
  console.log("Wrote tmp-test.docx");
}

run().catch(err=>{ console.error(err); process.exit(1); });

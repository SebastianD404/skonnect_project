import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import { readFileSync } from "fs";

export function loadTemplate(path: string) {
  const content = readFileSync(path, "binary");
  const zip = new PizZip(content);
  return zip;
}

export function createDocFromTemplate(zip: any, data: any, imageFetch?: (url: string) => Promise<Buffer>) {
  const opts: any = {};
  if (imageFetch) {
    opts.modules = [
      new ImageModule({
        centered: false,
        fileType: "docx",
        getImage: async function (tagValue: any) {
          if (!tagValue) return null;
          const buf = await imageFetch(tagValue);
          return buf;
        },
        getSize: function () {
          return [120, 120];
        },
      }),
    ];
  }

  const doc = new Docxtemplater(zip, opts);
  doc.setData(data);
  doc.render();
  const out = doc.getZip().generate({ type: "nodebuffer" });
  return out;
}

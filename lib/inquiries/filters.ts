import { Prisma } from "@prisma/client";

const skeapApplicationSubject = {
  contains: "SKEAP application",
  mode: Prisma.QueryMode.insensitive,
};

export const supportInboxInquiryWhere: Prisma.InquiryWhereInput = {
  OR: [
    { applicationId: null },
    { NOT: { subject: skeapApplicationSubject } },
  ],
};

export const skeapApplicationInquiryWhere: Prisma.InquiryWhereInput = {
  subject: skeapApplicationSubject,
  applicationId: { not: null },
};

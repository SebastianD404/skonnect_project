import { Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RESUBMISSION_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.REJECTED,
  SubmissionStatus.RETURNED_FOR_EDIT,
];

export type NonCompliantGrantee = {
  id: string;
  fullName: string;
  email: string | null;
  school: string;
  yearLevel: string;
  submittedAt: Date | null;
  statusLabel: string;
  issues: string[];
  missingDocuments: Array<"coe" | "grades">;
  rejectedDocuments: Array<"coe" | "grades">;
};

type NonCompliantGranteeOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
};

type NonCompliantGranteeResult = {
  records: NonCompliantGrantee[];
  totalCount: number;
  page: number;
  totalPages: number;
};

export async function getNonCompliantGrantees(
  semester: string,
  options: NonCompliantGranteeOptions = {},
): Promise<NonCompliantGranteeResult> {
  const semesterWhere: Prisma.SubmissionWhereInput = {
    semester: { equals: semester, mode: "insensitive" },
  };
  const incompleteWhere: Prisma.SubmissionWhereInput = {
    OR: [
      { coeFileUrl: "" },
      { gradeFileUrl: "" },
      { status: { in: RESUBMISSION_STATUSES } },
      { coeStatus: { in: RESUBMISSION_STATUSES } },
      { gradesStatus: { in: RESUBMISSION_STATUSES } },
    ],
  };
  const search = options.search?.trim() ?? "";
  const contains = { contains: search, mode: Prisma.QueryMode.insensitive };
  const where: Prisma.GranteeWhereInput = {
    status: "ACTIVE",
    AND: [
      {
        OR: [
          { submissions: { none: semesterWhere } },
          { submissions: { some: { ...semesterWhere, ...incompleteWhere } } },
        ],
      },
      ...(search
        ? [{
            OR: [
              { user: { is: { fullName: contains } } },
              { user: { is: { email: contains } } },
              { school: contains },
              { yearLevel: contains },
            ],
          }]
        : []),
    ],
  };

  const requestedPage = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = options.pageSize;
  const totalCount = await prisma.grantee.count({ where });
  const totalPages = pageSize ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const page = pageSize ? Math.min(requestedPage, totalPages) : 1;
  const orderBy = [{ updatedAt: "desc" }, { id: "desc" }] satisfies Prisma.GranteeOrderByWithRelationInput[];
  const select = {
    id: true,
    school: true,
    yearLevel: true,
    user: { select: { fullName: true, email: true } },
    submissions: {
      where: semesterWhere,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }] satisfies Prisma.SubmissionOrderByWithRelationInput[],
      take: 1,
      select: {
        coeFileUrl: true,
        gradeFileUrl: true,
        status: true,
        coeStatus: true,
        gradesStatus: true,
        submittedAt: true,
      },
    },
  } satisfies Prisma.GranteeSelect;
  const queryOptions = {
    where,
    orderBy,
    select,
  };
  const grantees = pageSize
    ? await prisma.grantee.findMany({
        ...queryOptions,
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
    : await prisma.grantee.findMany(queryOptions);

  const records = grantees.map((grantee) => {
    const submission = grantee.submissions[0];
    const missingDocuments: NonCompliantGrantee["missingDocuments"] = [];
    const rejectedDocuments: NonCompliantGrantee["rejectedDocuments"] = [];
    const issues: string[] = [];

    if (!submission || !submission.coeFileUrl.trim()) {
      missingDocuments.push("coe");
      issues.push("Missing Certificate of Enrollment");
    } else if (RESUBMISSION_STATUSES.includes(submission.coeStatus)) {
      rejectedDocuments.push("coe");
      issues.push("Certificate of Enrollment rejected or returned");
    }

    if (!submission || !submission.gradeFileUrl.trim()) {
      missingDocuments.push("grades");
      issues.push("Missing Grade Report");
    } else if (RESUBMISSION_STATUSES.includes(submission.gradesStatus)) {
      rejectedDocuments.push("grades");
      issues.push("Grade Report rejected or returned");
    }

    const isRejectedSubmission = submission
      && RESUBMISSION_STATUSES.includes(submission.status);
    if (isRejectedSubmission && rejectedDocuments.length === 0) {
      issues.push("Submission rejected or returned");
    }

    return {
      id: grantee.id,
      fullName: grantee.user.fullName,
      email: grantee.user.email,
      school: grantee.school,
      yearLevel: grantee.yearLevel,
      submittedAt: submission?.submittedAt ?? null,
      statusLabel: !submission
        ? "Missing Submission"
        : isRejectedSubmission
          ? "Rejected / Returned"
          : rejectedDocuments.length > 0
            ? "Rejected Document"
            : "Missing Documents",
      issues,
      missingDocuments,
      rejectedDocuments,
    };
  });

  return { records, totalCount, page, totalPages };
}

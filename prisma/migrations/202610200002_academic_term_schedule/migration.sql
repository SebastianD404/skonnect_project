CREATE TABLE "academic_term_schedules" (
  "id" TEXT NOT NULL,
  "semester" TEXT NOT NULL,
  "opensAt" TIMESTAMP(3) NOT NULL,
  "closesAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_term_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_term_schedules_semester_key"
ON "academic_term_schedules"("semester");

CREATE INDEX "academic_term_schedules_opensAt_closesAt_idx"
ON "academic_term_schedules"("opensAt", "closesAt");

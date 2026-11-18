"use client";

import { useState } from "react";
import GranteeDocumentsClient, {
  type GranteeDocumentsClientProps,
  type SubmissionSuccessType,
} from "./GranteeDocumentsClient";

type Props = Omit<
  GranteeDocumentsClientProps,
  "submissionSuccessType" | "onSubmissionSuccess" | "onDismissConfirmation" | "onUploadStarted"
> & {
  resetKey: string;
};

export default function GranteeDocumentsPageClient({ resetKey, ...props }: Props) {
  const [submissionSuccessType, setSubmissionSuccessType] = useState<SubmissionSuccessType>(null);

  return (
    <GranteeDocumentsClient
      key={resetKey}
      {...props}
      submissionSuccessType={submissionSuccessType}
      onSubmissionSuccess={(type) => setSubmissionSuccessType(type)}
      onDismissConfirmation={() => setSubmissionSuccessType(null)}
      onUploadStarted={() => setSubmissionSuccessType(null)}
    />
  );
}

import SupportInboxClient from "./SupportInboxClient";

type Props = {
  searchParams: Promise<{
    inquiry?: string;
    submitted?: string;
  }>;
};

export default async function GranteeInquiriesPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <SupportInboxClient
      basePath="/grantee-dashboard"
      initialInquiryId={params.inquiry ?? null}
      showSubmittedToast={params.submitted === "1"}
    />
  );
}

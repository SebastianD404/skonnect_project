import SupportInboxClient from "@/app/grantee-dashboard/inquiries/SupportInboxClient";

type Props = {
  searchParams: Promise<{
    inquiry?: string;
    submitted?: string;
  }>;
};

export default async function YouthInquiriesPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <SupportInboxClient
      basePath="/youth-dashboard"
      initialInquiryId={params.inquiry ?? null}
      showSubmittedToast={params.submitted === "1"}
    />
  );
}

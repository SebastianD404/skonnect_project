import SupportInboxClient from "@/app/grantee-dashboard/inquiries/SupportInboxClient";

type Props = {
  searchParams: Promise<{
    inquiryId?: string;
    inquiry?: string;
    submitted?: string;
  }>;
};

export default async function YouthInquiriesPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <SupportInboxClient
      basePath="/youth-dashboard"
      initialInquiryId={params.inquiryId ?? params.inquiry ?? null}
      showSubmittedToast={params.submitted === "1"}
    />
  );
}

import SkeapHistoryReceipt from "@/app/programs/skeap/history/SkeapHistoryReceipt";

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationHistoryPage({ params }: Props) {
  const { id } = await params;
  return <SkeapHistoryReceipt applicationId={id} />;
}

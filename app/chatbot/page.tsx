import Link from "next/link";

export default function ChatbotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] p-12">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 shadow-xl ring-1 ring-black/5">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-[#0F3D5C]/70">Chat with SKonnect</p>
              <h1 className="text-3xl font-black text-[#0F3D5C]">Youth support assistant</h1>
            </div>
            <div className="rounded-2xl bg-[#F1F7FB] px-4 py-3 text-sm font-medium text-[#0F3D5C]">
              Guest users can ask questions here.
            </div>
          </div>

          <div className="border-t border-[#E5E7EB] pt-6">
            <p className="text-sm text-[#52525C]">
              Chat history is saved for signed-in youth and grantees. If you are visiting without an account, your question is logged anonymously for quality monitoring only.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-[#0F3D5C]">← Back home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

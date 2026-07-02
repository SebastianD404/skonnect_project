import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: { id?: string } };

export default async function InquiryPage({ params }: Props) {
  const { id } = params;
  if (!id) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserId: string | null = null;
  if (user) {
    const appUser = await ensureProfile(user);
    if (appUser) currentUserId = appUser.id;
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Application not found</h1>
        <p className="mt-2 text-sm">We couldn't find that application.</p>
        <Link href="/programs" className="mt-4 inline-block text-teal-700">Back to programs</Link>
      </div>
    );
  }

  if (inquiry.userId !== currentUserId) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Not authorized</h1>
        <p className="mt-2 text-sm">You don't have permission to view this application.</p>
        <Link href="/programs" className="mt-4 inline-block text-teal-700">Back to programs</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">Application status</h1>
      <p className="mt-2 text-sm text-slate-700">Application ID: <span className="font-mono text-sm">{inquiry.id}</span></p>

      <div className="mt-4 rounded-md border p-4">
        <p className="font-medium">Status</p>
        <p className="mt-1 text-sm text-slate-700">{inquiry.isResolved ? "Responded" : "Pending review"}</p>
      </div>

      <div className="mt-4 rounded-md border p-4">
        <p className="font-medium">Your submission</p>
        <pre className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">{inquiry.message}</pre>
      </div>

      {inquiry.response && (
        <div className="mt-4 rounded-md border p-4 bg-slate-50">
          <p className="font-medium">Response from SK team</p>
          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{inquiry.response}</div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link href="/programs" className="rounded-md border px-4 py-2">Back</Link>
      </div>
    </div>
  );
}

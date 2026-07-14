import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/auth";

const DEFAULT_TOTAL = 10 * 1024 * 1024 * 1024; // 10 GB

export async function GET() {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const appUser = await ensureProfile(user);
		if (!appUser || appUser.role !== "SUPER_ADMIN") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		// Check admin client configuration first
		const hasAdminEnv = !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
		if (!hasAdminEnv) {
			return NextResponse.json({ error: "admin_client_unconfigured", message: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", debug: { hasAdminEnv } }, { status: 500 });
		}

		const admin = createAdminClient();
		const { data, error } = await admin.from("storage.objects").select("*, size, metadata").range(0, 100000);
		if (error) {
			console.warn("Failed to query storage.objects", error);
		}

		let usedBytes: number | null = null;
		let sampleRow: any = null;
		let bucketsDebug: any[] = [];
		let storageApiSum: number | null = null;

		if (Array.isArray(data)) {
			sampleRow = data[0] ?? null;

			const hasSizeColumn = data.some((r: any) => typeof r.size === "number");
			if (hasSizeColumn) {
				usedBytes = data.reduce((sum: number, row: any) => sum + (Number(row.size) || 0), 0);
			} else {
				usedBytes = data.reduce((sum: number, row: any) => {
					try {
						const meta = row.metadata;
						const size = meta && typeof meta === "object" ? Number(meta.size || 0) : Number(meta || 0);
						return sum + (Number.isFinite(size) ? size : 0);
					} catch {
						return sum;
					}
				}, 0);
			}
		}

		// If storage.objects returned no rows or zero usedBytes, try the Storage API as a fallback.
		if ((!usedBytes || usedBytes === 0) && typeof admin.storage?.listBuckets === "function") {
			try {
				const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();
				if (!bucketsError && Array.isArray(buckets)) {
					bucketsDebug = buckets.map((b: any) => ({ name: b.name, id: b.id }));
					let total = 0;
					for (const b of buckets) {
						const bucketName = b.name;
						const { data: objects, error: listErr } = await admin.storage.from(bucketName).list("", { limit: 1000 });
						if (listErr || !Array.isArray(objects)) continue;
						for (const obj of objects as any[]) {
							const meta = obj?.metadata;
							const size = (obj && typeof (obj as any).size === "number") ? Number((obj as any).size) : (meta && typeof meta.size === "number" ? Number(meta.size) : Number(meta?.size || 0));
							total += Number.isFinite(size) ? size : 0;
						}
					}
					storageApiSum = total;
					if (storageApiSum > 0) usedBytes = storageApiSum;
				}
			} catch (ex) {
				// ignore
			}
		}

		const totalBytes = Number(process.env.STORAGE_QUOTA_BYTES || process.env.ADMIN_STORAGE_QUOTA_BYTES || DEFAULT_TOTAL);
		const pct = usedBytes !== null && totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : null;

		let status = "operational";
		if (pct !== null) {
			if (pct >= 95) status = "critical";
			else if (pct >= 80) status = "degraded";
		}

		return NextResponse.json({ usedBytes, totalBytes, pct, status, debug: { rowCount: Array.isArray(data) ? data.length : 0, sampleRow, hasAdminEnv: !!hasAdminEnv, storageApiSum, buckets: bucketsDebug } });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("/api/admin/storage error:", err);
		return NextResponse.json({ error: "Failed to get storage info", message }, { status: 500 });
	}
}

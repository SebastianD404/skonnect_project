export type KKProfile = {
  id?: string;
  fullName: string;
  middleName?: string | null;
  email: string;
  contactNumber: string;
  purok: string;
  addressLine: string;
  barangay: string;
  birthDate: string;
  age: number;
  civilStatus?: string;
  sex?: string;
  registeredNationalVoter?: string;
  status?: string;
  registration?: {
    reviewStatus?: string;
    sex?: string;
    civilStatus?: string;
    registeredNationalVoter?: string;
    registeredSKVoter?: string;
  };
};

export type KKProfileResponse = {
  profile?: KKProfile;
  registration?: { reviewStatus?: string };
  error?: string;
};

const KK_PROFILE_CACHE_TTL = 5 * 60 * 1000;
let cachedProfile: { data: KKProfileResponse & { profile: KKProfile }; expiresAt: number } | null = null;
let profileRequest: Promise<KKProfileResponse & { profile: KKProfile }> | null = null;

export function fetchKKProfile(): Promise<KKProfileResponse & { profile: KKProfile }> {
  if (cachedProfile) {
    if (cachedProfile.expiresAt > Date.now()) {
      return Promise.resolve(cachedProfile.data);
    }
    cachedProfile = null;
  }
  if (profileRequest) return profileRequest;

  const request = fetch("/api/my/kk-profile", { cache: "no-store", credentials: "include" })
    .then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as KKProfileResponse;
      if (!response.ok) throw new Error(body.error || "Unable to load KK profile");
      if (!body.profile) throw new Error("KK profile not found");

      const result = body as KKProfileResponse & { profile: KKProfile };
      cachedProfile = { data: result, expiresAt: Date.now() + KK_PROFILE_CACHE_TTL };
      return result;
    })
    .finally(() => {
      profileRequest = null;
    });

  profileRequest = request;
  return request;
}

export function prefetchKKProfile() {
  void fetchKKProfile().catch(() => undefined);
}
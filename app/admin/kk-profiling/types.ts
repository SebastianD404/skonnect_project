export interface KKProfilingRegistration {
  id: string;
  skeapStatus?: string;
  user?: {
    fullName?: string | null;
    email?: string | null;
    grantee?: {
      id: string;
      status: string;
    } | null;
  } | null;
  fullName: string;
  email: string;
  address: string;
  sex: string;
  age: number;
  birthDate: string | Date;
  facebook: string;
  contactNumber: string;
  civilStatus: string;
  youthClassification: string;
  youthAgeGroup: string;
  workStatus: string;
  educationalBackground: string;
  registeredSKVoter: string;
  votedLastSK: string;
  registeredNationalVoter: string;
  attendedKKAssembly: string;
  assemblyTimes?: string | null;
  noAssemblyReason?: string | null;
  consent?: boolean;
  residencyStatementAcknowledgement?: boolean;
  idDocumentType?: string | null;
  photoFileUrl?: string | null;
  birthCertificateFileUrl?: string | null;
  idFrontFileUrl?: string | null;
  idBackFileUrl?: string | null;
  idSingleFileUrl?: string | null;
  reviewStatus?: string;
  archivedReason?: string | null;
  archivedAt?: string | Date | null;
  reviewNotes?: string | null;
  requiresManualReview?: boolean;
  submittedAt: string | Date;
}

export interface KKProfilingRegistration {
  id: string;
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
  submittedAt: string | Date;
}

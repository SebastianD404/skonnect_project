export function getKKYouthAgeGroup(age: number) {
  if (!Number.isInteger(age) || age < 0) return null;
  if (age < 15) return "Below KK age range";
  if (age <= 17) return "15–17: Child Youth";
  if (age <= 24) return "18–24: Core Youth";
  if (age <= 30) return "25–30: Young Adult";
  return "Aged Out (31+)";
}

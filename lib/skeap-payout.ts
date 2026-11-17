const DEFAULT_SKEAP_GRANT_AMOUNT = 5000;

export function getSkeapGrantAmount() {
  const configuredAmount = process.env.SKEAP_GRANT_AMOUNT?.trim();
  if (!configuredAmount) return DEFAULT_SKEAP_GRANT_AMOUNT;

  const amount = Number(configuredAmount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("SKEAP_GRANT_AMOUNT must be a positive whole number.");
  }
  return amount;
}

import {
  linkPropertyBank,
  updatePropertyBankLink,
} from "../api/properties.js";

/**
 * Ensure the selected owner bank account is linked as primary.
 * Uses existing property_bank_accounts junction (no schema changes).
 */
export async function syncPrimaryOwnerBankAccount(
  propertyId,
  desiredBankAccountId,
  currentLinks = []
) {
  const raw = String(desiredBankAccountId || "").trim();
  if (!raw) return;

  const bankAccountId = Number(raw);
  if (!Number.isInteger(bankAccountId) || bankAccountId <= 0) return;

  const existing = (currentLinks || []).find(
    (b) => Number(b.bankAccountId) === bankAccountId
  );

  if (existing) {
    if (!existing.isPrimary) {
      await updatePropertyBankLink(propertyId, bankAccountId, {
        isPrimary: true,
      });
    }
    return;
  }

  await linkPropertyBank(propertyId, {
    bankAccountId,
    isPrimary: true,
  });
}

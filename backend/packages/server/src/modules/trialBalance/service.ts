/**
 * Trial balance service -- the public interface of this module (FR-TB-01).
 *
 * Composes accounts + the POSTED slice of journal_lines into a report via
 * @jibuks/ledger's buildTrialBalance -- no ledger math lives here, this is
 * purely fetch-and-assemble.
 */

import type { CurrencyCode } from "@jibuks/domain";
import { buildTrialBalance, type TrialBalance } from "@jibuks/ledger";
import * as repository from "./repository.js";

export async function getTrialBalance(tenantId: string, asOf?: string): Promise<TrialBalance> {
  // tenantId always comes from requireRealIdentity's already-provisioned
  // user, whose tenant was created (with a validated base_currency) at
  // onboarding time and is never deleted -- this can't come back empty.
  const currency = (await repository.getTenantCurrency(tenantId)) as CurrencyCode;

  const [accounts, entries] = await Promise.all([
    repository.listAccountRefs(tenantId),
    repository.listPostedTotals(tenantId, asOf),
  ]);

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  return buildTrialBalance(entries, accountsById, currency);
}

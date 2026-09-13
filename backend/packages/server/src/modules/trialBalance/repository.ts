/**
 * Trial balance repository -- read-only. Doesn't own any table (there is
 * no `trial_balance` table); it reads `accounts` and the POSTED slice of
 * `journal_lines`/`journals`, the same tables accounts/repository.ts
 * already reads to compute a single account's balance (AD-02 governs
 * writes, not cross-module reads for reporting).
 */

import { readAsTenant } from "@jibuks/db";
import type { LedgerEntry } from "@jibuks/ledger";

export { getTenantCurrency, listAccountRefs } from "../reports/shared.js";

/** Sums POSTED journal_lines per account, as of `asOf` if given (inclusive)
 * -- otherwise every POSTED journal ever recorded. DRAFT/PENDING_APPROVAL
 * journals never contribute (FR-ACC-02: only POSTED is a real ledger
 * effect), matching accounts/repository.ts's BALANCE_EXPR. */
export async function listPostedTotals(tenantId: string, asOf?: string): Promise<LedgerEntry[]> {
  return readAsTenant(tenantId, async (client) => {
    const params: unknown[] = [];
    let asOfClause = "";
    if (asOf) {
      params.push(asOf);
      asOfClause = ` AND j.date <= $${params.length}`;
    }

    const result = await client.query<{ account_id: string; debit_minor: string; credit_minor: string }>(
      `SELECT jl.account_id, SUM(jl.debit_minor)::text AS debit_minor, SUM(jl.credit_minor)::text AS credit_minor
       FROM journal_lines jl
       JOIN journals j ON j.id = jl.journal_id AND j.status = 'POSTED'${asOfClause}
       GROUP BY jl.account_id`,
      params,
    );

    return result.rows.map((row) => ({
      accountId: row.account_id,
      debitMinor: Number(row.debit_minor),
      creditMinor: Number(row.credit_minor),
    }));
  });
}

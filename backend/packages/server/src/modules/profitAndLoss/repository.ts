/**
 * Profit & Loss repository -- read-only, same posture as Trial Balance's:
 * no owned table, reads accounts + the POSTED slice of journal_lines.
 * Unlike Trial Balance's cumulative as_of snapshot, P&L is scoped to a
 * date range -- it answers "how much profit in this period", not "what's
 * the balance right now".
 */

import { readAsTenant } from "@jibuks/db";
import type { LedgerEntry } from "@jibuks/ledger";

export { getTenantCurrency, listAccountRefs } from "../reports/shared.js";

/** Sums POSTED journal_lines per account, restricted to journals dated
 * within [from, to] inclusive. DRAFT/PENDING_APPROVAL journals never
 * contribute (FR-ACC-02: only POSTED is a real ledger effect). */
export async function listPostedTotalsForPeriod(tenantId: string, from: string, to: string): Promise<LedgerEntry[]> {
  return readAsTenant(tenantId, async (client) => {
    const result = await client.query<{ account_id: string; debit_minor: string; credit_minor: string }>(
      `SELECT jl.account_id, SUM(jl.debit_minor)::text AS debit_minor, SUM(jl.credit_minor)::text AS credit_minor
       FROM journal_lines jl
       JOIN journals j ON j.id = jl.journal_id AND j.status = 'POSTED' AND j.date >= $1 AND j.date <= $2
       GROUP BY jl.account_id`,
      [from, to],
    );

    return result.rows.map((row) => ({
      accountId: row.account_id,
      debitMinor: Number(row.debit_minor),
      creditMinor: Number(row.credit_minor),
    }));
  });
}

/**
 * Cash flow repository -- read-only, same posture as Trial Balance's: no
 * owned table, reads accounts + the POSTED slice of journal_lines.
 *
 * Unlike Trial Balance/P&L, which discover every account with ledger
 * activity on their own, this is scoped to the specific account ids the
 * caller names as cash/cash-equivalents (see cashFlowQuerySchema).
 */

import { readAsTenant } from "@jibuks/db";
import type { AccountRef } from "@jibuks/ledger";

export async function listAccountRefsByIds(tenantId: string, accountIds: readonly string[]): Promise<AccountRef[]> {
  return readAsTenant(tenantId, async (client) => {
    const result = await client.query<AccountRef>(`SELECT id, code, name, type FROM accounts WHERE id = ANY($1)`, [
      accountIds,
    ]);
    return result.rows;
  });
}

export interface CashMovement {
  readonly accountId: string;
  readonly openingBalanceMinor: number;
  readonly inflowMinor: number;
  readonly outflowMinor: number;
}

/** For each given account, sums POSTED journal_lines into: everything
 * dated before `from` (the opening balance, debit-natured since these are
 * always ASSET-type cash/bank accounts), and the debit/credit split for
 * journals dated within [from, to] inclusive (the period's inflows and
 * outflows). One query, one pass, via conditional aggregation. */
export async function getCashMovement(
  tenantId: string,
  accountIds: readonly string[],
  from: string,
  to: string,
): Promise<CashMovement[]> {
  return readAsTenant(tenantId, async (client) => {
    const result = await client.query<{
      account_id: string;
      opening_balance_minor: string;
      inflow_minor: string;
      outflow_minor: string;
    }>(
      `SELECT jl.account_id,
              COALESCE(SUM(CASE WHEN j.date < $2 THEN jl.debit_minor - jl.credit_minor ELSE 0 END), 0)::text AS opening_balance_minor,
              COALESCE(SUM(CASE WHEN j.date BETWEEN $2 AND $3 THEN jl.debit_minor ELSE 0 END), 0)::text AS inflow_minor,
              COALESCE(SUM(CASE WHEN j.date BETWEEN $2 AND $3 THEN jl.credit_minor ELSE 0 END), 0)::text AS outflow_minor
       FROM journal_lines jl
       JOIN journals j ON j.id = jl.journal_id AND j.status = 'POSTED'
       WHERE jl.account_id = ANY($1)
       GROUP BY jl.account_id`,
      [accountIds, from, to],
    );

    return result.rows.map((row) => ({
      accountId: row.account_id,
      openingBalanceMinor: Number(row.opening_balance_minor),
      inflowMinor: Number(row.inflow_minor),
      outflowMinor: Number(row.outflow_minor),
    }));
  });
}

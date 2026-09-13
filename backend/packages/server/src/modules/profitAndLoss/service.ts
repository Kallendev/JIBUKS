/**
 * Profit & Loss service -- the public interface of this module (FR-RPT-01).
 *
 * Reuses @jibuks/ledger's buildTrialBalance to net each account's period
 * activity onto its natural side, then keeps only the INCOME/EXPENSE rows
 * -- the ASSET/LIABILITY/EQUITY rows every balanced journal also touches
 * are simply discarded, exactly as isProfitAndLoss says they should be.
 */

import type { CurrencyCode } from "@jibuks/domain";
import { isProfitAndLoss } from "@jibuks/domain";
import { buildTrialBalance } from "@jibuks/ledger";
import * as repository from "./repository.js";

export interface ProfitAndLossLine {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly amountMinor: number;
}

export interface ProfitAndLoss {
  readonly currency: CurrencyCode;
  readonly from: string;
  readonly to: string;
  readonly income: readonly ProfitAndLossLine[];
  readonly expenses: readonly ProfitAndLossLine[];
  readonly totalIncomeMinor: number;
  readonly totalExpenseMinor: number;
  readonly netProfitMinor: number;
}

export async function getProfitAndLoss(tenantId: string, from: string, to: string): Promise<ProfitAndLoss> {
  // tenantId always comes from requireRealIdentity's already-provisioned
  // user, whose tenant was created (with a validated base_currency) at
  // onboarding time and is never deleted -- this can't come back empty.
  const currency = (await repository.getTenantCurrency(tenantId)) as CurrencyCode;

  const [accounts, entries] = await Promise.all([
    repository.listAccountRefs(tenantId),
    repository.listPostedTotalsForPeriod(tenantId, from, to),
  ]);

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const { rows } = buildTrialBalance(entries, accountsById, currency);

  const income: ProfitAndLossLine[] = [];
  const expenses: ProfitAndLossLine[] = [];
  for (const row of rows) {
    if (!isProfitAndLoss(row.accountType)) continue;
    const line: ProfitAndLossLine = {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      amountMinor: row.balanceMinor,
    };
    if (row.accountType === "INCOME") {
      income.push(line);
    } else {
      expenses.push(line);
    }
  }

  const totalIncomeMinor = income.reduce((sum, line) => sum + line.amountMinor, 0);
  const totalExpenseMinor = expenses.reduce((sum, line) => sum + line.amountMinor, 0);

  return {
    currency,
    from,
    to,
    income,
    expenses,
    totalIncomeMinor,
    totalExpenseMinor,
    netProfitMinor: totalIncomeMinor - totalExpenseMinor,
  };
}

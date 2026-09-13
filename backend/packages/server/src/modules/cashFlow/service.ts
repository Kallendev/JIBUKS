/**
 * Cash flow service -- the public interface of this module (FR-RPT-01).
 *
 * The simple, direct-method version: net movement (inflows vs outflows) on
 * whichever account(s) the caller names as cash/cash-equivalents, over a
 * date range. Deliberately NOT the indirect method with
 * Operating/Investing/Financing categorization -- that needs a way to
 * classify every balance-sheet account into a cash-flow category, which
 * accounts don't carry yet (tracked as a later enhancement).
 */

import type { CurrencyCode } from "@jibuks/domain";
import { DomainError } from "@jibuks/domain";
import * as reportsShared from "../reports/shared.js";
import * as repository from "./repository.js";

export interface CashFlowLine {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly openingBalanceMinor: number;
  readonly closingBalanceMinor: number;
  readonly inflowMinor: number;
  readonly outflowMinor: number;
  readonly netMinor: number;
}

export interface CashFlow {
  readonly currency: CurrencyCode;
  readonly from: string;
  readonly to: string;
  readonly accounts: readonly CashFlowLine[];
  readonly totalOpeningBalanceMinor: number;
  readonly totalClosingBalanceMinor: number;
  readonly totalInflowMinor: number;
  readonly totalOutflowMinor: number;
  readonly netCashFlowMinor: number;
}

export async function getCashFlow(
  tenantId: string,
  accountIds: readonly string[],
  from: string,
  to: string,
): Promise<CashFlow> {
  // tenantId always comes from requireRealIdentity's already-provisioned
  // user, whose tenant was created (with a validated base_currency) at
  // onboarding time and is never deleted -- this can't come back empty.
  const currency = (await reportsShared.getTenantCurrency(tenantId)) as CurrencyCode;

  const [accountRefs, movements] = await Promise.all([
    repository.listAccountRefsByIds(tenantId, accountIds),
    repository.getCashMovement(tenantId, accountIds, from, to),
  ]);

  const accountsById = new Map(accountRefs.map((account) => [account.id, account]));
  for (const accountId of accountIds) {
    if (!accountsById.has(accountId)) {
      throw new DomainError("ACCOUNT_NOT_FOUND", `Account ${accountId} not found`);
    }
  }

  const movementByAccountId = new Map(movements.map((movement) => [movement.accountId, movement]));
  const accounts: CashFlowLine[] = accountIds.map((accountId) => {
    const account = accountsById.get(accountId)!;
    const movement = movementByAccountId.get(accountId) ?? { openingBalanceMinor: 0, inflowMinor: 0, outflowMinor: 0 };
    const netMinor = movement.inflowMinor - movement.outflowMinor;
    return {
      accountId,
      accountCode: account.code,
      accountName: account.name,
      openingBalanceMinor: movement.openingBalanceMinor,
      closingBalanceMinor: movement.openingBalanceMinor + netMinor,
      inflowMinor: movement.inflowMinor,
      outflowMinor: movement.outflowMinor,
      netMinor,
    };
  });

  const totalOpeningBalanceMinor = accounts.reduce((sum, a) => sum + a.openingBalanceMinor, 0);
  const totalInflowMinor = accounts.reduce((sum, a) => sum + a.inflowMinor, 0);
  const totalOutflowMinor = accounts.reduce((sum, a) => sum + a.outflowMinor, 0);

  return {
    currency,
    from,
    to,
    accounts,
    totalOpeningBalanceMinor,
    totalClosingBalanceMinor: totalOpeningBalanceMinor + totalInflowMinor - totalOutflowMinor,
    totalInflowMinor,
    totalOutflowMinor,
    netCashFlowMinor: totalInflowMinor - totalOutflowMinor,
  };
}

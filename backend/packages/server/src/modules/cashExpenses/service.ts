/**
 * Cash expenses service -- the guided Cash Expense endpoint.
 *
 * A cash expense is the Cash Payments Book entry of manual bookkeeping,
 * the immediate-cash mirror of Write Bill -- payment happens on the spot,
 * so no Accounts Payable/supplier subledger is involved at all:
 *   Dr Expense/Asset line(s) (net)
 *   Dr Input Tax (if any -- reclaimable, unlike a sale's tax credit)
 *     Cr Cash/Bank (gross)
 * Posts through the same journals module and @jibuks/ledger
 * validateForPosting path as everything else.
 */

import type { CurrencyCode } from "@jibuks/domain";
import type { AuditContext } from "@jibuks/db";
import type { JournalWithLines } from "../journals/repository.js";
import * as journalsService from "../journals/service.js";

export interface CashExpenseLineRequest {
  readonly expenseAccountId: string;
  readonly amountMinor: number;
  readonly narrative?: string;
}

export interface CreateCashExpenseRequest {
  readonly tenantId: string;
  readonly clientUuid: string;
  readonly branchId?: string;
  readonly paidAccountId: string;
  readonly date: string;
  readonly currency: CurrencyCode;
  readonly reference?: string;
  readonly description?: string;
  readonly lines: readonly CashExpenseLineRequest[];
  readonly taxAccountId?: string;
  readonly taxAmountMinor?: number;
}

export async function createCashExpense(
  request: CreateCashExpenseRequest,
  audit: AuditContext,
): Promise<JournalWithLines> {
  const taxAmountMinor = request.taxAmountMinor ?? 0;
  const netTotal = request.lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const grossTotal = netTotal + taxAmountMinor;
  const description = request.description ?? "Cash expense";

  return journalsService.createJournal(
    {
      tenantId: request.tenantId,
      clientUuid: request.clientUuid,
      ...(request.branchId !== undefined ? { branchId: request.branchId } : {}),
      date: request.date,
      currency: request.currency,
      description,
      ...(request.reference !== undefined ? { reference: request.reference } : {}),
      source: "CASHBOOK",
      lines: [
        ...request.lines.map((line) => ({
          accountId: line.expenseAccountId,
          debitMinor: line.amountMinor,
          creditMinor: 0,
          ...(line.narrative !== undefined ? { narrative: line.narrative } : {}),
        })),
        ...(taxAmountMinor > 0
          ? [
              {
                // Presence of taxAccountId whenever taxAmountMinor > 0 is
                // enforced by createCashExpenseSchema before this is reached.
                accountId: request.taxAccountId!,
                debitMinor: taxAmountMinor,
                creditMinor: 0,
                narrative: "Input tax",
              },
            ]
          : []),
        {
          accountId: request.paidAccountId,
          debitMinor: 0,
          creditMinor: grossTotal,
          narrative: description,
        },
      ],
    },
    audit,
  );
}

/**
 * Small helpers shared by the read-only reporting endpoints (Trial
 * Balance, Profit & Loss, Cash Flow). None of these own a table (AD-02
 * governs writes, not cross-module reads for reporting) -- they just
 * avoid copy-pasting the same two lookups into every report module's
 * repository.ts.
 */

import { readAsTenant } from "@jibuks/db";
import type { AccountRef } from "@jibuks/ledger";

/** Reads `tenants.base_currency` directly -- the same read-only pattern
 * invites/repository.ts and users/repository.ts already use to look up a
 * tenant's name. */
export async function getTenantCurrency(tenantId: string): Promise<string | null> {
  return readAsTenant(tenantId, async (client) => {
    const result = await client.query<{ base_currency: string }>(`SELECT base_currency FROM tenants WHERE id = $1`, [
      tenantId,
    ]);
    return result.rows[0]?.base_currency ?? null;
  });
}

export async function listAccountRefs(tenantId: string): Promise<AccountRef[]> {
  return readAsTenant(tenantId, async (client) => {
    const result = await client.query<AccountRef>(`SELECT id, code, name, type FROM accounts`);
    return result.rows;
  });
}

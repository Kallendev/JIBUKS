/**
 * Cash flow controllers -- HTTP layer only.
 */

import type { Request, Response } from "express";
import { cashFlowQuerySchema } from "@jibuks/domain";
import * as service from "./service.js";

export async function get(req: Request, res: Response): Promise<void> {
  const { accountId, from, to } = cashFlowQuerySchema.parse(req.query);
  const report = await service.getCashFlow(req.tenantId!, accountId, from, to);
  res.json(report);
}

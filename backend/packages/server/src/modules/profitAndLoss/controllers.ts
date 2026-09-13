/**
 * Profit & Loss controllers -- HTTP layer only.
 */

import type { Request, Response } from "express";
import { profitAndLossQuerySchema } from "@jibuks/domain";
import * as service from "./service.js";

export async function get(req: Request, res: Response): Promise<void> {
  const { from, to } = profitAndLossQuerySchema.parse(req.query);
  const report = await service.getProfitAndLoss(req.tenantId!, from, to);
  res.json(report);
}

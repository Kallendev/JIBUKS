/**
 * Trial balance controllers -- HTTP layer only.
 */

import type { Request, Response } from "express";
import { partyBalanceQuerySchema } from "@jibuks/domain";
import * as service from "./service.js";

export async function get(req: Request, res: Response): Promise<void> {
  const { as_of } = partyBalanceQuerySchema.parse(req.query);
  const trialBalance = await service.getTrialBalance(req.tenantId!, as_of);
  res.json(trialBalance);
}

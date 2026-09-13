/**
 * Profit & Loss routes (FR-RPT-01). Read-only -- there is no POST here.
 */

import { Router, type Router as RouterType } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireRealIdentity } from "../../middleware/authContext.js";
import * as controllers from "./controllers.js";

export const profitAndLossRouter: RouterType = Router();

profitAndLossRouter.use(requireRealIdentity);

profitAndLossRouter.get("/", asyncHandler(controllers.get));

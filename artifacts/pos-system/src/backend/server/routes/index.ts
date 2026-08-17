import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { getAuthUser, checkLicenseStatus } from "./auth";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import ordersRouter from "./orders";
import customersRouter from "./customers";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import reportsRouter from "./reports";
import printConfigRouter from "./print-config";
import printLogRouter from "./print-log";
import printersRouter from "./printers";
import printerSettingsRouter from "./printer-settings";
import hrRouter from "./hr";
import returnsRouter from "./returns";
import accountingRouter from "./accounting";
import expensesRouter from "./expenses";
import suppliersRouter from "./suppliers";
import purchasesRouter from "./purchases";
import inventoryRouter from "./inventory";
import shiftsRouter from "./shifts";
import branchesRouter from "./branches";
import kdsRouter from "./kds";
import recipesRouter from "./recipes";
import tablesRouter from "./tables";
import systemRouter from "./system";
import licensesRouter from "./licenses";
import auditRouter from "./audit";
import onyxRouter from "./onyx";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(licensesRouter);

// Global License Guard Middleware for all application endpoints
router.use((req, res, next) => {
  const path = req.path;
  if (
    path === "/health" ||
    path.startsWith("/auth") ||
    path.startsWith("/licenses") ||
    path.startsWith("/license")
  ) {
    return next();
  }

  const user = getAuthUser(req);
  if (user && (user.role === "developer" || user.username === "developer")) {
    return next();
  }

  const license = checkLicenseStatus();
  if (license.blocked) {
    return res.status(403).json({
      error: "license_blocked",
      message: `${license.reason} توقف النظام بالكامل عن العمل. يرجى التواصل مع مسؤول النظام من شركة إتقان سوفت على الرقم: 777146387`
    });
  }

  next();
});

router.use(categoriesRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(customersRouter);
router.use(usersRouter);
router.use(dashboardRouter);
router.use(settingsRouter);
router.use(reportsRouter);
router.use(printConfigRouter);
router.use(printLogRouter);
router.use(printersRouter);
router.use(printerSettingsRouter);
router.use(hrRouter);
router.use(returnsRouter);
router.use(accountingRouter);
router.use(expensesRouter);
router.use(suppliersRouter);
router.use(purchasesRouter);
router.use(inventoryRouter);
router.use(shiftsRouter);
router.use(branchesRouter);
router.use(kdsRouter);
router.use(recipesRouter);
router.use(tablesRouter);
router.use(systemRouter);
router.use(auditRouter);
router.use(onyxRouter);

export default router;

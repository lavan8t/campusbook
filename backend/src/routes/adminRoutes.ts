import { Router } from "express";
import {
  getPendingApprovals,
  inspectClashes,
  approveBooking,
  rejectBooking,
  getUtilizationReport,
  scheduleMaintenance,
  listMaintenance,
  createVenue,
  setVenueAvailability,
} from "../controllers/adminController";

const router = Router();

router.get("/pending", getPendingApprovals);
router.get("/clashes/:id", inspectClashes);
router.post("/approve/:id", approveBooking);
router.post("/reject/:id", rejectBooking);
router.get("/reports/utilization", getUtilizationReport);
router.get("/maintenance", listMaintenance);
router.post("/maintenance", scheduleMaintenance);
router.post("/venues", createVenue);
router.patch("/venues/:id/availability", setVenueAvailability);

export default router;

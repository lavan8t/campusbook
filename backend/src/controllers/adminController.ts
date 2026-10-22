import type { Request, Response, NextFunction } from "express";
import { query } from "../config/db";

// GET /api/admin/pending (Prioritized Approval Queue)
export async function getPendingApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(`
      SELECT 
        b.booking_id,
        b.booking_ref,
        v.venue_id,
        v.venue_name,
        v.venue_type,
        v.seating_capacity,
        u.user_id,
        u.full_name AS requester_name,
        u.email AS requester_email,
        u.department,
        r.role_code AS requester_role,
        c.club_name,
        e.event_id,
        e.event_title,
        e.event_type,
        e.expected_attendees,
        b.start_datetime,
        b.end_datetime,
        b.purpose_notes,
        b.created_at AS requested_at,
        (
          SELECT COUNT(*)
          FROM bookings comp
          WHERE comp.venue_id = b.venue_id
            AND comp.booking_id <> b.booking_id
            AND comp.booking_status = 'PENDING'
            AND tstzrange(comp.start_datetime, comp.end_datetime, '[)') && 
                tstzrange(b.start_datetime, b.end_datetime, '[)')
        ) AS competing_pending_count,
        (
          SELECT COUNT(*)
          FROM bookings conf
          WHERE conf.venue_id = b.venue_id
            AND conf.booking_status = 'CONFIRMED'
            AND tstzrange(conf.start_datetime, conf.end_datetime, '[)') && 
                tstzrange(b.start_datetime, b.end_datetime, '[)')
        ) AS confirmed_conflicts_count
      FROM bookings b
      JOIN venues v ON b.venue_id = v.venue_id
      JOIN users u ON b.user_id = u.user_id
      JOIN roles r ON u.role_id = r.role_id
      JOIN events e ON b.event_id = e.event_id
      LEFT JOIN clubs c ON e.club_id = c.club_id
      WHERE b.booking_status = 'PENDING'
      ORDER BY b.start_datetime ASC, b.created_at ASC
    `);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/clashes/:id (Inspect All Competing Slots for a Booking)
export async function inspectClashes(req: Request, res: Response, next: NextFunction) {
  try {
    const targetBookingId = Number(req.params.id);

    const targetResult = await query(
      `SELECT venue_id, start_datetime, end_datetime, booking_status FROM bookings WHERE booking_id = $1`,
      [targetBookingId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Target booking not found." });
    }

    const target = targetResult.rows[0];

    const clashesResult = await query(
      `SELECT 
        b.booking_id,
        b.booking_ref,
        b.booking_status,
        u.full_name AS requester_name,
        r.role_code AS requester_role,
        e.event_title,
        e.expected_attendees,
        b.start_datetime,
        b.end_datetime,
        ROUND(EXTRACT(EPOCH FROM (
          LEAST(b.end_datetime, $3::timestamptz) - 
          GREATEST(b.start_datetime, $2::timestamptz)
        )) / 3600.0, 2) AS overlap_hours
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN roles r ON u.role_id = r.role_id
       JOIN events e ON b.event_id = e.event_id
       WHERE b.venue_id = $1
         AND b.booking_id <> $4
         AND b.booking_status IN ('PENDING', 'CONFIRMED')
         AND tstzrange(b.start_datetime, b.end_datetime, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       ORDER BY b.booking_status DESC, b.created_at ASC`,
      [target.venue_id, target.start_datetime, target.end_datetime, targetBookingId]
    );

    res.json({
      success: true,
      target_booking_id: targetBookingId,
      conflicts_count: clashesResult.rows.length,
      competing_requests: clashesResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/approve/:id (Atomic Approval via Stored Procedure)
export async function approveBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = Number(req.params.id);
    const { admin_id, remarks } = req.body;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "admin_id is required." });
    }

    // Call stored procedure sp_approve_booking
    await query(
      `CALL sp_approve_booking($1, $2, $3)`,
      [bookingId, admin_id, remarks || "Approved by Estate & Facilities Admin."]
    );

    // Fetch the updated booking record and approval details
    const updatedResult = await query(
      `SELECT 
        b.*, 
        ba.decision, 
        ba.remarks AS admin_remarks,
        ba.decision_datetime
       FROM bookings b
       JOIN booking_approvals ba ON b.booking_id = ba.booking_id
       WHERE b.booking_id = $1`,
      [bookingId]
    );

    // Also fetch any competing requests that were cascade-rejected
    const rejectedResult = await query(
      `SELECT booking_id, booking_ref, purpose_notes
       FROM bookings
       WHERE venue_id = $1
         AND booking_status = 'REJECTED'
         AND updated_at >= NOW() - INTERVAL '5 seconds'`,
      [updatedResult.rows[0].venue_id]
    );

    res.json({
      success: true,
      message: "Booking approved and permit granted successfully. Conflicting pending slots were automatically rejected.",
      data: updatedResult.rows[0],
      cascade_rejected_count: rejectedResult.rows.length,
      cascade_rejected_bookings: rejectedResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/reject/:id (Atomic Rejection)
export async function rejectBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = Number(req.params.id);
    const { admin_id, remarks } = req.body;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "admin_id is required." });
    }

    if (!(await isAdmin(admin_id))) {
      return res.status(403).json({
        success: false,
        error: "Authorization Error: Only an active ADMIN can reject bookings.",
      });
    }

    const current = await query(
      `SELECT booking_status FROM bookings WHERE booking_id = $1`,
      [bookingId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Booking not found." });
    }
    if (current.rows[0].booking_status !== "PENDING") {
      return res.status(409).json({
        success: false,
        error: `Invalid State Transition: Booking is ${current.rows[0].booking_status}, only PENDING bookings can be rejected.`,
      });
    }

    await query(
      `UPDATE bookings
       SET booking_status = 'REJECTED',
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId]
    );

    await query(
      `INSERT INTO booking_approvals (booking_id, admin_id, decision, remarks)
       VALUES ($1, $2, 'REJECTED', $3)`,
      [bookingId, admin_id, remarks || "Rejected by Administrator."]
    );

    res.json({
      success: true,
      message: "Booking rejected.",
      booking_id: bookingId,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/reports/utilization (Monthly Venue Utilization Analytics)
export async function getUtilizationReport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(`
      WITH venue_hours AS (
        SELECT 
          v.venue_id,
          v.venue_name,
          v.venue_type,
          v.seating_capacity,
          COALESCE(SUM(
            EXTRACT(EPOCH FROM (b.end_datetime - b.start_datetime)) / 3600.0
          ), 0) AS total_hours_booked,
          COUNT(b.booking_id) AS total_events_hosted
        FROM venues v
        LEFT JOIN bookings b ON v.venue_id = b.venue_id 
          AND b.booking_status = 'CONFIRMED'
          AND b.start_datetime >= DATE_TRUNC('month', CURRENT_DATE)
          AND b.start_datetime < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY v.venue_id, v.venue_name, v.venue_type, v.seating_capacity
      )
      SELECT 
        venue_id,
        venue_name,
        venue_type,
        seating_capacity,
        total_events_hosted,
        ROUND(total_hours_booked::NUMERIC, 2) AS hours_booked,
        ROUND((total_hours_booked / 360.0 * 100)::NUMERIC, 2) AS utilization_percentage
      FROM venue_hours
      ORDER BY utilization_percentage DESC;
    `);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// Shared Admin Guard: only ACTIVE users with the ADMIN role may use admin write endpoints
async function isAdmin(adminId: number): Promise<boolean> {
  const res = await query(
    `SELECT 1
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = $1 AND r.role_code = 'ADMIN' AND u.is_active = TRUE`,
    [adminId]
  );
  return res.rows.length > 0;
}

const VENUE_TYPES = ["AUDITORIUM", "MINI_AUDITORIUM", "LECTURE_HALL", "SEMINAR_HALL"];

// POST /api/admin/venues (Register a New Venue)
export async function createVenue(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      venue_name,
      venue_type,
      building,
      floor_number = 1,
      seating_capacity,
      has_air_conditioning = true,
      projector_count = 1,
      has_sound_system = true,
      has_smart_podium = false,
      required_auth_codes,
      admin_id,
    } = req.body;

    if (!venue_name || !venue_type || !building || !seating_capacity || !admin_id) {
      return res.status(400).json({
        success: false,
        error: "Missing fields: venue_name, venue_type, building, seating_capacity, admin_id",
      });
    }

    if (!VENUE_TYPES.includes(venue_type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid venue_type. Allowed: ${VENUE_TYPES.join(", ")}`,
      });
    }

    if (!(await isAdmin(admin_id))) {
      return res.status(403).json({
        success: false,
        error: "Authorization Error: Only an active ADMIN can register venues.",
      });
    }

    const result = await query(
      `INSERT INTO venues (
         venue_name, venue_type, building, floor_number, seating_capacity,
         has_air_conditioning, projector_count, has_sound_system, has_smart_podium
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        venue_name,
        venue_type,
        building,
        Number(floor_number) || 1,
        Number(seating_capacity),
        Boolean(has_air_conditioning),
        Number(projector_count) || 1,
        Boolean(has_sound_system),
        Boolean(has_smart_podium),
      ]
    );

    const venue = result.rows[0];

    const codes: string[] = Array.isArray(required_auth_codes)
      ? required_auth_codes.filter((c: unknown) => typeof c === "string" && c.length > 0)
      : [];
    if (codes.length > 0) {
      await query(
        `INSERT INTO venue_requirements (venue_id, auth_id)
         SELECT $1, auth_id FROM authorizations WHERE auth_code = ANY($2::varchar[])
         ON CONFLICT DO NOTHING`,
        [venue.venue_id, codes]
      );
    }

    res.status(201).json({
      success: true,
      message: "Venue registered successfully.",
      data: venue,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/venues/:id/availability (Enable / Disable Booking Availability)
export async function setVenueAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const venueId = Number(req.params.id);
    const { venue_status, admin_id } = req.body;

    if (!venue_status || !admin_id) {
      return res.status(400).json({
        success: false,
        error: "Missing fields: venue_status, admin_id",
      });
    }

    if (!["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"].includes(venue_status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid venue_status. Allowed: ACTIVE, MAINTENANCE, DECOMMISSIONED",
      });
    }

    if (!(await isAdmin(admin_id))) {
      return res.status(403).json({
        success: false,
        error: "Authorization Error: Only an active ADMIN can change venue availability.",
      });
    }

    const result = await query(
      `UPDATE venues SET venue_status = $2 WHERE venue_id = $1 RETURNING *`,
      [venueId, venue_status]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Venue not found." });
    }

    res.json({
      success: true,
      message: `Venue availability set to ${venue_status}.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/maintenance (List Upcoming Slot Blackouts)
export async function listMaintenance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT m.maintenance_id, m.venue_id, v.venue_name, v.building,
              m.start_datetime, m.end_datetime, m.reason, m.created_at
       FROM venue_maintenance m
       JOIN venues v ON m.venue_id = v.venue_id
       WHERE m.end_datetime >= NOW()
       ORDER BY m.start_datetime ASC`
    );

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/maintenance (Schedule Maintenance Window)
export async function scheduleMaintenance(req: Request, res: Response, next: NextFunction) {
  try {
    const { venue_id, start_datetime, end_datetime, reason, admin_id } = req.body;

    if (!venue_id || !start_datetime || !end_datetime || !reason || !admin_id) {
      return res.status(400).json({
        success: false,
        error: "Missing fields: venue_id, start_datetime, end_datetime, reason, admin_id",
      });
    }

    if (!(await isAdmin(admin_id))) {
      return res.status(403).json({
        success: false,
        error: "Authorization Error: Only an active ADMIN can schedule maintenance.",
      });
    }

    const start = new Date(start_datetime);
    const end = new Date(end_datetime);
    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: "End datetime must be strictly after start datetime.",
      });
    }

    const result = await query(
      `INSERT INTO venue_maintenance (venue_id, start_datetime, end_datetime, reason, scheduled_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [venue_id, start, end, reason, admin_id]
    );

    res.status(201).json({
      success: true,
      message: "Maintenance blackout scheduled successfully.",
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

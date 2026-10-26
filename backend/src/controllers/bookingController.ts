import type { Request, Response, NextFunction } from "express";
import { query } from "../config/db";

// POST /api/bookings (Submit new booking request by Normal User)
export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      user_id,
      venue_id,
      start_datetime,
      end_datetime,
      event_title,
      event_type,
      description,
      expected_attendees,
      club_id,
      purpose_notes,
    } = req.body;

    // 1. Validation
    if (!user_id || !venue_id || !start_datetime || !end_datetime || !event_title || !event_type) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: user_id, venue_id, start_datetime, end_datetime, event_title, event_type",
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

    // 2. Venue Availability Check (disabled venue or maintenance blackout)
    const venueAvail = await query(
      `SELECT venue_status FROM venues WHERE venue_id = $1`,
      [venue_id]
    );
    if (venueAvail.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Venue not found.",
      });
    }
    const venueStatus = venueAvail.rows[0].venue_status;
    if (venueStatus !== "ACTIVE") {
      return res.status(409).json({
        success: false,
        error: `Slot Unavailable: Venue is ${venueStatus}. No bookings permitted.`,
        code: "VENUE_UNAVAILABLE",
      });
    }

    const maintenanceOverlap = await query(
      `SELECT 1 FROM venue_maintenance
       WHERE venue_id = $1
         AND tstzrange(start_datetime, end_datetime, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       LIMIT 1`,
      [venue_id, start, end]
    );
    if (maintenanceOverlap.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Slot Unavailable: Venue is under scheduled maintenance during this interval.",
        code: "SLOT_MAINTENANCE",
      });
    }

    // 3. Relational Division: Verify User Authorizations against Venue Requirements
    const missingAuthResult = await query(
      `SELECT a.auth_id, a.auth_name, a.auth_code
       FROM venue_requirements vr
       JOIN authorizations a ON vr.auth_id = a.auth_id
       WHERE vr.venue_id = $1
       EXCEPT
       SELECT a.auth_id, a.auth_name, a.auth_code
       FROM user_authorizations ua
       JOIN authorizations a ON ua.auth_id = a.auth_id
       WHERE ua.user_id = $2
         AND ua.verification_status = 'VERIFIED'
         AND ua.expiry_date >= CURRENT_DATE`,
      [venue_id, user_id]
    );

    if (missingAuthResult.rows.length > 0) {
      return res.status(403).json({
        success: false,
        error: "Authorization Denied: You do not possess all required prerequisites to book this restricted venue.",
        code: "MISSING_PREREQUISITES",
        missing_authorizations: missingAuthResult.rows,
      });
    }

    // 3. Temporal Exclusion Check: Verify if slot overlaps with an already ACCEPTED (CONFIRMED) booking
    const confirmedConflictResult = await query(
      `SELECT 
        b.booking_id,
        b.booking_ref,
        b.start_datetime,
        b.end_datetime,
        e.event_title,
        e.event_type,
        u.full_name AS requester_name,
        v.venue_name
       FROM bookings b
       JOIN events e ON b.event_id = e.event_id
       JOIN users u ON b.user_id = u.user_id
       JOIN venues v ON b.venue_id = v.venue_id
       WHERE b.venue_id = $1
         AND b.booking_status = 'CONFIRMED'
         AND tstzrange(b.start_datetime, b.end_datetime, '[)') && tstzrange($2, $3, '[)')
       LIMIT 1`,
      [venue_id, start, end]
    );

    if (confirmedConflictResult.rows.length > 0) {
      const conflict = confirmedConflictResult.rows[0];
      return res.status(409).json({
        success: false,
        code: "SLOT_ALREADY_BOOKED",
        error: `This slot has already been booked and accepted for '${conflict.event_title}' at ${conflict.venue_name}.`,
        conflict: {
          booking_id: conflict.booking_id,
          booking_ref: conflict.booking_ref,
          event_title: conflict.event_title,
          event_type: conflict.event_type,
          requester_name: conflict.requester_name,
          venue_name: conflict.venue_name,
          start_datetime: conflict.start_datetime,
          end_datetime: conflict.end_datetime,
        },
      });
    }

    // 4. Create Event record
    const eventResult = await query(
      `INSERT INTO events (event_title, event_type, description, expected_attendees, organizer_user_id, club_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING event_id`,
      [
        event_title,
        event_type,
        description || null,
        Number(expected_attendees) || 50,
        user_id,
        club_id || null,
      ]
    );
    const eventId = eventResult.rows[0].event_id;

    // 4. Generate unique Booking Reference
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `BK-2026-${randomSuffix}`;

    // 5. Insert Booking record (Status = PENDING)
    const bookingResult = await query(
      `INSERT INTO bookings (
        booking_ref,
        venue_id,
        user_id,
        event_id,
        start_datetime,
        end_datetime,
        booking_status,
        purpose_notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
       RETURNING *`,
      [
        bookingRef,
        venue_id,
        user_id,
        eventId,
        start,
        end,
        purpose_notes || null,
      ]
    );

    // 6. Check if there are any competing requests for user visibility
    const competingResult = await query(
      `SELECT COUNT(*) AS competing_count
       FROM bookings
       WHERE venue_id = $1
         AND booking_id <> $2
         AND booking_status = 'PENDING'
         AND tstzrange(start_datetime, end_datetime, '[)') && tstzrange($3, $4, '[)')`,
      [venue_id, bookingResult.rows[0].booking_id, start, end]
    );

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully and queued for Administrative approval.",
      data: {
        ...bookingResult.rows[0],
        competing_pending_requests: Number(competingResult.rows[0].competing_count),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/my?user_id=X
export async function getMyBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.query.user_id);
    if (!userId) {
      return res.status(400).json({ success: false, error: "user_id query parameter is required." });
    }

    const result = await query(
      `SELECT 
        b.booking_id,
        b.booking_ref,
        b.venue_id,
        v.venue_name,
        v.venue_type,
        v.building,
        b.start_datetime,
        b.end_datetime,
        b.booking_status,
        b.purpose_notes,
        b.created_at,
        e.event_title,
        e.event_type,
        e.expected_attendees,
        c.club_name,
        ba.decision AS approval_decision,
        ba.remarks AS admin_remarks,
        ba.decision_datetime
       FROM bookings b
       JOIN venues v ON b.venue_id = v.venue_id
       JOIN events e ON b.event_id = e.event_id
       LEFT JOIN clubs c ON e.club_id = c.club_id
       LEFT JOIN booking_approvals ba ON b.booking_id = ba.booking_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id (Cancel own booking)
export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = Number(req.params.id);
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id is required in body to cancel booking." });
    }

    const checkResult = await query(
      `SELECT booking_id, user_id, booking_status, start_datetime
       FROM bookings
       WHERE booking_id = $1`,
      [bookingId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Booking not found." });
    }

    const booking = checkResult.rows[0];

    if (Number(booking.user_id) !== Number(user_id)) {
      return res.status(403).json({ success: false, error: "You can only cancel your own bookings." });
    }

    if (booking.booking_status === "CANCELLED") {
      return res.status(400).json({ success: false, error: "Booking is already cancelled." });
    }

    if (new Date() > new Date(booking.start_datetime)) {
      return res.status(400).json({ success: false, error: "Cannot cancel a booking that has already started." });
    }

    const updated = await query(
      `UPDATE bookings
       SET booking_status = 'CANCELLED',
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1
       RETURNING *`,
      [bookingId]
    );

    res.json({
      success: true,
      message: "Booking cancelled successfully.",
      data: updated.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/timetable?date=YYYY-MM-DD
export async function getTimetableBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];

    const result = await query(
      `SELECT 
        b.booking_id,
        b.booking_ref,
        b.venue_id,
        v.venue_name,
        v.venue_type,
        v.building,
        v.seating_capacity,
        b.user_id,
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
        b.booking_status,
        b.purpose_notes,
        ba.decision AS approval_decision,
        ba.remarks AS admin_remarks
      FROM bookings b
      JOIN venues v ON b.venue_id = v.venue_id
      JOIN users u ON b.user_id = u.user_id
      JOIN roles r ON u.role_id = r.role_id
      JOIN events e ON b.event_id = e.event_id
      LEFT JOIN clubs c ON e.club_id = c.club_id
      LEFT JOIN booking_approvals ba ON b.booking_id = ba.booking_id
      WHERE DATE(b.start_datetime AT TIME ZONE 'Asia/Kolkata') = $1
        AND b.booking_status IN ('CONFIRMED', 'PENDING')
      ORDER BY b.start_datetime ASC`,
      [dateStr]
    );

    res.json({
      success: true,
      count: result.rows.length,
      date: dateStr,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

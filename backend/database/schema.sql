-- ============================================================================
-- CAMPUSBOOK: CAMPUS AUDITORIUM & LECTURE HALL BOOKING SYSTEM
-- PostgreSQL Database Initialization & Seed Script
-- Compatible with PostgreSQL 15, 16, 17+
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Drop existing tables if re-running (in reverse dependency order)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS venue_maintenance CASCADE;
DROP TABLE IF EXISTS booking_approvals CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS venue_requirements CASCADE;
DROP TABLE IF EXISTS user_authorizations CASCADE;
DROP TABLE IF EXISTS authorizations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS clubs CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Drop existing enum types
DROP TYPE IF EXISTS event_type_enum CASCADE;
DROP TYPE IF EXISTS approval_decision_enum CASCADE;
DROP TYPE IF EXISTS booking_status_enum CASCADE;
DROP TYPE IF EXISTS venue_status_enum CASCADE;
DROP TYPE IF EXISTS venue_type_enum CASCADE;
DROP TYPE IF EXISTS user_role_enum CASCADE;

-- 2. ENUM TYPES
CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'FACULTY', 'CLUB_HEAD');
CREATE TYPE venue_type_enum AS ENUM ('AUDITORIUM', 'MINI_AUDITORIUM', 'LECTURE_HALL', 'SEMINAR_HALL');
CREATE TYPE venue_status_enum AS ENUM ('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');
CREATE TYPE booking_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');
CREATE TYPE approval_decision_enum AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE event_type_enum AS ENUM (
    'ACADEMIC_LECTURE',
    'GUEST_LECTURE',
    'SEMINAR',
    'CONFERENCE',
    'WORKSHOP',
    'HACKATHON',
    'CULTURAL_EVENT',
    'EXAMINATION'
);

-- 3. TABLES

-- Roles
CREATE TABLE roles (
    role_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_code user_role_enum NOT NULL UNIQUE,
    role_name VARCHAR(50) NOT NULL,
    description TEXT
);

-- Users
CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    role_id INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Venues (Auditoriums and Lecture Halls)
CREATE TABLE venues (
    venue_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_name VARCHAR(120) NOT NULL UNIQUE,
    venue_type venue_type_enum NOT NULL,
    building VARCHAR(100) NOT NULL,
    floor_number INT NOT NULL DEFAULT 1,
    seating_capacity INT NOT NULL CHECK (seating_capacity > 0),
    has_air_conditioning BOOLEAN NOT NULL DEFAULT TRUE,
    projector_count INT NOT NULL DEFAULT 1 CHECK (projector_count >= 0),
    has_sound_system BOOLEAN NOT NULL DEFAULT TRUE,
    has_smart_podium BOOLEAN NOT NULL DEFAULT FALSE,
    venue_status venue_status_enum NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Student Clubs
CREATE TABLE clubs (
    club_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    club_name VARCHAR(120) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    club_head_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    faculty_coordinator_name VARCHAR(150) NOT NULL,
    faculty_coordinator_email VARCHAR(150) NOT NULL,
    is_recognized BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Events
CREATE TABLE events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_title VARCHAR(200) NOT NULL,
    event_type event_type_enum NOT NULL,
    description TEXT,
    expected_attendees INT NOT NULL CHECK (expected_attendees > 0),
    organizer_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    club_id BIGINT REFERENCES clubs(club_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Authorizations Master
CREATE TABLE authorizations (
    auth_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auth_code VARCHAR(50) NOT NULL UNIQUE,
    auth_name VARCHAR(150) NOT NULL,
    description TEXT,
    issuing_authority VARCHAR(150) NOT NULL
);

-- User Authorizations Mapping
CREATE TABLE user_authorizations (
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    auth_id INT NOT NULL REFERENCES authorizations(auth_id) ON DELETE CASCADE,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('VERIFIED', 'REVOKED', 'EXPIRED')),
    verified_by_user_id BIGINT REFERENCES users(user_id),
    PRIMARY KEY (user_id, auth_id),
    CHECK (expiry_date >= issue_date)
);

-- Venue Requirements (Prerequisites for booking high-demand venues)
CREATE TABLE venue_requirements (
    venue_id BIGINT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    auth_id INT NOT NULL REFERENCES authorizations(auth_id) ON DELETE RESTRICT,
    PRIMARY KEY (venue_id, auth_id)
);

-- Bookings with GiST Temporal Range Exclusion Constraint
CREATE TABLE bookings (
    booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_ref VARCHAR(20) NOT NULL UNIQUE,
    venue_id BIGINT NOT NULL REFERENCES venues(venue_id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    booking_status booking_status_enum NOT NULL DEFAULT 'PENDING',
    purpose_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_booking_time_order CHECK (end_datetime > start_datetime),
    CONSTRAINT chk_booking_max_duration CHECK (end_datetime - start_datetime <= INTERVAL '14 hours'),

    -- GiST Temporal Range Exclusion Constraint:
    -- Guarantees at the database level that no two CONFIRMED bookings on the same venue can overlap
    CONSTRAINT no_overlapping_confirmed_bookings
    EXCLUDE USING gist (
        venue_id WITH =,
        tstzrange(start_datetime, end_datetime, '[)') WITH &&
    )
    WHERE (booking_status = 'CONFIRMED')
);

-- Booking Approvals (Administrative Permits)
CREATE TABLE booking_approvals (
    approval_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
    admin_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    decision approval_decision_enum NOT NULL,
    decision_datetime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT NOT NULL
);

-- Venue Maintenance Blackout Periods
CREATE TABLE venue_maintenance (
    maintenance_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id BIGINT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    scheduled_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_maint_time_order CHECK (end_datetime > start_datetime),
    CONSTRAINT no_overlapping_maintenance_confirmed_bookings
    EXCLUDE USING gist (
        venue_id WITH =,
        tstzrange(start_datetime, end_datetime, '[)') WITH &&
    )
);

-- Audit Logs
CREATE TABLE audit_logs (
    log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(10) NOT NULL,
    record_id BIGINT NOT NULL,
    actor_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    old_data JSONB,
    new_data JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. STORED PROCEDURES FOR CONCURRENCY-SAFE OPERATIONS

CREATE OR REPLACE PROCEDURE sp_approve_booking(
    p_booking_id BIGINT,
    p_admin_id BIGINT,
    p_remarks TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_venue_id BIGINT;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_current_status booking_status_enum;
    v_admin_role user_role_enum;
    v_conflict_count INT;
    v_competing_id BIGINT;
BEGIN
    -- Verify administrator credentials
    SELECT r.role_code INTO v_admin_role
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE u.user_id = p_admin_id AND u.is_active = TRUE;

    IF v_admin_role IS NULL OR v_admin_role <> 'ADMIN' THEN
        RAISE EXCEPTION 'Authorization Error: User ID % does not have ADMIN privileges.', p_admin_id;
    END IF;

    -- Lock the target booking row
    SELECT venue_id, start_datetime, end_datetime, booking_status
    INTO v_venue_id, v_start, v_end, v_current_status
    FROM bookings
    WHERE booking_id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking ID % not found.', p_booking_id;
    END IF;

    IF v_current_status <> 'PENDING' THEN
        RAISE EXCEPTION 'Invalid State Transition: Booking % is currently %, cannot be approved.', p_booking_id, v_current_status;
    END IF;

    -- Pessimistic Lock on Venue row to serialize concurrent approvals
    PERFORM venue_id 
    FROM venues 
    WHERE venue_id = v_venue_id 
    FOR UPDATE;

    -- Check for conflicting confirmed bookings
    SELECT COUNT(*) INTO v_conflict_count
    FROM bookings
    WHERE venue_id = v_venue_id
      AND booking_status = 'CONFIRMED'
      AND tstzrange(start_datetime, end_datetime, '[)') && tstzrange(v_start, v_end, '[)');

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Slot Conflict: An overlapping booking is already CONFIRMED for venue % during interval [%, %).',
            v_venue_id, v_start, v_end;
    END IF;

    -- Check for conflicting maintenance
    SELECT COUNT(*) INTO v_conflict_count
    FROM venue_maintenance
    WHERE venue_id = v_venue_id
      AND tstzrange(start_datetime, end_datetime, '[)') && tstzrange(v_start, v_end, '[)');

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Slot Conflict: Venue % is under scheduled MAINTENANCE during interval [%, %).',
            v_venue_id, v_start, v_end;
    END IF;

    -- Confirm the booking
    UPDATE bookings
    SET booking_status = 'CONFIRMED',
        updated_at = CURRENT_TIMESTAMP
    WHERE booking_id = p_booking_id;

    -- Record the approval
    INSERT INTO booking_approvals (booking_id, admin_id, decision, remarks)
    VALUES (p_booking_id, p_admin_id, 'APPROVED', p_remarks);

    -- Automatically reject competing pending requests for this overlapping slot
    FOR v_competing_id IN
        SELECT booking_id
        FROM bookings
        WHERE venue_id = v_venue_id
          AND booking_id <> p_booking_id
          AND booking_status = 'PENDING'
          AND tstzrange(start_datetime, end_datetime, '[)') && tstzrange(v_start, v_end, '[)')
        FOR UPDATE
    LOOP
        UPDATE bookings
        SET booking_status = 'REJECTED',
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = v_competing_id;

        INSERT INTO booking_approvals (booking_id, admin_id, decision, remarks)
        VALUES (
            v_competing_id,
            p_admin_id,
            'REJECTED',
            FORMAT('Automatically rejected due to slot clash with confirmed booking #%s.', p_booking_id)
        );
    END LOOP;
END;
$$;

-- 5. SEED DATA FOR TESTING

INSERT INTO roles (role_code, role_name, description) VALUES
('ADMIN', 'Estate & Facilities Admin', 'Administrative authority overseeing all campus venues and issuing permits'),
('FACULTY', 'Faculty Member', 'Academic staff reserving halls for lectures and symposia'),
('CLUB_HEAD', 'Student Club Head', 'Authorized representative of recognized student organizations');

-- Users
INSERT INTO users (full_name, email, phone, role_id, department, designation) VALUES
('Dr. A. Ramanathan', 'ramanathan@vit.ac.in', '+91-9876543210', 1, 'Estate Office', 'Chief Facilities Officer'),
('Prof. K. Venkatesh', 'kvenkatesh@vit.ac.in', '+91-9876543211', 2, 'Computer Science', 'Professor'),
('Dr. Meera Nambiar', 'meera.nambiar@vit.ac.in', '+91-9876543212', 2, 'Biotechnology', 'Associate Professor'),
('Aditya Sharma', 'aditya.sharma2024@vitstudent.ac.in', '+91-9876543213', 3, 'Computer Science', 'President, ACM Student Chapter'),
('Pooja Sundaram', 'pooja.s2024@vitstudent.ac.in', '+91-9876543214', 3, 'Mechanical Engg', 'Convenor, Dramatics Club');

-- Venues
INSERT INTO venues (venue_name, venue_type, building, floor_number, seating_capacity, has_air_conditioning, projector_count, has_sound_system, has_smart_podium) VALUES
('Anna Auditorium', 'AUDITORIUM', 'Main Administrative Block', 1, 1500, TRUE, 4, TRUE, TRUE),
('Kamaraj Mini Auditorium', 'MINI_AUDITORIUM', 'Technology Tower', 2, 450, TRUE, 2, TRUE, TRUE),
('Smart Lecture Hall TT-101', 'LECTURE_HALL', 'Technology Tower', 1, 120, TRUE, 1, TRUE, TRUE),
('Smart Lecture Hall SJT-204', 'LECTURE_HALL', 'Silver Jubilee Tower', 2, 180, TRUE, 2, TRUE, TRUE),
('Mahatma Gandhi Seminar Hall', 'SEMINAR_HALL', 'Library Complex', 3, 200, TRUE, 1, TRUE, FALSE);

-- Student Clubs
INSERT INTO clubs (club_name, category, club_head_user_id, faculty_coordinator_name, faculty_coordinator_email) VALUES
('ACM Student Chapter', 'Technical', 4, 'Prof. K. Venkatesh', 'kvenkatesh@vit.ac.in'),
('Dramatics & Cultural Club', 'Cultural', 5, 'Dr. Meera Nambiar', 'meera.nambiar@vit.ac.in');

-- Authorizations
INSERT INTO authorizations (auth_code, auth_name, description, issuing_authority) VALUES
('DEAN_PERMIT', 'Dean of Student Affairs Clearance', 'Mandatory permit for mega-events in main auditoriums', 'Office of Dean Student Affairs'),
('HOD_ACAD_CLEARANCE', 'HoD Academic Clearance', 'Clearance for multi-class joint lectures and departmental symposia', 'Department Head'),
('AV_TECH_CERT', 'Acoustic & AV Console Certification', 'Authorization to operate high-end auditorium audio consoles', 'Campus AV Center');

-- Venue Requirements (Anna Auditorium requires Dean Permit & AV Tech Certification)
INSERT INTO venue_requirements (venue_id, auth_id) VALUES
(1, 1), -- Anna Auditorium requires DEAN_PERMIT
(1, 3); -- Anna Auditorium requires AV_TECH_CERT

-- User Authorizations
INSERT INTO user_authorizations (user_id, auth_id, issue_date, expiry_date, verification_status) VALUES
(4, 1, '2026-08-01', '2027-05-31', 'VERIFIED'), -- Aditya Sharma has DEAN_PERMIT
(4, 3, '2026-08-01', '2027-05-31', 'VERIFIED'), -- Aditya Sharma has AV_TECH_CERT
(5, 1, '2026-08-01', '2027-05-31', 'VERIFIED'); -- Pooja has DEAN_PERMIT only (Missing AV_TECH_CERT for Audi 1)

-- Events
INSERT INTO events (event_title, event_type, description, expected_attendees, organizer_user_id, club_id) VALUES
('International Hackathon 2026', 'HACKATHON', '48-hour inter-collegiate coding hackathon', 800, 4, 1),
('Combined OS Section Lecture', 'ACADEMIC_LECTURE', 'Operating Systems joint revision lecture for Section D1 & D2', 150, 2, NULL),
('Annual Cultural Fest Auditions', 'CULTURAL_EVENT', 'Stage auditions for annual inter-college drama competition', 350, 5, 2);

-- Initial Bookings
INSERT INTO bookings (booking_ref, venue_id, user_id, event_id, start_datetime, end_datetime, booking_status, purpose_notes) VALUES
('BK-2026-001', 2, 2, 2, '2026-10-15 09:00:00+05:30', '2026-10-15 12:00:00+05:30', 'CONFIRMED', 'Approved by Estate Admin for OS Joint Lecture'),
('BK-2026-002', 1, 4, 1, '2026-10-20 10:00:00+05:30', '2026-10-20 18:00:00+05:30', 'PENDING', 'ACM Hackathon Inauguration and Track-1'),
('BK-2026-003', 1, 5, 3, '2026-10-20 14:00:00+05:30', '2026-10-20 17:00:00+05:30', 'PENDING', 'Dramatics Stage Auditions (Competing with ACM Hackathon!)');

-- Insert Approval Record for Confirmed Booking
INSERT INTO booking_approvals (booking_id, admin_id, decision, remarks) VALUES
(1, 1, 'APPROVED', 'Lecture verified against faculty timetable and approved.');

-- ============================================================
-- VIT VENUE EXPANSION (New Auditoriums & Smart Halls)
-- ============================================================
INSERT INTO venues (venue_name, venue_type, building, floor_number, seating_capacity, has_air_conditioning, projector_count, has_sound_system, has_smart_podium, venue_status) VALUES
('AB1 Auditorium', 'AUDITORIUM', 'AB Block', 1, 600, TRUE, 4, TRUE, TRUE, 'ACTIVE'),
('AB2 Auditorium', 'AUDITORIUM', 'AB Block', 1, 400, TRUE, 3, TRUE, TRUE, 'ACTIVE'),
('AC Block Auditorium', 'AUDITORIUM', 'AC Block', 1, 350, TRUE, 4, TRUE, TRUE, 'ACTIVE'),
('CP Block Auditorium', 'AUDITORIUM', 'CP Block', 2, 500, TRUE, 3, TRUE, FALSE, 'ACTIVE'),
('SM Block Auditorium', 'AUDITORIUM', 'SM Block', 1, 450, TRUE, 3, TRUE, TRUE, 'ACTIVE'),
('M Block Auditorium', 'AUDITORIUM', 'M Block', 1, 550, TRUE, 4, TRUE, TRUE, 'ACTIVE'),
('AB1-A Lecture Hall', 'LECTURE_HALL', 'AB Block', 2, 120, TRUE, 2, TRUE, TRUE, 'ACTIVE'),
('AC-205 Smart Lecture Hall', 'LECTURE_HALL', 'AC Block', 2, 90, TRUE, 1, TRUE, TRUE, 'ACTIVE'),
('CP-310 Smart Lecture Hall', 'LECTURE_HALL', 'CP Block', 3, 75, TRUE, 1, TRUE, FALSE, 'ACTIVE'),
('SM-104 Smart Lecture Hall', 'LECTURE_HALL', 'SM Block', 1, 60, TRUE, 1, TRUE, FALSE, 'ACTIVE'),
('Main Building Seminar Hall', 'SEMINAR_HALL', 'Main Building', 1, 150, TRUE, 2, TRUE, TRUE, 'ACTIVE'),
('Innovation Centre Seminar Hall', 'SEMINAR_HALL', 'Innovation Centre', 2, 100, TRUE, 1, TRUE, FALSE, 'ACTIVE'),
('Library Complex Seminar Room', 'SEMINAR_HALL', 'Library Complex', 2, 80, TRUE, 1, TRUE, FALSE, 'ACTIVE');

-- New Venue Requirements for restricted new auditoriums
INSERT INTO venue_requirements (venue_id, auth_id) VALUES
(6, 1),  -- AB1 requires DEAN_PERMIT
(8, 1),  -- AC Block requires DEAN_PERMIT
(9, 3); -- CP Block requires AV_TECH_CERT

-- Additional Users (random demo users)
INSERT INTO users (full_name, email, phone, role_id, department, designation) VALUES
('Dr. Lakshmi Narayanan', 'lakshmi.n@vit.ac.in', '+91-9876543214', 2, 'Computer Science', 'Professor'),
('Prof. S. Iyer', 's.iyer@vit.ac.in', '+91-9876543215', 2, 'Mechanical Engineering', 'Professor'),
('Nikhil Rao', 'nikhil.r@vitstudent.ac.in', '+91-9876543216', 3, 'Computer Science', 'Club Head'),
('Sneha Iyer', 'sneha.i@vitstudent.ac.in', '+91-9876543217', 3, 'Biotechnology', 'Club Head'),
('Arjun Nair', 'arjun.n@vit.ac.in', '+91-9876543218', 2, 'Electronics', 'Assistant Professor');

-- Additional Authorizations (optional new codes, but using existing)
INSERT INTO user_authorizations (user_id, auth_id, issue_date, expiry_date, verification_status) VALUES
(6, 2, '2026-06-01', '2027-05-30', 'VERIFIED'), -- Dr. Lakshmi has HoD clearance
(7, 3, '2026-07-01', '2027-06-30', 'VERIFIED'), -- Prof. Iyer has AV cert
(9, 1, '2026-08-01', '2027-05-31', 'VERIFIED'), -- Sneha has DEAN_PERMIT
(10, 2, '2026-09-01', '2027-08-31', 'VERIFIED'); -- Arjun HOD

-- Additional Events for new users / venues (random demo data)
INSERT INTO events (event_title, event_type, description, expected_attendees, organizer_user_id, club_id) VALUES
('International Robotics Workshop', 'WORKSHOP', 'Hands-on robotics lab session', 120, 6, NULL),
('Guest Lecture: AI Ethics', 'GUEST_LECTURE', 'Keynote on responsible AI', 200, 7, NULL),
('Cultural Night Rehearsals', 'CULTURAL_EVENT', 'Dress rehearsal for annual fest', 250, 9, 2),
('Departmental Symposium', 'CONFERENCE', 'Joint faculty-student presentations', 300, 10, NULL);

-- Additional Bookings (random recent dates around 2026-10-22 to 2026-10-24)
INSERT INTO bookings (booking_ref, venue_id, user_id, event_id, start_datetime, end_datetime, booking_status, purpose_notes) VALUES
('BK-2026-201', 6, 6, 12, '2026-10-22 09:00:00+05:30', '2026-10-22 12:30:00+05:30', 'CONFIRMED', 'Robotics workshop in AB1'),
('BK-2026-202', 9, 7, 13, '2026-10-23 10:00:00+05:30', '2026-10-23 14:00:00+05:30', 'PENDING', 'Guest lecture in AC Block'),
('BK-2026-203', 10, 9, 14, '2026-10-24 14:00:00+05:30', '2026-10-24 17:00:00+05:30', 'PENDING', 'Cultural rehearsal'),
('BK-2026-204', 11, 10, 15, '2026-10-22 14:00:00+05:30', '2026-10-22 17:30:00+05:30', 'CONFIRMED', 'Departmental symposium');

-- Random Maintenance Blackouts (disable slots / venue status demo)
INSERT INTO venue_maintenance (venue_id, start_datetime, end_datetime, reason, scheduled_by) VALUES
(6, '2026-10-22 08:00:00+05:30', '2026-10-22 10:00:00+05:30', 'AV equipment calibration', 1),
(9, '2026-10-23 09:00:00+05:30', '2026-10-23 16:00:00+05:30', 'Scheduled repair of air-conditioning duct', 1),
(10, '2026-10-24 08:00:00+05:30', '2026-10-24 12:00:00+05:30', 'Deep cleaning of auditorium', 1);

# CampusBook

CampusBook is a campus auditorium and smart lecture hall reservation system built for high-concurrency scheduling and administrative authorization. It demonstrates PostgreSQL temporal range exclusion (`tstzrange` with `btree_gist`), ACID pessimistic locking, and relational division.

## Documentation Links
- [Project Proposal (BCSE302P Database Systems Lab)](file:///home/kinglynara/Desktop/campusbook/docs/PROJECT_PROPOSAL.md)
- [Backend PRD & Database Design Specification](file:///home/kinglynara/Desktop/campusbook/docs/BACKEND_PRD_AND_DATABASE_DESIGN.md)
- [PostgreSQL Database DDL & Seed Script](file:///home/kinglynara/Desktop/campusbook/database/schema.sql)

## What it does

Universities must prevent overlapping venue reservations and verify administrative clearances before staff or student clubs reserve auditoriums. CampusBook demonstrates this workflow with an interactive booking console, an entity-relationship schema graph rendered with React Flow, and a live SQL audit console.

1. **Staff selection.** The user selects a researcher profile, such as Alice Chen or Bob Kumar.
2. **Equipment selection.** The user chooses an instrument, such as a confocal microscope or field emission SEM.
3. **Prerequisite checking.** The client verifies whether the researcher holds every safety credential required for that instrument.
4. **Temporal conflict checking.** The client checks whether the requested time interval overlaps with an existing reservation.
5. **Execution log.** The app records each check, SQL query, and constraint failure into an audit console with millisecond timestamps.

## Relational mechanics

### 1. Relational division for credential verification

Equipment often requires multiple independent certifications before a researcher can reserve it. For example, the Field Emission SEM requires both Laser Safety Level 2 and Biosafety Protocol BSL-2.

Relational division determines whether a user holds all qualifications associated with an equipment item.

In SQL, this is expressed using set difference:

```sql
-- Required qualifications for the selected resource
SELECT qualification_id
FROM equipment_requirements
WHERE resource_id = :resource_id

EXCEPT

-- Qualifications held and verified for the selected user
SELECT qualification_id
FROM user_qualifications
WHERE user_id = :user_id
  AND status = 'VERIFIED';
```

When this query returns zero rows, the user is cleared to book. When any qualification ID returns, the system halts the reservation and displays the missing prerequisite.

### 2. GiST temporal range exclusion

Standard database constraints like `UNIQUE (resource_id, start_datetime)` only catch identical start times. They allow overlapping spans where one reservation starts before another finishes.

PostgreSQL solves this problem using the `btree_gist` extension and an exclusion constraint over `tstzrange` intervals:

```sql
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_datetime, end_datetime) WITH &&
);
```

CampusBook simulates this constraint during booking submission. When an incoming interval intersects an existing booking for the same equipment, the engine rejects the write, returns an HTTP 409 status, and reports the conflicting booking ID.

## Architecture

- **Runtime and package manager.** Bun.
- **Framework.** Next.js 16 with the App Router.
- **Web components.** Material 3 custom elements from `@m3e/web`.
- **Schema graph.** `@xyflow/react` with custom table nodes and GSAP edge traversal animations.
- **Typography.** Google Sans Flex configured with `ROND` at 100, and Google Sans Code for transaction logs.

## Getting started

Install dependencies:

```bash
bun install
```

Start the local development server:

```bash
bun dev
```

Open `http://localhost:3000` in your browser.

To create a production build:

```bash
bun run build
```

To run the linter:

```bash
bun run lint
```

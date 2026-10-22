"use client";

import React, { useEffect, useState } from "react";
import type { Venue } from "@/lib/api";
import {
  createVenue,
  setVenueAvailability,
  scheduleMaintenance,
  listMaintenance,
} from "@/lib/api";

import "@m3e/web/button";
import "@m3e/web/icon";
import "@m3e/web/badge";
import "@m3e/web/chips";
import "@m3e/web/form-field";
import "@m3e/web/select";
import "@m3e/web/switch";

const VENUE_TYPES = [
  "AUDITORIUM",
  "MINI_AUDITORIUM",
  "LECTURE_HALL",
  "SEMINAR_HALL",
];

const AUTH_CODES = ["DEAN_PERMIT", "HOD_ACAD_CLEARANCE", "AV_TECH_CERT"];

export interface AdminFacilityManagerProps {
  venues: Venue[];
  adminId: number;
  onRefresh: () => void;
  notify: (message: string) => void;
}

interface MaintenanceWindow {
  maintenance_id: number | string;
  venue_id: number | string;
  venue_name: string;
  building: string;
  start_datetime: string;
  end_datetime: string;
  reason: string;
}

export function AdminFacilityManager({
  venues,
  adminId,
  onRefresh,
  notify,
}: AdminFacilityManagerProps) {
  const [venueName, setVenueName] = useState("");
  const [venueType, setVenueType] = useState("AUDITORIUM");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("1");
  const [capacity, setCapacity] = useState("100");
  const [projectors, setProjectors] = useState("1");
  const [hasAc, setHasAc] = useState(true);
  const [hasSound, setHasSound] = useState(true);
  const [hasPodium, setHasPodium] = useState(false);
  const [requiredCodes, setRequiredCodes] = useState<string[]>([]);

  const [slotVenueId, setSlotVenueId] = useState<string>("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotReason, setSlotReason] = useState("");

  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [busy, setBusy] = useState(false);

  const loadWindows = () => {
    listMaintenance()
      .then((res) => {
        if (res.success) setWindows(res.data as MaintenanceWindow[]);
      })
      .catch(() => {});
  };

  useEffect(loadWindows, []);

  async function handleAddVenue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await createVenue({
        venue_name: venueName,
        venue_type: venueType,
        building,
        floor_number: Number(floor) || 1,
        seating_capacity: Number(capacity) || 1,
        has_air_conditioning: hasAc,
        projector_count: Number(projectors) || 1,
        has_sound_system: hasSound,
        has_smart_podium: hasPodium,
        required_auth_codes: requiredCodes,
        admin_id: adminId,
      });
      if (res.success) {
        notify(`Venue "${venueName}" registered.`);
        setVenueName("");
        setBuilding("");
        onRefresh();
      }
    } catch (err: any) {
      notify(err.message || "Could not register venue.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAvailability(venue: Venue) {
    const nextStatus = venue.venue_status === "ACTIVE" ? "MAINTENANCE" : "ACTIVE";
    try {
      const res = await setVenueAvailability(venue.venue_id, nextStatus, adminId);
      if (res.success) {
        notify(`${venue.venue_name} availability set to ${nextStatus}.`);
        onRefresh();
      }
    } catch (err: any) {
      notify(err.message || "Could not change availability.");
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotVenueId || !slotStart || !slotEnd || !slotReason) {
      notify("Venue, start, end and reason are all required.");
      return;
    }
    setBusy(true);
    try {
      const res = await scheduleMaintenance({
        venue_id: Number(slotVenueId),
        start_datetime: new Date(slotStart).toISOString(),
        end_datetime: new Date(slotEnd).toISOString(),
        reason: slotReason,
        admin_id: adminId,
      });
      if (res.success) {
        notify("Slot blacked out for maintenance.");
        setSlotStart("");
        setSlotEnd("");
        setSlotReason("");
        loadWindows();
      }
    } catch (err: any) {
      notify(err.message || "Could not schedule slot.");
    } finally {
      setBusy(false);
    }
  }

  function toggleCode(code: string) {
    setRequiredCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <div className="space-y-4">
      {/* Register New Venue */}
      <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
        <h3 className="text-sm font-bold text-on-surface">Register New Venue</h3>
        <form onSubmit={handleAddVenue} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Venue name</label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full text-xs bg-transparent text-on-surface focus:outline-none"
              required
            />
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Type</label>
            <m3e-select value={venueType} onChange={(e: any) => setVenueType(String(e.target.value))}>
              {VENUE_TYPES.map((t) => (
                <m3e-option key={t} value={t}>{t.replace(/_/g, " ")}</m3e-option>
              ))}
            </m3e-select>
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Building</label>
            <input type="text" value={building} onChange={(e) => setBuilding(e.target.value)} className="w-full text-xs bg-transparent text-on-surface focus:outline-none" required />
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Floor</label>
            <input type="number" min="1" value={floor} onChange={(e) => setFloor(e.target.value)} className="w-full text-xs bg-transparent text-on-surface focus:outline-none" />
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Seating capacity</label>
            <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full text-xs bg-transparent text-on-surface focus:outline-none" required />
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Projectors</label>
            <input type="number" min="0" value={projectors} onChange={(e) => setProjectors(e.target.value)} className="w-full text-xs bg-transparent text-on-surface focus:outline-none" />
          </m3e-form-field>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3 flex-wrap">
            {[
              ["Air conditioned", hasAc, setHasAc],
              ["Sound system", hasSound, setHasSound],
              ["Smart podium", hasPodium, setHasPodium],
            ].map(([label, checked, setter]: any[]) => (
              <m3e-switch key={label} checked={checked} onChange={(e: any) => setter(e.target.checked)}>
                {label}
              </m3e-switch>
            ))}
            <m3e-chip-set>
              {AUTH_CODES.map((code) => (
                <m3e-filter-chip
                  key={code}
                  selected={requiredCodes.includes(code)}
                  onClick={() => toggleCode(code)}
                >
                  {code}
                </m3e-filter-chip>
              ))}
            </m3e-chip-set>
          </div>
          <m3e-button
            type="submit"
            variant="filled"
            disabled={busy}
            className="sm:col-span-2 lg:col-span-3 justify-self-start text-xs"
          >
            <m3e-icon slot="icon" name="add"></m3e-icon>
            Register Venue
          </m3e-button>
        </form>
      </div>

      {/* Block a Slot */}
      <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
        <h3 className="text-sm font-bold text-on-surface">Block a Slot</h3>
        <form onSubmit={handleAddSlot} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Venue</label>
            <m3e-select value={slotVenueId} onChange={(e: any) => setSlotVenueId(String(e.target.value))}>
              <m3e-option value="">Select venue</m3e-option>
              {venues.map((v) => (
                <m3e-option key={v.venue_id} value={String(v.venue_id)}>{v.venue_name}</m3e-option>
              ))}
            </m3e-select>
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">Start</label>
            <input type="datetime-local" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="w-full text-xs bg-transparent focus:outline-none" required />
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full">
            <label slot="label">End</label>
            <input type="datetime-local" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="w-full text-xs bg-transparent focus:outline-none" required />
          </m3e-form-field>
          <m3e-form-field variant="outlined" className="w-full" style={{ gridColumn: "span 2" }}>
            <label slot="label">Reason</label>
            <input value={slotReason} onChange={(e) => setSlotReason(e.target.value)} className="w-full text-xs bg-transparent focus:outline-none" required />
          </m3e-form-field>
          <m3e-button type="submit" variant="filled" disabled={busy} className="justify-self-start text-xs">
            <m3e-icon slot="icon" name="block"></m3e-icon>
            Block Slot
          </m3e-button>
        </form>
      </div>

      {/* Venue Availability Toggles */}
      <div className="rounded-xl bg-surface-container-low p-4 space-y-2">
        <h3 className="text-sm font-bold text-on-surface">Booking Availability</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {venues.map((v) => (
            <div
              key={v.venue_id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">{v.venue_name}</div>
                <div className="text-[10px] text-on-surface-variant">
                  {v.building} • {v.seating_capacity} seats
                </div>
              </div>
              <m3e-switch
                checked={v.venue_status === "ACTIVE"}
                onChange={() => handleToggleAvailability(v)}
              >
                {v.venue_status === "ACTIVE" ? "Accepting bookings" : "Bookings disabled"}
              </m3e-switch>
            </div>
          ))}
        </div>
      </div>

      {/* Active Blackouts */}
      <div className="rounded-xl bg-surface-container-low p-4 space-y-2">
        <h3 className="text-sm font-bold text-on-surface">Active Blackouts</h3>
        {windows.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No upcoming blackouts.</p>
        ) : (
          windows.map((w) => (
            <div
              key={w.maintenance_id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">{w.venue_name}</div>
                <div className="text-[10px] text-on-surface-variant">
                  {new Date(w.start_datetime).toLocaleString()} –{" "}
                  {new Date(w.end_datetime).toLocaleString()} • {w.reason}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AdminFacilityManager;

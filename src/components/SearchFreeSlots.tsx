"use client";

import React, { useState, useEffect, useMemo, useId } from "react";
import type { Venue, Booking } from "@/lib/api";
import { getTimetableBookings } from "@/lib/api";
import {
  formatDateDDMMYYYY,
  formatDateDayDDMonYYYY,
  getSystemDateYYYYMMDD,
  calculateContinuousFreeSlots,
  parseTimeToMinutes,
  parseIsoParts,
  formatSlotTime,
  type FreeSlot,
} from "@/lib/timetableUtils";

import "@m3e/web/card";
import "@m3e/web/button";
import "@m3e/web/icon";
import "@m3e/web/icon-button";
import "@m3e/web/chips";
import "@m3e/web/badge";
import "@m3e/web/form-field";

export interface SearchFreeSlotsProps {
  venues: Venue[];
  onNavigateToBook: (venueId: number, date: string, startTime: string, endTime: string) => void;
  loading?: boolean;
}

const VISUAL_SLOT_LIMIT = 3;

interface BookedSlotInfo {
  startTime: string;
  endTime: string;
  title: string;
  eventType: string;
}

interface VenueDayData {
  date: string;
  freeSlots: FreeSlot[];
  bookedSlots: BookedSlotInfo[];
  totalFreeMinutes: number;
}

interface VenueSearchItem {
  venue: Venue;
  days: VenueDayData[];
  totalFreeSlots: number;
  hasFreeSlots: boolean;
}

export function SearchFreeSlots({
  venues,
  onNavigateToBook,
  loading: parentLoading = false,
}: SearchFreeSlotsProps) {
  const dateFromId = useId();
  const dateToId = useId();
  const timeFromId = useId();
  const timeToId = useId();

  // 1. Filter: Date Range (defaults to system date)
  const [todayDate, setTodayDate] = useState<string>("2026-10-26");
  const [startDate, setStartDate] = useState<string>("2026-10-26");
  const [endDate, setEndDate] = useState<string>("2026-10-26");

  // Synchronize with client-side system clock on mount
  useEffect(() => {
    const today = getSystemDateYYYYMMDD();
    setTodayDate(today);
    setStartDate(today);
    setEndDate(today);
  }, []);

  // 2. Filter: Time Range (default: 08:00 to 20:00)
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("20:00");
  const [timePreset, setTimePreset] = useState<string>("all-day");

  // 3. Filter: Venue Selection Feature (Multi-Select Chips instead of plain dropdown)
  const [selectedVenueIds, setSelectedVenueIds] = useState<Set<number>>(
    () => new Set(venues.map((v) => Number(v.venue_id)))
  );
  const [venueTypeFilter, setVenueTypeFilter] = useState<string>("ALL");

  // Keep selected venues in sync if venues list loads
  useEffect(() => {
    if (venues.length > 0 && selectedVenueIds.size === 0) {
      setSelectedVenueIds(new Set(venues.map((v) => Number(v.venue_id))));
    }
  }, [venues]);

  // Bookings fetched for the selected date range
  const [rangeBookings, setRangeBookings] = useState<Booking[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // Expanded venue IDs for dropdown toggle ("1 venue pill per venue")
  const [expandedVenueIds, setExpandedVenueIds] = useState<Set<number>>(new Set());

  // Fetch bookings when date range changes
  useEffect(() => {
    let isCancelled = false;
    async function loadBookings() {
      if (!startDate) return;
      const targetEnd = endDate && endDate >= startDate ? endDate : startDate;
      try {
        setSearchLoading(true);
        const res = await getTimetableBookings(startDate, targetEnd);
        if (!isCancelled && res.success && res.data) {
          setRangeBookings(res.data);
        }
      } catch (err) {
        console.error("Failed to load range bookings for search:", err);
      } finally {
        if (!isCancelled) {
          setSearchLoading(false);
        }
      }
    }
    loadBookings();
    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate]);

  // Generate array of YYYY-MM-DD date strings in the range [startDate ... endDate]
  const dateRangeList = useMemo(() => {
    if (!startDate) return [todayDate];
    const s = new Date(startDate);
    const e = new Date(endDate && endDate >= startDate ? endDate : startDate);
    const list: string[] = [];
    const curr = new Date(s);
    let count = 0;
    while (curr <= e && count < 14) {
      list.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return list.length > 0 ? list : [startDate];
  }, [startDate, endDate, todayDate]);

  // Handle venue selection toggles
  const isAllVenuesSelected = selectedVenueIds.size === venues.length;

  const handleToggleAllVenues = () => {
    if (isAllVenuesSelected) {
      setSelectedVenueIds(new Set());
    } else {
      setSelectedVenueIds(new Set(venues.map((v) => Number(v.venue_id))));
    }
  };

  const handleToggleVenue = (id: number) => {
    setSelectedVenueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectVenueType = (type: string) => {
    setVenueTypeFilter(type);
    if (type === "ALL") {
      setSelectedVenueIds(new Set(venues.map((v) => Number(v.venue_id))));
    } else {
      const matchingIds = venues
        .filter((v) => v.venue_type === type)
        .map((v) => Number(v.venue_id));
      setSelectedVenueIds(new Set(matchingIds));
    }
  };

  // Filtered venues based on selection and type
  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      const numId = Number(v.venue_id);
      if (!selectedVenueIds.has(numId)) {
        return false;
      }
      if (venueTypeFilter !== "ALL" && v.venue_type !== venueTypeFilter) {
        return false;
      }
      return true;
    });
  }, [venues, selectedVenueIds, venueTypeFilter]);

  // Apply time presets
  const handleApplyTimePreset = (preset: "all-day" | "morning" | "afternoon" | "evening") => {
    setTimePreset(preset);
    if (preset === "all-day") {
      setStartTime("08:00");
      setEndTime("20:00");
    } else if (preset === "morning") {
      setStartTime("08:00");
      setEndTime("12:00");
    } else if (preset === "afternoon") {
      setStartTime("12:00");
      setEndTime("16:00");
    } else if (preset === "evening") {
      setStartTime("16:00");
      setEndTime("20:00");
    }
  };

  // Toggle dropdown for a venue pill
  const toggleVenueDropdown = (venueId: number) => {
    setExpandedVenueIds((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) {
        next.delete(venueId);
      } else {
        next.add(venueId);
      }
      return next;
    });
  };

  // Parsed minutes for the filter time range
  const filterStartMinutes = parseTimeToMinutes(startTime);
  const filterEndMinutes = parseTimeToMinutes(endTime);

  // Group and compute free slots: EXACTLY 1 RESULT ITEM PER VENUE
  const venueResults: VenueSearchItem[] = useMemo(() => {
    if (filterEndMinutes <= filterStartMinutes) return [];

    return filteredVenues.map((v) => {
      const venueIdNum = Number(v.venue_id);

      // Bookings confirmed for this venue in the fetched range
      const confirmedVenueBookings = rangeBookings.filter((b) => {
        return Number(b.venue_id) === venueIdNum && b.booking_status === "CONFIRMED";
      });

      // Calculate availability for each date in dateRangeList
      const days: VenueDayData[] = dateRangeList.map((d) => {
        const busyIntervals: [number, number][] = [];
        const bookedSlots: BookedSlotInfo[] = [];

        for (const b of confirmedVenueBookings) {
          const sParts = parseIsoParts(b.start_datetime);
          const eParts = parseIsoParts(b.end_datetime);
          if (!sParts || !eParts) continue;

          // Check if this booking overlaps date d (in Asia/Kolkata local timezone)
          if (sParts.date > d || eParts.date < d) continue;

          const busyStart = sParts.date === d ? sParts.minutes : 0;
          const busyEnd = eParts.date === d ? eParts.minutes : 1440;

          if (busyEnd > busyStart) {
            busyIntervals.push([busyStart, busyEnd]);

            const sH = Math.floor(busyStart / 60);
            const sM = busyStart % 60;
            const eH = Math.floor(busyEnd / 60);
            const eM = busyEnd % 60;

            bookedSlots.push({
              startTime: formatSlotTime(sH, sM),
              endTime: formatSlotTime(eH, eM),
              title: b.event_title || "Confirmed Event",
              eventType: b.event_type || "EVENT",
            });
          }
        }

        const freeSlots = calculateContinuousFreeSlots(
          filterStartMinutes,
          filterEndMinutes,
          busyIntervals
        );

        const totalFreeMinutes = freeSlots.reduce(
          (sum, slot) => sum + (slot.endMinutes - slot.startMinutes),
          0
        );

        return {
          date: d,
          freeSlots,
          bookedSlots,
          totalFreeMinutes,
        };
      });

      const totalFreeSlots = days.reduce((sum, d) => sum + d.freeSlots.length, 0);
      const hasFreeSlots = days.some((d) => d.freeSlots.length > 0);

      return {
        venue: v,
        days,
        totalFreeSlots,
        hasFreeSlots,
      };
    });
  }, [filteredVenues, rangeBookings, dateRangeList, filterStartMinutes, filterEndMinutes]);

  const isLoading = parentLoading || searchLoading;
  const isSingleDay = dateRangeList.length === 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* 1. Filters Card */}
      <div className="bg-surface rounded-xl p-5 sm:p-6 border border-outline-variant/60 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/50 pb-4">
          <div>
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <m3e-icon name="search" className="text-primary text-xl"></m3e-icon>
              <span>Search Free Slots</span>
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Filter by date range, continuous time window, and facility selection to find open booking slots.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <m3e-chip variant="assist">
              <m3e-icon slot="icon" name="domain" className="text-primary"></m3e-icon>
              <span>{venueResults.length} Venue(s) Analyzed</span>
            </m3e-chip>
          </div>
        </div>

        {/* 2. Three Main Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* FILTER 1: DATE RANGE */}
          <div className="lg:col-span-3 space-y-1.5">
            <span className="text-xs font-semibold text-on-surface block">1. Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <m3e-form-field variant="outlined" float-label="always" className="w-full">
                  <label slot="label" htmlFor={dateFromId}>From</label>
                  <input
                    id={dateFromId}
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      if (endDate < val) setEndDate(val);
                    }}
                    className="w-full text-xs bg-transparent text-on-surface focus:outline-none"
                  />
                </m3e-form-field>
              </div>
              <div>
                <m3e-form-field variant="outlined" float-label="always" className="w-full">
                  <label slot="label" htmlFor={dateToId}>To</label>
                  <input
                    id={dateToId}
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs bg-transparent text-on-surface focus:outline-none"
                  />
                </m3e-form-field>
              </div>
            </div>
            {/* Quick date range presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStartDate(todayDate);
                  setEndDate(todayDate);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  startDate === todayDate && endDate === todayDate
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate(todayDate);
                  const d = new Date(todayDate);
                  d.setDate(d.getDate() + 2);
                  setEndDate(d.toISOString().split("T")[0]);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  startDate === todayDate &&
                  endDate !== todayDate &&
                  new Date(endDate).getDate() - new Date(startDate).getDate() === 2
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                3 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate(todayDate);
                  const d = new Date(todayDate);
                  d.setDate(d.getDate() + 6);
                  setEndDate(d.toISOString().split("T")[0]);
                }}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                1 Week
              </button>
            </div>
          </div>

          {/* FILTER 2: TIME RANGE */}
          <div className="lg:col-span-3 space-y-1.5">
            <span className="text-xs font-semibold text-on-surface block">2. Time Window</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <m3e-form-field variant="outlined" float-label="always" className="w-full">
                  <label slot="label" htmlFor={timeFromId}>Start Time</label>
                  <input
                    id={timeFromId}
                    type="time"
                    step="1800"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setTimePreset("custom");
                    }}
                    className="w-full text-xs bg-transparent text-on-surface focus:outline-none"
                  />
                </m3e-form-field>
              </div>
              <div>
                <m3e-form-field variant="outlined" float-label="always" className="w-full">
                  <label slot="label" htmlFor={timeToId}>End Time</label>
                  <input
                    id={timeToId}
                    type="time"
                    step="1800"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setTimePreset("custom");
                    }}
                    className="w-full text-xs bg-transparent text-on-surface focus:outline-none"
                  />
                </m3e-form-field>
              </div>
            </div>
            {/* Quick time window presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleApplyTimePreset("all-day")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  timePreset === "all-day"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                Full Day (8-20)
              </button>
              <button
                type="button"
                onClick={() => handleApplyTimePreset("morning")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  timePreset === "morning"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                Morning
              </button>
              <button
                type="button"
                onClick={() => handleApplyTimePreset("afternoon")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  timePreset === "afternoon"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                Afternoon
              </button>
              <button
                type="button"
                onClick={() => handleApplyTimePreset("evening")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  timePreset === "evening"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                Evening
              </button>
            </div>
          </div>

          {/* FILTER 3: VENUES SELECTION FEATURE (INTERACTIVE CHIPS / PILLS) */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">
                3. Facility Selection ({selectedVenueIds.size} of {venues.length} Selected)
              </span>
              <button
                type="button"
                onClick={handleToggleAllVenues}
                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              >
                {isAllVenuesSelected ? "Deselect All" : "Select All Facilities"}
              </button>
            </div>

            {/* Category selection quick filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: "ALL", label: "All Venues" },
                { id: "AUDITORIUM", label: "Auditoriums" },
                { id: "LECTURE_HALL", label: "Lecture Halls" },
                { id: "SEMINAR_HALL", label: "Seminar Halls" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectVenueType(cat.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                    venueTypeFilter === cat.id
                      ? "bg-primary text-on-primary shadow-xs"
                      : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Individual Venue Selection Chips Feature */}
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 pt-1">
              {venues.map((v) => {
                const numId = Number(v.venue_id);
                const isSelected = selectedVenueIds.has(numId);
                return (
                  <button
                    key={v.venue_id}
                    type="button"
                    onClick={() => handleToggleVenue(numId)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-primary-container text-on-primary-container border-primary font-semibold shadow-2xs"
                        : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container-high opacity-70"
                    }`}
                  >
                    <m3e-icon
                      name={isSelected ? "check_circle" : "radio_button_unchecked"}
                      className={`text-xs ${isSelected ? "text-primary" : "text-on-surface-variant"}`}
                    ></m3e-icon>
                    <span className="truncate max-w-[150px]">{v.venue_name}</span>
                    <span className="text-[10px] opacity-80 font-normal">({v.seating_capacity})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Output List: EXACTLY 1 LONG PILL PER VENUE WITH DROPDOWN BUTTON */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-on-surface-variant flex flex-col items-center justify-center gap-2 bg-surface rounded-xl border border-outline-variant/60">
            <m3e-icon name="sync" className="animate-spin text-primary text-2xl"></m3e-icon>
            <span>Analyzing campus timetables & checking accepted bookings...</span>
          </div>
        ) : venueResults.length === 0 ? (
          <div className="py-12 text-center text-xs text-on-surface-variant bg-surface rounded-xl border border-outline-variant/60 space-y-2">
            <m3e-icon name="event_busy" className="text-3xl text-on-surface-variant"></m3e-icon>
            <p className="font-semibold text-on-surface">No facilities selected or match the criteria.</p>
            <p className="text-[11px]">Choose one or more facilities in the selection feature above.</p>
          </div>
        ) : (
          venueResults.map(({ venue, days, totalFreeSlots }) => {
            const numVenueId = Number(venue.venue_id);
            const isExpanded = expandedVenueIds.has(numVenueId);

            // Primary day slots (e.g. today or first day in range)
            const primaryDay = days[0];
            const primaryFreeSlots = primaryDay ? primaryDay.freeSlots : [];
            const visiblePillSlots = primaryFreeSlots.slice(0, VISUAL_SLOT_LIMIT);
            const remainingPrimarySlots = primaryFreeSlots.length - VISUAL_SLOT_LIMIT;

            return (
              <div
                key={venue.venue_id}
                className="rounded-2xl bg-surface border border-outline-variant/70 p-4 sm:px-6 sm:py-4 transition-all duration-200 hover:border-primary/50 hover:shadow-xs space-y-3"
              >
                {/* Main Pill Header Row: 1 Venue Pill with metadata and timeslot pills */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Venue Identity */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-on-surface truncate">
                        {venue.venue_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container-high text-on-surface-variant uppercase tracking-wider">
                        {venue.venue_type.replace("_", " ")}
                      </span>
                      <span className="text-primary font-bold text-xs">
                        {venue.seating_capacity} seats
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span>{venue.building}, Floor {venue.floor_number}</span>
                      <span>•</span>
                      {isSingleDay ? (
                        <span className="font-medium text-on-surface">
                          {formatDateDayDDMonYYYY(startDate)}
                        </span>
                      ) : (
                        <span className="font-medium text-on-surface">
                          {formatDateDDMMYYYY(startDate)} to {formatDateDDMMYYYY(endDate)} ({days.length} days)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Continuous Free Slots & Dropdown Button */}
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0 max-w-full">
                    {/* If single day, show continuous free slots pills directly */}
                    {isSingleDay && (
                      <>
                        {primaryFreeSlots.length === 0 ? (
                          <span className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-error-container/40 text-on-error-container border border-error/20 inline-flex items-center gap-1.5">
                            <m3e-icon name="block" className="text-xs"></m3e-icon>
                            <span>No free slots ({startTime} – {endTime})</span>
                          </span>
                        ) : (
                          visiblePillSlots.map((slot, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                onNavigateToBook(numVenueId, primaryDay.date, slot.startTime, slot.endTime)
                              }
                              title={`Click to book ${venue.venue_name} on ${formatDateDDMMYYYY(primaryDay.date)} from ${slot.startTime} to ${slot.endTime}`}
                              className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface border border-outline-variant/80 hover:bg-primary hover:text-on-primary hover:border-primary transition-all cursor-pointer shadow-2xs"
                            >
                              <m3e-icon
                                name="schedule"
                                className="text-primary text-xs group-hover:text-on-primary transition-colors"
                              ></m3e-icon>
                              <span>{slot.label}</span>
                              <span className="text-[10px] opacity-75 group-hover:opacity-100 font-normal">
                                ({slot.durationHours}h)
                              </span>
                            </button>
                          ))
                        )}

                        {remainingPrimarySlots > 0 && !isExpanded && (
                          <span className="text-[11px] font-medium text-primary px-1.5">
                            +{remainingPrimarySlots} more
                          </span>
                        )}
                      </>
                    )}

                    {/* If multi-day, show aggregated availability chip */}
                    {!isSingleDay && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-container-high text-on-surface border border-outline-variant/60 inline-flex items-center gap-1.5">
                        <m3e-icon name="event_available" className="text-primary text-xs"></m3e-icon>
                        <span>{totalFreeSlots} free slots across {days.length} days</span>
                      </span>
                    )}

                    {/* Single dropdown toggle button to view all timeslots */}
                    <button
                      type="button"
                      onClick={() => toggleVenueDropdown(numVenueId)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                        isExpanded
                          ? "bg-primary text-on-primary border-primary shadow-xs"
                          : "bg-surface-container-highest text-primary hover:bg-primary/10 border-outline-variant/70"
                      }`}
                    >
                      <span>
                        {isExpanded
                          ? "Hide Details"
                          : isSingleDay
                          ? "View all timeslots"
                          : `View all timeslots (${days.length}d)`}
                      </span>
                      <m3e-icon
                        name={isExpanded ? "expand_less" : "expand_more"}
                        className="text-xs"
                      ></m3e-icon>
                    </button>
                  </div>
                </div>

                {/* Expanded Dropdown Content: Complete breakdown of timeslots per day */}
                {isExpanded && (
                  <div className="pt-3 border-t border-outline-variant/50 space-y-4">
                    {days.map((dayData) => {
                      const dayFreeSlots = dayData.freeSlots;
                      const dayBookedSlots = dayData.bookedSlots;

                      return (
                        <div
                          key={dayData.date}
                          className="bg-surface-container-low rounded-xl p-3 sm:p-4 border border-outline-variant/50 space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                              <m3e-icon name="calendar_today" className="text-primary text-xs"></m3e-icon>
                              <span>{formatDateDayDDMonYYYY(dayData.date)}</span>
                            </span>

                            <span className="text-[11px] text-on-surface-variant">
                              {dayFreeSlots.length} free window(s) •{" "}
                              {Math.round((dayData.totalFreeMinutes / 60) * 10) / 10}h open
                            </span>
                          </div>

                          {/* Free Continuous Time Slots */}
                          <div>
                            <span className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">
                              Continuous Free Windows (Click to Book):
                            </span>
                            {dayFreeSlots.length === 0 ? (
                              <p className="text-xs text-error font-medium flex items-center gap-1">
                                <m3e-icon name="cancel" className="text-xs"></m3e-icon>
                                <span>Fully booked during selected window ({startTime} – {endTime})</span>
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {dayFreeSlots.map((slot, sIdx) => (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() =>
                                      onNavigateToBook(numVenueId, dayData.date, slot.startTime, slot.endTime)
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-all cursor-pointer border border-primary/30 shadow-2xs"
                                    title={`Click to book this slot: ${slot.label}`}
                                  >
                                    <m3e-icon name="add_circle" className="text-xs"></m3e-icon>
                                    <span>{slot.label}</span>
                                    <span className="text-[10px] opacity-80 font-normal">
                                      ({slot.durationHours}h)
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Accepted Bookings on This Day (Shows why other times are busy) */}
                          {dayBookedSlots.length > 0 && (
                            <div className="pt-2 border-t border-outline-variant/30">
                              <span className="text-[11px] font-semibold text-error/90 block mb-1 flex items-center gap-1">
                                <m3e-icon name="lock" className="text-xs text-error"></m3e-icon>
                                <span>Accepted / Confirmed Bookings (Unavailable):</span>
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {dayBookedSlots.map((bSlot, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-error-container/30 text-on-error-container border border-error/20"
                                  >
                                    <span className="font-semibold">{bSlot.startTime} – {bSlot.endTime}</span>
                                    <span>•</span>
                                    <span className="truncate max-w-[200px]">{bSlot.title}</span>
                                    <span className="opacity-70 text-[10px]">({bSlot.eventType})</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SearchFreeSlots;
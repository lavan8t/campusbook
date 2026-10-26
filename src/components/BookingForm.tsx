"use client";

import React, { useMemo, useState } from "react";
import type { CampusUser } from "@/data/schema";
import type { Venue, VenueRequirement, CreateBookingPayload, Booking } from "@/lib/api";
import { formatTimeRailway, formatDateDDMMYYYY, getSystemDateYYYYMMDD } from "@/lib/timetableUtils";

import "@m3e/web/form-field";
import "@m3e/web/select";
import "@m3e/web/option";
import "@m3e/web/datepicker";
import "@m3e/web/date-input";
import "@m3e/web/timepicker";
import "@m3e/web/segmented-button";
import "@m3e/web/textarea-autosize";
import "@m3e/web/button";
import "@m3e/web/icon-button";
import "@m3e/web/card";
import "@m3e/web/chips";
import "@m3e/web/icon";
import "@m3e/web/dialog";

export interface BookingFormProps {
  venues: Venue[];
  currentUser: CampusUser;
  selectedVenueId?: number;
  setSelectedVenueId?: (id: number) => void;
  selectedVenue?: Venue;
  bookingDate?: string;
  setBookingDate?: (date: string) => void;
  startTime?: string;
  setStartTime?: (time: string) => void;
  endTime?: string;
  setEndTime?: (time: string) => void;
  eventTitle?: string;
  setEventTitle?: (title: string) => void;
  eventType?: string;
  setEventType?: (type: string) => void;
  expectedAttendees?: number;
  setExpectedAttendees?: (attendees: number) => void;
  purposeNotes?: string;
  setPurposeNotes?: (notes: string) => void;
  loading?: boolean;
  onSubmit?: (e: React.FormEvent) => void | Promise<void>;
  onSubmitPayload?: (payload: CreateBookingPayload) => void | Promise<void>;
  prerequisiteCheck?: {
    eligible: boolean;
    missing: VenueRequirement[];
  };
  existingBookings?: Booking[];
  serverConflict?: Booking | {
    booking_id?: number | string;
    booking_ref?: string;
    event_title?: string;
    event_type?: string;
    requester_name?: string;
    venue_name?: string;
    start_datetime?: string;
    end_datetime?: string;
  } | null;
  onClearServerConflict?: () => void;
}

export function BookingForm({
  venues,
  currentUser,
  selectedVenueId: propVenueId,
  setSelectedVenueId: propSetVenueId,
  selectedVenue: propSelectedVenue,
  bookingDate: propBookingDate,
  setBookingDate: propSetBookingDate,
  startTime: propStartTime,
  setStartTime: propSetStartTime,
  endTime: propEndTime,
  setEndTime: propSetEndTime,
  eventTitle: propEventTitle,
  setEventTitle: propSetEventTitle,
  eventType: propEventType,
  setEventType: propSetEventType,
  expectedAttendees: propExpectedAttendees,
  setExpectedAttendees: propSetExpectedAttendees,
  purposeNotes: propPurposeNotes,
  setPurposeNotes: propSetPurposeNotes,
  loading = false,
  onSubmit,
  onSubmitPayload,
  prerequisiteCheck: propPrerequisiteCheck,
  existingBookings = [],
  serverConflict = null,
  onClearServerConflict,
}: BookingFormProps) {
  // Local state fallbacks for controlled/uncontrolled operation
  const [internalVenueId, setInternalVenueId] = useState<number>(
    venues[0]?.venue_id ? Number(venues[0].venue_id) : 1,
  );
  const [internalBookingDate, setInternalBookingDate] =
    useState<string>("2026-10-26");

  React.useEffect(() => {
    setInternalBookingDate(getSystemDateYYYYMMDD());
  }, []);
  const [internalStartTime, setInternalStartTime] = useState<string>("10:00");
  const [internalEndTime, setInternalEndTime] = useState<string>("13:00");
  const [internalEventTitle, setInternalEventTitle] = useState<string>("");
  const [internalEventType, setInternalEventType] =
    useState<string>("ACADEMIC_LECTURE");
  const [internalExpectedAttendees, setInternalExpectedAttendees] =
    useState<number>(100);
  const [internalPurposeNotes, setInternalPurposeNotes] = useState<string>("");
  const [durationPreset, setDurationPreset] = useState<string>("preset-custom");

  const [showClashDialog, setShowClashDialog] = useState<boolean>(false);
  const clashDialogRef = React.useRef<HTMLElement>(null);

  const venueId = propVenueId !== undefined ? propVenueId : internalVenueId;
  const bookingDate =
    propBookingDate !== undefined ? propBookingDate : internalBookingDate;
  const startTime =
    propStartTime !== undefined ? propStartTime : internalStartTime;
  const endTime = propEndTime !== undefined ? propEndTime : internalEndTime;
  const eventTitle =
    propEventTitle !== undefined ? propEventTitle : internalEventTitle;
  const eventType =
    propEventType !== undefined ? propEventType : internalEventType;
  const expectedAttendees =
    propExpectedAttendees !== undefined
      ? propExpectedAttendees
      : internalExpectedAttendees;
  const purposeNotes =
    propPurposeNotes !== undefined ? propPurposeNotes : internalPurposeNotes;

  const handleVenueChange = (newId: number) => {
    if (propSetVenueId) propSetVenueId(newId);
    setInternalVenueId(newId);
  };

  const handleDateChange = (date: string) => {
    if (propSetBookingDate) propSetBookingDate(date);
    setInternalBookingDate(date);
  };

  const handleStartTimeChange = (time: string) => {
    if (propSetStartTime) propSetStartTime(time);
    setInternalStartTime(time);
  };

  const handleEndTimeChange = (time: string) => {
    if (propSetEndTime) propSetEndTime(time);
    setInternalEndTime(time);
  };

  const handleTitleChange = (title: string) => {
    if (propSetEventTitle) propSetEventTitle(title);
    setInternalEventTitle(title);
  };

  const handleTypeChange = (type: string) => {
    if (propSetEventType) propSetEventType(type);
    setInternalEventType(type);
  };

  const handleAttendeesChange = (attendees: number) => {
    if (propSetExpectedAttendees) propSetExpectedAttendees(attendees);
    setInternalExpectedAttendees(attendees);
  };

  const handleNotesChange = (notes: string) => {
    if (propSetPurposeNotes) propSetPurposeNotes(notes);
    setInternalPurposeNotes(notes);
  };

  const bookingDateInputRef = React.useRef<HTMLElement>(null);
  const bookingDatePickerRef = React.useRef<HTMLElement>(null);
  const startTimeInputRef = React.useRef<HTMLElement>(null);
  const startTimePickerRef = React.useRef<HTMLElement>(null);
  const endTimeInputRef = React.useRef<HTMLElement>(null);
  const endTimePickerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const inputEl = bookingDateInputRef.current as
      (HTMLElement & { value?: Date | null }) | null;
    const pickerEl = bookingDatePickerRef.current as
      (HTMLElement & { date?: Date | null }) | null;

    if (inputEl) {
      const parts = bookingDate ? bookingDate.split("-").map(Number) : [];
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        inputEl.value = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        inputEl.value = null;
      }
    }
    if (pickerEl) {
      const parts = bookingDate ? bookingDate.split("-").map(Number) : [];
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        pickerEl.date = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        pickerEl.date = null;
      }
    }

    const handleChange = (e: Event) => {
      const target = e.target as {
        value?: Date | string;
        date?: Date | string;
      } | null;
      const val = target?.value ?? target?.date;
      if (val instanceof Date && !isNaN(val.getTime())) {
        const yr = val.getFullYear();
        const mo = String(val.getMonth() + 1).padStart(2, "0");
        const day = String(val.getDate()).padStart(2, "0");
        handleDateChange(`${yr}-${mo}-${day}`);
      } else if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        handleDateChange(val);
      }
    };

    inputEl?.addEventListener("change", handleChange);
    pickerEl?.addEventListener("change", handleChange);
    return () => {
      inputEl?.removeEventListener("change", handleChange);
      pickerEl?.removeEventListener("change", handleChange);
    };
  }, [bookingDate]);

  React.useEffect(() => {
    const parseTime = (timeStr: string): Date | null => {
      if (!timeStr) return null;
      const parts = timeStr.split(":").map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return new Date(2000, 0, 1, parts[0], parts[1], 0);
      }
      return null;
    };

    const formatTime = (d: Date): string => {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    };

    const startInput = startTimeInputRef.current as
      (HTMLElement & { value?: Date | null }) | null;
    const startPicker = startTimePickerRef.current as
      (HTMLElement & { date?: Date | null }) | null;
    const endInput = endTimeInputRef.current as
      (HTMLElement & { value?: Date | null }) | null;
    const endPicker = endTimePickerRef.current as
      (HTMLElement & { date?: Date | null }) | null;

    if (startInput) startInput.value = parseTime(startTime);
    if (startPicker) startPicker.date = parseTime(startTime);
    if (endInput) endInput.value = parseTime(endTime);
    if (endPicker) endPicker.date = parseTime(endTime);

    const handleStartChange = (e: Event) => {
      const target = e.target as {
        value?: Date | string;
        date?: Date | string;
      } | null;
      const val = target?.value ?? target?.date;
      if (val instanceof Date && !isNaN(val.getTime())) {
        handleStartTimeChange(formatTime(val));
      } else if (typeof val === "string" && val.includes(":")) {
        handleStartTimeChange(val.slice(0, 5));
      }
    };

    const handleEndChange = (e: Event) => {
      const target = e.target as {
        value?: Date | string;
        date?: Date | string;
      } | null;
      const val = target?.value ?? target?.date;
      if (val instanceof Date && !isNaN(val.getTime())) {
        handleEndTimeChange(formatTime(val));
      } else if (typeof val === "string" && val.includes(":")) {
        handleEndTimeChange(val.slice(0, 5));
      }
    };

    startInput?.addEventListener("change", handleStartChange);
    startInput?.addEventListener("input", handleStartChange);
    startPicker?.addEventListener("change", handleStartChange);
    endInput?.addEventListener("change", handleEndChange);
    endInput?.addEventListener("input", handleEndChange);
    endPicker?.addEventListener("change", handleEndChange);

    return () => {
      startInput?.removeEventListener("change", handleStartChange);
      startInput?.removeEventListener("input", handleStartChange);
      startPicker?.removeEventListener("change", handleStartChange);
      endInput?.removeEventListener("change", handleEndChange);
      endInput?.removeEventListener("input", handleEndChange);
      endPicker?.removeEventListener("change", handleEndChange);
    };
  }, [startTime, endTime]);

  // Determine current active venue
  const activeVenue = useMemo(() => {
    if (propSelectedVenue) return propSelectedVenue;
    return (
      venues.find((v) => Number(v.venue_id) === Number(venueId)) ||
      venues[0] || {
        venue_id: 1,
        venue_name: "Anna Auditorium",
        venue_type: "AUDITORIUM",
        building: "Main Administrative Block",
        floor_number: 1,
        seating_capacity: 1500,
        has_air_conditioning: true,
        projector_count: 4,
        has_sound_system: true,
        has_smart_podium: true,
        venue_status: "ACTIVE",
        required_authorizations: [],
      }
    );
  }, [propSelectedVenue, venues, venueId]);

  // Compute Relational Division Prerequisite Check
  const prerequisiteCheck = useMemo(() => {
    if (propPrerequisiteCheck) return propPrerequisiteCheck;
    if (!activeVenue || !activeVenue.required_authorizations) {
      return { eligible: true, missing: [] };
    }
    if (activeVenue.required_authorizations.length === 0) {
      return { eligible: true, missing: [] };
    }

    const userCredsText = (currentUser?.credentials || [])
      .join(" ")
      .toUpperCase();
    const missing = activeVenue.required_authorizations.filter((req) => {
      return !userCredsText.includes(req.auth_code.toUpperCase());
    });

    return {
      eligible: missing.length === 0,
      missing,
    };
  }, [propPrerequisiteCheck, activeVenue, currentUser]);

  // Duration Presets (2h, 4h, 8h)
  const applyDurationPreset = (preset: "2h" | "4h" | "8h") => {
    setDurationPreset(preset);
    if (preset === "2h") {
      handleStartTimeChange("09:00");
      handleEndTimeChange("11:00");
    } else if (preset === "4h") {
      handleStartTimeChange("10:00");
      handleEndTimeChange("14:00");
    } else if (preset === "8h") {
      handleStartTimeChange("09:00");
      handleEndTimeChange("17:00");
    }
  };

  React.useEffect(() => {
    if (serverConflict) {
      setShowClashDialog(true);
    }
  }, [serverConflict]);

  React.useEffect(() => {
    const el = clashDialogRef.current as (HTMLElement & { show?: () => void; hide?: () => void; open?: boolean }) | null;
    if (el) {
      if (showClashDialog) {
        el.open = true;
        el.show?.();
        el.setAttribute("open", "");
      } else {
        el.open = false;
        el.hide?.();
        el.removeAttribute("open");
      }
    }
  }, [showClashDialog]);

  const handleCloseClashDialog = () => {
    setShowClashDialog(false);
    if (onClearServerConflict) onClearServerConflict();
  };

  const selectedStart = `${bookingDate}T${startTime}:00+05:30`;
  const selectedEnd = `${bookingDate}T${endTime}:00+05:30`;
  const startTs = new Date(selectedStart).getTime();
  const endTs = new Date(selectedEnd).getTime();

  // Overlapping confirmed booking on this venue
  const activeConfirmedConflict = useMemo(() => {
    if (serverConflict) return serverConflict;
    if (!existingBookings || existingBookings.length === 0) return null;
    if (isNaN(startTs) || isNaN(endTs) || endTs <= startTs) return null;

    return (
      existingBookings.find((b) => {
        if (Number(b.venue_id) !== Number(venueId)) return false;
        if (b.booking_status !== "CONFIRMED") return false;
        const bStart = new Date(b.start_datetime).getTime();
        const bEnd = new Date(b.end_datetime).getTime();
        return bStart < endTs && bEnd > startTs;
      }) || null
    );
  }, [existingBookings, venueId, startTs, endTs, serverConflict]);

  // Overlapping pending bookings on this venue
  const activePendingConflicts = useMemo(() => {
    if (!existingBookings || existingBookings.length === 0) return [];
    if (isNaN(startTs) || isNaN(endTs) || endTs <= startTs) return [];

    return existingBookings.filter((b) => {
      if (Number(b.venue_id) !== Number(venueId)) return false;
      if (b.booking_status !== "PENDING") return false;
      const bStart = new Date(b.start_datetime).getTime();
      const bEnd = new Date(b.end_datetime).getTime();
      return bStart < endTs && bEnd > startTs;
    });
  }, [existingBookings, venueId, startTs, endTs]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (activeConfirmedConflict) {
      e.preventDefault();
      setShowClashDialog(true);
      return;
    }
    if (onSubmit) {
      await onSubmit(e);
      return;
    }
    e.preventDefault();
    if (onSubmitPayload) {
      const startISO = `${bookingDate}T${startTime}:00+05:30`;
      const endISO = `${bookingDate}T${endTime}:00+05:30`;
      await onSubmitPayload({
        user_id: currentUser.user_id,
        venue_id: Number(venueId),
        start_datetime: startISO,
        end_datetime: endISO,
        event_title: eventTitle || "Campus Academic Gathering",
        event_type: eventType,
        expected_attendees: expectedAttendees,
        purpose_notes: purposeNotes,
        club_id: currentUser.role === "CLUB_HEAD" ? 1 : null,
      });
    }
  };

  const parsedStartHour = Number(startTime.split(":")[0]) || 10;
  const parsedStartMinute = Number(startTime.split(":")[1]) || 0;
  const parsedEndHour = Number(endTime.split(":")[0]) || 13;
  const parsedEndMinute = Number(endTime.split(":")[1]) || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 max-w-7xl mx-auto w-full">
      {/* Left Column: Booking Form */}
      <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 sm:p-8 border border-outline-variant/60 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Target Venue / Hall Selector */}
          <div>
            <m3e-form-field variant="outlined" className="w-full" float-label="always">
              <label slot="label">Target Venue / Hall</label>
              <m3e-select
                value={String(venueId)}
                onChange={(e: React.FormEvent<HTMLElement>) => {
                  const target = e.target as HTMLElement & {
                    value?: string | number;
                  };
                  if (target.value !== undefined) {
                    handleVenueChange(Number(target.value));
                  }
                }}
              >
                {venues.map((v) => (
                  <m3e-option key={v.venue_id} value={String(v.venue_id)}>
                    {v.venue_name} ({v.venue_type} — {v.seating_capacity} Seats,{" "}
                    {v.building})
                  </m3e-option>
                ))}
              </m3e-select>
            </m3e-form-field>
          </div>

          {/* Relational Division Prerequisite Check Banner */}
          <div
            className={`p-4 rounded-lg text-xs ${
              prerequisiteCheck.eligible
                ? "bg-surface-container-low text-on-surface"
                : "bg-error-container text-on-error-container"
            }`}
          >
            <div className="flex items-start gap-3">
              <m3e-icon
                name={prerequisiteCheck.eligible ? "check_circle" : "error"}
                className={
                  prerequisiteCheck.eligible
                    ? "text-primary text-base shrink-0 mt-0.5"
                    : "text-on-error-container text-base shrink-0 mt-0.5"
                }
              >
                {prerequisiteCheck.eligible ? "check_circle" : "error"}
              </m3e-icon>
              <div className="flex-1">
                <div className="font-semibold text-xs">
                  {prerequisiteCheck.eligible
                    ? "Prerequisite Verification: CLEARED"
                    : "Authorization Restriction: MISSING CLEARANCE"}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                  {prerequisiteCheck.eligible ? (
                    `You possess all required clearances for ${activeVenue.venue_name}.`
                  ) : (
                    <span>
                      This venue requires mandatory institutional clearance.
                      Your request cannot be processed without these
                      credentials.
                    </span>
                  )}
                </div>

                {!prerequisiteCheck.eligible &&
                  prerequisiteCheck.missing.length > 0 && (
                    <div className="mt-2.5">
                      <m3e-chip-set>
                        {prerequisiteCheck.missing.map((req) => (
                          <m3e-assist-chip key={req.auth_id} variant="outlined">
                            <m3e-icon slot="icon" name="lock">
                              lock
                            </m3e-icon>
                            {req.auth_name} ({req.auth_code})
                          </m3e-assist-chip>
                        ))}
                      </m3e-chip-set>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Date & Time Range Inputs using m3e Web Components (no default form date picker) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <m3e-form-field variant="outlined" className="w-full" float-label="always">
                <label slot="label" htmlFor="booking-date-field">
                  Reservation Date
                </label>
                <m3e-date-input
                  id="booking-date-field"
                  ref={bookingDateInputRef}
                  type="date"
                ></m3e-date-input>
                <m3e-icon-button slot="suffix" aria-label="Open Calendar">
                  <m3e-icon name="calendar_today"></m3e-icon>
                  <m3e-datepicker-toggle for="booking-datepicker-popover"></m3e-datepicker-toggle>
                </m3e-icon-button>
              </m3e-form-field>
              <m3e-datepicker
                id="booking-datepicker-popover"
                ref={bookingDatePickerRef}
                for="booking-date-field"
                variant="modal"
              ></m3e-datepicker>
            </div>

            <div>
              <m3e-form-field variant="outlined" className="w-full" float-label="always">
                <label slot="label" htmlFor="start-time-field">
                  Start Time
                </label>
                <m3e-date-input
                  id="start-time-field"
                  ref={startTimeInputRef}
                  type="time"
                  time-format="24"
                ></m3e-date-input>
                <m3e-icon-button slot="suffix" aria-label="Open Timepicker">
                  <m3e-icon name="schedule"></m3e-icon>
                  <m3e-timepicker-toggle for="start-time-popover"></m3e-timepicker-toggle>
                </m3e-icon-button>
              </m3e-form-field>
              <m3e-timepicker
                id="start-time-popover"
                ref={startTimePickerRef}
                for="start-time-field"
                format="24"
                variant="modal"
              ></m3e-timepicker>
            </div>

            <div>
              <m3e-form-field variant="outlined" className="w-full" float-label="always">
                <label slot="label" htmlFor="end-time-field">
                  End Time
                </label>
                <m3e-date-input
                  id="end-time-field"
                  ref={endTimeInputRef}
                  type="time"
                  time-format="24"
                ></m3e-date-input>
                <m3e-icon-button slot="suffix" aria-label="Open Timepicker">
                  <m3e-icon name="schedule"></m3e-icon>
                  <m3e-timepicker-toggle for="end-time-popover"></m3e-timepicker-toggle>
                </m3e-icon-button>
              </m3e-form-field>
              <m3e-timepicker
                id="end-time-popover"
                ref={endTimePickerRef}
                for="end-time-field"
                format="24"
                variant="modal"
              ></m3e-timepicker>
            </div>
          </div>

          {/* Duration Presets Segmented Buttons (2h, 4h, 8h) */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold text-on-surface-variant">
              Duration Presets
            </span>
            <m3e-segmented-button>
              <m3e-button-segment
                checked={durationPreset === "2h"}
                onClick={() => applyDurationPreset("2h")}
              >
                <m3e-icon slot="icon" name="timer">
                  timer
                </m3e-icon>
                2h Lecture
              </m3e-button-segment>
              <m3e-button-segment
                checked={durationPreset === "4h"}
                onClick={() => applyDurationPreset("4h")}
              >
                <m3e-icon slot="icon" name="timer">
                  timer
                </m3e-icon>
                4h Symposium
              </m3e-button-segment>
              <m3e-button-segment
                checked={durationPreset === "8h"}
                onClick={() => applyDurationPreset("8h")}
              >
                <m3e-icon slot="icon" name="timer">
                  timer
                </m3e-icon>
                8h Full Day
              </m3e-button-segment>
            </m3e-segmented-button>
          </div>

          {/* Event Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <m3e-form-field variant="outlined" className="w-full" float-label="always">
                <label slot="label" htmlFor="event-title-input">
                  Event / Lecture Title
                </label>
                <input
                  id="event-title-input"
                  type="text"
                  value={eventTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full text-xs bg-transparent text-on-surface focus:outline-none"
                  required
                />
                <m3e-icon slot="suffix" name="edit">
                  edit
                </m3e-icon>
              </m3e-form-field>
            </div>

            <div>
              <m3e-form-field variant="outlined" className="w-full" float-label="always">
                <label slot="label">Event Category</label>
                <m3e-select
                  value={eventType}
                  onChange={(e: React.FormEvent<HTMLElement>) => {
                    const target = e.target as HTMLElement & { value?: string };
                    if (target.value) handleTypeChange(target.value);
                  }}
                >
                  <m3e-option value="ACADEMIC_LECTURE">
                    Academic Lecture / Class Merge
                  </m3e-option>
                  <m3e-option value="GUEST_LECTURE">
                    Guest Lecture / Keynote
                  </m3e-option>
                  <m3e-option value="WORKSHOP">
                    Workshop / Hands-on Lab
                  </m3e-option>
                  <m3e-option value="HACKATHON">
                    Hackathon / Tech Competition
                  </m3e-option>
                  <m3e-option value="CULTURAL_EVENT">
                    Cultural Event / Audition
                  </m3e-option>
                  <m3e-option value="CONFERENCE">
                    Conference / Symposium
                  </m3e-option>
                  <m3e-option value="EXAMINATION">
                    Department Examination
                  </m3e-option>
                </m3e-select>
              </m3e-form-field>
            </div>
          </div>

          {/* Expected Attendees */}
          <div>
            <m3e-form-field variant="outlined" className="w-full" float-label="always">
              <label slot="label" htmlFor="expected-attendees-input">
                Expected Attendees (Max capacity: {activeVenue.seating_capacity}
                )
              </label>
              <input
                id="expected-attendees-input"
                type="number"
                min={10}
                max={activeVenue.seating_capacity + 200}
                value={expectedAttendees}
                onChange={(e) => handleAttendeesChange(Number(e.target.value))}
                className="w-full text-xs bg-transparent text-on-surface focus:outline-none"
                required
              />
              <m3e-icon slot="suffix" name="groups">
                groups
              </m3e-icon>
            </m3e-form-field>
          </div>

          {/* Justification & Special Requirements Notes with Textarea Autosize */}
          <div>
            <m3e-form-field variant="outlined" className="w-full" float-label="always">
              <label slot="label" htmlFor="purpose-notes-textarea">
                Justification & Special Requirements
              </label>
              <textarea
                id="purpose-notes-textarea"
                rows={2}
                value={purposeNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className="w-full text-xs bg-transparent text-on-surface focus:outline-none resize-none"
              />
              <m3e-textarea-autosize
                for="purpose-notes-textarea"
                min-rows={2}
                max-rows={6}
              />
            </m3e-form-field>
          </div>

          {/* Confirmed Slot Clash Warning Banner */}
          {activeConfirmedConflict && (
            <div className="p-4 rounded-lg bg-error-container text-on-error-container border border-error/30 flex items-start gap-3">
              <m3e-icon name="event_busy" className="text-error text-xl shrink-0 mt-0.5">
                event_busy
              </m3e-icon>
              <div className="flex-1 space-y-1.5">
                <div className="font-semibold text-xs text-on-error-container">
                  Slot Already Booked
                </div>
                <p className="text-[11px] leading-relaxed opacity-95">
                  <strong>{activeVenue.venue_name}</strong> is already confirmed for <strong>{activeConfirmedConflict.event_title}</strong> (
                  {formatTimeRailway(activeConfirmedConflict.start_datetime)} – {formatTimeRailway(activeConfirmedConflict.end_datetime)}
                  ). Please select an alternate time or venue.
                </p>
                <div className="pt-1">
                  <m3e-button
                    variant="outlined"
                    type="button"
                    onClick={() => setShowClashDialog(true)}
                    className="text-xs"
                  >
                    <m3e-icon slot="icon" name="visibility">visibility</m3e-icon>
                    View Confirmed Booking Details
                  </m3e-button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Bids Slot Contention Notice */}
          {!activeConfirmedConflict && activePendingConflicts.length > 0 && (
            <div className="p-3.5 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/50 flex items-start gap-3 text-xs">
              <m3e-icon name="schedule" className="text-primary text-lg shrink-0 mt-0.5">
                schedule
              </m3e-icon>
              <div className="flex-1 text-[11px] leading-relaxed">
                <span className="font-semibold text-on-surface">Slot Contention Notice: </span>
                There {activePendingConflicts.length === 1 ? "is currently 1 pending request" : `are currently ${activePendingConflicts.length} pending requests`} bidding for this slot. Your request will enter the queue as a competing bid for Admin review.
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-3">
            <m3e-button
              variant="filled"
              type="submit"
              disabled={loading || !prerequisiteCheck.eligible || Boolean(activeConfirmedConflict)}
              className="w-full"
            >
              <m3e-icon slot="icon" name={activeConfirmedConflict ? "event_busy" : "send"}>
                {activeConfirmedConflict ? "event_busy" : "send"}
              </m3e-icon>
              {loading
                ? "Submitting to Database..."
                : activeConfirmedConflict
                ? "Slot Unavailable (Already Booked)"
                : "Submit Booking Request"}
            </m3e-button>
          </div>
        </form>
      </div>

      {/* Right Column: Venue Details Card */}
      <div className="lg:col-span-5">
        <div className="bg-surface-container-low rounded-xl p-6 sm:p-7 space-y-5 border border-outline-variant/60 shadow-xs">
          <div className="border-b border-outline-variant pb-3">
            <h3 className="text-sm font-bold text-on-surface">
              Venue Specifications
            </h3>
          </div>
          <div className="space-y-3 text-xs text-on-surface">
            <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/60 gap-4">
              <span className="text-on-surface-variant shrink-0">
                Venue Name
              </span>
              <span className="font-semibold text-on-surface text-right">
                {activeVenue.venue_name}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/60 gap-4">
              <span className="text-on-surface-variant shrink-0">Category</span>
              <span className="font-medium text-on-surface text-right">
                {activeVenue.venue_type}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/60 gap-4">
              <span className="text-on-surface-variant shrink-0">
                Building / Floor
              </span>
              <span className="font-medium text-on-surface text-right">
                {activeVenue.building}, Floor {activeVenue.floor_number}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/60 gap-4">
              <span className="text-on-surface-variant shrink-0">
                Seating Capacity
              </span>
              <span className="font-bold text-primary text-right">
                {activeVenue.seating_capacity} seats
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/60 gap-4">
              <span className="text-on-surface-variant shrink-0">
                Air Conditioned
              </span>
              <span className="font-medium text-on-surface text-right">
                {activeVenue.has_air_conditioning ? "Yes (Central AC)" : "No"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/60 gap-4">
              <span className="text-on-surface-variant shrink-0">
                Projector Arrays
              </span>
              <span className="font-medium text-on-surface text-right">
                {activeVenue.projector_count} Units
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/60 gap-4">
              <span className="text-on-surface-variant shrink-0">
                Sound System
              </span>
              <span className="font-medium text-on-surface text-right">
                {activeVenue.has_sound_system ? "Installed & Tuned" : "Basic"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 gap-4">
              <span className="text-on-surface-variant shrink-0">
                Smart Podium
              </span>
              <span className="font-medium text-on-surface text-right">
                {activeVenue.has_smart_podium ? "Yes (Touch display)" : "No"}
              </span>
            </div>
          </div>

          {/* Amenities & Facility Clearances */}
          <div className="pt-3 border-t border-outline-variant">
            <span className="text-[11px] font-semibold text-on-surface-variant block mb-2.5">
              Amenities & Clearances
            </span>
            <m3e-chip-set>
              {activeVenue.has_air_conditioning && (
                <m3e-assist-chip variant="outlined">
                  <m3e-icon slot="icon" name="ac_unit">
                    ac_unit
                  </m3e-icon>
                  Central AC
                </m3e-assist-chip>
              )}
              {activeVenue.projector_count > 0 && (
                <m3e-assist-chip variant="outlined">
                  <m3e-icon slot="icon" name="videocam">
                    videocam
                  </m3e-icon>
                  {activeVenue.projector_count} Projectors
                </m3e-assist-chip>
              )}
              {activeVenue.has_sound_system && (
                <m3e-assist-chip variant="outlined">
                  <m3e-icon slot="icon" name="volume_up">
                    volume_up
                  </m3e-icon>
                  Sound System
                </m3e-assist-chip>
              )}
              {activeVenue.has_smart_podium && (
                <m3e-assist-chip variant="outlined">
                  <m3e-icon slot="icon" name="podium">
                    podium
                  </m3e-icon>
                  Smart Podium
                </m3e-assist-chip>
              )}
              {activeVenue.required_authorizations?.map((auth) => (
                <m3e-assist-chip key={auth.auth_id} variant="outlined">
                  <m3e-icon slot="icon" name="lock">
                    lock
                  </m3e-icon>
                  {auth.auth_name}
                </m3e-assist-chip>
              ))}
            </m3e-chip-set>
          </div>
        </div>
      </div>

      {/* SLOT CLASH DIALOG MODAL */}
      <m3e-dialog
        ref={clashDialogRef}
        open={showClashDialog || undefined}
        dismissible
        onclosed={handleCloseClashDialog}
      >
        <div slot="header" className="flex items-center gap-2">
          <m3e-icon name="event_busy" className="text-error text-xl">event_busy</m3e-icon>
          <span className="text-base font-bold text-on-surface">
            Time Slot Unavailable — Already Booked
          </span>
        </div>
        <div className="space-y-4 py-2">
          <p className="text-xs text-on-surface-variant">
            This venue slot has already been approved and issued an administrative permit. Overlapping reservations cannot be submitted for this slot.
          </p>

          {activeConfirmedConflict && (
            <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/60 space-y-2.5 text-xs">
              <div className="flex justify-between items-start gap-2 border-b border-outline-variant/40 pb-2">
                <div>
                  <div className="font-bold text-sm text-on-surface">
                    {activeConfirmedConflict.event_title}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {activeConfirmedConflict.event_type}
                  </div>
                </div>
                <m3e-chip variant="assist">
                  <m3e-icon slot="icon" name="verified" className="text-success">verified</m3e-icon>
                  Confirmed
                </m3e-chip>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-on-surface-variant block">Target Venue</span>
                  <span className="font-semibold text-on-surface">
                    {activeConfirmedConflict.venue_name || activeVenue.venue_name}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Date</span>
                  <span className="font-semibold text-on-surface">
                    {formatDateDDMMYYYY(activeConfirmedConflict.start_datetime)}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Confirmed Hours</span>
                  <span className="font-semibold text-on-surface">
                    {formatTimeRailway(activeConfirmedConflict.start_datetime)} – {formatTimeRailway(activeConfirmedConflict.end_datetime)}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Booking Reference</span>
                  <span className="font-mono text-on-surface font-semibold">
                    {activeConfirmedConflict.booking_ref}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-surface-container-high text-xs text-on-surface-variant">
            <strong>Next Steps:</strong> Shift your requested hours to a vacant slot on the timetable, or select another lecture hall / auditorium.
          </div>
        </div>
        <div slot="actions" className="flex justify-end gap-2 w-full pt-2">
          <m3e-button variant="filled" onClick={handleCloseClashDialog}>
            <m3e-icon slot="icon" name="edit_calendar">edit_calendar</m3e-icon>
            Acknowledge & Adjust Time
          </m3e-button>
        </div>
      </m3e-dialog>
    </div>
  );
}

export default BookingForm;

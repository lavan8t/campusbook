"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APP_USERS,
  ADMIN_ACCESS_CODE,
  FALLBACK_VENUES,
  FALLBACK_TIMETABLE_BOOKINGS,
  type CampusUser,
} from "@/data/schema";
import {
  getVenues,
  createBooking,
  getMyBookings,
  cancelBooking,
  getPendingApprovals,
  getClashes,
  approveBooking,
  rejectBooking,
  getUtilizationReport,
  getTimetableBookings,
  checkBackendHealth,
  type Venue,
  type Booking,
  type CompetingClash,
  type UtilizationStat,
} from "@/lib/api";

import "@m3e/web/theme";
import "@m3e/web/card";
import "@m3e/web/badge";
import "@m3e/web/icon";
import "@m3e/web/snackbar";

import AppSidebar from "@/components/AppSidebar";
import OptionsView from "@/components/OptionsView";
import GanttTimetable from "@/components/GanttTimetable";
import { BookingForm } from "@/components/BookingForm";
import { VenueCatalog } from "@/components/VenueCatalog";
import MyBookings from "@/components/MyBookings";
import { AdminQueue } from "@/components/AdminQueue";
import { AdminReports } from "@/components/AdminReports";
import AdminFacilityManager from "@/components/AdminFacilityManager";
import UserSwitcherModal from "@/components/UserSwitcherModal";

type ActiveTab =
  | "timetable"
  | "book"
  | "catalog"
  | "my-bookings"
  | "admin-pending"
  | "admin-venues"
  | "admin-reports"
  | "options";

export default function CampusBookPage() {
  // 1. Current Active User State (Default: Aditya Sharma - Club Head)
  const [currentUser, setCurrentUser] = useState<CampusUser>(APP_USERS[0]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("timetable");

  // 2. Theme State & Mobile Nav State
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [adminAccessCode, setAdminAccessCode] = useState<string>(ADMIN_ACCESS_CODE);
  const [mounted, setMounted] = useState<boolean>(false);

  // 3. Timetable State (Home View)
  const [timetableDate, setTimetableDate] = useState<string>("2026-10-22");
  const [timetableBookings, setTimetableBookings] = useState<Booking[]>(FALLBACK_TIMETABLE_BOOKINGS);

  // 4. Data State from Backend
  const [venues, setVenues] = useState<Venue[]>(FALLBACK_VENUES as unknown as Venue[]);
  const [myBookingsList, setMyBookingsList] = useState<Booking[]>([]);
  const [pendingQueue, setPendingQueue] = useState<Booking[]>([]);
  const [utilizationStats, setUtilizationStats] = useState<UtilizationStat[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // 5. User Switching & Admin Auth Modal State
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [showAdminCodeModal, setShowAdminCodeModal] = useState<boolean>(false);
  const [adminCodeInput, setAdminCodeInput] = useState<string>("");
  const [adminCodeError, setAdminCodeError] = useState<string>("");

  // 6. Booking Form State (Normal Users)
  const [selectedVenueId, setSelectedVenueId] = useState<number>(1);
  const [bookingDate, setBookingDate] = useState<string>("2026-10-22");
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("13:00");
  const [eventTitle, setEventTitle] = useState<string>("");
  const [eventType, setEventType] = useState<string>("ACADEMIC_LECTURE");
  const [expectedAttendees, setExpectedAttendees] = useState<number>(100);
  const [purposeNotes, setPurposeNotes] = useState<string>("");
  const [serverConflict, setServerConflict] = useState<any>(null);

  // 7. Admin Clash & Approval Modals
  const [inspectingBooking, setInspectingBooking] = useState<Booking | null>(null);
  const [clashesData, setClashesData] = useState<CompetingClash[]>([]);
  const [clashesLoading, setClashesLoading] = useState<boolean>(false);
  const [actionBooking, setActionBooking] = useState<Booking | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>("Permit granted after administrative review.");
  const [rejectionRemarks, setRejectionRemarks] = useState<string>("Slot unavailable or conflicting priority event.");
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showRejectionModal, setShowRejectionModal] = useState<boolean>(false);

  // 8. Native M3 Snackbar State
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  function showToast(message: string) {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  }

  // Restore saved theme on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("campusbook_theme") as "light" | "dark" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  // Synchronize theme with document, body, and storage
  useEffect(() => {
    const isDark = theme === "dark";
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.style.colorScheme = theme;
      document.body.classList.toggle("dark", isDark);
      document.body.setAttribute("data-theme", theme);
      try {
        localStorage.setItem("campusbook_theme", theme);
      } catch {
        // Ignore quota/private browsing issues
      }
    }
  }, [theme]);

  // Check health and load initial data
  useEffect(() => {
    checkHealthAndFetch();
  }, []);

  async function checkHealthAndFetch() {
    try {
      await checkBackendHealth();
      setBackendOnline(true);
      refreshData();
    } catch {
      setBackendOnline(false);
      fetchTimetableSchedule(timetableDate);
    }
  }

  // Load timetable data whenever timetable date or booking date changes
  useEffect(() => {
    const targetDate = activeTab === "book" ? bookingDate : timetableDate;
    fetchTimetableSchedule(targetDate);
  }, [timetableDate, bookingDate, activeTab]);

  async function fetchTimetableSchedule(date: string) {
    try {
      const res = await getTimetableBookings(date);
      if (res.success && res.data && res.data.length > 0) {
        setTimetableBookings(res.data);
      } else {
        setTimetableBookings(FALLBACK_TIMETABLE_BOOKINGS);
      }
    } catch {
      setTimetableBookings(FALLBACK_TIMETABLE_BOOKINGS);
    }
  }

  async function refreshData() {
    try {
      setLoading(true);
      const vRes = await getVenues();
      if (vRes.success) setVenues(vRes.data);

      await fetchTimetableSchedule(timetableDate);

      if (currentUser.user_type === "normal") {
        const bRes = await getMyBookings(currentUser.user_id);
        if (bRes.success) setMyBookingsList(bRes.data);
      } else {
        const pRes = await getPendingApprovals();
        if (pRes.success) setPendingQueue(pRes.data);

        const uRes = await getUtilizationReport();
        if (uRes.success) setUtilizationStats(uRes.data);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; isOffline?: boolean };
      if (!errorObj.isOffline) {
        showToast(errorObj.message || "Failed to sync with backend");
      }
    } finally {
      setLoading(false);
    }
  }

  // Refresh bookings when switching users
  useEffect(() => {
    if (currentUser.user_type === "normal") {
      getMyBookings(currentUser.user_id)
        .then((res) => { if (res.success) setMyBookingsList(res.data); })
        .catch(() => {});
    } else {
      getPendingApprovals()
        .then((res) => { if (res.success) setPendingQueue(res.data); })
        .catch(() => {});
      getUtilizationReport()
        .then((res) => { if (res.success) setUtilizationStats(res.data); })
        .catch(() => {});
    }
  }, [currentUser]);

  // Selected Venue Details
  const selectedVenue = useMemo(() => {
    return venues.find((v) => Number(v.venue_id) === Number(selectedVenueId)) || venues[0];
  }, [venues, selectedVenueId]);

  // Relational Division Prerequisite Check for Selected Venue
  const prerequisiteCheck = useMemo(() => {
    if (!selectedVenue || !selectedVenue.required_authorizations) {
      return { eligible: true, missing: [] };
    }
    if (selectedVenue.required_authorizations.length === 0) {
      return { eligible: true, missing: [] };
    }

    const userCredsText = currentUser.credentials.join(" ").toUpperCase();
    const missing = selectedVenue.required_authorizations.filter((req) => {
      return !userCredsText.includes(req.auth_code.toUpperCase());
    });

    return {
      eligible: missing.length === 0,
      missing,
    };
  }, [selectedVenue, currentUser]);

  // One-click free slot booking handoff from Gantt Timetable
  function handleSelectFreeSlot(venueId: number, date: string, start: string, end: string) {
    setSelectedVenueId(venueId);
    setBookingDate(date);
    setStartTime(start);
    setEndTime(end);
    setActiveTab("book");
    const targetVenue = venues.find((v) => Number(v.venue_id) === Number(venueId));
    showToast(`Selected ${targetVenue?.venue_name || "Venue"} (${start} – ${end}). Enter event details to submit.`);
  }

  // Handle User Switching
  function handleSelectUser(targetUser: CampusUser) {
    if (targetUser.user_type === "admin") {
      setShowUserModal(false);
      setAdminCodeInput("");
      setAdminCodeError("");
      setShowAdminCodeModal(true);
    } else {
      setCurrentUser(targetUser);
      if (activeTab.startsWith("admin")) {
        setActiveTab("timetable");
      }
      setShowUserModal(false);
      showToast(`Switched active profile to ${targetUser.name} (${targetUser.role_display})`);
    }
  }

  function handleVerifyAdminCode() {
    if (adminCodeInput.trim() === adminAccessCode) {
      const adminUser = APP_USERS.find((u) => u.user_type === "admin")!;
      setCurrentUser(adminUser);
      if (!activeTab.startsWith("admin") && activeTab !== "timetable") {
        setActiveTab("admin-pending");
      }
      setShowAdminCodeModal(false);
      setShowUserModal(false);
      setAdminCodeInput("");
      setAdminCodeError("");
      showToast("Access Granted: Welcome Dr. A. Ramanathan (Estate Administrator)");
    } else {
      setAdminCodeError("Incorrect Passcode. Verification failed.");
    }
  }

  // Handle Booking Submission
  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault();

    if (!prerequisiteCheck.eligible) {
      showToast(
        `Authorization Denied: Missing mandatory clearance (${prerequisiteCheck.missing.map((m) => m.auth_name).join(", ")})`
      );
      return;
    }

    if (expectedAttendees > selectedVenue.seating_capacity) {
      showToast(
        `Capacity Warning: Expected ${expectedAttendees} attendees exceeds venue capacity of ${selectedVenue.seating_capacity}`
      );
      return;
    }

    const startISO = `${bookingDate}T${startTime}:00+05:30`;
    const endISO = `${bookingDate}T${endTime}:00+05:30`;

    if (new Date(endISO) <= new Date(startISO)) {
      showToast("End time must be after start time.");
      return;
    }

    try {
      setLoading(true);
      const res = await createBooking({
        user_id: currentUser.user_id,
        venue_id: Number(selectedVenueId),
        start_datetime: startISO,
        end_datetime: endISO,
        event_title: eventTitle || "Campus Academic Gathering",
        event_type: eventType,
        expected_attendees: expectedAttendees,
        purpose_notes: purposeNotes,
        club_id: currentUser.role === "CLUB_HEAD" ? 1 : null,
      });

      if (res.success) {
        showToast(`Request Submitted! Ref: ${res.data.booking_ref}. Queued for Admin review.`);
        setEventTitle("");
        setPurposeNotes("");
        setServerConflict(null);
        refreshData();
        setActiveTab("my-bookings");
      }
    } catch (err: unknown) {
      const errorObj = err as {
        message?: string;
        code?: string;
        data?: {
          code?: string;
          error?: string;
          conflict?: any;
        };
      };
      if (errorObj.code === "SLOT_ALREADY_BOOKED" || errorObj.data?.code === "SLOT_ALREADY_BOOKED") {
        const conflict = errorObj.data?.conflict || null;
        setServerConflict(
          conflict || {
            venue_name: selectedVenue.venue_name,
            event_title: "Confirmed Institutional Booking",
            start_datetime: startISO,
            end_datetime: endISO,
            booking_ref: "PERMIT-CONFIRMED",
          }
        );
        showToast("Slot is already booked! Please select another time or venue.");
      } else {
        showToast(errorObj.message || "Failed to submit booking request.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle Booking Cancellation
  async function handleCancelBooking(bookingId: number | string) {
    if (!confirm("Confirm cancellation of this booking request?")) return;
    try {
      setLoading(true);
      const res = await cancelBooking(bookingId, currentUser.user_id);
      if (res.success) {
        showToast("Booking request cancelled.");
        refreshData();
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      showToast(errorObj.message || "Could not cancel booking.");
    } finally {
      setLoading(false);
    }
  }

  // Admin: Inspect Clashes
  async function handleInspectClashes(booking: Booking) {
    setInspectingBooking(booking);
    setClashesLoading(true);
    try {
      const res = await getClashes(booking.booking_id);
      if (res.success) {
        setClashesData(res.competing_requests);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      showToast(errorObj.message || "Could not retrieve clashes.");
    } finally {
      setClashesLoading(false);
    }
  }

  // Admin: Approve Booking
  async function handleConfirmApprove() {
    if (!actionBooking) return;
    try {
      setLoading(true);
      const res = await approveBooking(actionBooking.booking_id, currentUser.user_id, approvalRemarks);
      if (res.success) {
        const rejectedCount = res.cascade_rejected_count || 0;
        showToast(
          `Permit Issued! Booking ${actionBooking.booking_ref} CONFIRMED.${
            rejectedCount > 0 ? ` ${rejectedCount} conflicting request(s) auto-rejected.` : ""
          }`
        );
        setShowApprovalModal(false);
        setActionBooking(null);
        refreshData();
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      showToast(errorObj.message || "Approval transaction failed.");
    } finally {
      setLoading(false);
    }
  }

  // Admin: Reject Booking
  async function handleConfirmReject() {
    if (!actionBooking) return;
    try {
      setLoading(true);
      const res = await rejectBooking(actionBooking.booking_id, currentUser.user_id, rejectionRemarks);
      if (res.success) {
        showToast(`Booking ${actionBooking.booking_ref} rejected with recorded remarks.`);
        setShowRejectionModal(false);
        setActionBooking(null);
        refreshData();
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      showToast(errorObj.message || "Rejection failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex bg-surface text-on-surface font-sans">
        <aside className="hidden md:block w-52 shrink-0 h-screen sticky top-0 z-30 border-r border-outline-variant bg-surface" />
        <div className="flex-1 flex flex-col min-w-0" />
      </div>
    );
  }

  return (
    <m3e-theme color="#C8261E" scheme={theme} variant="vibrant">
      <div className={`min-h-screen flex ${theme === "dark" ? "dark bg-surface-container-lowest" : "bg-surface"} text-on-surface font-sans`}>
        {/* Unified Left Vertical Sidebar */}
        <AppSidebar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={(tab: string) => setActiveTab(tab as ActiveTab)}
          onOpenUserModal={() => setShowUserModal(true)}
          myBookingsCount={myBookingsList.length}
          pendingQueueCount={pendingQueue.length}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Mobile Navigation Trigger (Mobile only) */}
          <div className="md:hidden flex items-center justify-between p-3 border-b border-outline-variant bg-surface shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
              aria-label="Open navigation menu"
            >
              <m3e-icon name="menu" className="text-xl"></m3e-icon>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-on-surface">CampusBook</span>
              <button
                type="button"
                onClick={() => setShowUserModal(true)}
                className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                aria-label={`Switch user (${currentUser.name})`}
                title={`Current: ${currentUser.name}. Tap to switch.`}
              >
                {currentUser.avatar_initials}
              </button>
            </div>
            <div className="w-8" />
          </div>

          {/* Main View Port */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {/* TAB 1: GANTT TIMETABLE MATRIX (Default Home View) */}
            {activeTab === "timetable" && (
              <GanttTimetable
                venues={venues}
                bookings={timetableBookings}
                selectedDate={timetableDate}
                onDateChange={setTimetableDate}
                onSelectFreeSlot={handleSelectFreeSlot}
                loading={loading}
              />
            )}

            {/* TAB 2: BOOK HALL / AUDI */}
            {activeTab === "book" && (
              <BookingForm
                venues={venues}
                currentUser={currentUser}
                selectedVenueId={selectedVenueId}
                setSelectedVenueId={setSelectedVenueId}
                selectedVenue={selectedVenue}
                bookingDate={bookingDate}
                setBookingDate={setBookingDate}
                startTime={startTime}
                setStartTime={setStartTime}
                endTime={endTime}
                setEndTime={setEndTime}
                eventTitle={eventTitle}
                setEventTitle={setEventTitle}
                eventType={eventType}
                setEventType={setEventType}
                expectedAttendees={expectedAttendees}
                setExpectedAttendees={setExpectedAttendees}
                purposeNotes={purposeNotes}
                setPurposeNotes={setPurposeNotes}
                loading={loading}
                onSubmit={handleSubmitBooking}
                prerequisiteCheck={prerequisiteCheck}
                existingBookings={timetableBookings}
                serverConflict={serverConflict}
                onClearServerConflict={() => setServerConflict(null)}
              />
            )}

            {/* TAB 3: VENUES CATALOG */}
            {activeTab === "catalog" && (
              <VenueCatalog
                venues={venues}
                currentUser={currentUser}
                selectedVenueId={selectedVenueId}
                onRequestVenue={(id) => {
                  setSelectedVenueId(id);
                  setActiveTab("book");
                }}
              />
            )}

            {/* TAB 4: MY BOOKINGS */}
            {activeTab === "my-bookings" && (
              <MyBookings
                currentUser={currentUser}
                bookings={myBookingsList}
                onCancelBooking={handleCancelBooking}
                onRefresh={refreshData}
                onNavigateToBook={() => setActiveTab("book")}
                loading={loading}
              />
            )}

            {/* TAB 5: ADMIN PENDING APPROVALS QUEUE */}
            {activeTab === "admin-pending" && currentUser.user_type === "admin" && (
              <AdminQueue
                pendingQueue={pendingQueue}
                inspectingBooking={inspectingBooking}
                clashesData={clashesData}
                clashesLoading={clashesLoading}
                onInspectClashes={handleInspectClashes}
                onCloseClashes={() => setInspectingBooking(null)}
                onOpenApprove={(b) => {
                  setActionBooking(b);
                  setShowApprovalModal(true);
                }}
                onOpenReject={(b) => {
                  setActionBooking(b);
                  setShowRejectionModal(true);
                }}
                showApprovalModal={showApprovalModal}
                showRejectionModal={showRejectionModal}
                actionBooking={actionBooking}
                approvalRemarks={approvalRemarks}
                rejectionRemarks={rejectionRemarks}
                setApprovalRemarks={setApprovalRemarks}
                setRejectionRemarks={setRejectionRemarks}
                onConfirmApprove={handleConfirmApprove}
                onConfirmReject={handleConfirmReject}
                onCancelModal={() => {
                  setShowApprovalModal(false);
                  setShowRejectionModal(false);
                  setActionBooking(null);
                }}
                loading={loading}
              />
            )}

            {/* TAB 6: ADMIN FACILITIES (slot control + venue management) */}
            {activeTab === "admin-venues" && currentUser.user_type === "admin" && (
              <AdminFacilityManager
                venues={venues}
                adminId={currentUser.user_id}
                onRefresh={refreshData}
                notify={showToast}
              />
            )}

            {/* TAB 7: ADMIN UTILIZATION REPORTS */}
            {activeTab === "admin-reports" && currentUser.user_type === "admin" && (
              <AdminReports utilizationStats={utilizationStats} />
            )}

            {/* TAB 8: OPTIONS PAGE */}
            {activeTab === "options" && (
              <OptionsView
                theme={theme}
                onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                onSelectTheme={setTheme}
                onSyncDb={refreshData}
                syncLoading={loading}
                adminPasscode={adminAccessCode}
                onUpdateAdminPasscode={(newCode) => {
                  setAdminAccessCode(newCode);
                  showToast("Administrator passcode updated successfully.");
                }}
              />
            )}
          </main>
        </div>

        {/* User Persona Switcher & Passcode Modal */}
        <UserSwitcherModal
          open={showUserModal}
          currentUser={currentUser}
          onSelectUser={handleSelectUser}
          onClose={() => setShowUserModal(false)}
          showAdminCodeModal={showAdminCodeModal}
          onCloseAdminModal={() => setShowAdminCodeModal(false)}
          adminCodeInput={adminCodeInput}
          setAdminCodeInput={setAdminCodeInput}
          adminCodeError={adminCodeError}
          setAdminCodeError={setAdminCodeError}
          onVerifyAdminCode={handleVerifyAdminCode}
        />

        {/* M3 Native Snackbar Notification */}
        <m3e-snackbar
          open={snackbarOpen}
          dismissible
          duration={5000}
          onclosed={() => setSnackbarOpen(false)}
        >
          {snackbarMessage}
        </m3e-snackbar>
        </div>
    </m3e-theme>
  );
}

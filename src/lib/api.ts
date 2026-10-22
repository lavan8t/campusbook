// CampusBook Frontend API Client Service
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface VenueRequirement {
  auth_id: number;
  auth_code: string;
  auth_name: string;
}

export interface Venue {
  venue_id: number | string;
  venue_name: string;
  venue_type: "AUDITORIUM" | "MINI_AUDITORIUM" | "LECTURE_HALL" | "SEMINAR_HALL";
  building: string;
  floor_number: number;
  seating_capacity: number;
  has_air_conditioning: boolean;
  projector_count: number;
  has_sound_system: boolean;
  has_smart_podium: boolean;
  venue_status: "ACTIVE" | "MAINTENANCE" | "DECOMMISSIONED";
  required_authorizations: VenueRequirement[];
}

export interface Booking {
  booking_id: number | string;
  booking_ref: string;
  venue_id: number | string;
  venue_name?: string;
  venue_type?: string;
  building?: string;
  seating_capacity?: number | string;
  user_id: number | string;
  requester_name?: string;
  requester_email?: string;
  department?: string;
  requester_role?: "ADMIN" | "FACULTY" | "CLUB_HEAD";
  club_name?: string | null;
  event_id?: number | string;
  event_title: string;
  event_type: string;
  expected_attendees?: number;
  start_datetime: string;
  end_datetime: string;
  booking_status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  purpose_notes?: string | null;
  created_at: string;
  updated_at?: string;
  approval_decision?: string;
  admin_remarks?: string;
  decision_datetime?: string;
  competing_pending_count?: number | string;
  confirmed_conflicts_count?: number | string;
}

export interface CompetingClash {
  booking_id: number | string;
  booking_ref: string;
  booking_status: string;
  requester_name: string;
  requester_role: string;
  event_title: string;
  expected_attendees: number;
  start_datetime: string;
  end_datetime: string;
  overlap_hours: string | number;
}

export interface ClashesResponse {
  success: boolean;
  target_booking_id: number;
  conflicts_count: number;
  competing_requests: CompetingClash[];
}

export interface CreateBookingPayload {
  user_id: number;
  venue_id: number;
  start_datetime: string;
  end_datetime: string;
  event_title: string;
  event_type: string;
  description?: string;
  expected_attendees: number;
  club_id?: number | null;
  purpose_notes?: string;
}

export interface UtilizationStat {
  venue_id: string | number;
  venue_name: string;
  venue_type: string;
  seating_capacity: number;
  total_events_hosted: string | number;
  hours_booked: string | number;
  utilization_percentage: string | number;
}

// Helper fetch wrapper
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}: Failed request`) as any;
      err.status = res.status;
      err.code = data.code;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      const offlineErr = new Error("Backend server is offline. Please start it with 'cd backend && bun run dev'.") as any;
      offlineErr.isOffline = true;
      throw offlineErr;
    }
    throw err;
  }
}

// 1. Health check
export async function checkBackendHealth() {
  return apiFetch<{ status: string; service: string; database: string }>("/health");
}

// 2. Venues
export async function getVenues(filters?: { type?: string; min_capacity?: number; has_ac?: boolean }): Promise<{ success: boolean; data: Venue[] }> {
  const query = new URLSearchParams();
  if (filters?.type) query.append("type", filters.type);
  if (filters?.min_capacity) query.append("min_capacity", String(filters.min_capacity));
  if (filters?.has_ac !== undefined) query.append("has_ac", String(filters.has_ac));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return apiFetch(`/venues${queryString}`);
}

export async function getVenueById(id: number | string): Promise<{ success: boolean; data: Venue }> {
  return apiFetch(`/venues/${id}`);
}

export async function getVenueSchedule(id: number | string, start?: string, end?: string) {
  const query = new URLSearchParams();
  if (start) query.append("start", start);
  if (end) query.append("end", end);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{
    success: boolean;
    data: {
      confirmed_bookings: Booking[];
      maintenance_windows: any[];
    };
  }>(`/venues/${id}/schedule${qs}`);
}

// 3. Bookings (Normal Users)
export async function createBooking(payload: CreateBookingPayload): Promise<{ success: boolean; message: string; data: Booking }> {
  return apiFetch("/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyBookings(userId: number): Promise<{ success: boolean; count: number; data: Booking[] }> {
  return apiFetch(`/bookings/my?user_id=${userId}`);
}

export async function cancelBooking(bookingId: number | string, userId: number): Promise<{ success: boolean; message: string; data: Booking }> {
  return apiFetch(`/bookings/${bookingId}`, {
    method: "DELETE",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function getTimetableBookings(date: string): Promise<{ success: boolean; date: string; data: Booking[] }> {
  return apiFetch(`/bookings/timetable?date=${date}`);
}

// 4. Admin Operations
export async function getPendingApprovals(): Promise<{ success: boolean; count: number; data: Booking[] }> {
  return apiFetch("/admin/pending");
}

export async function getClashes(bookingId: number | string): Promise<ClashesResponse> {
  return apiFetch(`/admin/clashes/${bookingId}`);
}

export async function approveBooking(bookingId: number | string, adminId: number, remarks: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: Booking;
    cascade_rejected_count: number;
    cascade_rejected_bookings: any[];
  }>(`/admin/approve/${bookingId}`, {
    method: "POST",
    body: JSON.stringify({ admin_id: adminId, remarks }),
  });
}

export async function rejectBooking(bookingId: number | string, adminId: number, remarks: string) {
  return apiFetch<{ success: boolean; message: string; booking_id: number }>(`/admin/reject/${bookingId}`, {
    method: "POST",
    body: JSON.stringify({ admin_id: adminId, remarks }),
  });
}

export async function getUtilizationReport(): Promise<{ success: boolean; data: UtilizationStat[] }> {
  return apiFetch("/admin/reports/utilization");
}

export async function createVenue(payload: {
  venue_name: string; venue_type: string; building: string; floor_number?: number;
  seating_capacity: number; has_air_conditioning?: boolean; projector_count?: number;
  has_sound_system?: boolean; has_smart_podium?: boolean; required_auth_codes?: string[]; admin_id: number;
}): Promise<{ success: boolean; message: string; data: Venue }> {
  return apiFetch("/admin/venues", { method: "POST", body: JSON.stringify(payload) });
}

export async function setVenueAvailability(
  id: number | string,
  venue_status: string,
  admin_id: number
): Promise<{ success: boolean; message: string; data: Venue }> {
  return apiFetch(`/admin/venues/${id}/availability`, {
    method: "PATCH",
    body: JSON.stringify({ venue_status, admin_id }),
  });
}

export async function scheduleMaintenance(payload: {
  venue_id: number | string; start_datetime: string; end_datetime: string; reason: string; admin_id: number;
}): Promise<{ success: boolean; message: string; data: any }> {
  return apiFetch("/admin/maintenance", { method: "POST", body: JSON.stringify(payload) });
}

export async function listMaintenance(): Promise<{ success: boolean; data: any[] }> {
  return apiFetch("/admin/maintenance");
}

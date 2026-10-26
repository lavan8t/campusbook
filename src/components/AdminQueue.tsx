"use client";

import React, { useEffect } from "react";
import type { Booking, CompetingClash } from "@/lib/api";
import { formatDateDDMMYYYY, formatTimeRailway } from "@/lib/timetableUtils";

import "@m3e/web/dialog";
import "@m3e/web/card";
import "@m3e/web/badge";
import "@m3e/web/chips";
import "@m3e/web/button";
import "@m3e/web/form-field";
import "@m3e/web/textarea-autosize";
import "@m3e/web/icon";
import "@m3e/web/divider";

export interface AdminQueueProps {
  pendingQueue: Booking[];
  inspectingBooking: Booking | null;
  clashesData: CompetingClash[];
  clashesLoading: boolean;
  onInspectClashes: (booking: Booking) => void | Promise<void>;
  onCloseClashes: () => void;
  onOpenApprove: (booking: Booking) => void;
  onOpenReject: (booking: Booking) => void;
  showApprovalModal: boolean;
  showRejectionModal: boolean;
  actionBooking: Booking | null;
  approvalRemarks: string;
  rejectionRemarks: string;
  setApprovalRemarks: React.Dispatch<React.SetStateAction<string>> | ((remarks: string) => void);
  setRejectionRemarks: React.Dispatch<React.SetStateAction<string>> | ((remarks: string) => void);
  onConfirmApprove: () => void | Promise<void>;
  onConfirmReject: () => void | Promise<void>;
  onCancelModal: () => void;
  loading: boolean;
}

export function AdminQueue({
  pendingQueue,
  inspectingBooking,
  clashesData,
  clashesLoading,
  onInspectClashes,
  onCloseClashes,
  onOpenApprove,
  onOpenReject,
  showApprovalModal,
  showRejectionModal,
  actionBooking,
  approvalRemarks,
  rejectionRemarks,
  setApprovalRemarks,
  setRejectionRemarks,
  onConfirmApprove,
  onConfirmReject,
  onCancelModal,
  loading,
}: AdminQueueProps) {
  const clashDialogRef = React.useRef<HTMLElement>(null);
  const approveDialogRef = React.useRef<HTMLElement>(null);
  const rejectDialogRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = clashDialogRef.current as (HTMLElement & { show?: () => void; hide?: () => void; open?: boolean }) | null;
    if (el) {
      if (inspectingBooking) {
        el.open = true;
        el.show?.();
        el.setAttribute("open", "");
      } else {
        el.open = false;
        el.hide?.();
        el.removeAttribute("open");
      }
    }
  }, [inspectingBooking]);

  React.useEffect(() => {
    const el = approveDialogRef.current as (HTMLElement & { show?: () => void; hide?: () => void; open?: boolean }) | null;
    if (el) {
      if (showApprovalModal && actionBooking) {
        el.open = true;
        el.show?.();
        el.setAttribute("open", "");
      } else {
        el.open = false;
        el.hide?.();
        el.removeAttribute("open");
      }
    }
  }, [showApprovalModal, actionBooking]);

  React.useEffect(() => {
    const el = rejectDialogRef.current as (HTMLElement & { show?: () => void; hide?: () => void; open?: boolean }) | null;
    if (el) {
      if (showRejectionModal && actionBooking) {
        el.open = true;
        el.show?.();
        el.setAttribute("open", "");
      } else {
        el.open = false;
        el.hide?.();
        el.removeAttribute("open");
      }
    }
  }, [showRejectionModal, actionBooking]);

  return (
    <div className="bg-surface rounded-lg p-6 sm:p-8 space-y-6">
      {/* Queue Toolbar */}
      <div className="flex justify-end items-center pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant font-medium">Pending Requests:</span>
          <m3e-badge className="font-bold text-xs">{pendingQueue.length}</m3e-badge>
        </div>
      </div>

      {/* Queue Booking List */}
      {pendingQueue.length === 0 ? (
        <div className="p-8 text-center rounded-lg bg-surface-container-low">
          <m3e-icon name="inbox" className="text-3xl text-on-surface-variant mb-2"></m3e-icon>
          <p className="text-sm font-medium text-on-surface">
            Queue is clear! No requests currently awaiting administrative approval.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingQueue.map((b) => {
            const hasConflict = Number(b.competing_pending_count || 0) > 0;
            return (
              <div
                key={b.booking_id}
                className="rounded-lg bg-surface-container-low transition-all"
              >
                <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Booking metadata */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-on-surface">
                        {b.booking_ref}
                      </span>
                      <m3e-chip variant="assist">
                        {b.requester_role}
                      </m3e-chip>
                      {hasConflict ? (
                        <m3e-chip
                          variant="assist"
                          onClick={() => onInspectClashes(b)}
                          className="cursor-pointer"
                        >
                          <m3e-icon slot="icon" name="warning" className="text-error"></m3e-icon>
                          {b.competing_pending_count} Clash Bid(s)
                        </m3e-chip>
                      ) : (
                        <m3e-chip variant="assist">
                          <m3e-icon slot="icon" name="verified" className="text-success"></m3e-icon>
                          Slot Vacant
                        </m3e-chip>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-on-surface-variant">Venue: </span>
                        <span className="font-semibold text-on-surface">{b.venue_name}</span>
                        <span className="text-on-surface-variant text-[11px] block">
                          {b.seating_capacity} seats
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Requester: </span>
                        <span className="font-semibold text-on-surface">{b.requester_name}</span>
                        <span className="text-on-surface-variant text-[11px] block">
                          {b.club_name || b.department || "Academic Department"}
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Requested Time: </span>
                        <span className="font-medium text-on-surface block">
                          {formatDateDDMMYYYY(b.start_datetime)}
                        </span>
                        <span className="text-on-surface-variant text-[11px]">
                          {formatTimeRailway(b.start_datetime)} – {formatTimeRailway(b.end_datetime)}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs pt-1 border-t border-outline-variant">
                      <span className="font-semibold text-on-surface">{b.event_title}</span>
                      <span className="text-on-surface-variant ml-2">
                        ({b.event_type} • {b.expected_attendees} attendees)
                      </span>
                      {b.purpose_notes && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5 italic">
                          &ldquo;{b.purpose_notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Approval/Rejection Action Buttons */}
                  <div className="flex md:flex-col items-center justify-end gap-2 shrink-0">
                    <m3e-button
                      variant="filled"
                      onClick={() => onOpenApprove(b)}
                      className="w-full sm:w-auto"
                    >
                      <m3e-icon slot="icon" name="check_circle"></m3e-icon>
                      Approve
                    </m3e-button>
                    <m3e-button
                      variant="outlined"
                      onClick={() => onOpenReject(b)}
                      className="w-full sm:w-auto"
                    >
                      <m3e-icon slot="icon" name="close"></m3e-icon>
                      Reject
                    </m3e-button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: SLOT CLASH MODAL */}
      <m3e-dialog
        ref={clashDialogRef}
        open={Boolean(inspectingBooking) || undefined}
        dismissible
        onclosed={onCloseClashes}
      >
        <div slot="header" className="flex items-center gap-2">
          <m3e-icon name="warning" className="text-primary text-xl"></m3e-icon>
          <span className="text-base font-bold text-on-surface">
            Slot Clash Analysis: {inspectingBooking?.booking_ref}
          </span>
        </div>
        <div className="space-y-4 py-2">
          <p className="text-xs text-on-surface-variant">
            Overlapping requests competing for {inspectingBooking?.venue_name}
          </p>

          {clashesLoading ? (
            <div className="py-8 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
              <m3e-icon name="sync" className="animate-spin text-primary"></m3e-icon>
              <span>Scanning PostgreSQL GiST range overlaps...</span>
            </div>
          ) : clashesData.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-on-surface bg-surface-container-low rounded-lg flex items-center justify-center gap-2">
              <m3e-icon name="verified" className="text-success"></m3e-icon>
              <span>No overlapping bids detected for this time range.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-on-surface font-medium">
                Found <strong>{clashesData.length}</strong> competing candidate request(s) on this slot:
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {clashesData.map((c) => (
                  <div
                    key={c.booking_id}
                    className="p-3 rounded-lg bg-surface-container-lowest"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-on-surface">
                          {c.booking_ref}: {c.event_title}
                        </div>
                        <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 flex-wrap">
                          <span>
                            Applicant: <strong>{c.requester_name}</strong>
                          </span>
                          <m3e-badge>{c.requester_role}</m3e-badge>
                          <span>• {c.expected_attendees} attendees</span>
                        </div>
                        <div className="text-[10px] text-on-surface-variant">
                          {formatTimeRailway(c.start_datetime)} – {formatTimeRailway(c.end_datetime)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <m3e-badge className="font-bold text-[10px]">
                          {c.overlap_hours}h Overlap
                        </m3e-badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-surface-container text-[11px] text-on-surface-variant flex items-start gap-2 mt-2">
                <m3e-icon name="info" className="text-primary text-sm shrink-0 mt-0.5"></m3e-icon>
                <div>
                  <strong>Automatic Cascade Rule:</strong> Approving {inspectingBooking?.booking_ref}{" "}
                  will grant its official permit and atomically transition these competing bids to{" "}
                  <code>REJECTED</code>.
                </div>
              </div>
            </div>
          )}
        </div>
        <div slot="actions" className="flex justify-end gap-2 w-full pt-2">
          <m3e-button variant="outlined" onClick={onCloseClashes}>
            Dismiss
          </m3e-button>
        </div>
      </m3e-dialog>

      {/* MODAL 2: PERMIT CONFIRMATION MODAL */}
      <m3e-dialog
        ref={approveDialogRef}
        open={(showApprovalModal && Boolean(actionBooking)) || undefined}
        dismissible
        onclosed={onCancelModal}
      >
        <div slot="header" className="flex items-center gap-2">
          <m3e-icon name="verified" className="text-success text-xl"></m3e-icon>
          <span className="text-base font-bold text-on-surface">
            Issue Administrative Permit: {actionBooking?.booking_ref}
          </span>
        </div>
        <div className="space-y-4 py-2">
          <p className="text-xs text-on-surface-variant">
            You are approving <strong>{actionBooking?.event_title}</strong> for{" "}
            <strong>{actionBooking?.venue_name}</strong> on{" "}
            <strong>{formatDateDDMMYYYY(actionBooking?.start_datetime)}</strong> (
            <strong>
              {formatTimeRailway(actionBooking?.start_datetime)} –{" "}
              {formatTimeRailway(actionBooking?.end_datetime)}
            </strong>
            ).
          </p>

          {Number(actionBooking?.competing_pending_count || 0) > 0 && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container flex items-start gap-2.5 text-xs">
              <m3e-icon name="warning" className="text-base shrink-0 mt-0.5">warning</m3e-icon>
              <div className="text-[11px] leading-relaxed">
                <strong>Slot Clash Impact:</strong> Approving this permit will automatically reject{" "}
                <strong>{actionBooking?.competing_pending_count}</strong> competing pending request(s) on this slot via PostgreSQL GiST exclusion.
              </div>
            </div>
          )}

          <m3e-form-field variant="outlined" float-label="always" className="w-full">
            <label slot="label" htmlFor="approval-remarks-input">
              Permit Approval Remarks / Instructions
            </label>
            <textarea
              id="approval-remarks-input"
              rows={2}
              value={approvalRemarks}
              onChange={(e) => {
                const val = (e.target as HTMLTextAreaElement).value;
                (setApprovalRemarks as (val: string) => void)(val);
              }}
              className="w-full bg-transparent text-on-surface text-xs focus:outline-none"
            />
            <m3e-textarea-autosize for="approval-remarks-input" min-rows={2} max-rows={6} />
          </m3e-form-field>
        </div>
        <div slot="actions" className="flex justify-end gap-2 w-full pt-2">
          <m3e-button
            variant="outlined"
            onClick={onCancelModal}
            disabled={loading}
          >
            Cancel
          </m3e-button>
          <m3e-button
            variant="filled"
            onClick={onConfirmApprove}
            disabled={loading}
          >
            {loading ? "Processing..." : "Confirm & Grant Permit"}
          </m3e-button>
        </div>
      </m3e-dialog>

      {/* MODAL 3: REJECTION MODAL */}
      <m3e-dialog
        ref={rejectDialogRef}
        open={(showRejectionModal && Boolean(actionBooking)) || undefined}
        dismissible
        onclosed={onCancelModal}
      >
        <div slot="header" className="flex items-center gap-2">
          <m3e-icon name="cancel" className="text-error text-xl"></m3e-icon>
          <span className="text-base font-bold text-on-surface">
            Reject Booking Request: {actionBooking?.booking_ref}
          </span>
        </div>
        <div className="space-y-4 py-2">
          <p className="text-xs text-on-surface-variant">
            Document reason for rejection for <strong>{actionBooking?.requester_name}</strong> (
            <strong>{actionBooking?.event_title}</strong> on{" "}
            <strong>{formatDateDDMMYYYY(actionBooking?.start_datetime)}</strong>,{" "}
            <strong>
              {formatTimeRailway(actionBooking?.start_datetime)} –{" "}
              {formatTimeRailway(actionBooking?.end_datetime)}
            </strong>
            ).
          </p>

          <m3e-form-field variant="outlined" float-label="always" className="w-full">
            <label slot="label" htmlFor="rejection-remarks-input">
              Rejection Reason / Remarks
            </label>
            <textarea
              id="rejection-remarks-input"
              rows={2}
              value={rejectionRemarks}
              onChange={(e) => {
                const val = (e.target as HTMLTextAreaElement).value;
                (setRejectionRemarks as (val: string) => void)(val);
              }}
              className="w-full bg-transparent text-on-surface text-xs focus:outline-none"
            />
            <m3e-textarea-autosize for="rejection-remarks-input" min-rows={2} max-rows={6} />
          </m3e-form-field>
        </div>
        <div slot="actions" className="flex justify-end gap-2 w-full pt-2">
          <m3e-button
            variant="outlined"
            onClick={onCancelModal}
            disabled={loading}
          >
            Cancel
          </m3e-button>
          <m3e-button
            variant="filled"
            onClick={onConfirmReject}
            disabled={loading}
          >
            {loading ? "Rejecting..." : "Confirm Rejection"}
          </m3e-button>
        </div>
      </m3e-dialog>
    </div>
  );
}

export default AdminQueue;

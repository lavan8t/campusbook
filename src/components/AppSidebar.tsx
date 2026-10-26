"use client";

import React from "react";
import type { CampusUser } from "@/data/schema";

import "@m3e/web/avatar";
import "@m3e/web/badge";
import "@m3e/web/icon-button";
import "@m3e/web/icon";
import "@m3e/web/nav-rail";
import "@m3e/web/nav-bar";

export interface AppSidebarProps {
  currentUser: CampusUser;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenUserModal: () => void;
  myBookingsCount?: number;
  pendingQueueCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

export function AppSidebar({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenUserModal,
  myBookingsCount = 0,
  pendingQueueCount = 0,
  mobileOpen = false,
  onCloseMobile,
}: AppSidebarProps) {
  const isAdmin = currentUser.user_type === "admin";

  const standardNavItems: NavItemDef[] = [
    { id: "timetable", label: "Timetable", icon: "calendar_month" },
    { id: "book", label: "Book Venue", icon: "add_circle" },
    { id: "search", label: "Search", icon: "search" },
    { id: "catalog", label: "Venues", icon: "domain" },
    {
      id: "my-bookings",
      label: "History",
      icon: "history",
      badge: myBookingsCount,
    },
    { id: "options", label: "Options", icon: "settings" },
  ];

  const adminNavItems: NavItemDef[] = [
    {
      id: "admin-pending",
      label: "Pending Approvals",
      icon: "pending_actions",
      badge: pendingQueueCount,
    },
    {
      id: "search",
      label: "Search",
      icon: "search",
    },
    {
      id: "admin-venues",
      label: "All Facilities",
      icon: "meeting_room",
    },
    {
      id: "admin-reports",
      label: "Monthly Reports",
      icon: "analytics",
    },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface border-r border-outline-variant select-none">
      {/* Top Brand Header: CampusBook with user icon directly to the right */}
      <div className="px-4 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-bold tracking-tight text-on-surface truncate">
            CampusBook
          </span>
          <button
            type="button"
            onClick={() => {
              onOpenUserModal();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-[11px] font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer shrink-0"
            aria-label={`Switch user (${currentUser.name})`}
            title={`Current: ${currentUser.name} (${currentUser.role_display}). Tap to switch.`}
          >
            {currentUser.avatar_initials}
          </button>
        </div>

        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Close navigation"
          >
            <m3e-icon name="close"></m3e-icon>
          </button>
        )}
      </div>

      {/* Navigation Rail - left-aligned horizontal layout */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <m3e-nav-rail mode="expanded" className="w-full flex flex-col gap-1">
          {standardNavItems.map((item) => (
            <m3e-nav-item
              key={item.id}
              orientation="horizontal"
              selected={activeTab === item.id}
              onClick={() => handleNavClick(item.id)}
              className="cursor-pointer"
            >
              <m3e-icon slot="icon" name={item.icon}></m3e-icon>
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span>{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <m3e-badge size="small">{item.badge}</m3e-badge>
                )}
              </span>
            </m3e-nav-item>
          ))}

          {isAdmin && (
            <div className="w-full pt-3 mt-1 flex flex-col gap-1">
              <div className="px-3 pb-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Admin
              </div>
              {adminNavItems.map((item) => (
                <m3e-nav-item
                  key={item.id}
                  orientation="horizontal"
                  selected={activeTab === item.id}
                  onClick={() => handleNavClick(item.id)}
                  className="cursor-pointer"
                >
                  <m3e-icon slot="icon" name={item.icon}></m3e-icon>
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <span>{item.label}</span>
                    {Boolean(item.badge && item.badge > 0) && (
                      <m3e-badge size="small">{item.badge}</m3e-badge>
                    )}
                  </span>
                </m3e-nav-item>
              ))}
            </div>
          )}
        </m3e-nav-rail>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar: 30% smaller (w-52) */}
      <aside className="hidden md:block w-52 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-150"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-52 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-150">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

export default AppSidebar;

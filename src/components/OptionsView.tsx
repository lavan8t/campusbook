"use client";

import React, { useState } from "react";

import "@m3e/web/button";
import "@m3e/web/icon";
import "@m3e/web/segmented-button";
import "@m3e/web/form-field";

export interface OptionsViewProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSelectTheme?: (theme: "light" | "dark") => void;
  onSyncDb: () => void;
  syncLoading?: boolean;
  adminPasscode: string;
  onUpdateAdminPasscode: (newPasscode: string) => void;
}

export function OptionsView({
  theme,
  onToggleTheme,
  onSelectTheme,
  onSyncDb,
  syncLoading = false,
  adminPasscode,
  onUpdateAdminPasscode,
}: OptionsViewProps) {
  const [currentCodeInput, setCurrentCodeInput] = useState("");
  const [newCodeInput, setNewCodeInput] = useState("");
  const [confirmCodeInput, setConfirmCodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [passcodeSuccess, setPasscodeSuccess] = useState("");
  const [showCurrentCode, setShowCurrentCode] = useState(false);
  const [showNewCode, setShowNewCode] = useState(false);
  const [showConfirmCode, setShowConfirmCode] = useState(false);

  const handleUpdatePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError("");
    setPasscodeSuccess("");

    if (!currentCodeInput) {
      setPasscodeError("Please enter your current administrator passcode.");
      return;
    }

    if (currentCodeInput.trim() !== adminPasscode) {
      setPasscodeError("Current passcode is incorrect. Verification failed.");
      return;
    }

    if (newCodeInput.trim().length < 4) {
      setPasscodeError("New passcode must be at least 4 characters long.");
      return;
    }

    if (newCodeInput.trim() !== confirmCodeInput.trim()) {
      setPasscodeError("New passcode and confirmation do not match.");
      return;
    }

    onUpdateAdminPasscode(newCodeInput.trim());
    setPasscodeSuccess("Administrator passcode updated successfully!");
    setCurrentCodeInput("");
    setNewCodeInput("");
    setConfirmCodeInput("");
    setShowCurrentCode(false);
    setShowNewCode(false);
    setShowConfirmCode(false);
  };

  const handleChooseTheme = (chosen: "light" | "dark") => {
    if (onSelectTheme) {
      onSelectTheme(chosen);
    } else if (theme !== chosen) {
      onToggleTheme();
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      {/* Section 1: Appearance */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <m3e-icon name="palette" className="text-primary text-base"></m3e-icon>
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Appearance
          </span>
        </div>

        <div className="max-w-xs">
          <m3e-segmented-button className="w-full">
            <m3e-button-segment
              value="light"
              selected={theme === "light"}
              onClick={() => handleChooseTheme("light")}
            >
              <m3e-icon slot="icon" name="light_mode"></m3e-icon>
              Light
            </m3e-button-segment>
            <m3e-button-segment
              value="dark"
              selected={theme === "dark"}
              onClick={() => handleChooseTheme("dark")}
            >
              <m3e-icon slot="icon" name="dark_mode"></m3e-icon>
              Dark
            </m3e-button-segment>
          </m3e-segmented-button>
        </div>
      </section>

      {/* Section 2: Database Sync */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <m3e-icon name="database" className="text-primary text-base"></m3e-icon>
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Database Synchronization
          </span>
        </div>

        <div>
          <m3e-button
            variant="filled"
            onClick={onSyncDb}
            disabled={syncLoading}
            className="text-xs justify-center font-semibold"
          >
            <m3e-icon
              slot="icon"
              name="sync"
              className={syncLoading ? "animate-spin" : ""}
            ></m3e-icon>
            {syncLoading ? "Syncing..." : "Sync DB"}
          </m3e-button>
        </div>
      </section>

      {/* Section 3: Change Passcode */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <m3e-icon name="lock_reset" className="text-primary text-base"></m3e-icon>
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Change Passcode
          </span>
        </div>

        <form onSubmit={handleUpdatePasscode} className="space-y-3.5 max-w-md">
          {passcodeError && (
            <div className="p-2.5 rounded-lg bg-error/10 border border-error/20 text-error text-[11px] flex items-start gap-2">
              <m3e-icon name="error" className="text-sm shrink-0 mt-0.5"></m3e-icon>
              <span>{passcodeError}</span>
            </div>
          )}

          {passcodeSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-start gap-2">
              <m3e-icon name="check_circle" className="text-sm shrink-0 mt-0.5"></m3e-icon>
              <span>{passcodeSuccess}</span>
            </div>
          )}

          <div>
            <m3e-form-field variant="outlined" className="w-full" float-label="always">
              <label slot="label" htmlFor="current-passcode-input">
                Current Passcode
              </label>
              <input
                id="current-passcode-input"
                type={showCurrentCode ? "text" : "password"}
                value={currentCodeInput}
                onChange={(e) => setCurrentCodeInput(e.target.value)}
                className="w-full text-xs bg-transparent text-on-surface focus:outline-none pr-2"
              />
              <button
                type="button"
                slot="suffix"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowCurrentCode((v) => !v);
                }}
                className="flex items-center justify-center p-1 pr-3 text-on-surface-variant hover:text-on-surface transition-colors bg-transparent border-0 focus:outline-none cursor-pointer"
                aria-label={showCurrentCode ? "Hide current passcode" : "Show current passcode"}
                tabIndex={-1}
              >
                <m3e-icon
                  name={showCurrentCode ? "visibility_off" : "visibility"}
                  className="text-lg"
                ></m3e-icon>
              </button>
            </m3e-form-field>
          </div>

          <div>
            <m3e-form-field variant="outlined" className="w-full" float-label="always">
              <label slot="label" htmlFor="new-passcode-input">
                New Passcode
              </label>
              <input
                id="new-passcode-input"
                type={showNewCode ? "text" : "password"}
                value={newCodeInput}
                onChange={(e) => setNewCodeInput(e.target.value)}
                className="w-full text-xs bg-transparent text-on-surface focus:outline-none pr-2"
              />
              <button
                type="button"
                slot="suffix"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowNewCode((v) => !v);
                }}
                className="flex items-center justify-center p-1 pr-3 text-on-surface-variant hover:text-on-surface transition-colors bg-transparent border-0 focus:outline-none cursor-pointer"
                aria-label={showNewCode ? "Hide new passcode" : "Show new passcode"}
                tabIndex={-1}
              >
                <m3e-icon
                  name={showNewCode ? "visibility_off" : "visibility"}
                  className="text-lg"
                ></m3e-icon>
              </button>
            </m3e-form-field>
          </div>

          <div>
            <m3e-form-field variant="outlined" className="w-full" float-label="always">
              <label slot="label" htmlFor="confirm-passcode-input">
                Confirm New Passcode
              </label>
              <input
                id="confirm-passcode-input"
                type={showConfirmCode ? "text" : "password"}
                value={confirmCodeInput}
                onChange={(e) => setConfirmCodeInput(e.target.value)}
                className="w-full text-xs bg-transparent text-on-surface focus:outline-none pr-2"
              />
              <button
                type="button"
                slot="suffix"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowConfirmCode((v) => !v);
                }}
                className="flex items-center justify-center p-1 pr-3 text-on-surface-variant hover:text-on-surface transition-colors bg-transparent border-0 focus:outline-none cursor-pointer"
                aria-label={showConfirmCode ? "Hide confirmation passcode" : "Show confirmation passcode"}
                tabIndex={-1}
              >
                <m3e-icon
                  name={showConfirmCode ? "visibility_off" : "visibility"}
                  className="text-lg"
                ></m3e-icon>
              </button>
            </m3e-form-field>
          </div>

          <div className="flex justify-end pt-1">
            <m3e-button
              type="submit"
              variant="filled"
              className="text-xs px-4 font-semibold"
            >
              Update Passcode
            </m3e-button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default OptionsView;

"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AreaOfCity, LandType, ListingType, SanadRecordType } from "./types";

// What Sanad should do once opened: answer a general question, follow up
// on a specific parcel, carry a request for one straight through, or —
// "admin" — run as Sarj leadership's internal business analyst instead
// of an investor-facing advisor (see src/lib/sanadAdminPrompt.ts). The
// land detail page's two CTAs, the header's nav entry, and the admin
// dashboard's own entry each set this differently — see
// SanadLaunchState below.
export type SanadMode = "inquiry" | "request" | "general" | "admin";

// The state a caller hands Sanad when opening it. parcelId is omitted for
// a general-purpose open (e.g. the header's "Talk to Sanad" entry, which
// has no parcel context to attach).
export interface SanadLaunchState {
  parcelId?: string;
  mode: SanadMode;
}

// What the API route hands back when Gemini decides it's time to show
// the contact form (see the offer_registration_form tool in
// src/app/api/sanad/route.ts) — already reconciled against real parcel
// data server-side, so the client never has to trust the model's own
// guess at land_type/area/budget for a real parcel. Shared (not just
// server-side) because SanadPanel.tsx and SanadContactForm.tsx both need
// its shape.
export interface SanadFormOffer {
  recordType: SanadRecordType;
  parcelId: string | null;
  requestedParcelId: string | null;
  landTypeWanted: LandType | null;
  areaOfCityWanted: AreaOfCity | null;
  prefers: ListingType | null;
  budgetSar: number | null;
}

interface SanadContextValue {
  isOpen: boolean;
  launchState: SanadLaunchState | null;
  openSanad: (state: SanadLaunchState) => void;
  closeSanad: () => void;
}

const SanadContext = createContext<SanadContextValue | null>(null);

// Wraps the app and holds Sanad's open/closed state plus whatever launch
// state the last opener passed in. Mounted once in src/app/layout.tsx,
// alongside LanguageProvider, so any page or the header can call
// useSanad() to open it. Consumed by SanadPanel.tsx.
export function SanadProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [launchState, setLaunchState] = useState<SanadLaunchState | null>(
    null
  );

  const openSanad = useCallback((state: SanadLaunchState) => {
    setLaunchState(state);
    setIsOpen(true);
  }, []);

  const closeSanad = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<SanadContextValue>(
    () => ({ isOpen, launchState, openSanad, closeSanad }),
    [isOpen, launchState, openSanad, closeSanad]
  );

  // createElement instead of JSX: this file is .ts (not .tsx), matching
  // the dictionary-file-plus-provider convention already used for
  // src/lib/i18n.ts.
  return createElement(SanadContext.Provider, { value }, children);
}

// Read Sanad's open/closed state, its current launch state, and the two
// functions that change them, from any Client Component beneath a
// SanadProvider.
export function useSanad(): SanadContextValue {
  const context = useContext(SanadContext);
  if (!context) {
    throw new Error("useSanad must be used within a SanadProvider");
  }
  return context;
}

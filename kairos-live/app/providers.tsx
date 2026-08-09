"use client";

import { PortalProvider } from "@portalsdk/react";
import { portal } from "@/lib/portal";

export function Providers({ children }: { children: React.ReactNode }) {
  return <PortalProvider client={portal}>{children}</PortalProvider>;
}

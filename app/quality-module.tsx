"use client";

import React from "react";
import { QualityModule, type QualityModuleProps } from "@/components/quality-module";

export function QualityModuleApp({
  onNavigate,
  selectedClientId,
  selectedWorkItemId,
}: QualityModuleProps): React.JSX.Element {
  return (
    <QualityModule
      onNavigate={onNavigate}
      selectedClientId={selectedClientId}
      selectedWorkItemId={selectedWorkItemId}
    />
  );
}

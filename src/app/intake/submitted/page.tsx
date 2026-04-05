"use client";

import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";

export default function IntakeSubmittedPage() {
  return (
    <AppShell>
      <div className="px-6 md:px-10 lg:px-12 xl:px-16 py-16 max-w-[800px] mx-auto text-center">
        {/* Success icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mb-6">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">
          Request Submitted Successfully
        </h1>

        {/* Description */}
        <p className="text-[var(--muted-foreground)] mb-2 max-w-md mx-auto">
          Your intake request has been received and creative generation has
          started automatically.
        </p>

        {/* What happens next */}
        <div className="card p-6 text-left max-w-lg mx-auto mt-8 mb-8">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4 uppercase tracking-wider">
            What happens next
          </h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--oneforma-charcoal)] text-white flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  AI researches your target market
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Cultural intelligence, platform demographics, competitive
                  landscape
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--oneforma-charcoal)] text-white flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Creatives are generated and evaluated
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Character photos, multilingual copy, platform-specific layouts
                  — all quality-gated
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--oneforma-charcoal)] text-white flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Marketing manager reviews
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  The marketing team will review the creative package and approve or request refinements
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--oneforma-charcoal)] text-white flex items-center justify-center text-xs font-bold">
                4
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  You{"'"}ll be notified when ready
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Once the marketing manager, designer, and paid media team
                  sign off, you{"'"}ll receive a notification with the final
                  package
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Estimated time */}
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          Estimated processing time: <strong>10-15 minutes</strong>
        </p>

        {/* Back button */}
        <Link
          href="/"
          className="btn-secondary inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </AppShell>
  );
}

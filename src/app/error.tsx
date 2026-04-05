'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">Something went wrong</h2>
        <p className="text-sm text-[#737373] mb-6">An unexpected error occurred. Please try again or contact the marketing team if the issue persists.</p>
        <button onClick={() => reset()} className="btn-primary cursor-pointer px-6 py-2.5">Try Again</button>
      </div>
    </div>
  );
}

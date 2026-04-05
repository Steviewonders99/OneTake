import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-[#E5E5E5] mb-4">404</div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">Page not found</h2>
        <p className="text-sm text-[#737373] mb-6">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
        <Link href="/" className="btn-primary cursor-pointer px-6 py-2.5 inline-block">Back to Dashboard</Link>
      </div>
    </div>
  );
}

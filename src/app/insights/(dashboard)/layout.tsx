import Sidebar from '@/components/Sidebar';

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#f7f7f8]">
        {children}
      </main>
    </div>
  );
}

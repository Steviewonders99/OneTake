"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  ImageIcon,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const pipelineLinks: NavItem[] = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/intake/new", label: "New Request", Icon: PlusCircle },
];

const toolsLinks: NavItem[] = [
  { href: "/assets", label: "Asset Library", Icon: ImageIcon },
  { href: "/admin", label: "Schema Admin", Icon: Settings },
];

function NavSection({
  title,
  links,
  pathname,
}: {
  title: string;
  links: NavItem[];
  pathname: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 px-3">
        {title}
      </p>
      <div className="space-y-1">
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
            >
              <link.Icon size={16} />
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-white border border-[var(--border)] shadow-sm cursor-pointer"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[220px] bg-white border-r border-[var(--border)]
          flex flex-col
          transition-transform duration-200 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <Link href="/" className="cursor-pointer" onClick={() => setMobileOpen(false)}>
              <span className="text-[17px] font-bold tracking-tight text-[var(--foreground)]">
                OneForma
              </span>
              <span className="block text-[11px] font-medium text-[var(--muted-foreground)] mt-0.5">
                Recruitment Intake
              </span>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden cursor-pointer p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pt-5" onClick={() => setMobileOpen(false)}>
          <NavSection title="Pipeline" links={pipelineLinks} pathname={pathname} />
          <NavSection title="Tools" links={toolsLinks} pathname={pathname} />
        </nav>

        {/* Account */}
        <div className="px-4 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
            <span className="text-sm text-[var(--muted-foreground)]">Account</span>
          </div>
        </div>
      </aside>
    </>
  );
}

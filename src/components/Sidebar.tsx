"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  Menu,
  X,
  Users,
  Activity,
  FileCode,
  Palette,
  Wand2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ROLE_NAV: Record<string, { title: string; links: NavItem[] }[]> = {
  admin: [
    {
      title: "Pipeline",
      links: [
        { href: "/", label: "Dashboard", Icon: LayoutDashboard },
        { href: "/intake/new", label: "New Request", Icon: PlusCircle },
      ],
    },
    {
      title: "Admin",
      links: [
        { href: "/admin", label: "Dashboard", Icon: Settings },
        { href: "/admin/users", label: "Users", Icon: Users },
        { href: "/admin/schemas", label: "Schemas", Icon: FileCode },
        { href: "/admin/pipeline", label: "Workers", Icon: Activity },
      ],
    },
  ],
  recruiter: [
    {
      title: "Pipeline",
      links: [
        { href: "/", label: "Dashboard", Icon: LayoutDashboard },
        { href: "/intake/new", label: "New Request", Icon: PlusCircle },
      ],
    },
  ],
  designer: [
    {
      title: "Design",
      links: [
        { href: "/designer", label: "My Campaigns", Icon: Palette },
        { href: "/designer/editor", label: "Seedream Editor", Icon: Wand2 },
      ],
    },
  ],
  viewer: [
    {
      title: "Pipeline",
      links: [{ href: "/", label: "Dashboard", Icon: LayoutDashboard }],
    },
  ],
};

const DEFAULT_NAV: { title: string; links: NavItem[] }[] = [
  {
    title: "Pipeline",
    links: [{ href: "/", label: "Dashboard", Icon: LayoutDashboard }],
  },
];

function NavSection({
  title,
  links,
  pathname,
  collapsed,
}: {
  title: string;
  links: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="mb-5">
      {!collapsed && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5 px-3">
          {title}
        </p>
      )}
      <div className="space-y-0.5">
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={`
                flex items-center gap-2.5 rounded-lg text-sm transition-colors cursor-pointer
                ${collapsed ? "justify-center px-2 py-2.5 mx-1" : "px-3 py-2 mx-1"}
                ${
                  isActive
                    ? "bg-[var(--foreground)] text-white font-medium"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }
              `}
            >
              <link.Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{link.label}</span>}
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
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // Restore collapsed state from localStorage
    const saved = localStorage.getItem("nova-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.role) setRole(data.role);
      })
      .catch(() => {});
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("nova-sidebar-collapsed", String(next));
  };

  const navSections = role ? (ROLE_NAV[role] ?? DEFAULT_NAV) : DEFAULT_NAV;

  const sidebarWidth = collapsed ? "w-[60px]" : "w-[220px]";

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
          fixed top-0 left-0 z-50 h-full ${sidebarWidth} bg-white border-r border-[var(--border)]
          flex flex-col transition-all duration-200 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo + collapse toggle */}
        <div className="px-3 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            {!collapsed ? (
              <Link
                href="/"
                className="cursor-pointer flex-1"
                onClick={() => setMobileOpen(false)}
              >
                <span className="text-[16px] font-bold tracking-tight text-[var(--foreground)]">
                  Nova
                </span>
                <span className="block text-[10px] font-medium text-[var(--muted-foreground)] mt-0.5">
                  OneForma Creative Intelligence
                </span>
              </Link>
            ) : (
              <Link
                href="/"
                className="cursor-pointer mx-auto"
                onClick={() => setMobileOpen(false)}
                title="Nova — OneForma"
              >
                <span className="text-[16px] font-bold text-[var(--foreground)]">
                  N
                </span>
              </Link>
            )}

            {/* Collapse toggle (desktop only) */}
            <button
              onClick={toggleCollapsed}
              className="hidden lg:flex p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>

            {/* Mobile close */}
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
        <nav
          className="flex-1 overflow-y-auto pt-4"
          onClick={() => setMobileOpen(false)}
        >
          {navSections.map((section) => (
            <NavSection
              key={section.title}
              title={section.title}
              links={section.links}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Account */}
        <div className="px-3 py-3 border-t border-[var(--border)]">
          <div
            className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
          >
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
            {!collapsed && (
              <span className="text-xs text-[var(--muted-foreground)]">
                Account
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

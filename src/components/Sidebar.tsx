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
  BarChart3,
  Target,
  Zap,
  Radio,
  Megaphone,
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
      title: "Analytics",
      titleHref: "/insights",
      links: [
        { href: "/insights/command-center", label: "Command Center", Icon: Target },
        { href: "/insights/deep-dive", label: "Deep Dive", Icon: Zap },
        { href: "/insights/channel-intel", label: "Channel Intel", Icon: Radio },
      ],
    },
    {
      title: "Recruiter",
      links: [
        { href: "/recruiter", label: "Recruiter View", Icon: Megaphone },
      ],
    },
    {
      title: "Admin",
      links: [
        { href: "/admin", label: "Dashboard", Icon: Settings },
        { href: "/admin/users", label: "Users", Icon: Users },
        { href: "/admin/schemas", label: "Schemas", Icon: FileCode },
        { href: "/admin/pipeline", label: "Workers", Icon: Activity },
        { href: "/admin/artifacts", label: "Artifacts", Icon: Palette },
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
    {
      title: "Analytics",
      titleHref: "/insights",
      links: [
        { href: "/insights/command-center", label: "Command Center", Icon: Target },
        { href: "/insights/deep-dive", label: "Deep Dive", Icon: Zap },
        { href: "/insights/channel-intel", label: "Channel Intel", Icon: Radio },
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
  titleHref,
  links,
  pathname,
  collapsed,
}: {
  title: string;
  titleHref?: string;
  links: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="mb-5">
      {!collapsed && (
        titleHref ? (
          <Link href={titleHref}
                className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-3 transition-colors cursor-pointer hover:text-[var(--foreground)]"
                style={{ color: pathname === titleHref ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
            {title}
          </Link>
        ) : (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5 px-3">
            {title}
          </p>
        )
      )}
      <div className="space-y-0.5">
        {links.map((link) => {
          // Exact match for parent routes that have children (e.g. /insights)
          // to avoid both parent and child showing as active
          const hasChildren = links.some(
            (other) => other.href !== link.href && other.href.startsWith(link.href + "/")
          );
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : hasChildren
                ? pathname === link.href
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
    const saved = localStorage.getItem("onetake-sidebar-collapsed");
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
    localStorage.setItem("onetake-sidebar-collapsed", String(next));
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
          group/sidebar
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
              <>
                <Link
                  href="/"
                  className="cursor-pointer flex-1 flex items-center gap-2.5"
                  onClick={() => setMobileOpen(false)}
                >
                  <img src="/oneforma-logo.png" alt="OneTake" className="w-7 h-7 object-contain" />
                  <div>
                    <span className="text-[15px] font-bold tracking-tight text-[var(--foreground)]">
                      OneTake
                    </span>
                    <span className="block text-[10px] font-medium text-[var(--muted-foreground)] mt-0.5">
                      OneForma Creative Intelligence
                    </span>
                  </div>
                </Link>
                {/* Collapse toggle */}
                <button
                  onClick={toggleCollapsed}
                  className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-all opacity-0 group-hover/sidebar:opacity-100"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose size={14} />
                </button>
              </>
            ) : (
              /* Collapsed: logo icon is the expand button */
              <button
                onClick={toggleCollapsed}
                className="cursor-pointer mx-auto w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--muted)] transition-colors"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <img src="/oneforma-logo.png" alt="OneTake" className="w-6 h-6 object-contain" />
              </button>
            )}

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
              titleHref={(section as any).titleHref}
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

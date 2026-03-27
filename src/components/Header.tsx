import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Header() {
  return (
    <header
      className="flex items-center justify-between bg-white border-b border-[var(--border)] px-6"
      style={{
        height: 56,
        boxShadow: "var(--shadow-subtle)",
      }}
    >
      <Link href="/" className="flex items-center gap-3 cursor-pointer">
        <span className="text-[var(--foreground)] text-lg font-semibold tracking-tight">
          OneForma
        </span>
        <span className="text-[var(--muted-foreground)] text-sm font-medium">
          Recruitment Intake
        </span>
      </Link>
      <UserButton />
    </header>
  );
}

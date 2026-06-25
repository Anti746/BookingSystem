"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Home,
  UserCircle,
  Settings,
  MessageCircle,
  Waves,
  GraduationCap,
  Menu,
  X,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reservations", label: "Reservations", icon: Calendar },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/instructors", label: "Instructors", icon: Users },
  { href: "/accommodation", label: "Accommodation", icon: Home },
  { href: "/customers", label: "Customers", icon: UserCircle },
  { href: "/chat-demo", label: "Chat Demo", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const logo = (
    <div className="flex items-center gap-3 border-b border-border px-6 py-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <Waves className="h-6 w-6 text-primary-foreground" />
      </div>
      <div>
        <h1 className="font-semibold text-foreground">Surf Wala</h1>
        <p className="text-xs text-muted-foreground">Admin Dashboard</p>
      </div>
    </div>
  );

  const handleLogout = () => {
    document.cookie = "admin_auth=; path=/; max-age=0";
    window.location.href = "/login";
  };

  const footer = (
    <div className="border-t border-border p-4 space-y-2">
      <div className="rounded-lg bg-muted p-3">
        <p className="text-xs font-medium text-foreground">Surf Wala</p>
        <p className="mt-1 text-xs text-muted-foreground">Booking System v1.0</p>
      </div>
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Log out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Waves className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">Surf Wala</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Waves className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Surf Wala</span>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        {logo}
        {nav}
        {footer}
      </aside>
    </>
  );
}

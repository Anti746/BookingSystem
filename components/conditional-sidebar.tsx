"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export function ConditionalSidebar() {
  const pathname = usePathname();
  if (pathname === "/chat-demo" || pathname === "/login") return null;
  return <Sidebar />;
}

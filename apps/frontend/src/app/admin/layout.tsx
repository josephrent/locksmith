"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Key,
  LayoutDashboard,
  Users,
  Briefcase,
  MessageSquare,
  BarChart3,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Jobs", href: "/admin/jobs", icon: Briefcase },
  { name: "Locksmiths", href: "/admin/locksmiths", icon: Users },
  { name: "Messages", href: "/admin/messages", icon: MessageSquare },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-brand-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-900 border-r border-brand-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-brand-800">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-copper-500 rounded-lg flex items-center justify-center">
              <Key className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-display text-xl font-bold text-white block">
                Locksmith
              </span>
              <span className="text-xs text-brand-500">Admin Console</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-copper-500/20 text-copper-400"
                    : "text-brand-400 hover:bg-brand-800 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-brand-800">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 text-brand-400 hover:text-white rounded-lg hover:bg-brand-800 transition-colors"
          >
            <Settings className="w-5 h-5" />
            View Site
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

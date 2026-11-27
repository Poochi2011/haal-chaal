"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Activity, Bell, Heart, Home, Phone, PhoneCall, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useFamily } from "@/lib/useFamily";
import { computeAlerts } from "@/lib/insights";
import { isOnboarded } from "@/lib/store";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calls", label: "Call History", short: "Calls", icon: Phone },
  { href: "/health", label: "Health", icon: Activity },
  { href: "/family", label: "Family", icon: Users },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${light ? "text-white" : "text-ink"}`}>
      <Heart className="h-7 w-7" strokeWidth={2.2} />
      <span className="text-[22px] font-bold tracking-tight">Haal Chaal</span>
    </Link>
  );
}

function Hills() {
  return (
    <svg viewBox="0 0 280 120" className="pointer-events-none absolute bottom-0 left-0 w-full opacity-60" aria-hidden>
      <path d="M0 80 C40 55 70 50 110 68 S180 40 220 58 S260 70 280 60 V120 H0Z" fill="#323c66" />
      <path d="M0 98 C50 80 90 86 130 94 S210 76 280 90 V120 H0Z" fill="#283158" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (!isOnboarded()) router.replace("/welcome"); }, [router]);
  const { family, calls } = useFamily();
  const alertCount = family ? computeAlerts(family, calls).length : 0;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-screen lg:pl-[272px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col overflow-hidden rounded-r-[28px] bg-navy px-5 py-8 lg:flex">
        <div className="px-3"><Logo light /></div>
        <nav className="mt-10 flex flex-col gap-1.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[16px] font-medium transition ${
                active(href) ? "bg-navy-2 text-white shadow-inner" : "text-white/75 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/call"
          className="relative z-10 mt-8 flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-[15px] font-semibold text-navy shadow-lg transition hover:bg-cream"
        >
          <PhoneCall className="h-4.5 w-4.5" /> Start today&apos;s call
        </Link>
        <p className="relative z-10 mt-3 px-2 text-center text-xs leading-relaxed text-white/55">
          Plays the call {family?.callName ?? "your parent"} gets, right here in your browser.
        </p>
        <Hills />
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-cream/90 px-5 pb-3 pt-4 backdrop-blur lg:hidden">
        <Logo />
        <Link href="/" className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-white" aria-label={`${alertCount} alerts`}>
          <Bell className="h-5 w-5 text-ink" />
          {alertCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-alarm ring-2 ring-white" />}
        </Link>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 pb-32 pt-2 sm:px-8 lg:px-12 lg:pb-14 lg:pt-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end">
          {NAV.slice(0, 2).map((n) => <MobileTab key={n.href} {...n} on={active(n.href)} />)}
          <Link href="/call" className="-mt-7 flex flex-col items-center gap-1 text-[12px] font-semibold text-ink">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-leaf text-white shadow-lg ring-4 ring-cream">
              <PhoneCall className="h-6 w-6" />
            </span>
            Call
          </Link>
          {NAV.slice(2).map((n) => <MobileTab key={n.href} {...n} on={active(n.href)} />)}
        </div>
      </nav>
    </div>
  );
}

function MobileTab({ href, label, short, icon: Icon, on }: (typeof NAV)[number] & { on: boolean }) {
  return (
    <Link href={href} className={`mx-1 flex flex-col items-center gap-1 rounded-2xl py-2 text-[12px] font-medium ${on ? "bg-lav-2 text-ink" : "text-muted"}`}>
      <Icon className="h-5.5 w-5.5" />
      {short ?? label}
    </Link>
  );
}

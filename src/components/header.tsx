"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function Header() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="mx-auto flex w-full max-w-5xl items-baseline justify-between gap-6 px-6 py-6">
      <Link href="/" className="font-display text-3xl tracking-tight text-ink">
        Fieldmark
      </Link>
      <nav className="flex items-baseline gap-5 text-[1.02rem]">
        <Link
          href="/"
          className={pathname === "/" ? "text-moss" : "text-dusk hover:text-ink"}
        >
          Identify
        </Link>
        <Link
          href="/log"
          className={pathname === "/log" ? "text-moss" : "text-dusk hover:text-ink"}
        >
          Log
        </Link>
        {isPending ? null : session?.user ? (
          <Link href="/account/settings" className="text-dusk hover:text-ink">
            {session.user.email}
          </Link>
        ) : (
          <Link href="/auth/sign-in" className="text-dusk hover:text-ink">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

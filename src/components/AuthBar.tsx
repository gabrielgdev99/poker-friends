"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

export function AuthBar() {
  const { data, status } = useSession();

  if (status === "loading") {
    return (
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/40">
        …
      </p>
    );
  }

  if (!data?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="border border-amber-200/40 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-500/10"
      >
        Entrar com Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {data.user.isAdmin && (
        <Link
          href="/admin"
          className="text-xs uppercase tracking-wider text-amber-400 hover:text-amber-300"
        >
          Admin
        </Link>
      )}
      {data.user.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.user.image}
          alt=""
          className="h-8 w-8 rounded-full border border-amber-200/30"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="max-w-[10rem] truncate text-sm text-amber-100/80">
        {data.user.name}
      </span>
      <button
        type="button"
        onClick={() => signOut()}
        className="text-xs uppercase tracking-wider text-emerald-200/50 hover:text-amber-200"
      >
        Sair
      </button>
    </div>
  );
}

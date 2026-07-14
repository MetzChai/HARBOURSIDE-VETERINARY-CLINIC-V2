"use client";

import Link from "next/link";
import Image from "next/image";

interface Props {
  href: string;
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
}

export default function HeaderProfileLink({ href, displayName, subtitle, avatarUrl }: Props) {
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 -mr-2 hover:bg-muted/60 transition-colors"
      aria-label="View profile"
    >
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
            unoptimized={avatarUrl.startsWith("http")}
          />
        ) : (
          <span className="text-xs font-bold text-primary">{initial}</span>
        )}
      </div>
      <div className="hidden sm:block text-left min-w-0">
        <p className="text-sm font-medium leading-none truncate max-w-[140px]">{displayName}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </Link>
  );
}

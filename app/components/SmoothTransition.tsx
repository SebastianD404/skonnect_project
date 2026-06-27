"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReactNode } from "react";

export function SmoothLink({ 
  href, 
  children, 
  className = "" 
}: { 
  href: string; 
  children: ReactNode; 
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <Link 
      href={href} 
      onClick={handleClick}
      className={`${className} ${isPending ? "opacity-60" : "opacity-100"} transition-opacity duration-200`}
    >
      {children}
    </Link>
  );
}

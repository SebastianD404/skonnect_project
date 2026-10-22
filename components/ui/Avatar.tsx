"use client";

import { useState } from "react";
import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, alt, size = 40, className = "" }: AvatarProps) {
  const fallbackInitial = alt ? alt.charAt(0).toUpperCase() : "?";

  if (!src) {
    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="font-semibold text-slate-600" style={{ fontSize: size * 0.4 }}>
          {fallbackInitial}
        </span>
      </div>
    );
  }

  return (
    <AvatarImage key={src} src={src} alt={alt} size={size} className={className} fallbackInitial={fallbackInitial} />
  );
}

function AvatarImage({
  src,
  alt,
  size,
  className,
  fallbackInitial,
}: {
  src: string;
  alt: string;
  size: number;
  className: string;
  fallbackInitial: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="font-semibold text-slate-600" style={{ fontSize: size * 0.4 }}>
          {fallbackInitial}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ${className}`}
      style={{ width: size, height: size }}
    >
      {isLoading ? <div className="absolute inset-0 animate-pulse rounded-full bg-slate-200" /> : null}
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes={`${size}px`}
        className={`object-cover transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}

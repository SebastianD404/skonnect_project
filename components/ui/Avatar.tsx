"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
  isUploading?: boolean;
}

function getImageResourceKey(src: string) {
  try {
    const url = new URL(src, "https://skonnect.invalid");
    return `${url.origin}${url.pathname}`;
  } catch {
    return src;
  }
}

export function Avatar({ src, alt, size = 40, className = "", isUploading = false }: AvatarProps) {
  const fallbackInitial = alt ? alt.charAt(0).toUpperCase() : "?";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <AvatarImage src={src} alt={alt} size={size} fallbackInitial={fallbackInitial} />
      ) : (
        <span className="font-semibold text-slate-600" style={{ fontSize: size * 0.4 }}>
          {fallbackInitial}
        </span>
      )}
      {isUploading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-slate-950/45"
          role="status"
          aria-label="Uploading profile picture"
        >
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        </div>
      )}
    </div>
  );
}

function AvatarImage({
  src,
  alt,
  size,
  fallbackInitial,
}: {
  src: string;
  alt: string;
  size: number;
  fallbackInitial: string;
}) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const currentResourceKey = useRef(getImageResourceKey(src));

  useEffect(() => {
    const nextResourceKey = getImageResourceKey(src);
    if (nextResourceKey === currentResourceKey.current) return;

    let isCurrentRequest = true;
    const preloader = new window.Image();
    preloader.decoding = "async";
    preloader.onload = () => {
      if (!isCurrentRequest) return;
      currentResourceKey.current = nextResourceKey;
      setDisplaySrc(src);
      setHasError(false);
    };
    preloader.onerror = () => {
      isCurrentRequest = false;
    };
    preloader.src = src;

    return () => {
      isCurrentRequest = false;
    };
  }, [src]);

  if (hasError) {
    return (
      <span className="font-semibold text-slate-600" aria-label={alt}>
        {fallbackInitial}
      </span>
    );
  }

  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill
      unoptimized
      sizes={`${size}px`}
      decoding="async"
      className="rounded-full object-cover"
      onError={(event) => {
        event.currentTarget.onerror = null;
        setHasError(true);
      }}
    />
  );
}

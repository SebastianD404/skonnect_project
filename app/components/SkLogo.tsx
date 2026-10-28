import Image from "next/image";

type SkLogoProps = {
  className: string;
};

export function SkLogo({ className }: SkLogoProps) {
  return (
    <Image
      src="/SK%20LOGO.svg"
      alt=""
      width={48}
      height={48}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

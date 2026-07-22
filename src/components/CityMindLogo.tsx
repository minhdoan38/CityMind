import Image from "next/image";

import { cn } from "@/lib/utils";

type CityMindLogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export default function CityMindLogo({
  className,
  size = 32,
  priority = false,
}: CityMindLogoProps) {
  return (
    <Image
      src="/logo_citymind.svg"
      alt="CityMind AI"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0", className)}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import {
  getCachedThumbnailUrl,
  loadEvidenceThumbnail,
} from "@/lib/evidence-thumbnail-cache";
import { cn } from "@/lib/utils";

import CategoryIcon from "./category-icon";

type Props = {
  reportId: string;
  evidencePath?: string | null;
  category?: string;
  className?: string;
  /** Defer network fetch until the thumbnail enters the viewport (table rows). */
  deferLoad?: boolean;
};

export default function ReportThumbnail({
  reportId,
  evidencePath,
  category,
  className,
  deferLoad = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(!deferLoad);
  const [imageSrc, setImageSrc] = useState<string | null>(() =>
    getCachedThumbnailUrl(reportId),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deferLoad || !evidencePath) return;
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [deferLoad, evidencePath]);

  useEffect(() => {
    if (!evidencePath || !inView || failed) return;

    const cached = getCachedThumbnailUrl(reportId);
    if (cached) {
      setImageSrc(cached);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    void loadEvidenceThumbnail(reportId, controller.signal)
      .then((url) => {
        if (!url) {
          setFailed(true);
          return;
        }
        setImageSrc(url);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [evidencePath, failed, inView, reportId]);

  const showImage = Boolean(imageSrc) && !failed;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40",
        loading && "skeleton-shimmer animate-none",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc ?? undefined}
          alt=""
          decoding="async"
          className={cn(
            "size-full object-cover transition-opacity duration-200 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
            loading ? "opacity-0" : "opacity-100",
          )}
          onError={() => setFailed(true)}
        />
      ) : (
        <CategoryIcon category={category} className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

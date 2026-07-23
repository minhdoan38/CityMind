import {
  AlertTriangle,
  Ban,
  Droplets,
  FileText,
  Lamp,
  Paintbrush,
  Trash2,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  pothole: AlertTriangle,
  flooding: Droplets,
  waste: Trash2,
  streetlight: Lamp,
  graffiti: Paintbrush,
  obstruction: Ban,
  other: FileText,
};

export default function CategoryIcon({
  category,
  className,
}: {
  category?: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category?.toLowerCase() ?? ""] ?? FileText;
  return <Icon className={className} aria-hidden />;
}

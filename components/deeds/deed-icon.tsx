import { FileHeart, FilePen, FileSignature, Gift, Handshake, KeyRound, MapPinned, ScrollText, Store, type LucideIcon } from "lucide-react";

import type { DeedType } from "@/lib/deed-types";

export const deedIcons: Record<DeedType, LucideIcon> = {
  sale: FileSignature,
  agreement_to_sell: Handshake,
  gift: Gift,
  release: FileHeart,
  partition: MapPinned,
  will: ScrollText,
  lease: Store,
  rent: KeyRound,
  other: FilePen,
};

export function DeedIcon({ type, className }: { type: DeedType; className?: string }) {
  const Icon = deedIcons[type];
  return <Icon className={className} />;
}

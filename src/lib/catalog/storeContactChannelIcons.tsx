import { ExternalLink, Globe, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { siFacebook, siInstagram, siTiktok, siWhatsapp } from "simple-icons";

import type { StoreContactChannelType } from "@/app/[locale]/(app)/stores/_components/share/StoreContactChannelList";

function SimpleIconSvg({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/**
 * Returns the React node icon matching a contact channel type.
 * Uses simple-icons for brand glyphs (Instagram, WhatsApp, Facebook, TikTok)
 * and Lucide for generic ones (mail, phone, globe).
 */
export function getStoreContactChannelIcon(type: StoreContactChannelType, size = 14): ReactNode {
  switch (type) {
    case "INSTAGRAM":
      return <SimpleIconSvg path={siInstagram.path} size={size} />;
    case "WHATSAPP":
      return <SimpleIconSvg path={siWhatsapp.path} size={size} />;
    case "FACEBOOK":
      return <SimpleIconSvg path={siFacebook.path} size={size} />;
    case "TIKTOK":
      return <SimpleIconSvg path={siTiktok.path} size={size} />;
    case "EMAIL":
      return <Mail size={size} aria-hidden="true" />;
    case "PHONE":
      return <Phone size={size} aria-hidden="true" />;
    case "WEBSITE":
      return <Globe size={size} aria-hidden="true" />;
    case "OTHER":
    default:
      return <ExternalLink size={size} aria-hidden="true" />;
  }
}

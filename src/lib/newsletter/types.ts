export type NewsletterSectionType = "arrivals" | "service_tip" | "event" | "offer";

export interface ArrivalsSection {
  type: "arrivals";
  title: string;
  body: string;
  vehicles?: string[];
}

export interface ServiceTipSection {
  type: "service_tip";
  title: string;
  tip: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface EventSection {
  type: "event";
  eventKey: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  rsvpDeadline?: string;
}

export interface OfferSection {
  type: "offer";
  title: string;
  body: string;
  ctaText: string;
  expiresOn?: string;
}

export type NewsletterSection =
  | ArrivalsSection
  | ServiceTipSection
  | EventSection
  | OfferSection;

export interface Newsletter {
  id: string;
  dealership_id: string;
  subject: string;
  preview_text: string | null;
  sections: NewsletterSection[];
  status: "draft" | "sending" | "sent";
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
  updated_at: string;
}

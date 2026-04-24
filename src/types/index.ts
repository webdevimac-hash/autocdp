// ============================================================
// AutoCDP — Shared TypeScript Types
// ============================================================

export type { Json } from "./supabase";

// ── Database row types ────────────────────────────────────────

export interface Dealership {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  logo_url: string | null;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  phone: string | null;
  hours: Record<string, string>;
  settings: Record<string, Json>;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDealership {
  id: string;
  user_id: string;
  dealership_id: string;
  role: "owner" | "admin" | "member";
  invited_by: string | null;
  created_at: string;
}

export type LifecycleStage = "prospect" | "active" | "at_risk" | "lapsed" | "vip";

export interface Customer {
  id: string;
  dealership_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  tags: string[];
  lifecycle_stage: LifecycleStage;
  total_visits: number;
  total_spend: number;
  last_visit_date: string | null;
  metadata: Record<string, Json>;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  dealership_id: string;
  customer_id: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  service_type: string | null;
  service_notes: string | null;
  technician: string | null;
  ro_number: string | null;
  total_amount: number | null;
  visit_date: string;
  created_at: string;
}

export type CampaignChannel = "sms" | "email" | "direct_mail" | "multi_channel";
export type CampaignStatus = "draft" | "scheduled" | "active" | "completed" | "paused";

export interface CampaignStats {
  targeted: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue_attributed: number;
}

export interface Campaign {
  id: string;
  dealership_id: string;
  name: string;
  description: string | null;
  channel: CampaignChannel;
  status: CampaignStatus;
  target_segment: Record<string, Json>;
  message_template: string | null;
  ai_instructions: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  stats: CampaignStats;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CommunicationChannel = "sms" | "email" | "direct_mail";
export type CommunicationStatus =
  | "pending" | "queued" | "sent" | "delivered"
  | "opened" | "clicked" | "converted" | "bounced" | "failed";

export interface Communication {
  id: string;
  dealership_id: string;
  customer_id: string;
  campaign_id: string | null;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  subject: string | null;
  content: string;
  ai_generated: boolean;
  provider_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

export type AgentType =
  | "orchestrator" | "data" | "targeting" | "creative" | "optimization";

export interface AgentRun {
  id: string;
  dealership_id: string;
  agent_type: AgentType;
  campaign_id: string | null;
  status: "running" | "completed" | "failed";
  input_tokens: number;
  output_tokens: number;
  duration_ms: number | null;
  input_summary: string | null;
  output_summary: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface GlobalLearning {
  id: string;
  pattern_type: string;
  pattern_data: Record<string, Json>;
  description: string | null;
  confidence: number;
  sample_size: number;
  region: string | null;
  vehicle_segment: string | null;
  created_at: string;
  updated_at: string;
}

// ── Direct Mail types ─────────────────────────────────────────

export type MailTemplateType = "postcard_6x9" | "letter_6x9" | "letter_8.5x11";

export type MailPieceStatus =
  | "pending"
  | "processing"
  | "in_production"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled"
  | "error";

export interface MailPiece {
  id: string;
  dealership_id: string;
  customer_id: string;
  campaign_id: string | null;
  template_type: MailTemplateType;
  personalized_text: string;
  variables: {
    vehicle?: string;
    service_type?: string;
    offer?: string;
    technician?: string;
    mileage?: number;
    [key: string]: Json | undefined;
  };
  qr_code_url: string | null;
  qr_image_data_url: string | null;
  postgrid_mail_id: string | null;
  postgrid_order_id: string | null;
  postgrid_status: string | null;
  postgrid_pdf_url: string | null;
  status: MailPieceStatus;
  is_test: boolean;
  cost_cents: number;
  estimated_delivery: string | null;
  scanned_count: number;
  first_scanned_at: string | null;
  last_scanned_at: string | null;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
}

export interface MailScan {
  id: string;
  mail_piece_id: string;
  dealership_id: string;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  scanned_at: string;
}

// ── Agent types ───────────────────────────────────────────────

export interface AgentContext {
  dealershipId: string;
  dealershipName: string;
  campaignId?: string;
}

export interface CustomerSegment {
  filters: {
    lifecycle_stage?: LifecycleStage[];
    min_visits?: number;
    max_days_since_visit?: number;
    tags?: string[];
    min_spend?: number;
  };
  estimated_size?: number;
}

export interface PersonalizedMessage {
  customerId: string;
  channel: CommunicationChannel;
  subject?: string;
  content: string;
  reasoning: string;
  confidence: number;
}

// send_direct_mail Anthropic tool input/output shapes
export interface SendDirectMailToolInput {
  customer_id: string;
  template_type: MailTemplateType;
  personalized_text: string;
  variables?: Record<string, Json>;
  accent_color?: "indigo" | "yellow" | "orange" | "pink" | "green";
  highlight_offer?: boolean;
}

export interface SendDirectMailToolResult {
  success: boolean;
  mail_piece_id?: string;
  postgrid_id?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  cost_cents?: number;
  message: string;
  error?: string;
}

// send_sms Anthropic tool shapes
export interface SendSmsToolInput {
  customer_id: string;
  message: string;
}

export interface SendSmsToolResult {
  success: boolean;
  communication_id?: string;
  provider_id?: string;
  message: string;
  error?: string;
}

// send_email Anthropic tool shapes
export interface SendEmailToolInput {
  customer_id: string;
  subject: string;
  body_html: string;
}

export interface SendEmailToolResult {
  success: boolean;
  communication_id?: string;
  provider_id?: string;
  message: string;
  error?: string;
}

// Campaign type (standard vs aged inventory)
export type CampaignType = "standard" | "aged_inventory";

// Vehicle interest extracted from visit history
export interface CustomerVehicleInterest {
  customerId: string;
  makes: string[];
  models: string[];
  colors: string[];
  primaryMake: string | null;
  primaryModel: string | null;
}

// Aged inventory vehicle matched to a customer
export interface AgedInventoryMatch {
  vehicle: InventoryVehicle;
  customerId: string;
  matchStrength: "perfect" | "strong" | "partial";
  matchReasons: string[];
}

// Inventory
export interface InventoryVehicle {
  id: string;
  dealership_id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  color: string | null;
  mileage: number | null;
  condition: "new" | "used" | "certified" | null;
  price: number | null;
  days_on_lot: number;
  status: "available" | "sold" | "reserved" | "pending";
  metadata: Record<string, Json>;
  created_at: string;
  updated_at: string;
}

// Conquest lead
export interface ConquestLead {
  id: string;
  dealership_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: Record<string, string> | null;
  vehicle_interest: string | null;
  source: string;
  score: number;
  status: "new" | "contacted" | "converted" | "disqualified";
  notes: string | null;
  metadata: Record<string, Json>;
  created_at: string;
  updated_at: string;
}

// ── Billing types ─────────────────────────────────────────────

export type BillingEventType =
  | "agent_run" | "sms_sent" | "email_sent" | "mail_piece_sent" | "api_call";

export interface BillingEvent {
  id: string;
  dealership_id: string;
  event_type: BillingEventType;
  quantity: number;
  unit_cost_cents: number;
  metadata: Record<string, Json>;
  billed_at: string | null;
  created_at: string;
}

// ── UI helpers ────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface StatsCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: string;
}

export interface OnboardingData {
  websiteUrl: string;
  dealershipName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

// ── DMS Integration types ────────────────────────────────────

export type DmsProviderName =
  | "cdk_fortellis"
  | "reynolds"
  | "vinsolutions"
  | "vauto"
  | "seven_hundred_credit"
  | "general_crm";

export interface DmsConnection {
  id: string;
  dealership_id: string;
  provider: DmsProviderName;
  status: "pending" | "active" | "error" | "disconnected";
  encrypted_tokens: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SyncJob {
  id: string;
  dealership_id: string;
  connection_id: string;
  provider: DmsProviderName;
  job_type: "full" | "delta";
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  records_synced: {
    customers: number;
    visits: number;
    inventory: number;
  };
  error: string | null;
  cursor: string | null;
}

export interface SyncLog {
  id: string;
  job_id: string;
  level: "info" | "warn" | "error";
  message: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

// ── Supabase Database type (generated) ───────────────────────
export type { Database } from "./supabase";

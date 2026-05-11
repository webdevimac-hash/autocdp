"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Home as HomeIcon,
  Sparkles,
  Car,
  CreditCard,
  Wrench,
  CheckCircle2,
  FileText,
  Globe,
  ArrowUpRight,
  X,
  Minus,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  PhoneCall,
  Mail as MailIcon,
  MessageCircle,
  Video,
  ClipboardList,
  CalendarClock,
  StickyNote,
  ListChecks,
  Trophy,
  XCircle,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ----- Types ----------------------------------------------------------------

export interface CustomerDetailData {
  id: string;
  first_name: string;
  last_name: string;
  store?: string;
  stage?: string; // "Lead" | "Customer" | etc.
  customer_number?: string;
  phones?: { label: string; value: string }[];
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  vehicle_of_interest?: string;
  campaign_source?: string;
  best_contact_method?: "phone" | "email" | "text" | "video";
  best_contact_value?: string;
  genius_summary?: string | null; // null if not yet generated
  wish_list?: string[];
  details?: {
    sales_1?: { name: string; initials: string };
    sales_2?: { name: string; initials: string } | null;
    bdc?: { name: string; initials: string } | null;
    service_bdc?: { name: string; initials: string } | null;
  };
  open_deal?: {
    status: string; // "Lead" | "Proposal" | "Sold" | ...
    status_subtext?: string;
    interested?: string;
    trade_in?: string | null;
    source?: string;
    date_created?: string;
  };
  garage?: { year: number; make: string; model: string; owned_since?: string }[];
  planned_tasks?: TimelineItem[];
  past_activity?: TimelineItem[];
}

export interface TimelineItem {
  id: string;
  type:
    | "note"
    | "text"
    | "call"
    | "email"
    | "video"
    | "task"
    | "appt"
    | "system";
  author?: string;
  author_initials?: string;
  timestamp: string; // pre-formatted, e.g. "Today at 1:52 PM"
  title: string;
  body?: string;
  channel_detail?: string; // e.g. phone number that received text
}

interface CustomerDetailPanelProps {
  customer: CustomerDetailData;
  /** Called when user closes (X) or clicks outside. */
  onClose: () => void;
  /** Called when user minimises to taskbar. (Optional — wire later.) */
  onMinimize?: () => void;
}

// ----- Component ------------------------------------------------------------

export function CustomerDetailPanel({
  customer,
  onClose,
  onMinimize,
}: CustomerDetailPanelProps) {
  const fullName = `${customer.first_name} ${customer.last_name}`;
  const initials =
    `${customer.first_name?.[0] ?? ""}${customer.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      {/* Two-card panel: summary rail (left) + workspace (right).
          Clicking the backdrop closes; clicking inside does not. */}
      <div
        className="flex h-full w-full max-w-[1180px] gap-3 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <SummaryRail customer={customer} />
        <Workspace
          customer={customer}
          fullName={fullName}
          initials={initials}
          onClose={onClose}
          onMinimize={onMinimize}
        />
      </div>
    </div>
  );
}

// ----- Left: summary rail ---------------------------------------------------

function SummaryRail({ customer }: { customer: CustomerDetailData }) {
  const fullName = `${customer.first_name} ${customer.last_name}`;
  const initials =
    `${customer.first_name?.[0] ?? ""}${customer.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
      {/* Identity header */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <Avatar className="h-11 w-11 bg-emerald-100 ring-2 ring-emerald-200">
          <AvatarFallback className="bg-emerald-100 font-semibold text-emerald-700">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold text-slate-900">
            {fullName}
          </div>
          {customer.store && (
            <div className="truncate text-xs text-slate-500">
              {customer.store}
            </div>
          )}
        </div>
        <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <span className="text-lg leading-none">⋮</span>
        </button>
      </div>

      {/* Contact rows */}
      <div className="space-y-2 px-5 text-sm">
        {customer.phones?.map((p) => (
          <ContactRow
            key={p.label + p.value}
            icon={p.label === "Home" ? <HomeIcon className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
            label={p.label}
            value={p.value}
          />
        ))}
        {customer.email && (
          <ContactRow
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Home"
            value={customer.email}
          />
        )}
        {customer.address && (
          <ContactRow
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Address"
            value={
              <>
                <div>{customer.address.street}</div>
                <div>
                  {customer.address.city}
                  {customer.address.city && customer.address.state && ", "}
                  {customer.address.state} {customer.address.zip}
                </div>
              </>
            }
          />
        )}
      </div>

      <Separator />

      {/* Genius Summary — AI */}
      <CollapsibleSection
        title="Genius Summary"
        defaultOpen
        actionIcon={<Sparkles className="h-3.5 w-3.5" />}
      >
        {customer.genius_summary ? (
          <p className="text-sm leading-relaxed text-slate-700">
            {customer.genius_summary}
          </p>
        ) : (
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50 to-fuchsia-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100">
            <Sparkles className="h-4 w-4" />
            Generate Summary
          </button>
        )}
      </CollapsibleSection>

      <Separator />

      {/* Wish List */}
      <CollapsibleSection
        title="Wish List"
        rightLabel={
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <button className="text-indigo-600 hover:underline">Add</button>
            <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
              {customer.wish_list?.length ?? 0}
            </Badge>
          </span>
        }
      >
        {customer.wish_list && customer.wish_list.length > 0 ? (
          <ul className="space-y-1 text-sm text-slate-700">
            {customer.wish_list.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <Car className="h-3.5 w-3.5 text-slate-400" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-sm text-slate-400">
            No Vehicles Currently
          </p>
        )}
      </CollapsibleSection>

      <Separator />

      {/* Best Contact Method — radial visual */}
      <CollapsibleSection title="Best Contact Method">
        <div className="flex items-center gap-4">
          <ContactMethodRadial method={customer.best_contact_method ?? "text"} />
          <div className="flex flex-col gap-1">
            <Badge className="w-fit gap-1 bg-sky-100 text-sky-700 hover:bg-sky-100">
              <MessageCircle className="h-3 w-3" />
              {labelForMethod(customer.best_contact_method ?? "text")}
            </Badge>
            <div className="text-sm text-slate-600">
              {customer.best_contact_value ?? customer.phones?.[0]?.value}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <Separator />

      {/* Details: assigned team */}
      <CollapsibleSection title="Details" defaultOpen>
        <div className="space-y-2 text-sm">
          <DetailRow
            label="Sales 1"
            value={customer.details?.sales_1}
            fallback={<button className="text-indigo-600 hover:underline">Add</button>}
          />
          <DetailRow
            label="Sales 2"
            value={customer.details?.sales_2}
            fallback={<button className="text-indigo-600 hover:underline">Add</button>}
          />
          <DetailRow
            label="BDC"
            value={customer.details?.bdc}
            fallback={<button className="text-indigo-600 hover:underline">Add</button>}
          />
          <DetailRow
            label="Service BDC"
            value={customer.details?.service_bdc}
            fallback={<button className="text-indigo-600 hover:underline">Add</button>}
          />
          {customer.customer_number && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Customer #</span>
              <span className="font-mono text-slate-700">
                {customer.customer_number}
              </span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <Separator />

      {/* Open Deal */}
      {customer.open_deal && (
        <>
          <CollapsibleSection title="Open Deal" defaultOpen>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  {customer.open_deal.status}
                </Badge>
                {customer.open_deal.status_subtext && (
                  <span className="text-xs text-slate-500">
                    {customer.open_deal.status_subtext}
                  </span>
                )}
              </div>
              {customer.open_deal.interested && (
                <DealRow icon={<Car className="h-3.5 w-3.5" />} label="Interested" value={customer.open_deal.interested} />
              )}
              <DealRow
                icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                label="Trade-in"
                value={customer.open_deal.trade_in ?? "Add"}
                muted={!customer.open_deal.trade_in}
              />
              {customer.open_deal.source && (
                <DealRow icon={<Globe className="h-3.5 w-3.5" />} label="Source" value={customer.open_deal.source} />
              )}
              {customer.open_deal.date_created && (
                <DealRow
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Date Created"
                  value={customer.open_deal.date_created}
                />
              )}
            </div>
          </CollapsibleSection>
          <Separator />
        </>
      )}

      {/* Garage */}
      <CollapsibleSection
        title="Garage"
        rightLabel={
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <button className="text-indigo-600 hover:underline">Add</button>
            <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
              {customer.garage?.length ?? 0}
            </Badge>
          </span>
        }
        defaultOpen
      >
        {customer.garage?.length ? (
          <ul className="space-y-2 text-sm">
            {customer.garage.map((v, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">
                  <Car className="h-4 w-4 text-slate-500" />
                </div>
                <div className="leading-tight">
                  <div className="font-medium text-slate-800">
                    {v.year} {v.make} {v.model}
                  </div>
                  {v.owned_since && (
                    <div className="text-xs text-slate-500">
                      Owned Since {v.owned_since}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-sm text-slate-400">
            No vehicles in garage
          </p>
        )}
      </CollapsibleSection>

      <Separator />

      {/* Customer Notes */}
      <CollapsibleSection
        title="Customer Notes"
        rightLabel={
          <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
            0
          </Badge>
        }
        defaultOpen
      >
        <input
          placeholder="Add a note"
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </CollapsibleSection>

      <div className="h-3" />
    </aside>
  );
}

// ----- Right: workspace -----------------------------------------------------

const TABS = [
  { id: "activity", label: "Activity" },
  { id: "conversation", label: "Conversation" },
  { id: "open", label: "Open" },
  { id: "deals", label: "Deals" },
  { id: "value", label: "Value" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const COMPOSERS = [
  { id: "note", label: "NOTE", icon: StickyNote },
  { id: "call", label: "CALL", icon: PhoneCall },
  { id: "email", label: "EMAIL", icon: MailIcon },
  { id: "text", label: "TEXT", icon: MessageCircle },
  { id: "video", label: "VIDEO", icon: Video },
  { id: "task", label: "TASK", icon: ClipboardList },
  { id: "appt", label: "APPT", icon: CalendarClock },
] as const;

type ComposerId = (typeof COMPOSERS)[number]["id"];

function Workspace({
  customer,
  fullName,
  initials,
  onClose,
  onMinimize,
}: {
  customer: CustomerDetailData;
  fullName: string;
  initials: string;
  onClose: () => void;
  onMinimize?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("activity");
  const [composer, setComposer] = useState<ComposerId>("note");
  const [draft, setDraft] = useState("");

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-2 ring-emerald-200">
            <AvatarFallback className="bg-emerald-500 text-lg font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{fullName}</h2>
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {customer.store && (
                <span className="flex items-center gap-1">
                  <HomeIcon className="h-3 w-3" />
                  {customer.store}
                </span>
              )}
              {customer.stage && <span>{customer.stage}</span>}
              {customer.phones?.[0] && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phones[0].value}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {customer.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {customer.vehicle_of_interest && (
              <span className="flex items-center gap-1">
                <Car className="h-3 w-3" />
                {customer.vehicle_of_interest}
              </span>
            )}
            {customer.customer_number && (
              <span className="text-slate-600">
                Customer:&nbsp;#{customer.customer_number}
              </span>
            )}
          </div>
          {customer.campaign_source && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Campaign / {customer.campaign_source}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tabs row */}
      <div className="flex items-center gap-6 border-b border-slate-100 px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "relative py-3 text-sm font-medium transition-colors",
              activeTab === t.id
                ? "text-emerald-600"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-emerald-500" />
            )}
          </button>
        ))}
      </div>

      {/* Body: two columns — main timeline + actions sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Composer */}
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-6 text-xs font-semibold tracking-wider">
              {COMPOSERS.map((c) => {
                const Icon = c.icon;
                const isActive = composer === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setComposer(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-1 pb-2 pt-1 transition-colors",
                      isActive
                        ? "border-emerald-500 text-emerald-600"
                        : "border-transparent text-slate-400 hover:text-slate-600",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg bg-amber-50/60 ring-1 ring-amber-100">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholderFor(composer)}
                rows={3}
                className="w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2 border-t border-amber-100 px-3 py-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Draft
                </Button>
                <Button
                  size="sm"
                  disabled={!draft.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* PLANNED divider */}
          <div className="px-6 pt-5">
            <SectionDivider label="PLANNED" tone="indigo" />
          </div>

          {/* Planned tasks */}
          <div className="space-y-2 px-6 py-3">
            {customer.planned_tasks?.length ? (
              customer.planned_tasks.map((t) => (
                <PlannedTaskCard key={t.id} item={t} />
              ))
            ) : (
              <EmptyHint text="No upcoming tasks." />
            )}
          </div>

          {/* PAST divider */}
          <div className="px-6 pt-3">
            <SectionDivider label="PAST" tone="slate" />
          </div>

          {/* Past activity tab strip */}
          <div className="flex items-center gap-5 border-b border-slate-100 px-6 pt-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            <FilterPill label={`All ${customer.past_activity?.length ?? 0}`} active />
            <FilterPill label="Tasks 0" />
            <FilterPill label="Appts 0" />
            <FilterPill label={`Notes ${countByType(customer.past_activity, "note")}`} />
            <FilterPill label="Service 0" />
            <FilterPill label="Proposals 0" />
            <FilterPill label="3rd Party 0" />
            <FilterPill label="Logs 34" />
          </div>

          {/* Past activity */}
          <div className="space-y-4 px-6 py-4 pb-8">
            {customer.past_activity?.length ? (
              customer.past_activity.map((item) => (
                <TimelineEntry key={item.id} item={item} />
              ))
            ) : (
              <EmptyHint text="No past activity yet." />
            )}
          </div>
        </div>

        {/* Actions sidebar */}
        <div className="w-[220px] shrink-0 space-y-5 border-l border-slate-100 bg-slate-50/50 px-4 py-5">
          <ActionGroup label="Add">
            <ActionButton icon={<Car className="h-4 w-4" />} label="Vehicles" />
            <ActionButton icon={<ArrowUpRight className="h-4 w-4" />} label="Trade In" />
            <ActionButton icon={<CreditCard className="h-4 w-4" />} label="Credit App" />
          </ActionGroup>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              automotive<span className="text-slate-600">Mastermind</span>
            </div>
            <ActionButton
              icon={<Wrench className="h-4 w-4" />}
              label="BPS / Drivers"
              ghost
            />
          </div>

          <ActionGroup label="Actions">
            <ActionButton icon={<CheckCircle2 className="h-4 w-4" />} label="Check In" />
            <ActionButton icon={<FileText className="h-4 w-4" />} label="Documents" />
            <ActionButton icon={<Globe className="h-4 w-4" />} label="Portal" />
            <ActionButton icon={<ArrowUpRight className="h-4 w-4" />} label="Push" />
            <ActionButton
              icon={<Trophy className="h-4 w-4" />}
              label="Mark as Sold"
              tone="emerald"
            />
            <ActionButton
              icon={<XCircle className="h-4 w-4" />}
              label="Dead"
              tone="rose"
            />
          </ActionGroup>
        </div>
      </div>
    </section>
  );
}

// ----- Sub-components -------------------------------------------------------

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-slate-700">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span className="w-14 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 text-sm">{value}</span>
    </div>
  );
}

function Separator() {
  return <div className="mx-5 border-t border-slate-100" />;
}

function CollapsibleSection({
  title,
  children,
  rightLabel,
  actionIcon,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  rightLabel?: ReactNode;
  actionIcon?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="px-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {actionIcon}
          {title}
        </span>
        <span className="flex items-center gap-2">
          {rightLabel}
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function DetailRow({
  label,
  value,
  fallback,
}: {
  label: string;
  value?: { name: string; initials: string } | null;
  fallback: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      {value ? (
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">
            {value.initials}
          </span>
          <span className="text-slate-700">{value.name}</span>
        </span>
      ) : (
        fallback
      )}
    </div>
  );
}

function DealRow({
  icon,
  label,
  value,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">{icon}</span>
      <span className="w-20 text-slate-500">{label}</span>
      <span className={cn("flex-1", muted ? "text-indigo-600" : "text-slate-700")}>
        {value}
      </span>
    </div>
  );
}

function ContactMethodRadial({ method }: { method: string }) {
  const color =
    method === "text"
      ? "stroke-sky-500"
      : method === "phone"
        ? "stroke-emerald-500"
        : method === "email"
          ? "stroke-indigo-500"
          : "stroke-fuchsia-500";
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          className="stroke-slate-200"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          className={color}
          strokeWidth="3"
          strokeDasharray="75 100"
          strokeLinecap="round"
          pathLength="100"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-emerald-500" />
      </div>
    </div>
  );
}

function labelForMethod(m: string) {
  switch (m) {
    case "text":
      return "Text";
    case "phone":
      return "Call";
    case "email":
      return "Email";
    case "video":
      return "Video";
    default:
      return m;
  }
}

function placeholderFor(c: ComposerId) {
  switch (c) {
    case "note":
      return "Type your note here. Use @Name to mention a coworker";
    case "call":
      return "Log call notes…";
    case "email":
      return "Compose email subject and body…";
    case "text":
      return "Type a text message…";
    case "video":
      return "Add a personal video message…";
    case "task":
      return "Describe the task and set a due date…";
    case "appt":
      return "Schedule an appointment — date, time, location…";
  }
}

function SectionDivider({
  label,
  tone,
}: {
  label: string;
  tone: "indigo" | "slate";
}) {
  return (
    <div className="flex items-center justify-center">
      <span
        className={cn(
          "rounded-md px-3 py-1 text-[11px] font-bold tracking-wider text-white",
          tone === "indigo" ? "bg-indigo-500" : "bg-slate-500",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function PlannedTaskCard({ item }: { item: TimelineItem }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <button className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2 border-slate-300 transition-colors hover:border-emerald-500 hover:bg-emerald-50" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-800">{item.title}</span>
          <span className="text-slate-400">·</span>
          <span className="text-xs text-slate-500">{item.timestamp}</span>
        </div>
        {item.body && (
          <div className="mt-2 rounded-md bg-slate-50 px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-100">
            {item.body}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  const meta = typeMeta(item.type);
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white",
          meta.bg,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-slate-800">{item.title}</span>
          {item.author && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600">{item.author}</span>
            </>
          )}
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-500">{item.timestamp}</span>
        </div>
        {item.channel_detail && (
          <div className="mt-0.5 text-xs text-slate-500">{item.channel_detail}</div>
        )}
        {item.body && (
          <div
            className={cn(
              "mt-2 rounded-md px-3 py-2 text-sm",
              item.type === "note"
                ? "bg-amber-50 text-slate-700 ring-1 ring-amber-100"
                : "bg-slate-50 text-slate-700 ring-1 ring-slate-100",
            )}
          >
            {item.body}
          </div>
        )}
      </div>
    </div>
  );
}

function typeMeta(type: TimelineItem["type"]) {
  switch (type) {
    case "note":
      return { icon: StickyNote, bg: "bg-amber-400" };
    case "text":
      return { icon: MessageCircle, bg: "bg-sky-500" };
    case "call":
      return { icon: PhoneCall, bg: "bg-emerald-500" };
    case "email":
      return { icon: MailIcon, bg: "bg-indigo-500" };
    case "video":
      return { icon: Video, bg: "bg-fuchsia-500" };
    case "task":
      return { icon: ClipboardList, bg: "bg-slate-500" };
    case "appt":
      return { icon: CalendarClock, bg: "bg-violet-500" };
    case "system":
      return { icon: FileText, bg: "bg-slate-400" };
  }
}

function countByType(items: TimelineItem[] | undefined, type: TimelineItem["type"]) {
  return items?.filter((i) => i.type === type).length ?? 0;
}

function FilterPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={cn(
        "relative py-3 text-xs font-medium transition-colors",
        active ? "text-emerald-600" : "text-slate-500 hover:text-slate-700",
      )}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-emerald-500" />
      )}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function ActionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  tone,
  ghost,
}: {
  icon: ReactNode;
  label: string;
  tone?: "emerald" | "rose";
  ghost?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        ghost
          ? "text-slate-600 hover:bg-slate-100"
          : tone === "emerald"
            ? "text-emerald-700 hover:bg-emerald-50"
            : tone === "rose"
              ? "text-rose-600 hover:bg-rose-50"
              : "text-slate-700 hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200",
      )}
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
  );
}

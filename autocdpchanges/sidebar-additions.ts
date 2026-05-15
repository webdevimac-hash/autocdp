/**
 * SIDEBAR ADDITIONS — drop these into `src/components/layout/sidebar.tsx`
 * ──────────────────────────────────────────────────────────────────────
 *
 * Goal: surface the new DriveCentric-inspired pages without breaking your
 * existing nav structure. The new routes map onto the existing groups, so the
 * sidebar's overall shape stays the same.
 *
 * If your sidebar currently looks like:
 *
 *   const navGroups = [
 *     { label: "Main", items: [
 *         { href: "/dashboard", icon: Home, label: "Dashboard" },
 *         { href: "/dashboard/customers", icon: Users, label: "Customers" },
 *         { href: "/dashboard/campaigns", icon: Megaphone, label: "Campaigns" },
 *     ]},
 *     { label: "Channels", items: [
 *         { href: "/dashboard/direct-mail", icon: Mail, label: "Direct Mail" },
 *         …
 *     ]},
 *     …
 *   ];
 *
 * …then merge in the items below. The icons used here are all already
 * available from `lucide-react`.
 */

import {
  ChevronsRight,
  Zap,
  Calendar,
  Send,
  Star,
  ListTodo,
} from "lucide-react";

export const NEW_NAV_ITEMS = {
  Main: [
    // Slot this in immediately after "Dashboard":
    {
      href: "/dashboard/pipeline",
      icon: ChevronsRight,
      label: "Sales Hub",
      // Optional badge — show count of overdue follow-ups
      badge: "overdue_count",
    },
    {
      href: "/dashboard/workplan",
      icon: ListTodo,
      label: "Workplan",
    },
  ],
  Channels: [
    // Already have direct-mail, sms, email. Add:
    {
      href: "/dashboard/email-blast",
      icon: Send,
      label: "Email Blast",
    },
  ],
  Operations: [
    // Add alongside Integrations / Inventory / Conquest:
    {
      href: "/dashboard/appointments",
      icon: Calendar,
      label: "Appointments",
    },
    {
      href: "/dashboard/mining",
      icon: Zap,
      label: "Mining",
    },
    {
      href: "/dashboard/reputation",
      icon: Star,
      label: "Reputation",
    },
  ],
};

/**
 * IMPORTANT: keep the navy sidebar (#0B1526) + indigo left-border active
 * indicator — those are documented as "Things NOT to Break" in the project
 * summary. Don't replace the existing icons; just add these new entries.
 */

/**
 * Shared insight type definitions and display constants.
 * Safe to import in both server and client code — no server-only APIs here.
 */

export type InsightType =
  | "trade_in_lines"
  | "top_vehicles"
  | "popular_colors"
  | "inventory_turnover"
  | "sentiment_patterns"
  | "google_review_trends";

export const INSIGHT_TITLES: Record<InsightType, string> = {
  trade_in_lines:       "Top Trade-In Lines",
  top_vehicles:         "Top Vehicles Serviced",
  popular_colors:       "Popular Vehicle Colors",
  inventory_turnover:   "Inventory Turnover",
  sentiment_patterns:   "Customer Sentiment",
  google_review_trends: "Google Review Trends",
};

export const INSIGHT_DESCRIPTIONS: Record<InsightType, string> = {
  trade_in_lines:       "Makes and models customers most commonly trade in.",
  top_vehicles:         "Vehicles appearing most often in service records.",
  popular_colors:       "Colors dominating your current inventory.",
  inventory_turnover:   "How quickly different models move off the lot.",
  sentiment_patterns:   "Recurring themes in customer service notes.",
  google_review_trends: "Key topics and sentiment from your Google reviews.",
};

/**
 * Conquest Retargeting Pixel — server-side helpers
 *
 * Generates the JS pixel snippet and processes inbound events:
 *   - Matches anonymous sessions to known CRM customers by email/phone cookie
 *   - Matches to conquest_leads by email/phone
 *   - Classifies page type from URL patterns
 *   - Extracts VDP metadata from page data
 *
 * Privacy:
 *   - Raw IP is never stored; SHA-256 hash of IP is used for deduplication only.
 *   - session_id is a client-generated UUID stored in sessionStorage (not a tracking cookie).
 *   - No third-party cookies; first-party only.
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Pixel JS snippet
// ---------------------------------------------------------------------------

export function buildPixelSnippet(dealershipId: string, apiBase: string): string {
  // Minified-safe template literal — no backticks inside so we can embed cleanly
  return `(function(){
  var DID="${dealershipId}";
  var BASE="${apiBase}";
  var SID_KEY="acdp_sid_"+DID;
  function uuid(){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){return(c^(crypto.getRandomValues(new Uint8Array(1))[0]&(15>>c/4))).toString(16);});}
  var sid=sessionStorage.getItem(SID_KEY);
  if(!sid){sid=uuid();sessionStorage.setItem(SID_KEY,sid);}
  function getPageType(url){
    var p=new URL(url).pathname.toLowerCase();
    if(p.match(/\\/vdp|\\/vehicle-detail|\\/inventory\\//))return"vdp_view";
    if(p.match(/\\/srp|\\/search|\\/inventory/))return"srp_view";
    if(p.match(/\\/finance|\\/credit-app/))return"finance_tool";
    if(p.match(/\\/trade|\\/value-your-trade/))return"trade_tool";
    if(p.match(/\\/contact|\\/get-a-quote|\\/request/))return"lead_form_start";
    return"homepage_view";
  }
  function getVdpMeta(){
    var vin=null,make=null,model=null,year=null,price=null;
    var metas=document.querySelectorAll("meta");
    metas.forEach(function(m){
      var n=(m.getAttribute("name")||m.getAttribute("property")||"").toLowerCase();
      var v=m.getAttribute("content")||"";
      if(n==="vin"||n==="product:vin")vin=v;
      if(n==="make"||n==="product:make")make=v;
      if(n==="model"||n==="product:model")model=v;
      if(n==="year"||n==="product:year")year=parseInt(v)||null;
      if(n==="price"||n==="product:price:amount")price=parseFloat(v)||null;
    });
    var vinEl=document.querySelector("[data-vin]");
    if(vinEl&&!vin)vin=vinEl.getAttribute("data-vin");
    return{vin:vin,vehicle_make:make,vehicle_model:model,vehicle_year:year,vehicle_price:price};
  }
  function fire(evtType,extra){
    var payload=Object.assign({dealership_id:DID,session_id:sid,event_type:evtType,page_url:location.href,referrer_url:document.referrer||null,user_agent:navigator.userAgent},extra||{});
    var body=JSON.stringify(payload);
    if(navigator.sendBeacon){navigator.sendBeacon(BASE+"/api/conquest/retargeting/event",new Blob([body],{type:"application/json"}));}
    else{fetch(BASE+"/api/conquest/retargeting/event",{method:"POST",headers:{"Content-Type":"application/json"},body:body,keepalive:true});}
  }
  var ptype=getPageType(location.href);
  var vdp=ptype==="vdp_view"?getVdpMeta():{};
  fire(ptype,vdp);
  document.addEventListener("click",function(e){
    var el=e.target;
    while(el&&el!==document){
      var tag=(el.tagName||"").toLowerCase();
      var href=el.getAttribute("href")||"";
      var cls=(el.className||"").toString();
      if(tag==="a"&&href.match(/^tel:/)){fire("phone_click");return;}
      if(cls.match(/chat|livechat/i)){fire("chat_start");return;}
      if(cls.match(/test.?drive/i)||(el.textContent||"").match(/test drive/i)){fire("test_drive_request");return;}
      if(tag==="button"&&(el.type==="submit"||(el.form))&&cls.match(/lead|contact|quote|submit/i)){fire("lead_form_submit");return;}
      el=el.parentElement;
    }
  },true);
})();`.replace(/\n/g, "");
}

// ---------------------------------------------------------------------------
// Event processing helpers
// ---------------------------------------------------------------------------

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip.trim()).digest("hex");
}

/** Extract IP from Next.js request headers (handles proxies) */
export function extractIp(headers: Headers): string | null {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export type PixelEventType =
  | "homepage_view"
  | "srp_view"
  | "vdp_view"
  | "lead_form_start"
  | "lead_form_submit"
  | "phone_click"
  | "chat_start"
  | "trade_tool"
  | "finance_tool"
  | "test_drive_request";

const VALID_EVENT_TYPES = new Set<PixelEventType>([
  "homepage_view", "srp_view", "vdp_view",
  "lead_form_start", "lead_form_submit",
  "phone_click", "chat_start", "trade_tool",
  "finance_tool", "test_drive_request",
]);

export interface InboundPixelEvent {
  dealership_id:  string;
  session_id:     string;
  event_type:     PixelEventType;
  page_url?:      string;
  referrer_url?:  string;
  user_agent?:    string;
  vin?:           string;
  vehicle_make?:  string;
  vehicle_model?: string;
  vehicle_year?:  number;
  vehicle_price?: number;
  country_code?:  string;
}

export function validatePixelEvent(body: unknown): { ok: true; event: InboundPixelEvent } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid body" };
  const b = body as Record<string, unknown>;

  if (typeof b.dealership_id !== "string" || !b.dealership_id)
    return { ok: false, error: "missing dealership_id" };
  if (typeof b.session_id !== "string" || !b.session_id)
    return { ok: false, error: "missing session_id" };
  if (!VALID_EVENT_TYPES.has(b.event_type as PixelEventType))
    return { ok: false, error: `invalid event_type: ${b.event_type}` };

  return {
    ok: true,
    event: {
      dealership_id:  b.dealership_id as string,
      session_id:     b.session_id as string,
      event_type:     b.event_type as PixelEventType,
      page_url:       typeof b.page_url === "string" ? b.page_url.slice(0, 2048) : undefined,
      referrer_url:   typeof b.referrer_url === "string" ? b.referrer_url.slice(0, 2048) : undefined,
      user_agent:     typeof b.user_agent === "string" ? b.user_agent.slice(0, 512) : undefined,
      vin:            typeof b.vin === "string" ? b.vin.trim().toUpperCase() : undefined,
      vehicle_make:   typeof b.vehicle_make === "string" ? b.vehicle_make : undefined,
      vehicle_model:  typeof b.vehicle_model === "string" ? b.vehicle_model : undefined,
      vehicle_year:   typeof b.vehicle_year === "number" ? Math.trunc(b.vehicle_year) : undefined,
      vehicle_price:  typeof b.vehicle_price === "number" ? b.vehicle_price : undefined,
      country_code:   typeof b.country_code === "string" ? b.country_code.slice(0, 2) : undefined,
    },
  };
}

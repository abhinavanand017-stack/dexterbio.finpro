import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Whitelist of feeds we're willing to proxy. Prevents this endpoint
// from being abused as an open proxy to arbitrary URLs.
const ALLOWED: Record<string, string> = {
  markets: "https://www.moneycontrol.com/rss/marketsnews.xml",
  business: "https://www.moneycontrol.com/rss/business.xml",
  latest: "https://www.moneycontrol.com/rss/latestnews.xml",
  economy: "https://www.moneycontrol.com/rss/economy.xml",
  mf: "https://www.moneycontrol.com/rss/mfreports.xml",
};

export const Route = createFileRoute("/api/public/market/rss")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const feed = url.searchParams.get("feed") ?? "";
          const upstream = ALLOWED[feed];
          if (!upstream) {
            return new Response(JSON.stringify({ error: "unknown feed" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          const res = await fetch(upstream, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; DexterBio/1.0; +https://dexterbio.lovable.app)",
              Accept: "application/rss+xml, application/xml, text/xml",
            },
          });
          const text = await res.text();
          return new Response(text, {
            status: res.status,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              ...CORS,
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "unknown";
          return new Response(JSON.stringify({ error: message }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
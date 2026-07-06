import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Returns the Finnhub key so the browser can open a WebSocket directly.
// The key is a browser-usable API token; embedding it in a browser
// connection is Finnhub's documented pattern.
export const Route = createFileRoute("/api/public/market/finnhub-token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const token = process.env.FINNHUB_API_KEY;
        if (!token) {
          return new Response(JSON.stringify({ error: "FINNHUB_API_KEY missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        return new Response(JSON.stringify({ token }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dexter — Bio-Algorithmic Trading Engine" },
      { name: "description", content: "Dexter is a cognitive firewall between human impulse and capital markets — bio-algorithmic trading intelligence for the Indian markets." },
      { property: "og:title", content: "Dexter — Bio-Algorithmic Trading Engine" },
      { property: "og:description", content: "Cognitive firewall for capital markets. Biometric-aware risk control for NSE/BSE traders." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/dexter.html"
      title="Dexter — Bio-Algorithmic Trading Engine"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        background: "#020810",
      }}
    />
  );
}

"use client";

import Link from "next/link";

export default function Page() {
  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Arbitrage Scanner</h1>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/perps-opps">Perps Arb Opps</Link>
        <Link href="/funding-opps">Funding Opps</Link>
      </div>
    </main>
  );
}

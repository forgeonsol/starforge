/* $FORGE launch config — the single place to switch the site and the game from "coming soon" to live.
   Fill these in at launch; every CTA on the landing page and inside the game reads from here.
   Empty values keep the "coming soon" state: buttons then lead to the launch section instead of a dead link. */
window.FORGE_TOKEN = {
  status: "soon",          // "soon" before trading opens, "live" once the token can be bought
  symbol: "$FORGE",
  chain: "Solana",
  contract: "",            // token mint / contract address — shown with a copy button once set
  buyUrl: "",              // where to buy (DEX / launchpad link)
  chartUrl: "",            // price chart (e.g. DexScreener / Birdeye)
  launchDate: "",          // ISO date-time, e.g. "2026-11-01T16:00:00Z" — shows a countdown when set
  walletConnect: false,    // true once an on-chain wallet adapter is wired into forge-economy.js
  links: { x: "", telegram: "" }  // community links; empty ones are hidden
};

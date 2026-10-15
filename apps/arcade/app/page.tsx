import { redirect } from "next/navigation";

/* The landing page and the game are static files in /public (index.html, game.html) so that the
   site, the game and the published preview share one codebase. "/" forwards to the landing page. */
export default function Home() {
  redirect("/index.html");
}

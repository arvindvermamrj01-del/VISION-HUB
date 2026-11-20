/* Cloudflare Pages route for the AdSense sellers declaration. */
export async function onRequestGet({ env }) {
  const raw = String(env.ADSENSE_PUBLISHER_ID || "").trim();
  const publisher = raw.startsWith("ca-pub-") ? raw.slice(3) : raw;
  if (!/^pub-\d{10,20}$/.test(publisher)) {
    return new Response("AdSense publisher is not configured.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  return new Response("google.com, " + publisher + ", DIRECT, f08c47fec0942fa0\n", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" }
  });
}

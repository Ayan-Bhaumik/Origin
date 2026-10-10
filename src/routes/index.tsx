import { createFileRoute } from "@tanstack/react-router";
import { getPublicSettings } from "@/lib/clips.functions";
import { Landing } from "@/components/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "origin — Free online clipboard to share text, images & files" },
      { name: "description", content: "Move anything between your devices, instantly. Share text, images and files from phone to PC with a short code — free, no account, auto-expiring." },
      { property: "og:title", content: "origin — Move anything between your devices, instantly" },
      { property: "og:description", content: "Share text, images and files between any devices with a short code. Free, anonymous, no account, auto-expiring." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://origin.ayanbhaumik.in/" },
      { property: "og:site_name", content: "origin" },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: "https://origin.ayanbhaumik.in/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "origin — Move anything between your devices, instantly." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "origin — Move anything between your devices, instantly" },
      { name: "twitter:description", content: "Share text, images and files between any devices with a short code." },
      { name: "twitter:image", content: "https://origin.ayanbhaumik.in/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://origin.ayanbhaumik.in/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "origin",
          url: "https://origin.ayanbhaumik.in/",
          description: "A free, anonymous online clipboard to move text, images and files between devices using a short code.",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any",
          browserRequirements: "Requires a modern web browser",
          image: "https://origin.ayanbhaumik.in/og-image.png",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: ["Share text up to 100 KB", "Share images up to 10 MB", "Share files up to 25 MB", "Optional PIN protection", "Delete after first view", "Auto-expiry up to 24 hours", "QR code sharing", "No account required"],
        }),
      },
    ],
  }),
  loader: () => getPublicSettings(),
  component: Index,
});

function Index() {
  const settings = Route.useLoaderData();
  return <Landing settings={settings} />;
}

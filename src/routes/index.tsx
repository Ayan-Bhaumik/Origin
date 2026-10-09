import { createFileRoute } from "@tanstack/react-router";
import { getPublicSettings } from "@/lib/clips.functions";
import { Landing } from "@/components/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "origin — Move anything between your devices, instantly" },
      { name: "description", content: "A free, anonymous online clipboard. Send text, images and files to any device with a short code." },
      { property: "og:title", content: "origin — Move anything between your devices, instantly" },
      { property: "og:description", content: "A free, anonymous online clipboard. Send text, images and files to any device with a short code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => getPublicSettings(),
  component: Index,
});

function Index() {
  const settings = Route.useLoaderData();
  return <Landing settings={settings} />;
}

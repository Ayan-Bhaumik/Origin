import { createFileRoute } from "@tanstack/react-router";
import { getPublicSettings } from "@/lib/clips.functions";
import { Landing } from "@/components/landing";

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "Open a shared clip — origin" },
      { name: "description", content: "Someone shared a clip with you on origin. Open it to view or download." },
      { property: "og:title", content: "Open a shared clip — origin" },
      { property: "og:description", content: "Someone shared a clip with you on origin. Open it to view or download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: () => getPublicSettings(),
  component: RetrieveDeepLink,
});

function RetrieveDeepLink() {
  const settings = Route.useLoaderData();
  const { code } = Route.useParams();
  return <Landing settings={settings} initialCode={code} />;
}

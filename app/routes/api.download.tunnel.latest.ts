// Redirects first-party download links to the latest GitHub Release asset.
import type { LoaderFunctionArgs } from "react-router";
import {
  parseTunnelDownloadPlatform,
  tunnelGithubDownloadUrl,
  tunnelGithubReleaseUrl,
} from "~/lib/utils/tunnelDownloads";

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  if (process.env.NIT_TUNNEL_RELEASE_ASSETS_READY !== "1") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: tunnelGithubReleaseUrl(),
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const platform = parseTunnelDownloadPlatform(url.searchParams.get("platform"));
  const location = tunnelGithubDownloadUrl(platform);

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "public, max-age=300",
    },
  });
}

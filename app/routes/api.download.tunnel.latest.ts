// Redirects first-party download links to the latest GitHub Release asset.
import type { LoaderFunctionArgs } from "react-router";
import {
  parseTunnelDownloadPlatform,
  tunnelGithubDownloadUrl,
} from "~/lib/utils/tunnelDownloads";

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
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

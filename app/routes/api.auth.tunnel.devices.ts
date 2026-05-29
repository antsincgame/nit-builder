import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "~/lib/server/requireAuth.server";
import { listUserDevices } from "~/lib/server/tunnelDevices.server";

/**
 * GET /api/auth/tunnel/devices
 *
 * Список привязанных устройств текущего юзера (для раздела «Устройства»
 * в настройках). Токены не отдаём — только метаданные.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getAuth(request);
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }
  const devices = await listUserDevices(user.userId);
  return Response.json({
    devices: devices.map((d) => ({
      id: d.$id,
      deviceName: d.deviceName,
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt ?? null,
      revoked: d.revoked,
    })),
  });
}

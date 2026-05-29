import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "~/lib/server/requireAuth.server";
import { revokeDevice } from "~/lib/server/tunnelDevices.server";
import { revokeDeviceTunnels } from "~/lib/services/tunnelRegistry.server";

/**
 * DELETE /api/auth/tunnel/devices/:id
 *
 * Отзыв привязанного устройства (с ownership-проверкой). Помечает revoked=true
 * (следующий hello с его токеном провалится) И сразу обрывает активное
 * соединение этого устройства, если оно онлайн — доступ пропадает немедленно.
 * Другие устройства юзера не затрагиваются. Принимаем DELETE и POST (для
 * простоты вызова из fetch).
 */
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await getAuth(request);
  if (!user) {
    return Response.json({ error: "Не авторизован" }, { status: 401 });
  }

  const deviceId = params.id;
  if (!deviceId) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const ok = await revokeDevice(user.userId, deviceId);
  if (!ok) {
    return Response.json({ error: "Устройство не найдено" }, { status: 404 });
  }

  // Мгновенно рвём живой туннель этого устройства (если онлайн) — доступ
  // пропадает сразу, не дожидаясь реконнекта. revoked=true уже не даст ему
  // переподключиться.
  revokeDeviceTunnels(deviceId);

  return Response.json({ ok: true });
}

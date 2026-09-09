import asyncio

from fastapi import WebSocket


class AlertConnectionManager:
    """Process-local viewer registry, grouped by alert id."""

    def __init__(self) -> None:
        self._viewers: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def add_viewer(self, alert_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            self._viewers.setdefault(alert_id, set()).add(websocket)

    async def remove_viewer(self, alert_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            viewers = self._viewers.get(alert_id)
            if viewers is None:
                return
            viewers.discard(websocket)
            if not viewers:
                self._viewers.pop(alert_id, None)

    async def broadcast(self, alert_id: int, message: dict) -> None:
        async with self._lock:
            viewers = tuple(self._viewers.get(alert_id, ()))

        disconnected: list[WebSocket] = []
        for viewer in viewers:
            try:
                await viewer.send_json(message)
            except Exception:
                disconnected.append(viewer)

        for viewer in disconnected:
            await self.remove_viewer(alert_id, viewer)


alert_connections = AlertConnectionManager()

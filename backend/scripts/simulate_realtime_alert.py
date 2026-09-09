"""Create an alert and publish a ten-minute simulated route over WebSocket.

Run from the repository root with the backend already listening on localhost:8000:

    PB_TEST_EMAIL='user@example.com' PB_TEST_PASSWORD='password' \
        backend/.venv/bin/python backend/scripts/simulate_realtime_alert.py

The credentials are read from the environment and are never written to output.
"""

import asyncio
import json
import math
import os
import time
from datetime import datetime, timezone

import httpx
import websockets


BASE_URL = "http://127.0.0.1:8000"
WS_BASE_URL = "ws://127.0.0.1:8000"
DURATION_SECONDS = 10 * 60
UPDATE_SECONDS = 5


async def main() -> None:
    email = os.environ["PB_TEST_EMAIL"]
    password = os.environ["PB_TEST_PASSWORD"]

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        login = await client.post("/auth/login", json={"email": email, "password": password})
        login.raise_for_status()
        session_token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {session_token}"}

        initial = {
            "latitude": 10.480593,
            "longitude": -66.903606,
            "accuracy": 7.5,
            "speed": 6.0,
            "bearing": 0.0,
        }
        created = await client.post("/alerts", json=initial, headers=headers)
        created.raise_for_status()
        alert = created.json()

        alert_id = alert["id"]
        publisher_token = alert["publisher_token"]
        print(
            f"Alert {alert_id} created; the confirmed email contact should now have its live link.",
            flush=True,
        )
        print("Starting a ten-minute simulated circular route through central Caracas.", flush=True)

        started = time.monotonic()
        deadline = started + DURATION_SECONDS
        sequence = 0
        next_report = started + 60

        while time.monotonic() < deadline:
            try:
                async with websockets.connect(
                    f"{WS_BASE_URL}/alerts/{alert_id}/track",
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=5,
                ) as websocket:
                    await websocket.send(json.dumps({"type": "auth", "token": publisher_token}))
                    ready = json.loads(await websocket.recv())
                    if ready.get("type") != "ready":
                        raise RuntimeError(f"publisher was not accepted: {ready}")
                    sequence = max(sequence, int(ready.get("latest_sequence", 0)))

                    while time.monotonic() < deadline:
                        elapsed = time.monotonic() - started
                        angle = (elapsed / DURATION_SECONDS) * math.tau
                        sequence += 1
                        location = {
                            "type": "location",
                            "sequence": sequence,
                            "latitude": 10.480593 + 0.010 * math.sin(angle),
                            "longitude": -66.903606 + 0.014 * math.cos(angle),
                            "accuracy": 6.0 + 2.0 * abs(math.sin(angle * 3)),
                            "speed": 6.0,
                            "bearing": math.degrees(angle) % 360,
                            "recorded_at": datetime.now(timezone.utc).isoformat(),
                        }
                        await websocket.send(json.dumps(location))
                        response = json.loads(await asyncio.wait_for(websocket.recv(), timeout=15))
                        if response.get("type") == "status":
                            raise RuntimeError(f"tracking ended early: {response.get('status')}")
                        if response.get("type") != "ack":
                            raise RuntimeError(f"unexpected server response: {response}")

                        now = time.monotonic()
                        if now >= next_report:
                            completed = min(10, int((now - started) // 60))
                            print(
                                f"Simulation progress: {completed}/10 minutes, "
                                f"sequence {sequence} acknowledged.",
                                flush=True,
                            )
                            next_report += 60
                        await asyncio.sleep(
                            min(UPDATE_SECONDS, max(0, deadline - time.monotonic()))
                        )
            except (OSError, websockets.ConnectionClosed, asyncio.TimeoutError) as error:
                if time.monotonic() >= deadline:
                    break
                print(
                    f"Publisher connection interrupted ({type(error).__name__}); reconnecting.",
                    flush=True,
                )
                await asyncio.sleep(2)

        stopped = await client.post(f"/alerts/{alert_id}/stop", headers=headers)
        stopped.raise_for_status()
        print(
            f"Simulation completed. Alert {alert_id} is now marked ended at its final position.",
            flush=True,
        )


if __name__ == "__main__":
    asyncio.run(main())

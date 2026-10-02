# Clawd Muse — firmware overlay plan

Target board: Waveshare ESP32-S3-Touch-AMOLED-1.75(C).
Upstream overlay: `devices/sdkconfig.muse-waveshare-s3-175c` (muse UI: avatar/voice/settings).

## New screens (LVGL, on top of the muse UI)

| Screen | File (planned) | Description |
|---|---|---|
| `clawd_boot` | `main/clawd_boot.c` | Clawd splash, Musebook session bring-up, pairing code |
| `clawd_home` | `main/clawd_home.c` | Portfolio snapshot: SOL, $CLAWD, watchlist |
| `clawd_chart` | `main/clawd_chart.c` | Full-screen PNG chart viewer; swipe = token/timeframe |
| `clawd_voice` | `main/clawd_voice.c` | Push-to-talk UI, live waveform, transcript line |
| `clawd_confirm` | `main/clawd_confirm.c` | Exact-terms card + 10s countdown + confirm/reject |

## Backend client (planned)

`main/clawd_api.c` — minimal HTTPS client for `/api/gadget/*`:
device-auth (SIWS), portfolio, chart PNG fetch, quote, intent, voice audio
upload. Reuses the firmware's TLS stack; device token stored in NVS.

## Voice audio path (planned)

- I2S RX from INMP441 (shared BCK/WS with MAX98357A TX).
- Capture → VAD → Opus → POST `/api/gadget/voice`.
- Play TTS reply via I2S TX → MAX98357A → speaker.

## Status

Scaffold only — screens and `clawd_api.c` are to be implemented against the
upstream `components/muse` UI primitives. The upstream simulator
(`esp32/simulator/`) can exercise the UI without hardware.

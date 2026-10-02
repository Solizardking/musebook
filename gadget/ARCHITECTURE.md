# Clawd Muse — Architecture

## Design goals

1. **Pocket-first.** The ESP32 device is the product: glanceable charts,
   voice commands, physical trade confirmation.
2. **No new trust assumptions.** Signing still happens where it already does
   (browser, or a scoped device key you explicitly approve). The gadget is a
   remote control and display, not a custodian.
3. **Musebook-native.** All market data, quotes, and trade building go through
   the existing Musebook backend (`musebook-proxy` worker). The gadget adds no
   parallel trading stack.
4. **Hackable.** Built on the open muse-gadget-sdk; every layer is replaceable.

## Layer 1 — Device firmware (`firmware/`)

Based on the upstream `esp32/` firmware, target board
**Waveshare ESP32-S3-Touch-AMOLED-1.75** (overlay
`devices/sdkconfig.muse-waveshare-s3-175c`).

Customizations on top of stock firmware:

- **Boot:** pairs with the Muse app over BLE (stock), joins Wi-Fi (stock),
  then opens a session to the Musebook backend and shows the Clawd boot
  screen. "Spins up a muse at launch" = the device brings up your Muse
  session (via the Muse app link) *and* a Musebook device session.
- **Home screen:** portfolio snapshot (SOL + $CLAWD + watched tokens),
  pulled from `/api/gadget/portfolio`.
- **Charts screen:** server-rendered PNG charts fetched via the firmware's
  image path and drawn full-screen. Swipe or button cycles tokens/timeframes.
- **Voice screen:** push-to-talk → mic capture → Muse voice pipeline →
  parsed trade intent spoken back for confirmation ("Buy 10 $CLAWD for
  ~0.014 SOL?") → physical confirm/reject.
- **Trade confirm screen:** exact terms (side, size, venue, est. receive,
  fee) + a 10-second countdown; confirm = touch/press, reject = timeout.
- **Settings:** sign-in / sign-out, wallet mode toggle, Wi-Fi, brightness.

Hardware additions over the bare board: INMP441 I2S mic, MAX98357A I2S amp +
speaker, LiPo + charger (see BOM.md).

## Layer 2 — Pi companion (`linux/`)

A Raspberry Pi (3B+/4/5/Zero 2 W) running the linux device SDK plus the
`clawd_muse` service. It does what the ESP32 can't do cheaply:

- **Voice brain:** STT on captured audio (Musebook `/api/trade/voice`), intent
  parsing, TTS replies. Exposes `clawd.voice` to the Muse app.
- **Chart rendering:** pulls OHLCV from the Musebook connector and renders
  PNGs the ESP32 displays.
- **Trade orchestration:** quote → intent → unsigned tx, then either hands the
  signing URL to your phone (sign-in mode) or signs with the scoped device
  key after physical confirm (wallet mode).
- **Custom Muse commands** registered on the device: `clawd.status`,
  `clawd.quote`, `clawd.chart`, `clawd.buy`, `clawd.sell`, `clawd.portfolio`.

The Pi is optional: sign-in mode + charts work with the ESP32 talking
directly to the Musebook backend. The Pi unlocks voice trading and wallet
mode orchestration.

## Layer 3 — Musebook backend (`api/`)

New worker routes under `/api/gadget/*` on the existing `musebook-proxy`:

| Endpoint | Purpose |
|---|---|
| `POST /api/gadget/device-auth` | SIWS challenge → short-lived device token (or `mbk_live_*` key auth) |
| `GET /api/gadget/portfolio` | SOL + token balances for the linked wallet |
| `GET /api/gadget/chart?mint=&tf=` | Server-rendered chart PNG |
| `POST /api/gadget/quote` | Trade quote (DFlow / Definitive, read-only) |
| `POST /api/gadget/intent` | Build unsigned trade tx from a quote |
| `POST /api/gadget/voice` | Audio in → transcript + parsed intent + TTS audio out |
| `GET /api/gadget/status` | Health / caps / mode for the device UI |

All endpoints reuse existing auth (Ed25519 SIWS), rate limits, and the
exact-terms confirmation contract. See [api/OPENAPI.md](api/OPENAPI.md).

## Auth flows

**Sign-in (default):**
1. Gadget shows a pairing code.
2. User opens `musebook.trade/gadget`, connects wallet, signs the SIWS
   challenge containing the code.
3. Backend issues a scoped device token (portfolio/quote/chart/intent only —
   no trading authority). Token is revocable from the site.

**Wallet mode (opt-in, explicit approval):**
1. User creates a scoped device wallet in the Musebook UI (caps: per-trade,
   per-day, venue allowlist — same policy engine as `clawd-buyer`).
2. Encrypted key material is provisioned to the Pi companion only (never the
   ESP32 UI layer), decrypted transiently per trade.
3. Every trade still requires the physical confirm press on the device.

## Voice trading flow (`docs/VOICE.md`)

```
mic → VAD → Opus → /api/gadget/voice → transcript + intent
   → TTS "Buy 10 $CLAWD for ~0.0142 SOL?" → speaker
   → device shows exact terms → physical CONFIRM
   → (sign-in: signing URL → phone browser)
   → (wallet: sign with scoped key → broadcast → receipt on screen)
```

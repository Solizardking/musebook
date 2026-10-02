# Clawd Muse 🦞

A pocket trading gadget for Musebook, built on Meta's [muse-gadget-sdk](https://github.com/Solizardking/muse-gadget-sdk).

A handheld ESP32 device with a color AMOLED touchscreen, microphone, and
speaker. It pairs with the Muse app, connects to Musebook, shows live charts,
takes **voice trading commands** ("buy 10 $CLAWD"), and lets you **confirm
trades with a physical press** instead of squinting at a phone.

```
┌─────────────────────────────────────────────────────────┐
│                    Clawd Muse gadget                     │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ ESP32-S3 │   │ Raspberry Pi │   │ Musebook backend │  │
│  │ AMOLED   │◄─►│ companion    │◄─►│  (musebook.trade)│  │
│  │ mic+spk  │   │ (linux SDK)  │   │  /api/gadget/*   │  │
│  └──────────┘   └──────────────┘   └──────────────────┘  │
│       │                 │                     │          │
│       └──── BLE ──► Muse app ◄── sign-in ─────┘          │
│              (spins up your Muse at launch)              │
└─────────────────────────────────────────────────────────┘
```

## Three layers

| Layer | What it is | Code |
|---|---|---|
| **Device** | ESP32-S3 firmware: trading UI, charts, voice loop, physical trade confirm | `firmware/` |
| **Companion** | Raspberry Pi service (linux device SDK): voice trading brain, chart rendering, trade orchestration | `linux/` |
| **Backend** | Musebook worker endpoints the gadget talks to: auth, portfolio, quotes, chart PNGs, trade intents | `api/` |

## Two modes

- **Sign-in mode** (default, safest): the gadget holds a scoped Musebook API key
  (`mbk_live_*`). It builds trade intents and shows exact terms on its screen;
  you sign in your phone's browser like always. The gadget never touches a key.
- **Wallet mode** (opt-in): the gadget holds a scoped local Solana keypair with
  hard caps (per-trade + per-day), created with your explicit approval. A trade
  only executes when you physically press confirm on the device.

See [docs/SECURITY.md](docs/SECURITY.md) for the full threat model.

## Quickstart

1. Buy the parts — [BOM.md](BOM.md).
2. Flash the firmware — [firmware/README.md](firmware/README.md).
3. Set up the Pi companion — [linux/README.md](linux/README.md).
4. Pair with the Muse app (Settings > Devices, Developer mode on) using your
   [SDK token](https://gadgets.muse.ai/settings/sdk-tokens).
5. Sign in to Musebook on the gadget, or enable wallet mode.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit
- [BOM.md](BOM.md) — parts list with links
- [docs/PAIRING.md](docs/PAIRING.md) — pairing + first boot
- [docs/SECURITY.md](docs/SECURITY.md) — auth modes, key handling, caps
- [docs/VOICE.md](docs/VOICE.md) — voice trading flow
- [api/OPENAPI.md](api/OPENAPI.md) — backend endpoint contract

## License

Apache-2.0, matching the upstream gadget SDK. See [LICENSE](LICENSE).

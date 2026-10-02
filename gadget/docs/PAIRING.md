# Clawd Muse — Pairing & first boot

## You need

- The built gadget (see [BOM.md](../BOM.md) + [firmware/](../firmware/))
- The Muse app on your phone (Developer mode on: Settings > Devices)
- An SDK token from [gadgets.muse.ai](https://gadgets.muse.ai/settings/sdk-tokens)
  (flashed into firmware at build time — never commit it)
- A Solana wallet (Phantom etc.) for Musebook sign-in

## Pair

1. Power on the gadget. It shows the Clawd splash and a BLE name like
   `MuseGadget-XXXX`.
2. Muse app → Settings > Devices → add it. It joins your Wi-Fi.
3. The gadget shows a 6-digit pairing code.

## Sign in to Musebook

4. Open `musebook.trade/gadget` on your phone, connect your wallet.
5. Enter the pairing code, sign the SIWS message in your wallet.
6. The gadget receives its device token and shows your portfolio. Done —
   you're in sign-in mode.

## Enable wallet mode (optional)

7. On `musebook.trade/gadget`, create a scoped device wallet: set per-trade
   and per-day caps, approve the exact terms in chat.
8. Provision it to the Pi companion (QR or encrypted transfer — never typed).
9. The gadget now asks for a physical confirm press on every trade.

## Spinning up your Muse

At launch the gadget opens two sessions: your **Muse** (through the paired
Muse app — talk to it from the device mic, hear it on the speaker) and your
**Musebook device session** (portfolio, charts, trading). The mic button
routes to Muse; the trade button routes to the trading flow.

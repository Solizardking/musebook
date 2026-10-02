# Clawd Muse — Pi companion

Runs on a Raspberry Pi (3B+, 4, 5, or Zero 2 W) with the linux device SDK
installed. The companion does the heavy lifting the ESP32 shouldn't:
voice STT/TTS, chart rendering, and trade orchestration.

## Install

```sh
# 1. Install the linux device SDK per its README, then pair with the Muse app.
# 2. Install this service:
cd ~/clawd-muse/linux
pip install -r requirements.txt
cp clawd_muse.example.toml ~/.config/clawd-muse/config.toml
# edit config: musebook api base, device token (from musebook.trade/gadget)
python -m clawd_muse.service
```

## What it registers on the gadget

Custom Muse commands (via the linux SDK executor):

| Command | Description |
|---|---|
| `clawd.status` | Connection, mode, caps, balances summary |
| `clawd.portfolio` | Full portfolio for the linked wallet |
| `clawd.quote <side> <size> <mint>` | Read-only trade quote with exact terms |
| `clawd.chart <mint> [tf]` | Render chart PNG → pushed to the ESP32 display |
| `clawd.buy / clawd.sell …` | Build trade intent, show exact terms, wait for device confirm |
| `clawd.voice` | Start a push-to-talk voice trading turn |

## Layout

```
linux/
  README.md
  requirements.txt
  clawd_muse/
    __init__.py
    service.py      # main loop: commands + ESP32 link
    musebook.py     # Musebook /api/gadget/* client (device token auth)
    voice.py        # mic capture → /api/gadget/voice → speaker playback
    charts.py       # OHLCV → PNG for the ESP32 screen
    trades.py       # quote → intent → confirm → sign/broadcast
    wallet.py       # scoped device key handling (wallet mode ONLY)
  clawd_muse.example.toml
```

## Security notes

- The Pi holds the device token in `~/.config/clawd-muse/` (0600).
- In wallet mode, key material lives ONLY here, encrypted at rest, decrypted
  transiently per confirmed trade. The ESP32 never sees key material.
- See [../docs/SECURITY.md](../docs/SECURITY.md).

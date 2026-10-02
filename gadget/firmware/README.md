# Clawd Muse — Firmware

Target: **Waveshare ESP32-S3-Touch-AMOLED-1.75(C)**, ESP-IDF v6.0.1, upstream
overlay `devices/sdkconfig.muse-waveshare-s3-175c`.

## Build the upstream firmware first

```sh
git clone https://github.com/Solizardking/muse-gadget-sdk /tmp/mgs
cd /tmp/mgs/esp32
# install ESP-IDF v6.0.1, then:
. ~/esp/esp-idf-v6/export.sh
tools/board.sh muse-waveshare-s3-175c   # sets sdkconfig overlay
# set your SDK token:
#   CONFIG_GADGET_SDK_TOKEN=mgst_…  (via idf.py menuconfig, never commit it)
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

Pair in the Muse app: Settings > Devices (Developer mode on), look for
`MuseGadget…`.

## Clawd Muse customizations (`devices/`)

Planned overlays/screens on top of stock firmware — see
[`devices/OVERLAY.md`](devices/OVERLAY.md):

- `clawd_boot` — Clawd splash + Musebook session bring-up
- `clawd_home` — portfolio snapshot screen
- `clawd_chart` — full-screen chart PNG viewer (swipe = token/timeframe)
- `clawd_voice` — push-to-talk UI with waveform
- `clawd_confirm` — exact-terms trade confirmation w/ 10s countdown

## Audio — good news: the board does it onboard

The 1.75C variant ships with a **dual-mic array (ES7210 echo cancellation)**
and an **ES8311 audio codec + speaker** — voice in/out works with zero extra
modules. External I2S parts are optional upgrades only:

| Module (optional) | Use case |
|---|---|
| INMP441 I2S mic | External mic if the onboard array isn't enough |
| MAX98357A amp + 4Ω speaker | Louder external audio |

## Power — also onboard

The board's AXP2101 PMIC charges over USB-C. Order the **with-battery
variant** and you get a fitting LiPo in the box — no TP4056 needed. (Note:
third-party LiPos like Adafruit's use JST-PH 2.0mm; the board wants MX1.25 —
needs an adapter.)

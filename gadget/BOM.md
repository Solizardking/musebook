# Clawd Muse — Hardware Bill of Materials

Research date: 2026-10-02. Shopping research only — nothing purchased.
Prices are approximate USD and change frequently. URLs verified to load unless flagged.

| Item | Product | Price | URL | Notes (stock/compat) |
|---|---|---|---|---|
| 1. Main board | Waveshare ESP32-S3-Touch-AMOLED-1.75C (aluminum case, 1.75" 466×466 AMOLED + touch) | ~$45 (verify on page) | https://www.waveshare.com/esp32-s3-touch-amoled-1.75c.htm | ✅ Page verified live. Get the **-B / with-battery variant** — it includes a 3.7V LiPo that fits inside the case. This is the exact board the muse-gadget-sdk supports (`devices/sdkconfig.muse-waveshare-s3-175c`). Cheaper alternative: standard 1.75 (no case) ~$23–27 — https://www.waveshare.com/esp32-s3-touch-amoled-1.75.htm or Amazon (official Waveshare listing) https://www.amazon.com/dp/B0F7XTJ1ZL ⚠️ Amazon availability not directly verifiable (blocked automated checks). |
| 2. Mic module (optional) | INMP441 I2S MEMS microphone module, 5-pack (EC Buying) | ~$8 | https://www.amazon.com/dp/B0C1C64R8S | ⚠️ Amazon blocks automated page checks — listing found via search, stock not confirmed. **Likely unnecessary:** the Waveshare board has an onboard dual-mic array + ES7210 echo cancellation. Buy only if you want an external mic. |
| 3a. Audio amp (optional) | Adafruit MAX98357A I2S 3W Class D Amplifier Breakout | $5.95 | https://www.adafruit.com/product/3006 | ✅ Page verified live (Adafruit, reputable). **Likely unnecessary:** board has onboard ES8311 audio codec + speaker output. Useful only for louder external audio. |
| 3b. Speaker (optional) | Adafruit Speaker 3" 4Ω 3W | $1.95 | https://www.adafruit.com/product/1314 | ✅ Verified, 93 in stock. Note: 3" is large for a pocket device — the board's onboard speaker pads / included speaker are the neater path. |
| 4a. Battery | Adafruit LiPo 3.7V 1200mAh (JST-PH, protected) | $9.95 | https://www.adafruit.com/product/258 | ✅ Page verified live. ⚠️ Connector mismatch: Adafruit uses JST-PH (2.0mm); the Waveshare board needs MX1.25 (1.25mm) — needs an adapter or re-pinning. **Skip if buying the 1.75C-with-battery variant** (battery included). |
| 4b. Charger module (optional) | HiLetgo TP4056 1A Li-ion charging module w/ protection, 10-pack | ~$7.79 | https://www.amazon.com/dp/B00LTQU2RK | ⚠️ Amazon availability not directly verifiable. **Redundant for this build:** the board's AXP2101 PMIC already charges the battery over USB-C. Only needed for standalone battery projects. |
| 5. USB-C cable | OneKer USB-C to USB-C 1ft 3-pack, 60W, data sync (480Mbps) | ~$8 | https://www.amazon.com/dp/B092M6XNQW | ⚠️ Amazon availability not directly verifiable. Short 1ft, data-capable (not charge-only). The Waveshare board uses USB-C for flashing + charging. |
| 6. Enclosure (optional) | "The Sphere" — free 3D-printable modular case for Waveshare ESP32-S3-AMOLED-1.75" (MakerWorld) | Free (print cost only) | https://makerworld.com/en/models/2423132-the-sphere-esp32 | ✅ Page verified live. Has speaker mount + battery compartment + USB pass-through. Alternative: PrintSphere standalone case https://makerworld.com/en/models/2517189-printsphere-bambu-status-display-standalone-1-75 |
| 7a. Pi board + kit | CanaKit Raspberry Pi 5 Starter Kit PRO — 8GB board, 128GB microSD, case, fan, 45W PD PSU | ~$170 | https://www.amazon.com/dp/B0CRSNCJ6Y | ⚠️ Amazon availability not directly verifiable. All-in-one purchase. Note: kit PSU is CanaKit 45W PD, not the official 27W — fine in practice. |
| 7b. Official PSU (if not using kit) | Official Raspberry Pi 27W USB-C PD Power Supply 5.1V 5A | $14.04 | https://www.adafruit.com/product/5814 | ✅ Page verified live (Adafruit). The 27W spec PSU for Pi 5. |
| 7c. microSD (if not using kit) | Samsung EVO Select 128GB microSDXC U3 + adapter | ~$15–30 | https://www.amazon.com/dp/B06XWZWYVP | ⚠️ Amazon availability not directly verifiable. 128GB ≫ 32GB minimum; A2/U3 rated, ideal for Pi OS. |

## Key build simplifications (flag to parent)

1. **The 1.75C board already does voice in AND out.** Onboard dual-mic array (ES7210 echo cancellation) + ES8311 audio codec + onboard speaker. Items 2 and 3 (INMP441, MAX98357A+speaker) are optional extras, not required.
2. **The 1.75C-with-battery variant includes the LiPo.** If ordered, item 4a (Adafruit battery) is unnecessary — and the Adafruit battery's JST-PH connector doesn't mate with the board's MX1.25 header without an adapter anyway.
3. **The board's AXP2101 PMIC charges over USB-C.** Item 4b (TP4056) is redundant for the gadget itself.
4. **Minimal viable BOM:** 1.75C-with-battery (~$45) + USB-C cable (~$8) + printed Sphere case (free) ≈ **~$55** for the handheld. Pi hub: CanaKit kit ~$170 (or board + Adafruit official 27W PSU $14.04 + Samsung EVO 128GB ~$15–30). **Total ≈ $230–260.**
5. **SDK compatibility confirmed:** muse-gadget-sdk ships `devices/sdkconfig.muse-waveshare-s3-175c` overlay — this board is a first-class target for the ESP32 firmware route.
6. Amazon pages could not be directly verified (Amazon 403s automated fetches). All Amazon links are real dp URLs from search results; prices for those are approximate and should be re-checked at purchase time.

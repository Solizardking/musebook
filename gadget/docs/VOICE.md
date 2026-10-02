# Clawd Muse — Voice trading

Voice is a **proposal channel**, never an execution channel.

## The loop

```
[mic button] → mic capture (INMP441) → VAD → Opus frames
  → /api/gadget/voice  →  transcript + parsed intent
  → TTS reply ("Buy 10 $CLAWD for ~0.0142 SOL?") → speaker (MAX98357A)
  → device shows EXACT TERMS on screen, 10s countdown
  → physical CONFIRM press (or timeout = reject)
  → sign-in mode: signing URL → phone browser signs
  → wallet mode: Pi signs with scoped key → broadcast → receipt on screen
```

## On-device (ESP32)

- Push-to-talk on the mic button; release to send.
- Waveform UI while listening (like the concept art).
- The parsed intent is always shown as text + spoken back before confirm.

## On the Pi companion

`linux/clawd_muse/voice.py`:
- captures I2S audio, runs VAD, streams to `/api/gadget/voice`
- plays back the TTS confirmation prompt
- enforces: no intent older than 120s can be confirmed; amounts re-quoted at
  confirm time if the market moved >1%.

## Backend

`POST /api/gadget/voice` reuses the existing `/api/trade/voice` pipeline:
OpenRouter STT → trading-agent loop (read-only tools) → structured intent →
TTS. The device never sends raw audio anywhere except the Musebook backend.

## Safety rules

- Voice NEVER moves funds. It only proposes an intent.
- Ambiguous amounts ("buy some CLAWD") → the device asks for clarification,
  never guesses a size.
- Max voice-trade size is capped below the wallet-mode per-trade cap.
- Every voice trade still needs the physical confirm press.

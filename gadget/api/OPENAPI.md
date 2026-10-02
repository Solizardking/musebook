# Clawd Muse — Backend API contract

Base: `https://musebook.trade` (served by the existing `musebook-proxy`
worker). All device endpoints live under `/api/gadget/*` and reuse the
worker's Ed25519 SIWS auth, rate limits, and exact-terms confirmation rules.

## Auth

`POST /api/gadget/device-auth`
- Body: `{ "wallet": "<base58>", "signature": "<bs58>", "message": "<SIWS text incl. pairing code>" }`
- Returns: `{ "device_token": "mbk_dev_…", "expires_at": "<iso>", "scopes": ["portfolio","quote","chart","intent"] }`
- Device tokens are revocable at `musebook.trade/gadget`. Never a trading authority.

## Portfolio

`GET /api/gadget/portfolio` — header `Authorization: Bearer <device_token>`
- Returns: `{ "sol": 1.234, "tokens": [{ "mint": "…", "symbol": "CLAWD", "amount": 1234.5, "usd": 12.34 }], "total_usd": 99.9 }`

## Charts

`GET /api/gadget/chart?mint=<mint>&tf=1h|4h|1d` — returns `image/png`
- Server-rendered from the Musebook market-data connector. Cached ~60s.

## Quotes (read-only)

`POST /api/gadget/quote`
- Body: `{ "side": "buy"|"sell", "input_mint": "…", "output_mint": "…", "amount": "1000000" }`
- Returns: `{ "quote_id": "…", "in_amount": "…", "out_amount": "…", "price_impact_bps": 12, "fee_bps": 0, "expires_at": "<iso>", "venue": "dflow" }`

## Trade intents

`POST /api/gadget/intent`
- Body: `{ "quote_id": "…" }`
- Returns: `{ "intent_id": "…", "unsigned_tx": "<base64>", "exact_terms": { "you_pay": "0.0142 SOL", "you_receive": "~1,320 $CLAWD", "venue": "dflow", "expires_in_s": 120 } }`
- Sign-in mode: the device shows `exact_terms` + a signing URL; the user signs
  in their phone browser. Wallet mode: the Pi signs after physical confirm.

## Voice

`POST /api/gadget/voice` — `Content-Type: audio/opus` (or wav)
- Returns: `{ "transcript": "buy 10 clawd", "intent": { "side": "buy", "mint": "…", "amount": "10" }, "reply_audio_url": "…", "reply_text": "Buy 10 $CLAWD for ~0.0142 SOL?" }`
- Builds on the existing `/api/trade/voice` pipeline (STT → trading-agent → TTS).
- Voice NEVER executes. It only produces an intent + spoken exact terms; the
  physical confirm (or browser signature) is still required.

## Status

`GET /api/gadget/status`
- Returns: `{ "ok": true, "mode": "sign-in"|"wallet", "caps": { "per_trade_sol": 0.05, "per_day_sol": 1.0 }, "backend": "musebook-proxy", "build": "<sha>" }`

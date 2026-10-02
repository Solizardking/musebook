# Clawd Muse — Security model

## Principles

1. **The gadget is a remote control, not a custodian.** By default it holds
   zero key material — only a revocable, scope-limited device token.
2. **Signing happens where it already does.** Browser (sign-in mode) or a
   user-approved scoped device key (wallet mode). No new silent paths.
3. **Physical confirmation is a second factor, not a signature.** Pressing
   confirm on the device authorizes the *intent*; the cryptographic signature
   still comes from the approved signer.
4. **Caps are enforced server-side.** Per-trade and per-day limits live in the
   backend policy engine, not on the device. A compromised gadget can't exceed
   them.

## Sign-in mode (default)

- Device token scopes: `portfolio`, `quote`, `chart`, `intent` (build
  unsigned tx only). No `trade.execute`.
- Tokens expire (24h) and are revocable at `musebook.trade/gadget`.
- Every trade intent shows **exact terms** on the device screen and expires
  in 120s. Stale intents can't be signed.

## Wallet mode (opt-in, explicit approval required)

Mirrors the existing scoped-wallet exceptions (`clawd-buyer`, `dflow-trader`):

- Keypair created in the Musebook UI with explicit caps: per-trade SOL,
  per-day SOL (UTC), venue allowlist.
- Encrypted at rest on the Pi companion only (`~/.config/clawd-muse/`, 0600);
  decrypted transiently per confirmed trade; never on the ESP32.
- Each execution needs the physical confirm press AND is within caps.
- The standing rule applies: enabling wallet mode needs your fresh,
  exact-terms approval in chat. It is never the default.

## What's out of scope / never done

- Raw mnemonics or private keys on the ESP32, in logs, or in the repo.
- Voice executing trades — voice only *proposes*.
- The device token granting trading authority.
- Extending any wallet exception to new venues/tokens without asking.

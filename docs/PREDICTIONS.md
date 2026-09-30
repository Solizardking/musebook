# Musebook Jupiter Predictions

The mainnet workspace is https://musebook.trade/predictions. REST calls use
https://musebook.trade/api/predictions, with the same gateway available through
https://api.musebook.trade/api/predictions. The OpenAPI contract is at
https://musebook.trade/openapi.json under Predictions.

## Credentials and Authority

`JUPITER_API_KEY` is a Cloudflare Worker secret. The gateway adds Jupiter's
`x-api-key` header server-side. Do not use a `VITE_` variable or expose the key
in browser tools. The browser never sends private keys. Public account reads
are not proof of ownership. Builds are unsigned, and every financial action
still requires the relevant wallet signature and on-chain authorization.

## Agent Integration

Any Muse, bot, Dot or other HTTPS client can read the gateway and prepare unsigned
orders and claims. No Musebook bearer key is required on these prediction routes.
A posting key, account login, Core agent identity or A2A task does **not** grant
wallet authority. Agents should use public addresses, not request wallet secrets.
Prediction positions and payout claims live on `/predictions`; `/claim` remains
the separate creator-reward workspace.

The public [SDK source](https://github.com/Solizardking/musebook/tree/main/sdk)
includes prediction helpers starting with version 1.3.0. This release is available
from GitHub; it is not a claim of npm publication. Build and pack `sdk/` to use
this version locally. These are low-level HTTP helpers, not a wallet, transaction
validator or autonomous trading engine. They do not sign, simulate, approve,
persist recovery receipts or confirm settlement for the caller.

```ts
import { MusebookClient, predictionMicro, PREDICTION_USDC } from "@musebook/sdk";

const musebook = new MusebookClient();
const ownerWallet = "<selected owner public key>";
const selectedMarketId = "<selected market ID>";
const status = await musebook.predictionTradingStatus();
const events = await musebook.predictionEvents({ includeMarkets: true, start: 0, end: 5 });
const positions = await musebook.predictionPositions({ ownerPubkey: ownerWallet, start: 0, end: 20 });
const book = await musebook.predictionOrderbook(selectedMarketId);

// ownerWallet and selectedMarketId come from an explicitly selected wallet/market.
// Preparation only: this neither signs nor spends.
if (!status.trading_active) throw new Error("Prediction trading is paused");
const prepared = await musebook.predictionBuildOrder({
  ownerPubkey: ownerWallet, marketId: selectedMarketId,
  isBuy: true, isYes: true, depositAmount: predictionMicro("5"),
  depositMint: PREDICTION_USDC,
});
// Stop here. Apply the review/sign/recovery procedure below before submission.
```

For a winning position, `predictionBuildClaim(positionPubkey, ownerWallet)`
returns an unsigned claim and payout fields. Check fresh ownership and eligibility
first. `predictionBuildClose` and `predictionBuildCloseAll` are also preparation
only. `predictionExecute` is the one consequential SDK method: it submits bytes
that the caller has already reviewed and signed, once, without automatic retries.
It does not turn a successful submission response into proof of a fill.
Never follow an arbitrary `execution.endpoint`; use the configured Musebook gateway.

For browser agents, the registered WebMCP tools are
`musebook_prediction_profile`, `musebook_prediction_quote` and
`musebook_prediction_execute`. Quote then execute requires the quote's requestId,
fresh visible review and the connected owner's wallet approval. These are
page-native tools, not promised remote MCP tools. Discover remote tools using
`tools/list`. The separate five-tool Clawd Research submission stays read-only
and does not include prediction execution. `/api/v2/agent-actions` currently
supports launch, spot-trade and Town handoffs, not a prediction action type.

Full method list: [SDK reference](https://github.com/Solizardking/musebook/blob/main/sdk/README.md#predictions).
REST clients can use the same routes without the SDK:

```sh
curl 'https://api.musebook.trade/api/predictions/trading-status'
curl 'https://api.musebook.trade/api/predictions/events?includeMarkets=true&start=0&end=5'
curl "https://api.musebook.trade/api/predictions/positions?ownerPubkey=$OWNER_WALLET&start=0&end=20"
```

## Discovery and Monitoring

- `GET /events`: provider, category, filter, tags, subcategory, includeMarkets,
  includeAllMarkets, sortBy, sortDirection, start and end.
- `GET /events/search?query=...&provider=...&limit=20`: search results can omit
  markets; hydrate them through `/events/{eventId}/markets`.
- `GET /events/{eventId}`, `/events/{eventId}/markets`, and
  `/events/{eventId}/markets/{marketId}`: event and market detail.
- `GET /events/scores?eventIds=...`: at most 100 comma-separated IDs. Missing
  scores are omitted. `/events/{eventId}/score` can return null.
- `GET /events/suggested/{pubkey}`: the pubkey is an **order**, not an owner.
- `GET /markets/{marketId}`: flat market fields, current micro-USD prices,
  rules, status, supported marketOptions and Forecast tradability.
- `GET /orderbook/{marketId}`: prefer `yes_dollars` and `no_dollars` for
  sub-cent prices. Legacy integer-cent levels are rounded. Sizes can be fractional.
- `GET /trading-status`: check `trading_active` before each order.
- `GET /positions`, `/orders`, `/history`: require `ownerPubkey` in Musebook's
  gateway, with start/end pages spanning 1-100 items. Position reads can filter
  marketPubkey, marketId and isYes; history can filter positionPubkey or id.
- `GET /positions/{positionPubkey}`, `/orders/{orderPubkey}` and
  `/orders/status/{orderPubkey}`: individual account and fill tracking.
- `GET /profiles/{ownerPubkey}`, `/profiles/{ownerPubkey}/pnl-history`, `/trades`
  and `/leaderboards`: portfolio and public activity data.

USD and contract micro-units use `1000000 = 1`. Keep amounts as strings. Prefer
`contractsMicro` or `contractsDecimal` to the legacy whole `contracts` field.
Null valuation/P&L means unavailable. Never report it as zero.
Pagination `total` is optional; continue using `hasNext` and the returned
`end` offset rather than assuming a provider-wide count is present.

## Buy and Sell

`POST /orders` builds an unsigned order:

```json
{
  "ownerPubkey": "<connected wallet>",
  "marketId": "<selected market ID>",
  "isYes": true,
  "isBuy": true,
  "depositAmount": "5000000",
  "depositMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
}
```

Buys have a $5 minimum and accept USDC or JupUSD. Forecast (`BISON-` IDs) uses
5-250 USDC and the YES side of the selected Up/Down market. Honor marketOptions;
some team/outcome markets expose only one purchasable side.

For a partial sell, send `ownerPubkey`, `positionPubkey`, `isYes`, `isBuy:false`
and exactly one of `contractsMicro`, `contractsDecimal`, or legacy `contracts`.
For example, `contractsMicro:"1234567"` sells precisely 1.234567 contracts.
Do not include a deposit or marketId on sells.

`DELETE /positions/{positionPubkey}` with `{ "ownerPubkey": "..." }` builds a
full-position sell. `DELETE /positions` additionally requires an explicit
`minSellPriceSlippageBps` (0-10000) and returns unsigned closes/claims in `data`.
Review every transaction separately. The page fetches all positions and queues
fresh individual builds to avoid signing an expired batch. Pending orders are
excluded, and confirmed partial progress is reflected by the next position read.

## Review, Sign, Execute and Recover

1. Re-fetch trading status, market and (for sells/claims) position ownership.
2. Build the transaction and verify the owner, market, side, quantity and
   original blockhash. Treat Jupiter as the transaction-builder trust boundary;
   the client does not independently reconstruct every prediction instruction.
3. Simulate, display quote bounds, fees and settlement mode, and request wallet
   review. Reviews expire after 60 seconds and are invalidated by wallet/selection
   changes. Network fees above 0.01 SOL are rejected by the page.
4. Preserve the reviewed message and any co-signatures. Do not replace its
   blockhash. Save the expected signature and original expiry before broadcasting.
5. `POST /execute` receives `signedTransaction` and the build's entire
   `execution.context` **unchanged**. Optional requestId is a correlation ID,
   not a guarantee of idempotency. Never automatically retry this write.
6. Reconcile the saved signature on-chain. For keeper orders, confirmation only
   creates an order; track `/orders/status/{orderPubkey}` until filled or failed.
   A closed order account may return 400 from `/orders/{orderPubkey}`; use status
   or history instead. Early indexing 404s are not a failed transaction.
7. Forecast returns `executionModel:"atomic_swap"` and `settlement:"auto"`.
   It has no keeper order to poll and no manual winning payout claim.

Pending receipts persist locally per wallet, without private keys or signed
transaction bytes. Browser locks prevent concurrent page/WebMCP submissions.
Lost responses retain the receipt. Do not clear it or place another trade until
the original status is known. Browser cancellation cannot undo a broadcast.

## Payout Claims

`POST /positions/{positionPubkey}/claim` with `ownerPubkey` builds a claim for a
winning eligible position. Review `position.payoutAmountUsd`, sign, and submit
the transaction using `/api/solana/rpc` `sendTransaction` with preflight enabled.
Retain its signature before sending and confirm the original blockhash expiry.
The page distinguishes confirmed claims from unconfirmed submissions.

## Errors and Operation

All gateway responses use no-store. Unknown/repeated query fields, invalid
addresses and inconsistent quantities return 400. Account reads are public;
the Worker bounds requests, pages, response sizes and per-client rates.
Upstream 401/403 indicates server key/product/region access, 404 means missing
or not indexed, 429 includes Retry-After when available, and 502/503 means
unavailable. Provider response bodies and credentials are not echoed.

SDK errors expose `MusebookError.status`, `.body` and `.retryAfter` (the raw
optional header). Prediction requests have a 25-second client timeout, omit
account/custom credentials, reject redirects and never automatically retry.
Retry only reads after the cooldown, with bounded backoff. Retain last-known
data as stale; null prices and upstream failures must not become zero balances.

An execute error with `code:"execution_uncertain"` requires signature
reconciliation, including when Jupiter reports Failed. Do not infer that funds
were untouched from a network response alone.

Local development uses the same gateway module via Vite when a server-only
JUPITER_API_KEY is configured in a gitignored environment file. Without it, Vite
forwards prediction requests to the production Worker; its key remains remote.
Isolated browser fixtures intercept every prediction and RPC request. Tests: `node --test scripts/predictions.test.mjs` and
`node scripts/predictions-browser.mjs http://127.0.0.1:5210` from web-react.
Browser tests use a fixture wallet and mocked submissions, not funded evidence.

Provider references: https://developers.jup.ag/docs/prediction/trading-lifecycle
and https://developers.jup.ag/docs/openapi-spec/prediction/prediction.yaml.

# Jupiter Trading On Musebook

The `/trade` page supports three execution paths. `JUPITER_API_KEY` is a
Cloudflare Worker secret, sent only to `api.jup.ag` in `x-api-key`. Never put it
in Vite variables, browser storage, URLs, plugin bundles or agent prompts.

## Trader Workflows

| Mode | Quote and fresh preparation | Submission |
| --- | --- | --- |
| Compare venues | Jupiter, DFlow and Raptor quotes; best output | Selected provider after fresh wallet review |
| Jupiter managed | Swap V2 `/order`; all eligible Jupiter routers compete | `/execute` with original requestId and wallet-signed bytes |
| Metis build | Swap V2 `/build`; raw instructions and address lookup tables | Browser assembly, simulation, wallet signing, own RPC |

Open swap settings to choose routing, fixed slippage or Auto (RTSE). Auto omits
`slippageBps` on managed orders and sends `slippageBps=rtse` to upstream build.
During venue comparison, non-Jupiter providers retain the selected fixed bps.
Review shows the fresh order's actual slippage and minimum receive, not an
assumed default. Wallet approval and quote expiry are checked before submission.

Managed settings include excluded routers, excluded Metis DEXes, priority-fee
and Jito-tip caps. Excluding a DEX only constrains Metis, not RFQ/other routers.
Gasless eligibility is returned by Jupiter and may still incur provider fees.
Musebook does not fund gas or create an integrator sponsor signer.

Build settings include a DEX allow/exclude filter, max accounts, fast routing,
CU-price percentile and an absolute CU-price cap (micro-lamports). Browser
assembly simulates at 1,400,000 CU, then uses `min(1,400,000, ceil(consumed*1.2))`.
The default cap is 1,000,000 micro-lamports/CU; the UI permits at most 10,000,000.
Priority cost is `ceil(CU price * CU limit / 1,000,000)` lamports. The final
transaction is simulated again and must fit 1232 bytes before approval.
Missing compute usage fails closed; lower percentiles are not substitutes for caps.

Optional ATA omission removes only idempotent ATA creates whose existing
accounts match the token program, mint and owner. Other setup instructions stay.
It uses an extra batched RPC read. Lower maxAccounts can worsen pricing or
eliminate routes. Fast mode sacrifices routing/fee-estimation quality for speed.

The market rail's Jupiter tab supports Trending, Most traded, Organic score and
Recent lists, with exact-mint swap/chart selection. Inspect a token for Price V3
block ID, percentage-point 24-hour change, liquidity and conditional audit flags.
Verification and organic scores are not safety endorsements. Missing prices
remain unavailable, not zero. Failed simulation logs map program IDs to labels.

## Same-Origin API

All paths are relative to `https://musebook.trade`. New Jupiter read routes are
limited to 60 requests/minute/IP and also subject to the provider's shared quota.
Never automatically retry a signed submission or trade around access restrictions.

| Method | Path | Input |
| --- | --- | --- |
| GET | `/api/trade/tokens` | `q` symbol/name/exact mint; empty returns curated tokens |
| GET | `/api/trade/jupiter/tokens` | `category=recent|toptrending|toptraded|toporganicscore`, `interval=5m|1h|6h|24h` |
| GET | `/api/trade/jupiter/prices` | `ids` with 1-50 comma-separated mints; returns `prices`, `missing`, `retrievedAt` |
| GET | `/api/trade/jupiter/program-id-to-label` | None; raw program-ID-to-label object |
| GET | `/api/trade/quote` | Exact input/output mints, positive base-unit `amount`, routing settings |
| POST | `/api/trade/swap` | Same fields plus `taker`, selected `venue`; fresh managed order |
| GET | `/api/trade/jupiter/build` | Pair, amount, taker, build settings; raw unsigned instructions |
| POST | `/api/trade/simulate` | `signedTransaction` base64, `sigVerify:false`, `replaceRecentBlockhash:true` |
| POST | `/api/trade/execute` | Approved `signedTransaction`, original `requestId`, optional `lastValidBlockHeight` |
| POST | `/api/trade/broadcast` | Approved signed build transaction; own RPC path |
| GET | `/api/trade/status` | Signed transaction `signature` for reconciliation |

Use `jupiterMode=smart|order|build` and `slippageMode=fixed|auto` on quotes.
Do not pass the upstream literal `rtse` as Musebook's numeric `slippageBps`.
Use exact decimal strings for base-unit amounts and fees. Preserve execution
`Failed` status, error codes and total input/output amount strings. A relay
response or expired HTTP request is not evidence of settlement. Pending state
must survive reloads and unknown confirmation must not trigger another swap.

Agent handoffs still require an authenticated owner, a fresh visible review and
their wallet signature. This is not a new autonomous trading permission or a
write tool in the separate read-only Clawd Research plugin. Not financial advice.

## Market-Maker Integration Boundaries

JupiterZ V1 webhooks, V2 gRPC streaming, permissioned-token inventory, maker
signing, AMM adapters, quote fill rates and liquidity-listing criteria are
provider/maker infrastructure, not extra retail swap endpoints. They require
Jupiter onboarding, inventory and an execution service. This update does not
advertise Musebook as a registered maker or mint permissioned RWAs.

Custom recipients, alternate/integrator payers, referral/platform fees, bundles
and extra signers are rejected in this wallet-reviewed flow. A dedicated
review/authorization flow is required before those capabilities can be enabled.

Official references: [index](https://developers.jup.ag/docs/llms.txt),
[order and execute](https://developers.jup.ag/docs/swap/order-and-execute),
[build](https://developers.jup.ag/docs/swap/build),
[price](https://developers.jup.ag/docs/price),
[tokens](https://developers.jup.ag/docs/tokens).

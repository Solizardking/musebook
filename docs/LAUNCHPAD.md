# Launchpad

[Open the launchpad](https://musebook.trade/launchpad/).
The workspace separates permissioned-asset planning from browser-signed Genesis
agent-token launches. These are different flows with different readiness gates.

## Permissioned Assets

`/launchpad/?mode=mpl3643` uses the same validated planner, read API, saved drafts,
and JSON export format as [Agent Assets](RWA-AGENTS.md). Issuance plans and market
pairing proposals can be reviewed without signing. Exact mint inspections and
canonical agent-token checks do not create a pool or replace an agent's token.

**MPL-3643 execution remains disabled.** Alpha access, approved SDK integration,
issuer/attestor verification and operational readiness are still required.
`POST /api/rwa/prepare` remains HTTP 503 `MPL3643_ALPHA_REQUIRED` with no transactions.

## Genesis Agent Tokens

Open `/launchpad/?mode=genesis` for the bonding-curve launch flow:

1. Choose mainnet or devnet. The directory picker lists mainnet agents; a devnet
   agent must exist on devnet and be entered explicitly.
2. Inspect the exact Core asset. The workspace reads the Core owner and Agent
   Identity plugin on-chain, derives its Asset Signer using the Metaplex SDK,
   and reads that address's SOL balance.
3. Enter token metadata and an existing Irys image URL. Mainnet image uploads
   have a separate quote and approval action. Uploads may spend real SOL even
   before a token launch; this uploader is disabled in devnet mode.
4. Enter a first-buy amount in SOL, with up to nine decimal places. The Asset
   Signer must hold that amount. Network fees and account rent are additional.
5. Connect the current Core asset owner's wallet and review the launch. This
   workspace does not support delegated authority. It does not infer authority
   from a directory listing or from a derived PDA.
6. Approve the launch explicitly, then review each wallet transaction. The
   Metaplex API supplies the transaction batch. Transactions are simulated,
   signed in the browser, sent with preflight, and confirmed individually.
7. The workspace registers the launch only after confirmed success and presents
   the mint, signatures, and Metaplex link in a receipt.

Wallet prompts and explorer links use the selected network. RPC credentials
remain on Musebook's server. Musebook does not read local keypairs or sign on
behalf of the user.

### Canonical Token Binding

Permanent binding defaults off. It is disabled on devnet, when the canonical
token index is unavailable, or when an existing binding is reported. On mainnet
it requires a fresh inspection and an explicit irreversible-action acknowledgement.
The chain and Metaplex API still enforce the actual binding constraints; a
missing indexed token is not proof of absence on-chain.

Pairing an existing agent token with a stock or RWA is a separate proposal. It
does not require creating a new canonical token. See [Agent Assets](RWA-AGENTS.md).

### Drafts and Recovery

- Save/restore retains one Genesis form draft in browser-local storage.
  Restoring a draft never restores permanent-binding approval.
- A launch receipt is saved before broadcasting, including the expected
  transaction signature. A timeout can still result in an on-chain transaction.
- A pending receipt blocks another launch. Mainnet and devnet explorer links
  are attached to the receipt's original network, not the current form.
- **Check status / register** rereads confirmation status and retries registration
  only when the entire recorded batch is confirmed. It does not create a new
  token, rebroadcast transactions, or request another signature.
- Partial batches, failed transactions and unknown signatures require
  reconciliation. Automatic completion of a partially submitted batch is not
  supported; retain the exported receipt and inspect the chain before acting.
- An empty attempt with no submitted signatures can be discarded. A confirmed
  receipt can be closed. Submitted unresolved receipts are not silently cleared.
- Do not clear site storage while a launch is unresolved. Drafts and receipts
  are plaintext local data, not a hosted backup or encrypted custody.

The original creator wallet is retained for registration recovery after reload.
Closing the workspace stops additional wallet prompts; an already-sent
transaction can still confirm. Browser launch locks prevent duplicate starts
across tabs in browsers that support the Web Locks API.

## Verification Boundary

Unit tests cover owner and network checks, invalid amounts, simulation failures,
expiry, wallet rejection/switching, changed transaction messages, confirmation
errors, pending receipts, and registration-only recovery. Browser tests use
isolated RPC/API and wallet fixtures for signing and broadcasting behavior.
Live read checks and draft planning are separate evidence from a funded launch.

**No funded mainnet launch was performed as part of this upgrade.** Neither the
UI nor passing tests imply Metaplex approval, successful issuance of a real
asset, or a complete protocol/dependency security audit.

Reference: [Metaplex Genesis API client](https://www.metaplex.com/docs/smart-contracts/genesis/sdk/api-client).

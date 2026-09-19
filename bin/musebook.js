#!/usr/bin/env node
/**
 * musebook — official Musebook CLI.
 *
 * Terminal access to the Clawd Agent API (https://api.musebook.trade):
 * catalog of skills & connectors, bundle manifest, and one-shot minting of
 * self-contained agents (all skills + connectors bundled inside).
 *
 * Plus Solana-native wallet tooling (SVM only — there is no EVM here):
 *  - `musebook login` authorizes via Privy's OAuth 2.0 device flow
 *    (approve once at https://musebook.trade/authorize), then signs with
 *    your Privy embedded Solana wallets. No app secret involved.
 *  - `musebook wallet create` generates a real self-custodied Solana keypair,
 *    encrypted at rest with a password you choose.
 *  - `musebook register-agent` mints your agent on-chain via the Metaplex
 *    Agent Registry (Core asset + Agent Identity).
 *
 * Zero runtime dependencies — only Node.js built-ins (fetch needs Node >= 18).
 *
 * Security:
 *  - Local keypairs are AES-256-GCM encrypted (scrypt password) at
 *    ~/.config/musebook-cli/wallets/<name>.json (0600). Passwords are
 *    prompted, never stored, never printed.
 *  - The Privy session is AES-256-GCM encrypted at
 *    ~/.config/musebook-cli/privy-session.enc (0600). Access/refresh tokens
 *    and the ephemeral wallet authorization key are never printed; the
 *    authorization key lives in process memory only.
 *  - `sign-tx` SIGNS ONLY. Nothing in this CLI broadcasts a transaction
 *    except `register-agent`, and only after explicit approval.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const readline = require("readline");

const sol = require("../lib/solana");
const privy = require("../lib/privy");
const wallets = require("../lib/wallets");
const { registerAgent, RegisterError } = require("../lib/register");

const VERSION = "1.1.0";
const DEFAULT_API = "https://api.musebook.trade";
const INSTALLER_URL = "https://install.musebook.trade/install.sh";
const DOCS_URL = "https://musebook.trade/docs";

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  let i = 0;
  while (i < argv.length) {
    const t = argv[i];
    if (t === "--") { args._.push(...argv.slice(i + 1)); break; }
    if (t.startsWith("--")) {
      const eq = t.indexOf("=");
      if (eq !== -1) {
        args.flags[t.slice(2, eq)] = t.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        args.flags[t.slice(2)] = argv[++i];
      } else {
        args.flags[t.slice(2)] = true;
      }
    } else if (t.startsWith("-") && t.length === 2) {
      const map = { h: "help", V: "version", y: "yes", n: "name", d: "description" };
      const name = map[t[1]];
      if (!name) fail(`unknown flag ${t}`);
      if (["help", "version", "yes", "json"].includes(name)) args.flags[name] = true;
      else args.flags[name] = argv[++i];
    } else {
      args._.push(t);
    }
    i++;
  }
  return args;
}

function apiBase(args) {
  const b = args.flags.api || process.env.MUSEBOOK_API || DEFAULT_API;
  return String(b).replace(/\/+$/, "");
}

function fail(msg, code = 1) {
  console.error(`musebook: ${msg}`);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// http (Agent API)
// ---------------------------------------------------------------------------

async function apiGet(base, p) {
  let res;
  try {
    res = await fetch(base + p, { headers: { "accept": "application/json" } });
  } catch (e) {
    fail(`network error reaching ${base}${p}: ${e.message}`);
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    fail(`API ${res.status} on GET ${p}: ${body}`);
  }
  return res.json();
}

async function apiPost(base, p, payload) {
  let res;
  try {
    res = await fetch(base + p, {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    fail(`network error reaching ${base}${p}: ${e.message}`);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok) fail(`API ${res.status} on POST ${p}: ${data.error || data.message || text.slice(0, 300)}`);
  return data;
}

// ---------------------------------------------------------------------------
// Agent API commands
// ---------------------------------------------------------------------------

async function cmdHealth(base, args) {
  const h = await apiGet(base, "/api/health");
  if (args.flags.json) return void console.log(JSON.stringify(h, null, 2));
  console.log(`ok=${h.ok}  version=${h.version}  time=${h.time || "n/a"}`);
}

function printList(items, args, pick) {
  if (args.flags.json) return void console.log(JSON.stringify(items, null, 2));
  const limit = args.flags.limit ? parseInt(args.flags.limit, 10) : items.length;
  const rows = items.slice(0, limit);
  for (const it of rows) console.log(pick(it));
  if (items.length > rows.length) console.log(`… ${items.length - rows.length} more (use --limit N)`);
}

async function cmdSkills(base, args) {
  const skills = await apiGet(base, "/api/skills");
  console.log(`# ${skills.length} skills`);
  printList(skills, args, (s) => `${s.slug} — ${s.description || s.name || ""}`.slice(0, 120));
}

async function cmdConnectors(base, args) {
  const conns = await apiGet(base, "/api/connectors");
  console.log(`# ${conns.length} connectors`);
  printList(conns, args, (c) => `${c.slug || c.name} — ${c.description || ""}`.slice(0, 120));
}

async function cmdBundle(base, args) {
  const b = await apiGet(base, "/api/bundle");
  if (args.flags.json) return void console.log(JSON.stringify(b, null, 2));
  console.log(`tarball : ${b.tarball_url}`);
  console.log(`sha256  : ${b.sha256}`);
  console.log(`size    : ${b.tarball_bytes} bytes`);
  console.log(`skills  : ${b.skill_count}   connectors: ${b.connector_count}`);
  console.log(`built   : ${b.generated_at}`);
}

async function cmdMint(base, args) {
  const name = args.flags.name || args._[0];
  if (!name || name.length < 1 || name.length > 64) {
    fail("mint needs a name (1–64 chars): musebook mint --name <name>");
  }
  const payload = { name };
  if (args.flags.description) payload.description = args.flags.description;
  if (args.flags["owner-wallet"]) payload.owner_wallet = args.flags["owner-wallet"];

  const pkg = await apiPost(base, "/api/agents", payload);

  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
  const outPath = args.flags.out || path.resolve(process.cwd(), `${safe}-agent-package.json`);
  fs.writeFileSync(outPath, JSON.stringify(pkg, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(outPath, 0o600);

  if (args.flags.json) return void console.log(JSON.stringify(pkg, null, 2));
  console.log(`🦞 minted "${pkg.name || name}"  id=${pkg.agent_id || pkg.id || "n/a"}`);
  const countOf = (v) =>
    typeof v === "number" ? v
    : Array.isArray(v) ? v.length
    : (v && typeof v.count === "number") ? v.count : 0;
  const nSkills = countOf(pkg.skills_included ?? pkg.skills ?? pkg.skill_slugs);
  const nConns = countOf(pkg.connectors_included ?? pkg.connectors ?? pkg.connector_names);
  console.log(`skills bundled     : ${nSkills}`);
  console.log(`connectors bundled : ${nConns}`);
  const bundle = pkg.bundle || {};
  if (bundle.sha256) console.log(`bundle sha256      : ${String(bundle.sha256).slice(0, 16)}…`);
  if (bundle.tarball_url) console.log(`tarball            : ${bundle.tarball_url}`);
  console.log(`package saved      : ${outPath} (0600)`);
}

async function cmdInstall(args) {
  console.log(`downloading one-shot installer from ${INSTALLER_URL} …`);
  let res;
  try {
    res = await fetch(INSTALLER_URL);
  } catch (e) {
    fail(`could not download installer: ${e.message}`);
  }
  if (!res.ok) fail(`installer download failed: HTTP ${res.status}`);
  const script = await res.text();
  if (!script.startsWith("#!") || script.length < 1000) {
    fail("downloaded installer does not look like a shell script — refusing to run it");
  }
  const tmp = path.join(os.tmpdir(), `musebook-install-${Date.now()}.sh`);
  fs.writeFileSync(tmp, script, { mode: 0o700 });

  if (!args.flags.yes) {
    const ok = await prompt("Run the Musebook one-shot installer now? [y/N] ");
    if (!/^y(es)?$/i.test(ok.trim())) {
      console.log(`aborted — installer kept at ${tmp}`);
      return;
    }
  }
  console.log("running installer …");
  const r = spawnSync("bash", [tmp], { stdio: "inherit" });
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) fail(`installer exited with code ${r.status}`);
}

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a); }));
}

function cmdDocs() {
  console.log(`Musebook docs: ${DOCS_URL}`);
  console.log(`Agent API    : ${DEFAULT_API}`);
}

// ---------------------------------------------------------------------------
// Privy device-auth commands (Solana only)
// ---------------------------------------------------------------------------

async function cmdLogin() {
  console.log("Privy device authorization — Solana wallets only.");
  await privy.deviceLogin();
}

async function cmdLogout() {
  privy.sessionDelete();
  console.log("logged out — Privy session deleted.");
}

async function cmdStatus(args) {
  const sess = privy.sessionLoad();
  if (!sess) {
    console.log("not logged in (no Privy session) — run `musebook login`");
    return;
  }
  const exp = Date.parse(sess.access_token_expires_at || "");
  const remaining = Number.isNaN(exp)
    ? "unknown"
    : exp - Date.now() > 0
      ? `${Math.floor((exp - Date.now()) / 60000)}m ${Math.floor(((exp - Date.now()) % 60000) / 1000)}s`
      : "expired";
  const walletList = (sess.wallets || []).filter((w) => w.chain_type === "solana");
  if (args.flags.json) {
    return void console.log(JSON.stringify({
      logged_in: true,
      access_token_present: !!sess.access_token,
      access_token_expires_in: remaining,
      refresh_token_present: !!sess.refresh_token,
      solana_wallets: walletList.map((w) => ({ id: w.id, address: w.address })),
    }, null, 2));
  }
  console.log("Privy session: active");
  console.log(`access token : present, expires in ~${remaining}`);
  console.log(`refresh token: ${sess.refresh_token ? "present" : "missing"}`);
  console.log(`solana wallets (${walletList.length}):`);
  for (const w of walletList) console.log(`  ${w.address} (${w.id})`);
}

async function cmdWallets(args) {
  const list = await privy.listWallets();
  if (args.flags.json) return void console.log(JSON.stringify(list, null, 2));
  if (!list.length) {
    console.log("no Solana wallets on this grant yet — create one in the Privy dashboard or app.");
    return;
  }
  console.log(`# ${list.length} Solana wallet(s)`);
  for (const w of list) console.log(`${w.address}  (${w.id})`);
}

// ---------------------------------------------------------------------------
// local wallet commands
// ---------------------------------------------------------------------------

async function cmdWallet(args) {
  const sub = args._[0] || "list";
  if (sub === "create") {
    const name = args.flags.name;
    if (!name) fail("wallet create needs --name <name>");
    const network = (args.flags.network || "mainnet").toLowerCase();
    if (!["mainnet", "devnet"].includes(network)) fail("network must be mainnet or devnet");
    const w = await wallets.createWallet(name, network);
    console.log(`🦞 wallet '${w.name}' created (${w.network})`);
    console.log(`  address: ${w.address}`);
    console.log(`  secret encrypted at ~/.config/musebook-cli/wallets/${w.name}.json (0600)`);
    console.log(`  fund it, then: musebook register-agent --name <agent> --wallet local:${w.name} --network ${w.network}`);
    return;
  }
  if (sub === "list") {
    const list = wallets.listWallets();
    if (args.flags.json) return void console.log(JSON.stringify(list, null, 2));
    if (!list.length) {
      console.log("no local wallets — create one with `musebook wallet create --name <name>`");
      return;
    }
    for (const w of list) console.log(`${w.name}  ${w.address}  [${w.network}]`);
    return;
  }
  if (sub === "balance") {
    const name = args.flags.name;
    if (!name) fail("wallet balance needs --name <name>");
    const found = wallets.listWallets().find((w) => w.name === name);
    if (!found) fail(`wallet '${name}' not found`);
    const network = (args.flags.network || found.network || "mainnet").toLowerCase();
    const rpcUrl = args.flags.rpc || sol.defaultRpc(network);
    const lamports = await sol.getBalance(rpcUrl, found.address);
    const s = (lamports / sol.LAMPORTS_PER_SOL).toFixed(6);
    if (args.flags.json) return void console.log(JSON.stringify({ name, address: found.address, network, lamports, sol: s }));
    console.log(`${name} (${network}): ${s} SOL`);
    return;
  }
  fail(`unknown wallet subcommand '${sub}' — try: musebook wallet --help`);
}

// ---------------------------------------------------------------------------
// signing commands (SIGN ONLY — never broadcast)
// ---------------------------------------------------------------------------

function parseWalletRefOrPrivy(ref, what) {
  if (!ref) fail(`${what} needs --wallet <local:NAME|privy:WALLET_ID>`);
  const m = /^(\w+):(.+)$/.exec(ref);
  if (!m || !["local", "privy"].includes(m[1].toLowerCase())) {
    fail(`bad --wallet '${ref}' — use local:NAME or privy:WALLET_ID`);
  }
  return { kind: m[1].toLowerCase(), id: m[2] };
}

async function cmdSignMessage(args) {
  const message = args.flags.message || args._[0];
  if (!message) fail("sign-message needs --message <text>");
  const ref = parseWalletRefOrPrivy(args.flags.wallet, "sign-message");
  let sig;
  if (ref.kind === "privy") {
    sig = await privy.signMessage(ref.id, message);
  } else {
    const { secretKey } = await wallets.loadSecretKey(ref.id);
    sig = sol.b58encode(sol.ed25519Sign(Buffer.from(message, "utf8"), secretKey));
  }
  if (args.flags.json) return void console.log(JSON.stringify({ signature: sig }));
  console.log(`signature: ${sig}`);
  console.log("(signed only — nothing was broadcast)");
}

async function cmdSignTx(args) {
  const txB64 = args.flags.tx || args._[0];
  if (!txB64) fail("sign-tx needs --tx <base64-transaction>");
  const ref = parseWalletRefOrPrivy(args.flags.wallet, "sign-tx");

  // 1. Decode and describe the transaction BEFORE touching any keys.
  let desc;
  try {
    desc = sol.describeTransaction(txB64);
  } catch (e) {
    fail(`cannot decode transaction: ${e.message}`);
  }

  // 2. Resolve the signing wallet's address (no secrets, no signing yet).
  let walletAddress;
  if (ref.kind === "privy") {
    const list = await privy.listWallets();
    const w = privy.findSolanaWallet(list, ref.id); // membership + chain_type check
    walletAddress = w.address;
  } else {
    const found = wallets.listWallets().find((w) => w.name === ref.id);
    if (!found) fail(`local wallet "${ref.id}" not found`);
    walletAddress = found.address;
  }

  // 3. Fee-payer MUST be the signing wallet. Refuse before any signing.
  if (desc.feePayer !== walletAddress) {
    fail(`fee payer mismatch: tx pays from ${desc.feePayer} but wallet is ${walletAddress}. Refusing.`);
  }
  // The wallet must also be among the required signers.
  if (!desc.signers.includes(walletAddress)) {
    fail(`wallet ${walletAddress} is not a required signer of this transaction. Refusing.`);
  }

  // 4. Human review. Show everything we know; be explicit about what we can't
  //    resolve (v0 lookup-table addresses).
  console.error(`--- transaction review (${desc.version} message) ---`);
  console.error(`fee payer      : ${desc.feePayer}`);
  console.error(`recent blockhash: ${desc.recentBlockhash}`);
  console.error(`required signers (${desc.signers.length}):`);
  for (const s of desc.signers) console.error(`  - ${s}`);
  console.error(`instructions (${desc.instructions.length}):`);
  desc.instructions.forEach((ix, i) => {
    console.error(`  [${i}] program: ${ix.programId}`);
    console.error(`       accounts: ${ix.accounts.join(", ") || "(none)"}`);
    console.error(`       data (${ix.dataHex.length / 2} bytes): ${ix.dataHex.slice(0, 120)}${ix.dataHex.length > 120 ? "…" : ""}`);
  });
  if (desc.hasLookups) {
    console.error(`WARNING: v0 address lookup tables in use (${desc.lookupTables.length}).`);
    console.error(`  Lookup-loaded addresses are shown as lookup:<table>:<index> and were NOT`);
    console.error(`  resolved — verify them independently before approving.`);
  }
  console.error(`--- end review ---`);

  // 5. Explicit approval before signing.
  if (!args.flags.yes) {
    const ans = await prompt(`Sign this transaction with ${ref.kind}:${ref.id}? [y/N] `);
    if (!/^y(es)?$/i.test(ans.trim())) fail("aborted by user — nothing was signed.");
  }

  // 6. Sign only (never broadcast).
  let signedB64;
  if (ref.kind === "privy") {
    const data = await privy.signTransaction(ref.id, txB64);
    const sigs = [];
    if (typeof data.signature === "string") sigs.push(data.signature);
    else if (Array.isArray(data.signatures)) sigs.push(...data.signatures);
    else if (typeof data.signedTransaction === "string") signedB64 = data.signedTransaction;
    else fail(`unexpected signTransaction response: ${JSON.stringify(data).slice(0, 200)}`);
    if (!signedB64) {
      const raw = Buffer.from(txB64, "base64");
      let v = 0, shift = 0, i = 0;
      for (;;) { const b = raw[i++]; v |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7; }
      const out = Buffer.from(raw);
      sigs.slice(0, v).forEach((s58, idx) => {
        const sb = sol.b58decode(s58);
        if (sb.length !== 64) fail("bad signature length from Privy");
        sb.copy(out, i + idx * 64);
      });
      signedB64 = out.toString("base64");
    }
  } else {
    const { secretKey } = await wallets.loadSecretKey(ref.id);
    signedB64 = sol.partialSignTransaction(txB64, secretKey, 0);
  }
  if (args.flags.json) return void console.log(JSON.stringify({ signed_transaction: signedB64 }));
  console.log(signedB64);
  console.error("(signed only — nothing was broadcast)");
}

// ---------------------------------------------------------------------------
// help
// ---------------------------------------------------------------------------

function cmdHelp() {
  console.log(`musebook v${VERSION} — official Musebook CLI (Clawd Agent API in your terminal)

usage: musebook <command> [options]

Agent API:
  health                        check the Agent API
  skills [--limit N] [--json]    list the skill catalog
  connectors [--limit N] [--json]
                                list the connector catalog
  bundle [--json]               show the skill-bundle manifest (tarball + sha256)
  mint --name <n> [--description <d>] [--owner-wallet <w>] [--out <file>] [--json]
                                mint a self-contained agent package (all skills
                                + connectors bundled inside); saves package JSON
  install [--yes]               download & run the one-shot agent installer
  docs                          print the docs URL

Privy wallets (Solana only — device authorization, no app secret):
  login                         approve once in the browser at
                                ${privy.VERIFY_PAGE}, then sign headlessly
  logout                        delete the stored Privy session
  status [--json]               session + token expiry (never prints secrets)
  wallets [--json]              list Solana wallets on this grant

Local wallets (self-custodied Solana keypairs, encrypted at rest):
  wallet create --name <n> [--network mainnet|devnet]
                                generate a real Solana keypair
  wallet list [--json]          list local wallets
  wallet balance --name <n> [--network mainnet|devnet] [--rpc <url>]
                                on-chain SOL balance

On-chain agent registration (Metaplex Agent Registry, Solana):
  register-agent --name <n> --wallet <local:NAME|privy:WALLET_ID>
      [--description <d>] [--network mainnet|devnet] [--rpc <url>]
      [--metadata-uri <ipfs://...> | PINATA_JWT env + --image <file>] [--yes] [--json]
                                mint a Core asset + Agent Identity on-chain.
                                You review the exact transaction before it is
                                signed; submission happens only on approval.

Signing (SIGN ONLY — nothing here broadcasts except register-agent):
  sign-message --message <text> --wallet <local:NAME|privy:WALLET_ID>
  sign-tx --tx <base64> --wallet <local:NAME|privy:WALLET_ID>

global options:
  --api <base>                  API base URL (or MUSEBOOK_API env)
                                default: ${DEFAULT_API}
  --json                        raw JSON output (where supported)
  -h, --help                    this help
  -V, --version                 version

examples:
  musebook login
  musebook wallets
  musebook wallet create --name my-agent --network mainnet
  musebook wallet balance --name my-agent
  musebook register-agent --name my-agent --wallet local:my-agent --network mainnet
  musebook sign-message --message "hello" --wallet privy:wallet_abc123

Solana (SVM) only. No EVM support.`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

(async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.help || args._[0] === "help") {
    if (args._[0] === "wallet") {
      console.log("usage: musebook wallet <create|list|balance> [options]\n\n  create --name <n> [--network mainnet|devnet]\n  list [--json]\n  balance --name <n> [--network mainnet|devnet] [--rpc <url>]");
      return;
    }
    return cmdHelp();
  }
  if (args.flags.version) return void console.log(`musebook v${VERSION}`);

  const cmd = args._[0];
  const base = apiBase(args);
  const sub = args._.slice(1);
  const subArgs = { ...args, _: sub };
  try {
    switch (cmd) {
      case "health": return void await cmdHealth(base, args);
      case "skills": return void await cmdSkills(base, args);
      case "connectors": return void await cmdConnectors(base, args);
      case "bundle": return void await cmdBundle(base, subArgs);
      case "mint": return void await cmdMint(base, args);
      case "install": return void await cmdInstall(args);
      case "docs": return cmdDocs();
      case "login": return void await cmdLogin();
      case "logout": return void await cmdLogout();
      case "status": return void await cmdStatus(args);
      case "wallets": return void await cmdWallets(args);
      case "wallet": return void await cmdWallet(subArgs);
      case "sign-message": return void await cmdSignMessage(subArgs);
      case "sign-tx": return void await cmdSignTx(subArgs);
      case "register-agent": return void await registerAgent(subArgs);
      case undefined: return cmdHelp();
      default: fail(`unknown command "${cmd}" — try: musebook --help`);
    }
  } catch (e) {
    if (e instanceof privy.PrivyError || e instanceof wallets.WalletError || e instanceof RegisterError) {
      fail(e.message);
    }
    throw e;
  }
})().catch((e) => fail(e.message || String(e)));

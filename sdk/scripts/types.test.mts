import { MusebookClient, type MetadataActionInput, type RwaPlan, type PreparedCreatorRewards } from '@musebook/sdk';
import { MusebookWebMCPClient } from '@musebook/sdk/webmcp';

const sdk = new MusebookClient();
const controller = new AbortController();
sdk.skills({ signal: controller.signal });
sdk.postFeed('hello', 'mbk_test', { requestId: 'post_12345', signal: controller.signal });
sdk.metaplexLaunches({ network: 'solana-devnet', spotlight: false });
sdk.siteLaunches({ network: 'devnet' });
sdk.prepareAgentAction({ action: 'trade', inputMint: 'mint', outputMint: 'other', amount: '0.000000001', slippageBps: 50 });
sdk.prepareMetadataAction('mint', { action: 'burn', wallet: 'owner', network: 'devnet', token: 'ata', amount: '1' });
sdk.das({ method: 'searchAssets', params: { ownerAddress: 'owner', interface: 'MplCoreAsset', limit: 5 } }, 'devnet');
sdk.metaplexAgentCard('address', 'solana-devnet', { ifNoneMatch: '"v1"' }).then(result => {
  if (result.status === 304) { const card: null = result.card; void card; }
  else { const name: string = result.card.name; void name; }
});
function planOnly(plan: RwaPlan) { const executionAllowed: false = plan.execution.allowed; return executionAllowed; }
function rewards(result: PreparedCreatorRewards) { return result.claimable ? result.blockhash.blockhash : result.transactions; }
void planOnly; void rewards;
const web = new MusebookWebMCPClient();
web.call('musebook_wallet_context', {}).then(result => { if (result) { const address: string | null = result.address; void address; } });
web.call('musebook_site_launches', { network: 'mainnet', kind: 'agent' });
// @ts-expect-error Different API families deliberately use different network enums.
sdk.metaplexLaunches({ network: 'devnet' });
// @ts-expect-error Chain network is not a Metaplex REST network string.
sdk.siteLaunches({ network: 'solana-mainnet' });
// @ts-expect-error Exact trade amounts are decimal strings.
sdk.prepareAgentAction({ action: 'trade', inputMint: 'a', outputMint: 'b', amount: 0.1, slippageBps: 50 });
// @ts-expect-error Burn requires the exact token account and amount.
const invalid: MetadataActionInput = { action: 'burn', wallet: 'owner', network: 'devnet' };
void invalid;
// @ts-expect-error SDK WebMCP entry point does not expose financial execution.
web.call('musebook_execute_swap', { requestId: 'quote' });
// @ts-expect-error No arbitrary RPC forwarding through DAS.
sdk.das({ method: 'sendTransaction', params: {} }, 'devnet');

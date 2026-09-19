import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface McpConnection {
  client: Client;
  url: string;
  close: () => Promise<void>;
}

let connection: McpConnection | null = null;

export async function getMcpConnection(url: string): Promise<McpConnection> {
  if (connection && connection.url === url) return connection;
  if (connection) {
    await connection.close().catch(() => {});
    connection = null;
  }
  const client = new Client({ name: 'musebook-tui', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);
  connection = {
    client,
    url,
    close: async () => {
      await client.close().catch(() => {});
      if (connection?.url === url) connection = null;
    },
  };
  return connection;
}

/** Call a remote MCP tool and return the parsed payload (JSON when possible). */
export async function callMcpTool(
  url: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client } = await getMcpConnection(url);
  const res = await client.callTool({ name, arguments: args });
  const blocks = (res.content ?? []) as Array<{ type: string; text?: string }>;
  const texts = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '');
  const joined = texts.join('\n');
  if ((res as { isError?: boolean }).isError) {
    return { error: joined || `MCP tool ${name} failed` };
  }
  try {
    return JSON.parse(joined);
  } catch {
    return { text: joined };
  }
}

export async function closeMcp(): Promise<void> {
  if (connection) await connection.close().catch(() => {});
}

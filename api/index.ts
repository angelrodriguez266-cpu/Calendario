import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAppRequest } from '../src/server/server.ts';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await handleAppRequest(req, res);
}

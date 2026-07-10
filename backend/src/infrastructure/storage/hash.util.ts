import { createHash } from 'crypto';
import { Readable } from 'stream';

export function hashBuffer(buffer: Buffer | Uint8Array): Promise<string> {
  return Promise.resolve(createHash('sha256').update(buffer).digest('hex'));
}

export async function hashStreamAndCollect(
  stream: Readable,
): Promise<{ hash: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      chunks.push(Buffer.from(chunk));
    });

    stream.on('end', () => {
      const digest = hash.digest('hex');
      resolve({ hash: digest, buffer: Buffer.concat(chunks) });
    });

    stream.on('error', (err) => reject(err));
  });
}

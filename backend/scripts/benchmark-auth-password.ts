import * as argon2 from 'argon2';
import { performance } from 'node:perf_hooks';
import { PasswordUtils } from '../src/common/utils/password.utils';

const sampleCount = Number(process.env.AUTH_BENCH_SAMPLES ?? 12);
const concurrencyValues = (process.env.AUTH_BENCH_CONCURRENCY ?? '1,2,4')
  .split(',')
  .map(Number);
const benchmarkPassword = 'local-auth-password-benchmark-only';

function percentile(samples: number[], quantile: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(quantile * sorted.length) - 1];
}

async function benchmarkConcurrency(
  hash: string,
  concurrency: number,
): Promise<void> {
  const latencies: number[] = [];
  const startedAt = performance.now();

  for (let completed = 0; completed < sampleCount; completed += concurrency) {
    const batchSize = Math.min(concurrency, sampleCount - completed);
    const results = await Promise.all(
      Array.from({ length: batchSize }, async () => {
        const operationStartedAt = performance.now();
        const verified = await argon2.verify(hash, benchmarkPassword);
        if (!verified) {
          throw new Error('Argon2 benchmark verification unexpectedly failed');
        }
        return performance.now() - operationStartedAt;
      }),
    );
    latencies.push(...results);
  }

  const elapsedMs = performance.now() - startedAt;
  console.log(
    JSON.stringify({
      concurrency,
      samples: sampleCount,
      p50Ms: Number(percentile(latencies, 0.5).toFixed(1)),
      p95Ms: Number(percentile(latencies, 0.95).toFixed(1)),
      throughputPerSecond: Number(
        (sampleCount / (elapsedMs / 1000)).toFixed(2),
      ),
      elapsedMs: Number(elapsedMs.toFixed(1)),
    }),
  );
}

async function main(): Promise<void> {
  if (
    !Number.isInteger(sampleCount) ||
    sampleCount < 3 ||
    sampleCount > 100 ||
    concurrencyValues.some(
      (concurrency) =>
        !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32,
    )
  ) {
    throw new Error(
      'AUTH_BENCH_SAMPLES must be 3-100 and AUTH_BENCH_CONCURRENCY values must be 1-32.',
    );
  }

  const hash = await PasswordUtils.hash(benchmarkPassword);
  const parameters = hash.match(
    /\$(argon2(?:id|i|d))\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/,
  );
  if (!parameters) {
    throw new Error(
      'Could not read Argon2 parameters from the benchmark hash.',
    );
  }

  const memoryKiB = Number(parameters[2]);
  console.log(
    JSON.stringify({
      algorithm: parameters[1],
      memoryKiB,
      timeCost: Number(parameters[3]),
      parallelism: Number(parameters[4]),
      maxConcurrentMemoryMiB: Math.ceil(
        (memoryKiB * Math.max(...concurrencyValues)) / 1024,
      ),
      note: 'Local synthetic benchmark only; do not lower password hash costs from this result alone.',
    }),
  );

  for (const concurrency of concurrencyValues) {
    await benchmarkConcurrency(hash, concurrency);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

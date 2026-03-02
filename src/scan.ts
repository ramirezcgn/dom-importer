import type { LoaderOptions, ModuleDefinition } from './types.js';
import { DomImporter } from './loader.js';

/**
 * One-shot helper. Creates a `DomImporter`, runs `scan`, and discards it.
 * Use `DomImporter` directly when you need `watch`, `prefetch`, or caching.
 */
export async function scan<T extends Record<string, unknown> = Record<string, unknown>>(
  definitions: ModuleDefinition<T>[],
  options?: LoaderOptions<T>
): Promise<void> {
  const loader = new DomImporter<T>(options);
  await loader.scan(definitions);
}

/**
 * One-shot helper. Creates a `DomImporter` and runs `prefetch`.
 */
export async function prefetch<T extends Record<string, unknown> = Record<string, unknown>>(
  definitions: ModuleDefinition<T>[],
  options?: LoaderOptions<T>
): Promise<void> {
  const loader = new DomImporter<T>(options);
  await loader.prefetch(definitions);
}


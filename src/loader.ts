import type { LoadFn, LoaderOptions, ModuleDefinition } from './types.js';
import { callInit, getCleanup } from './mount.js';

/**
 * Main class. Holds shared state (import cache, active observers) and exposes
 * `scan`, `watch`, `prefetch`, and `stop`.
 *
 * Instantiate once with your global options, then call methods as needed.
 */
export class DomImporter<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly options: LoaderOptions<T>;

  /** Deduplicates imports: same LoadFn reference → same Promise. */
  private readonly cache = new Map<LoadFn, Promise<unknown>>();

  /** Tracks already-initialized elements to avoid double-processing. */
  private readonly initialized = new WeakSet<Element>();

  /** Cleanup callbacks for all active observers. */
  private readonly cleanups = new Set<() => void>();

  constructor(options: LoaderOptions<T> = {}) {
    this.options = options;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Scans the root node for elements matching the definitions and loads +
   * initializes the associated modules.
   */
  async scan(definitions: ModuleDefinition<T>[]): Promise<void> {
    const root = this.getRoot();
    await Promise.all(definitions.map((def) => this.processDef(def, root)));
  }

  /**
   * Runs an initial `scan` and then watches the root node for newly added
   * elements, processing them as they appear.
   *
   * @returns A `stop` function that disconnects the observer.
   */
  watch(definitions: ModuleDefinition<T>[]): () => void {
    const root = this.getRoot();

    // Initial pass.
    this.scan(definitions).catch((err) => this.handleError(err, null));

    const observer = new MutationObserver((mutations) => {
      const added: Element[] = [];

      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            added.push(node as Element);
          }
        }
      }

      if (added.length === 0) return;

      Promise.all(
        definitions.map(async (def) => {
          const { resolvedSelector, importFn, once, lazy } =
            this.resolveDefinition(def);

          const elements = added
            .flatMap((node) => {
              const matches: Element[] = [];
              if (node.matches?.(resolvedSelector)) {
                matches.push(node);
              }
              matches.push(...Array.from(node.querySelectorAll(resolvedSelector)));
              return matches;
            })
            .filter((el) => !this.initialized.has(el));

          if (elements.length === 0) return;

          elements.forEach((el) => this.initialized.add(el));

          if (lazy) {
            elements.forEach((el) =>
              this.observeLazy(el, importFn, root, once, def)
            );
            return;
          }

          await this.loadAndInit(elements, importFn, root, once, def);
        })
      ).catch((err) => this.handleError(err, null));
    });

    observer.observe(root as Node, { childList: true, subtree: true });

    const stop = () => {
      observer.disconnect();
      this.cleanups.delete(stop);
    };

    this.cleanups.add(stop);
    return stop;
  }

  /**
   * Pre-loads the modules for all definitions without mounting anything.
   * Useful for warming the import cache during idle time.
   */
  async prefetch(definitions: ModuleDefinition<T>[]): Promise<void> {
    await Promise.all(
      definitions.map((def) => {
        const { importFn } = this.resolveDefinition(def);
        return this.cachedImport(importFn)?.catch((err) =>
          this.handleError(err, def)
        );
      })
    );
  }

  /**
   * Disconnects all active `watch` and lazy `IntersectionObserver` instances.
   */
  stop(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups.clear();
  }

  /**
   * Clears the internal import cache, forcing fresh imports on the next call.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getRoot(): Document | Element {
    const root =
      this.options.rootNode ??
      (typeof document === 'undefined' ? null! : document);

    if (!root) {
      throw new Error(
        '[dom-importer] rootNode is required in non-browser environments.'
      );
    }

    return root;
  }

  private resolveDefinition(definition: ModuleDefinition<T>) {
    const { selector, load, once = false, lazy = false } = definition;
    const { transformers } = this.options;

    const resolvedSelector = transformers?.selector
      ? transformers.selector(selector, definition)
      : selector;

    const resolvedLoad: string | LoadFn =
      typeof load === 'string' && transformers?.load
        ? transformers.load(load, definition)
        : load;

    const importFn: LoadFn =
      typeof resolvedLoad === 'function'
        ? resolvedLoad
        : () => import(/* @vite-ignore */ /* webpackIgnore: true */ resolvedLoad);

    return { resolvedSelector, importFn, once, lazy };
  }

  private cachedImport(importFn: LoadFn): Promise<unknown> | undefined {
    if (!this.cache.has(importFn)) {
      this.cache.set(importFn, importFn());
    }
    return this.cache.get(importFn);
  }

  private handleError(err: unknown, definition: ModuleDefinition<T> | null): void {
    if (this.options.onError && definition) {
      this.options.onError(err, definition);
    } else {
      console.error('[dom-importer]', err, definition);
    }
  }

  private runInit(
    mod: unknown,
    elements: Element[],
    definition: ModuleDefinition<T>
  ): boolean {
    if (!this.options.init) {
      return false;
    }

    return this.options.init(mod, elements, definition) === true;
  }

  private setupCleanupObserver(elements: Element[], root: Document | Element): void {
    const observer = new MutationObserver(() => {
      const elementsToClean: Element[] = [];
      
      for (const element of elements) {
        if (!(root as Node).contains(element)) {
          elementsToClean.push(element);
        }
      }

      for (const element of elementsToClean) {
        const cleanup = getCleanup(element);
        if (cleanup) {
          cleanup();
        }
        elements.splice(elements.indexOf(element), 1);
      }

      if (elements.length === 0) {
        observer.disconnect();
        this.cleanups.delete(cleanupFn);
      }
    });

    observer.observe(root as Node, { childList: true, subtree: true });

    const cleanupFn = () => observer.disconnect();
    this.cleanups.add(cleanupFn);
  }

  private async processDef(
    definition: ModuleDefinition<T>,
    root: Document | Element
  ): Promise<void> {
    if (!definition.selector || !definition.load) {
      console.warn(
        '[dom-importer] Each definition requires "selector" and "load".',
        definition
      );
      return;
    }

    const { resolvedSelector, importFn, once, lazy } =
      this.resolveDefinition(definition);

    const elements = Array.from(root.querySelectorAll(resolvedSelector)).filter(
      (el) => !this.initialized.has(el)
    );

    if (elements.length === 0) return;

    elements.forEach((el) => this.initialized.add(el));

    if (lazy) {
      elements.forEach((el) =>
        this.observeLazy(el, importFn, root, once, definition)
      );
      return;
    }

    await this.loadAndInit(elements, importFn, root, once, definition);
  }

  private async loadAndInit(
    elements: Element[],
    importFn: LoadFn,
    root: Document | Element,
    once: boolean,
    definition: ModuleDefinition<T>
  ): Promise<void> {
    try {
      const mod = await this.cachedImport(importFn);
      const handledByInit = this.runInit(mod, elements, definition);
      if (handledByInit) return;
      callInit(mod, elements, root, once, this.options.mount, definition);
      
      // If there's a custom mount callback, setup cleanup observer for returned cleanup functions
      if (this.options.mount) {
        this.setupCleanupObserver(Array.from(elements), root);
      }
    } catch (err) {
      this.handleError(err, definition);
    }
  }

  private observeLazy(
    element: Element,
    importFn: LoadFn,
    root: Document | Element,
    once: boolean,
    definition: ModuleDefinition<T>
  ): void {
    const observer = new IntersectionObserver(async (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        obs.unobserve(entry.target);
        this.cleanups.delete(cleanup);
        try {
          const mod = await this.cachedImport(importFn);
          const handledByInit = this.runInit(mod, [entry.target], definition);
          if (handledByInit) {
            continue;
          }
          callInit(mod, [entry.target], root, once, this.options.mount, definition);
          
          // If there's a custom mount callback, setup cleanup observer for returned cleanup functions
          if (this.options.mount) {
            this.setupCleanupObserver([entry.target], root);
          }
        } catch (err) {
          this.handleError(err, definition);
        }
      }
    });

    observer.observe(element);

    const cleanup = () => observer.disconnect();
    this.cleanups.add(cleanup);
  }
}

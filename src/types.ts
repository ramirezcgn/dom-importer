// ---------------------------------------------------------------------------
// Core primitive types
// ---------------------------------------------------------------------------

export type LoadFn = () => Promise<unknown>;

// ---------------------------------------------------------------------------
// ModuleDefinition
// ---------------------------------------------------------------------------

/**
 * Describes a single component to scan for and load.
 * Extend with a generic `T` to add custom attributes.
 */
export type ModuleDefinition<T extends Record<string, unknown> = Record<string, unknown>> = {
  /**
   * CSS selector (or a short name resolved by `transformers.selector`).
   */
  selector: string;

  /**
   * The module to import when at least one matching element is found.
   * - Function: bundler-friendly dynamic import → `() => import('./my-component.js')`
   * - String: raw URL **or** a short name resolved by `transformers.load`
   */
  load: string | LoadFn;

  /**
   * When `true`, the module is imported only once regardless of how many
   * matching elements exist. Defaults to `false`.
   */
  once?: boolean;

  /**
   * When `true`, the element is observed with an `IntersectionObserver` and
   * the module is only loaded when the element enters the viewport.
   * Defaults to `false`.
   */
  lazy?: boolean;
} & T;

// ---------------------------------------------------------------------------
// Transformers
// ---------------------------------------------------------------------------

/**
 * Transformer functions applied to plain string values in a `ModuleDefinition`.
 * Each transformer receives the raw value **and** the full definition, so custom
 * attributes (e.g. `isReact`) can influence the resolution.
 */
export interface Transformers<T extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Converts the raw `selector` string into a full CSS selector.
   */
  selector?: (value: string, definition: ModuleDefinition<T>) => string;

  /**
   * Converts the raw `load` string into a URL or a `LoadFn`.
   */
  load?: (value: string, definition: ModuleDefinition<T>) => string | LoadFn;
}

// ---------------------------------------------------------------------------
// LoaderOptions
// ---------------------------------------------------------------------------

export interface LoaderOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Root node to query against. Defaults to `document`.
   */
  rootNode?: Document | Element;

  /**
   * Transformer functions applied to `selector` and `load` string values
   * before they are used. Only called when the value is a plain string.
   */
  transformers?: Transformers<T>;

  /**
   * Per-element mount callback executed for each matched element.
   * Called after the module loads unless `init` returns `true`.
   *
   * May return a cleanup function which will be
   * called when the element is removed from the DOM (when using `watch`).
   */
  mount?: (
    module: unknown,
    element: Element,
    props: Props,
    definition: ModuleDefinition<T>
  ) => void | (() => void);

  /**
   * Global init callback executed once per definition (all matched elements).
   *
   * Return `true` to mark the definition as fully handled and skip the regular
   * initialization flow (`mount`, mountable class, or plain function)
   * for that definition.
   */
  init?: (
    module: unknown,
    elements: Element[],
    definition: ModuleDefinition<T>
  ) => boolean | void;

  /**
   * Called when a module fails to import or initialize.
   * If omitted, errors are logged to `console.error`.
   */
  onError?: (error: unknown, definition: ModuleDefinition<T>) => void;
}

// ---------------------------------------------------------------------------
// Data-attribute props
// ---------------------------------------------------------------------------

/**
 * Plain object produced by {@link parseDataProps}.
 * Keys are the camelCase dataset key names; values are auto-parsed from JSON
 * when possible, otherwise kept as strings.
 */
export type Props = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Mountable component contract
// ---------------------------------------------------------------------------

export interface MountableInstance {
  /**
   * Called once after the module loads.
   *
   * @param element - The matched DOM element.
   * @param props   - Data attributes of the element, parsed automatically.
   *                  e.g. `data-title="Hi"` → `{ title: 'Hi' }`
   */
  mount(element: Element, props: Props): void;
  /**
   * Called when the element is removed from the root node.
   * Optional — only needed when cleanup logic is required.
   */
  unmount?(): void;
}

/**
 * Constructor type for classes that can be instantiated by the loader.
 * - With `mount()` method: instantiated with no arguments
 * - Without `mount()` method: instantiated with (element, props)
 */
export type MountableClass = new (...args: any[]) => any;

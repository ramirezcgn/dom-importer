import type { MountableClass, MountableInstance, ModuleDefinition, Props } from './types.js';
import { parseDataProps } from './utils/parseDataProps.js';

/**
 * Cleanup callbacks: map from element to cleanup function for tracking
 * returned cleanup functions from custom init callbacks.
 */
const cleanupMap = new WeakMap<Element, () => void>();

/**
 * Get cleanup callback for an element.
 */
export function getCleanup(element: Element): (() => void) | undefined {
  return cleanupMap.get(element);
}

/**
 * Returns `true` when `val` is a class whose prototype has a `mount` method.
 */
export function isMountableClass(val: unknown): val is MountableClass {
  return (
    typeof val === 'function' &&
    typeof (val as { prototype?: Record<string, unknown> })?.prototype?.mount === 'function'
  );
}

/**
 * Returns `true` when `val` looks like a class (constructor function).
 * Used to detect classes that might instantiate via constructor with (element, props).
 * Heuristic: checks if the function's string representation contains "class"
 */
function isClass(val: unknown): val is MountableClass {
  if (typeof val !== 'function') return false;
  const fnStr = Function.prototype.toString.call(val);
  return fnStr.startsWith('class ');
}

/**
 * Instantiates the class via constructor passing (element, props),
 * and — if the instance has an `unmount` method — sets up a `MutationObserver`
 * that fires `unmount()` when the element leaves the root node's subtree.
 */
function mountConstructor(
  ModuleClass: MountableClass,
  element: Element,
  root: Document | Element
): void {
  const props: Props = parseDataProps(element);
  const instance = new ModuleClass(element, props);

  if (typeof instance?.unmount !== 'function') {
    return;
  }

  const observer = new MutationObserver(() => {
    if (!(root as Node).contains(element)) {
      if (typeof instance.unmount === 'function') {
        instance.unmount();
      }
      observer.disconnect();
    }
  });

  observer.observe(root as Node, { childList: true, subtree: true });
}

/**
 * Instantiates the class, calls `mount(element)`, and — if `unmount` is
 * defined — sets up a `MutationObserver` that fires `unmount()` as soon
 * as the element leaves the root node's subtree.
 */
export function mountInstance(
  ModuleClass: MountableClass,
  element: Element,
  root: Document | Element
): void {
  const instance: MountableInstance = new ModuleClass();
  const props: Props = parseDataProps(element);
  instance.mount(element, props);

  if (typeof instance.unmount !== 'function') {
    return;
  }

  const observer = new MutationObserver(() => {
    if (!(root as Node).contains(element)) {
      if (typeof instance.unmount === 'function') {
        instance.unmount();
      }
      observer.disconnect();
    }
  });

  observer.observe(root as Node, { childList: true, subtree: true });
}

/**
 * Dispatches module initialization to the right strategy:
 *
 * 1. **Custom `mount` callback** — full control handed to the caller.
 *    May return a cleanup function.
 * 2. **Class with `mount()`** — instantiated per element; `MutationObserver`
 *    wired up when `unmount()` is also present.
 * 3. **Class without `mount()`** — instantiated via constructor with `(element, props)`;
 *    fallback strategy (not recommended; use `mount()` method instead).
 * 4. **Plain function** — may return a cleanup function.
 *    - `once: false` (default): called once per element as `fn(element, props)`.
 *    - `once: true`: called once with the full elements array as `fn(elements)`.
 */
export function callInit<T extends Record<string, unknown> = Record<string, unknown>>(
  mod: unknown,
  elements: Element[],
  root: Document | Element,
  once: boolean,
  mount: ((module: unknown, element: Element, props: Props, definition: ModuleDefinition<T>) => void | (() => void)) | undefined,
  definition: ModuleDefinition<T>
): void {
  if (typeof mount === 'function') {
    elements.forEach((el) => {
      const cleanup = mount(mod, el, parseDataProps(el), definition);
      if (typeof cleanup === 'function') {
        cleanupMap.set(el, cleanup);
      }
    });
    return;
  }

  const defaultExport = (mod as Record<string, unknown>)?.default;

  if (isMountableClass(defaultExport)) {
    elements.forEach((el) => mountInstance(defaultExport, el, root));
    return;
  }

  if (typeof defaultExport === 'function') {
    if (once) {
      // Single invocation for all matched elements — no single element to derive props from.
      (defaultExport as (elements: Element[]) => void)(elements);
    } else if (isClass(defaultExport)) {
      // Per-element invocation: try constructor first (class without mount()),
      // then fall back to plain function.
      // Try to instantiate as a class with (element, props)
      elements.forEach((el) => mountConstructor(defaultExport, el, root));
    } else {
      // Plain function — may return a cleanup function
      elements.forEach((el) => {
        const cleanup = (defaultExport as (element: Element, props: Props) => void | (() => void))(
          el,
          parseDataProps(el)
        );
        if (typeof cleanup === 'function') {
          cleanupMap.set(el, cleanup);
        }
      });
    }
  }
}

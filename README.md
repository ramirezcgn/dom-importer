# dom-importer

Scans a DOM tree and dynamically imports JavaScript modules when matching elements are found. Supports plain functions, lifecycle classes (`mount` / `unmount`), lazy loading via `IntersectionObserver`, import-cache deduplication, and SPA-friendly `watch` — all without depending on any framework.

## Install

```bash
npm install dom-importer
```

## Quick start — functional API

For one-shot page loads the `scan` helper is the simplest entry point.
It accepts the same `LoaderOptions` as `new DomImporter(options)`, so `transformers`, `mount`, `init`, `onError`, and `rootNode` are supported:

```ts
import { scan } from 'dom-importer';

scan(
  [
    { selector: 'carousel', load: 'carousel' },
    { selector: 'accordion', load: 'accordion' },
  ],
  {
    transformers: {
      selector: (name) => `[data-component="${name}"]`,
      load: (name) => () => import(`./components/${name}.js`),
    },
  }
);
```

---

## Class-based API — recommended

Use `DomImporter` directly whenever you need `watch`, `prefetch`, lazy loading, `onError`, or shared import caching across multiple calls.

```ts
import { DomImporter } from 'dom-importer';

const loader = new DomImporter({
  transformers: {
    selector: (name) => `[data-component="${name}"]`,
    load: (name) => () => import(`./components/${name}.js`),
  },
  onError: (err, def) => console.error('Failed to load', def.selector, err),
});

await loader.scan([
  { selector: 'carousel', load: 'carousel' },
  { selector: 'accordion', load: 'accordion' },
]);
```

### `watch()` — SPA / dynamic DOM

Runs an initial `scan` and then observes the root node for newly inserted elements, initializing matching components as they appear. Returns a stop function.

```ts
const stopWatching = loader.watch([
  { selector: 'carousel', load: 'carousel' },
  { selector: 'tooltip', load: 'tooltip' },
]);

// Later — e.g. before navigating away:
stopWatching();
// Or stop all observers at once:
loader.stop();
```

### `prefetch()` — warm the import cache

Pre-loads modules during idle time without mounting anything. Subsequent `scan` or `watch` calls will use the cached promise.

```ts
loader.prefetch([
  { selector: 'modal', load: 'modal' },
  { selector: 'video-player', load: 'video-player' },
]);
```

### `lazy: true` — viewport-triggered loading

Add `lazy: true` to any definition to defer loading until the element enters the viewport (`IntersectionObserver`).

```ts
loader.scan([
  { selector: 'video-player', load: 'video-player', lazy: true },
  { selector: 'carousel',     load: 'carousel' },   // eager (default)
]);
```

### `clearCache()`

Clears the internal import cache, forcing fresh imports on the next `scan`, `watch`, or `prefetch` call.

```ts
loader.clearCache();
```

---

## How modules are initialized

After a matching element is found and the module is loaded, the library dispatches initialization in this order:

### 1. Per-element `mount` callback (`options.mount`) — custom element-level control

Executes for each matched element. Use this for module-specific initialization logic. 

May return a cleanup function which will be automatically called when the element is removed from the DOM (when using `watch`).

```ts
const loader = new DomImporter({
  mount: (mod, element, props, def) => {
    new (mod as any).Tabs(element, props);
    
    // Optional: return a cleanup function
    return () => {
      // cleanup code
    };
  },
});

await loader.scan([
  { selector: '.tabs', load: () => import('./tabs.js') },
]);
```

### 2. Global `init` callback (`options.init`) — batch-level control

Executes once per definition with all matched elements. Use this for cross-cutting initialization logic. If it returns `true`, the regular mount flow is skipped for that definition.

```ts
const loader = new DomImporter({
  init: (mod, elements, def) => {
    // Initialize all matched elements for this definition
    elements.forEach((element) => {
      console.log('Initializing', element);
    });

    // return true to skip mount callback/mount class/default function
  },
});
```

### 3. Class with `mount()` — lifecycle component

If `module.default` is a class with a `mount` method, it is instantiated once per element. Data attributes are automatically parsed and passed as the second argument. If `unmount()` exists, a `MutationObserver` will call it when the element leaves the DOM.

```ts
// components/carousel.ts
import type { Props } from 'dom-importer';

export default class Carousel {
  private el!: Element;

  mount(element: Element, props: Props) {
    this.el = element;
    console.log(props.title);   // from data-title="..."
    console.log(props.values);  // from data-values="[1,2,3]" → parsed as array
  }

  unmount() {
    // cleanup: remove listeners, destroy timers, etc.
  }
}
```

```html
<div data-component="carousel"
     data-title="Featured"
     data-values="[1,2,3]"
     data-config='{"autoplay":true}'>
</div>
```

### 4. Class with constructor parameters — fallback (not recommended)

If `module.default` is a class without a `mount()` method, it will be instantiated with `(element, props)` passed to the constructor. This is a fallback; the `mount()` method pattern is preferred for clarity.

```ts
// components/tabs.ts
import type { Props } from 'dom-importer';

export default class Tabs {
  constructor(element: Element, props: Props) {
    console.log(props.label);
  }

  unmount() {
    // cleanup
  }
}
```

> **Note:** The `mount()` method pattern is recommended because it makes the initialization contract explicit. If you export a class without `mount()`, consider adding it or exporting a plain function instead.

### 5. Plain function — simple components

If `module.default` is a plain function (no `mount` method), it is called **once per element** with `(element, props)`. May return a cleanup function.

```ts
// components/tooltip.ts
import type { Props } from 'dom-importer';

export default function (element: Element, props: Props) {
  element.setAttribute('aria-label', props.label as string);
  
  // Optional: return a cleanup function
  return () => {
    element.removeAttribute('aria-label');
  };
}
```

> When `once: true`, the function is called once for **all** matched elements as `fn(elements)` — no props argument in that case.

---

## Data-attribute prop parsing

Props are parsed automatically from `data-*` attributes before being passed to `mount()`. Keys become camelCase and values are JSON-parsed when possible:

| HTML attribute          | Prop key   | Prop value        |
|-------------------------|------------|-------------------|
| `data-title="Hello"`    | `title`    | `'Hello'`         |
| `data-count="42"`       | `count`    | `42`              |
| `data-active="true"`    | `active`   | `true`            |
| `data-values="[1,2,3]"`  | `values`   | `[1, 2, 3]`       |
| `data-cfg='{"x":1}'`    | `cfg`      | `{ x: 1 }`        |
| `data-my-label="Hi"`    | `myLabel`  | `'Hi'`            |

You can also call `parseDataProps` manually:

```ts
import { parseDataProps } from 'dom-importer';

const props = parseDataProps(document.querySelector('.carousel')!);
// { title: 'Featured', values: [1, 2, 3] }
```

---

## Custom component lifecycle (mount/unmount)

For components that need setup/teardown logic, export a class with `mount` and optionally `unmount` methods:

```ts
import type { MountableInstance, Props } from 'dom-importer';

export default class implements MountableInstance {
  mount(element: Element, props: Props): void {
    // Initialize your component
  }

  unmount(): void {
    // Clean up when element is removed
  }
}
```

The loader automatically:
- Calls `mount(element, props)` once per matched element
- Parses `data-*` attributes and passes them as `props`
- Calls `unmount()` when elements are removed from the DOM (when using `watch`)

---

### Example: React adapter

Keep your React components **pure** and handle React mounting with `options.init`:

```tsx
// components/Carousel.tsx — pure React component
export default function Carousel({ title, values }: { title: string; values: number[] }) {
  return (
    <div className="carousel">
      <h2>{title}</h2>
      <p>Items: {values.join(', ')}</p>
    </div>
  );
}
```

```ts
// main.ts
import { DomImporter } from 'dom-importer';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import type { ModuleDefinition } from 'dom-importer';

type MyDef = ModuleDefinition<{ isReact?: boolean }>;

const loader = new DomImporter<MyDef>({
  transformers: {
    selector: (name) => `[data-component="${name}"]`,
    load: (name) => () => import(`./components/${name}.js`),
  },
  mount: (mod, element, props, def) => {
    if (!def.isReact) return;

    const root = createRoot(element);
    root.render(createElement(mod.default as any, props));
    
    // Return cleanup function
    return () => {
      root.unmount();
    };
  },
});

const definitions: MyDef[] = [
  {
    selector: 'video-player',
    load: 'video-player',
    isReact: true,
  },
  { selector: 'tooltip', load: 'tooltip' },
];

await loader.watch(definitions);
```

```html
<!-- Data attributes are parsed into props -->
<div data-component="carousel" data-title="Featured" data-values="[1,2,3]"></div>
```

---

## Custom attributes on definitions

Pass extra fields in any definition and read them inside `load` or `selector` transformers:

```ts
import type { ModuleDefinition } from 'dom-importer';

type MyDef = ModuleDefinition<{
  isReact?: boolean;
  priority?: 'high' | 'low';
  version?: number;
}>;

const loader = new DomImporter<MyDef>({
  transformers: {
    selector: (name) => `[data-component="${name}"]`,
    load: (name, def) => {
      const path = def.priority === 'high' ? './critical' : './components';
      return () => import(`${path}/${name}.js`);
    },
  },
});

loader.scan([
  { selector: 'carousel', load: 'carousel', isReact: true, priority: 'high' },
  { selector: 'tooltip', load: 'tooltip', priority: 'low' },
]);
```

---

## API reference

### `new DomImporter(options?)`

The primary API. Holds shared state: import cache and active observer instances.

| Method                  | Returns         | Description                                                                 |
|-------------------------|-----------------|-----------------------------------------------------------------------------|
| `scan(definitions)`     | `Promise<void>` | Find matching elements and load + init modules.                             |
| `watch(definitions)`    | `() => void`    | `scan` + observe DOM for new elements. Returns a per-observer stop fn.      |
| `prefetch(definitions)` | `Promise<void>` | Warm the import cache without mounting.                                     |
| `stop()`                | `void`          | Disconnect all active `MutationObserver` and `IntersectionObserver` instances. |
| `clearCache()`          | `void`          | Clear the import deduplication cache.                                       |

### `scan(definitions, options?)` — functional helper

Creates a `DomImporter(options)`, runs `scan`, and discards it. Suitable for simple one-shot page loads. `options` is `LoaderOptions<T>`, so all loader options are supported. Returns `Promise<void>`.

### `prefetch(definitions, options?)` — functional helper

Creates a `DomImporter` and runs `prefetch`. Returns `Promise<void>`.

---

### `ModuleDefinition<T>`

| Property   | Type                                              | Default | Description                                                                                          |
|------------|---------------------------------------------------|---------|------------------------------------------------------------------------------------------------------|
| `selector` | `string`                                          | –       | CSS selector or short name resolved by `transformers.selector`.                                      |
| `load`     | `string \| () => Promise<any>`                    | –       | Module path/URL or short name resolved by `transformers.load`. Prefer a function for bundler support.|
| `once`     | `boolean`                                         | `false` | Load and call the module only once even if multiple elements match.                                  |
| `lazy`     | `boolean`                                         | `false` | Defer loading until the element enters the viewport (`IntersectionObserver`).                        |
| `...T`     | any                                               | –       | Any extra fields — forwarded to transformer functions as the second argument.                        |

### `LoaderOptions<T>`

| Property       | Type                                                        | Default    | Description                                                            |
|----------------|-------------------------------------------------------------|------------|------------------------------------------------------------------------|
| `rootNode`     | `Document \| Element`                                       | `document` | Root node to query. Useful for scoped subtrees.                        |
| `transformers` | `Transformers<T>`                                           | –          | Functions that resolve `selector` and `load` strings.                  |
| `mount`        | `(module: unknown, element: Element, props: Props, def: ModuleDefinition<T>) => void \| (() => void)` | – | Per-element mount callback. Executes for each matched element. May return a cleanup function.
| `init`         | `(module: unknown, elements: Element[], def: ModuleDefinition<T>) => boolean \| void` | – | Global init callback per definition (all matched elements). Return `true` to skip regular mount flow for that definition. |
| `onError`      | `(error: unknown, def: ModuleDefinition<T>) => void`        | –          | Error handler. If omitted, errors are logged to `console.error`.       |

### `Transformers<T>`

| Property   | Type                                                          | Description                                           |
|------------|---------------------------------------------------------------|-------------------------------------------------------|
| `selector` | `(value: string, def: ModuleDefinition<T>) => string`         | Converts a short name to a full CSS selector.         |
| `load`     | `(value: string, def: ModuleDefinition<T>) => string\|LoadFn` | Converts a short name to a URL or import function.    |

### `MountableInstance`

```ts
interface MountableInstance {
  mount(element: Element, props: Props): void;
  unmount?(): void;
}
```

### `parseDataProps(element)`

Parses all `data-*` attributes of an element into a `Props` object (`Record<string, unknown>`) with camelCase keys and JSON-parsed values where applicable.

---

## License

MIT

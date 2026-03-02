export type Props = Record<string, unknown>;

/**
 * Reads all `data-*` attributes from an element and returns them as a plain
 * object, with keys in camelCase and values auto-parsed as JSON when possible.
 */
export function parseDataProps(element: Element): Props {
  const props: Props = {};

  for (const key of Object.keys((element as HTMLElement).dataset ?? {})) {
    const raw = (element as HTMLElement).dataset[key];
    props[key] = tryParse(raw);
  }

  return props;
}

/**
 * Tries to JSON-parse a string. Returns the raw string on failure.
 */
function tryParse(value: string | undefined): unknown {
  if (value === undefined) return undefined;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

import { parseDataProps } from '../src/utils/parseDataProps';

describe('parseDataProps', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockElement = document.createElement('div');
    document.body.appendChild(mockElement);
  });

  it('should return empty object for element with no data attributes', () => {
    const props = parseDataProps(mockElement);
    expect(props).toEqual({});
  });

  it('should parse simple string data attributes', () => {
    mockElement.setAttribute('data-title', 'Hello');
    mockElement.setAttribute('data-message', 'World');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      title: 'Hello',
      message: 'World',
    });
  });

  it('should convert kebab-case to camelCase', () => {
    mockElement.setAttribute('data-first-name', 'John');
    mockElement.setAttribute('data-last-name', 'Doe');
    mockElement.setAttribute('data-phone-number', '555-1234');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '555-1234',
    });
  });

  it('should parse JSON numbers', () => {
    mockElement.setAttribute('data-count', '42');
    mockElement.setAttribute('data-price', '19.99');
    mockElement.setAttribute('data-negative', '-10');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      count: 42,
      price: 19.99,
      negative: -10,
    });
  });

  it('should parse JSON booleans', () => {
    mockElement.setAttribute('data-enabled', 'true');
    mockElement.setAttribute('data-disabled', 'false');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      enabled: true,
      disabled: false,
    });
  });

  it('should parse JSON null', () => {
    mockElement.setAttribute('data-empty', 'null');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      empty: null,
    });
  });

  it('should parse JSON arrays', () => {
    mockElement.setAttribute('data-items', '[1,2,3]');
    mockElement.setAttribute('data-names', '["John","Jane","Bob"]');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      items: [1, 2, 3],
      names: ['John', 'Jane', 'Bob'],
    });
  });

  it('should parse JSON objects', () => {
    mockElement.setAttribute('data-config', '{"key":"value","nested":{"inner":42}}');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      config: {
        key: 'value',
        nested: {
          inner: 42,
        },
      },
    });
  });

  it('should return string for non-JSON values', () => {
    mockElement.setAttribute('data-invalid-json', '{not valid json}');
    mockElement.setAttribute('data-text', 'just a string');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      invalidJson: '{not valid json}',
      text: 'just a string',
    });
  });

  it('should handle mixed data attributes', () => {
    mockElement.setAttribute('data-name', 'John');
    mockElement.setAttribute('data-age', '30');
    mockElement.setAttribute('data-active', 'true');
    mockElement.setAttribute('data-config', '{"theme":"dark"}');
    mockElement.setAttribute('data-tags', '["a","b","c"]');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      name: 'John',
      age: 30,
      active: true,
      config: { theme: 'dark' },
      tags: ['a', 'b', 'c'],
    });
  });

  it('should handle empty string data attribute', () => {
    mockElement.setAttribute('data-empty', '');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      empty: '',
    });
  });

  it('should handle special characters in string values', () => {
    mockElement.setAttribute('data-special', 'value@with#special$chars');
    mockElement.setAttribute('data-unicode', 'hello🌍');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      special: 'value@with#special$chars',
      unicode: 'hello🌍',
    });
  });

  it('should ignore non-data attributes', () => {
    mockElement.setAttribute('id', 'my-id');
    mockElement.setAttribute('class', 'my-class');
    mockElement.setAttribute('data-title', 'Title');

    const props = parseDataProps(mockElement);
    expect(props).toEqual({
      title: 'Title',
    });
  });

  it('should handle data attributes with multiple consecutive hyphens', () => {
    mockElement.setAttribute('data-my--double-hyphen', 'value');

    const props = parseDataProps(mockElement);
    // dataset converts data-my--double-hyphen to myDoubleHyphen (or my-DoubleHyphen depending on browser)
    // Check if at least one of the keys exists and has the value
    const hasCorrectValue = Object.values(props).includes('value');
    expect(hasCorrectValue).toBe(true);
  });
});

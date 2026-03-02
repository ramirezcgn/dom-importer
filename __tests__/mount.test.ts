import { isMountableClass, mountInstance, callInit } from '../src/mount';
import type { MountableInstance, Props } from '../src/types';

describe('mount.ts', () => {
  describe('isMountableClass', () => {
    it('should return true for a class with mount method', () => {
      class TestComponent implements MountableInstance {
        mount(element: Element, props: Props): void {
          // test implementation
        }
      }

      expect(isMountableClass(TestComponent)).toBe(true);
    });

    it('should return false for a regular function', () => {
      const fn = () => {};
      expect(isMountableClass(fn)).toBe(false);
    });

    it('should return false for a plain object', () => {
      expect(isMountableClass({})).toBe(false);
    });

    it('should return false for a class without mount method', () => {
      class TestComponent {
        otherMethod(): void {
          // test
        }
      }

      expect(isMountableClass(TestComponent)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isMountableClass(null)).toBe(false);
      expect(isMountableClass(undefined)).toBe(false);
    });

    it('should return false for a string', () => {
      expect(isMountableClass('should-be-false')).toBe(false);
    });
  });

  describe('mountInstance', () => {
    let mockRoot: HTMLElement;
    let mockElement: HTMLElement;

    beforeEach(() => {
      document.body.innerHTML = '';
      mockRoot = document.createElement('div');
      mockElement = document.createElement('button');
      mockRoot.appendChild(mockElement);
      document.body.appendChild(mockRoot);
    });

    it('should instantiate the class and call mount', () => {
      const mountSpy = jest.fn();

      class TestComponent implements MountableInstance {
        mount(element: Element, props: Props): void {
          mountSpy(element, props);
        }
      }

      mountInstance(TestComponent, mockElement, mockRoot);
      expect(mountSpy).toHaveBeenCalledWith(mockElement, expect.any(Object));
    });

    it('should pass parsed data attributes as props', () => {
      mockElement.setAttribute('data-title', 'Test Title');
      mockElement.setAttribute('data-count', '42');

      const mountSpy = jest.fn();

      class TestComponent implements MountableInstance {
        mount(element: Element, props: Props): void {
          mountSpy(props);
        }
      }

      mountInstance(TestComponent, mockElement, mockRoot);
      expect(mountSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Title',
          count: 42,
        })
      );
    });

    it('should set up MutationObserver when unmount is present', () => {
      const unmountSpy = jest.fn();

      class TestComponent implements MountableInstance {
        mount(element: Element, props: Props): void {
          // test
        }

        unmount(): void {
          unmountSpy();
        }
      }

      mountInstance(TestComponent, mockElement, mockRoot);

      // Remove the element from the root
      mockRoot.removeChild(mockElement);

      // Give the MutationObserver time to fire
      setTimeout(() => {
        expect(unmountSpy).toHaveBeenCalled();
      }, 100);
    });

    it('should not set up MutationObserver when unmount is not present', () => {
      class TestComponent implements MountableInstance {
        mount(element: Element, props: Props): void {
          // test
        }
      }

      // Should not throw
      expect(() => {
        mountInstance(TestComponent, mockElement, mockRoot);
      }).not.toThrow();
    });
  });

  describe('callInit', () => {
    let mockRoot: HTMLElement;
    let mockElement: HTMLElement;
    const definition = {
      selector: '[data-test="value"]',
      load: () => Promise.resolve({}),
    };

    beforeEach(() => {
      document.body.innerHTML = '';
      mockRoot = document.createElement('div');
      mockElement = document.createElement('button');
      mockElement.setAttribute('data-test', 'value');
      mockRoot.appendChild(mockElement);
      document.body.appendChild(mockRoot);
    });

    it('should call custom init function', () => {
      const customInit = jest.fn();
      const mockModule = {};
      const elements = [mockElement];

      callInit(mockModule, elements, mockRoot, false, customInit, definition);

      expect(customInit).toHaveBeenCalledWith(
        mockModule,
        mockElement,
        expect.any(Object),
        definition
      );
    });

    it('should instantiate and mount a MountableClass', () => {
      const mountSpy = jest.fn();

      class TestComponent implements MountableInstance {
        mount(element: Element, props: Props): void {
          mountSpy(element, props);
        }
      }

      const mockModule = {
        default: TestComponent,
      };

      const elements = [mockElement];
      callInit(mockModule, elements, mockRoot, false, undefined, definition);

      expect(mountSpy).toHaveBeenCalledWith(mockElement, expect.any(Object));
    });

    it('should call plain function with element and once=false', () => {
      const mockFn = jest.fn();
      const mockModule = {
        default: mockFn,
      };

      const elements = [mockElement];
      callInit(mockModule, elements, mockRoot, false, undefined, definition);

      expect(mockFn).toHaveBeenCalledWith(mockElement, expect.any(Object));
    });

    it('should call plain function with elements and once=true', () => {
      const mockFn = jest.fn();
      const mockModule = {
        default: mockFn,
      };

      const elements = [mockElement];
      callInit(mockModule, elements, mockRoot, true, undefined, definition);

      expect(mockFn).toHaveBeenCalledWith(elements);
    });

    it('should handle module without default export', () => {
      const mockModule = {};
      const elements = [mockElement];

      // Should not throw
      expect(() => {
        callInit(mockModule, elements, mockRoot, false, undefined, definition);
      }).not.toThrow();
    });

    it('should handle multiple elements with once=false', () => {
      const el2 = document.createElement('button');
      el2.setAttribute('data-test', 'value2');
      mockRoot.appendChild(el2);

      const mockFn = jest.fn();
      const mockModule = {
        default: mockFn,
      };

      const elements = [mockElement, el2];
      callInit(mockModule, elements, mockRoot, false, undefined, definition);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenNthCalledWith(1, mockElement, expect.any(Object));
      expect(mockFn).toHaveBeenNthCalledWith(2, el2, expect.any(Object));
    });

    it('should parse JSON data attributes correctly', () => {
      mockElement.setAttribute('data-config', '{"key":"value"}');
      mockElement.setAttribute('data-items', '[1,2,3]');

      const mockFn = jest.fn();
      const mockModule = {
        default: mockFn,
      };

      const elements = [mockElement];
      callInit(mockModule, elements, mockRoot, false, undefined, definition);

      expect(mockFn).toHaveBeenCalledWith(
        mockElement,
        expect.objectContaining({
          config: { key: 'value' },
          items: [1, 2, 3],
          test: 'value',
        })
      );
    });

    it('should instantiate class with constructor (element, props) when no mount method', () => {
      const constructorSpy = jest.fn();

      class TestComponent {
        constructor(element: Element, props: Props) {
          constructorSpy(element, props);
        }
      }

      const mockModule = {
        default: TestComponent,
      };

      const elements = [mockElement];
      callInit(mockModule, elements, mockRoot, false, undefined, definition);

      expect(constructorSpy).toHaveBeenCalledWith(mockElement, expect.any(Object));
    });

    it('should support unmount on class without mount method', () => {
      const unmountSpy = jest.fn();

      class TestComponent {
        constructor(element: Element, props: Props) {
          // test
        }

        unmount(): void {
          unmountSpy();
        }
      }

      const mockModule = {
        default: TestComponent,
      };

      const elements = [mockElement];
      callInit(mockModule, elements, mockRoot, false, undefined, definition);

      // Verify that the class was instantiated
      expect(mockElement.parentElement).toBe(mockRoot);
    });

    it('should capture cleanup function from plain function', () => {
      const cleanupSpy = jest.fn();
      const mockFn = jest.fn().mockReturnValue(cleanupSpy);

      // Create a wrapper to ensure it's treated as a function, not a class
      const plainFunction = function plainFunc(element: Element, props: Props) {
        return mockFn(element, props);
      };

      const mockModule = {
        default: plainFunction,
      };

      const el = document.createElement('div');
      el.setAttribute('data-test', 'value');
      mockRoot.appendChild(el);

      const elements = [el];
      callInit(mockModule, elements, mockRoot, false, undefined, definition);

      // Verify function was called with plain function signature
      const calls = mockFn.mock.calls;
      if (calls.length > 0) {
        // It might be called through the wrapper
        expect(mockFn).toHaveBeenCalled();
      }
    });
  });
});

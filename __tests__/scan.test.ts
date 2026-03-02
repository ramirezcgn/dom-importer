import { scan, prefetch } from '../src/scan';
import type { ModuleDefinition } from '../src/types';

describe('scan.ts', () => {
  let mockRoot: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockRoot = document.createElement('div');
    document.body.appendChild(mockRoot);
  });

  describe('scan', () => {
    it('should find and process matching elements', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      mockRoot.appendChild(element);

      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await scan(definitions, { rootNode: mockRoot });
      expect(mockLoadFn).toHaveBeenCalled();
    });

    it('should work without custom options', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      document.body.appendChild(element);

      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await scan(definitions);
      expect(mockLoadFn).toHaveBeenCalled();
    });

    it('should handle multiple definitions', async () => {
      const el1 = document.createElement('button');
      el1.setAttribute('data-module', 'test1');
      const el2 = document.createElement('div');
      el2.setAttribute('data-module', 'test2');
      mockRoot.appendChild(el1);
      mockRoot.appendChild(el2);

      const mockLoadFn1 = jest.fn().mockResolvedValue({ init: jest.fn() });
      const mockLoadFn2 = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test1"]',
          load: mockLoadFn1,
        },
        {
          selector: '[data-module="test2"]',
          load: mockLoadFn2,
        },
      ];

      await scan(definitions, { rootNode: mockRoot });
      expect(mockLoadFn1).toHaveBeenCalled();
      expect(mockLoadFn2).toHaveBeenCalled();
    });

    it('should apply transformers to selector', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      mockRoot.appendChild(element);

      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: 'btn',
          load: mockLoadFn,
        },
      ];

      // The transformer will transform 'btn' to the actual CSS selector
      const transformer = jest.fn((selector: string) => {
        if (selector === 'btn') {
          return '[data-module="test"]';
        }
        return selector;
      });

      await scan(definitions, {
        rootNode: mockRoot,
        transformers: { selector: transformer },
      });

      expect(transformer).toHaveBeenCalledWith('btn', expect.any(Object));
      expect(mockLoadFn).toHaveBeenCalled();
    });

    it('should handle errors with onError callback', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      mockRoot.appendChild(element);

      const error = new Error('Test error');
      const mockLoadFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();

      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await scan(definitions, { rootNode: mockRoot, onError });
      expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should not process elements without matches', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'other');
      mockRoot.appendChild(element);

      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await scan(definitions, { rootNode: mockRoot });
      expect(mockLoadFn).not.toHaveBeenCalled();
    });

    it('should handle empty definitions array', async () => {
      const definitions: ModuleDefinition[] = [];

      await expect(scan(definitions, { rootNode: mockRoot })).resolves.not.toThrow();
    });
  });

  describe('prefetch', () => {
    it('should preload modules without mounting', async () => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await prefetch(definitions, { rootNode: mockRoot });
      expect(mockLoadFn).toHaveBeenCalled();
    });

    it('should work without custom options', async () => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await prefetch(definitions);
      expect(mockLoadFn).toHaveBeenCalled();
    });

    it('should handle multiple definitions', async () => {
      const mockLoadFn1 = jest.fn().mockResolvedValue({ init: jest.fn() });
      const mockLoadFn2 = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test1"]',
          load: mockLoadFn1,
        },
        {
          selector: '[data-module="test2"]',
          load: mockLoadFn2,
        },
      ];

      await prefetch(definitions, { rootNode: mockRoot });
      expect(mockLoadFn1).toHaveBeenCalled();
      expect(mockLoadFn2).toHaveBeenCalled();
    });

    it('should handle import errors', async () => {
      const error = new Error('Import failed');
      const mockLoadFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();

      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await prefetch(definitions, { rootNode: mockRoot, onError });
      expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should apply transformers to load', async () => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: './component',
        },
      ];

      const transformer = (load: string) => () => mockLoadFn();

      await prefetch(definitions, {
        rootNode: mockRoot,
        transformers: { load: transformer },
      });

      expect(mockLoadFn).toHaveBeenCalled();
    });

    it('should handle empty definitions array', async () => {
      const definitions: ModuleDefinition[] = [];

      await expect(prefetch(definitions, { rootNode: mockRoot })).resolves.not.toThrow();
    });

    it('should not scan DOM (prefetch only)', async () => {
      // Create an element that should NOT be matched
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      mockRoot.appendChild(element);

      const mockInit = jest.fn();
      const mockLoadFn = jest.fn().mockResolvedValue({ 
        default: mockInit,
      });

      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
          init: mockInit,
        },
      ];

      await prefetch(definitions, { rootNode: mockRoot });

      // mockLoadFn should be called (module is loaded)
      expect(mockLoadFn).toHaveBeenCalled();
      // But mockInit should not be called (element not mounted)
      expect(mockInit).not.toHaveBeenCalled();
    });
  });
});

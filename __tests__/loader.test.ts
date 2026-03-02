import { DomImporter } from '../src/loader';
import type { ModuleDefinition, LoaderOptions } from '../src/types';

describe('DomImporter', () => {
  let loader: DomImporter;
  let mockRoot: HTMLElement;

  beforeEach(() => {
    // Reset del DOM
    document.body.innerHTML = '';
    mockRoot = document.createElement('div');
    document.body.appendChild(mockRoot);
    
    loader = new DomImporter({
      rootNode: mockRoot,
    });
  });

  afterEach(() => {
    loader.stop();
    loader.clearCache();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const instance = new DomImporter();
      expect(instance).toBeInstanceOf(DomImporter);
    });

    it('should create instance with custom options', () => {
      const onError = jest.fn();
      const instance = new DomImporter({ onError });
      expect(instance).toBeInstanceOf(DomImporter);
    });
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

      await loader.scan(definitions);
      expect(mockLoadFn).toHaveBeenCalled();
    });

    it('should handle multiple matching elements', async () => {
      const el1 = document.createElement('button');
      const el2 = document.createElement('button');
      el1.setAttribute('data-module', 'test');
      el2.setAttribute('data-module', 'test');
      mockRoot.appendChild(el1);
      mockRoot.appendChild(el2);

      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await loader.scan(definitions);
      // mockLoadFn debe ser llamado solo una vez porque usa cache deduplication
      expect(mockLoadFn).toHaveBeenCalledTimes(1);
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

      await loader.scan(definitions);
      expect(mockLoadFn).not.toHaveBeenCalled();
    });

    it('should handle matching nested elements', async () => {
      const container = document.createElement('div');
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      container.appendChild(element);
      mockRoot.appendChild(container);

      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await loader.scan(definitions);
      expect(mockLoadFn).toHaveBeenCalled();
    });
  });

  describe('watch', () => {
    it('should return a stop function', () => {
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: jest.fn().mockResolvedValue({ init: jest.fn() }),
        },
      ];

      const stop = loader.watch(definitions);
      expect(typeof stop).toBe('function');
      stop();
    });

    it('should process dynamically added elements', (done) => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      loader.watch(definitions);

      // Esperar a que se procese el scan inicial
      setTimeout(() => {
        const element = document.createElement('button');
        element.setAttribute('data-module', 'test');
        mockRoot.appendChild(element);

        setTimeout(() => {
          expect(mockLoadFn).toHaveBeenCalled();
          done();
        }, 100);
      }, 100);
    });

    it('should disconnect observer when stop is called', (done) => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      const stop = loader.watch(definitions);

      setTimeout(() => {
        stop();
        mockLoadFn.mockClear();

        const element = document.createElement('button');
        element.setAttribute('data-module', 'test');
        mockRoot.appendChild(element);

        setTimeout(() => {
          // Después de detener, no debería procesar nuevos elementos
          expect(mockLoadFn).not.toHaveBeenCalled();
          done();
        }, 100);
      }, 100);
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

      await loader.prefetch(definitions);
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

      await loader.prefetch(definitions);
      expect(mockLoadFn1).toHaveBeenCalled();
      expect(mockLoadFn2).toHaveBeenCalled();
    });

    it('should handle import errors', async () => {
      const error = new Error('Import failed');
      const mockLoadFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();
      
      const loaderWithError = new DomImporter({
        rootNode: mockRoot,
        onError,
      });

      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await loaderWithError.prefetch(definitions);
      expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });

  describe('stop', () => {
    it('should disconnect all observers', (done) => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      loader.watch(definitions);

      setTimeout(() => {
        loader.stop();
        mockLoadFn.mockClear();

        const element = document.createElement('button');
        element.setAttribute('data-module', 'test');
        mockRoot.appendChild(element);

        setTimeout(() => {
          expect(mockLoadFn).not.toHaveBeenCalled();
          done();
        }, 100);
      }, 100);
    });
  });

  describe('clearCache', () => {
    it('should clear the import cache', async () => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      // Primera vez, mockLoadFn debe ser llamado
      await loader.prefetch(definitions);
      expect(mockLoadFn).toHaveBeenCalledTimes(1);

      // Limpiar cache
      loader.clearCache();

      // Segunda vez, mockLoadFn debe ser llamado de nuevo (no del cache)
      await loader.prefetch(definitions);
      expect(mockLoadFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache deduplication', () => {
    it('should deduplicate same import function references', async () => {
      const mockLoadFn = jest.fn().mockResolvedValue({ init: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test1"]',
          load: mockLoadFn,
        },
        {
          selector: '[data-module="test2"]',
          load: mockLoadFn,
        },
      ];

      await loader.prefetch(definitions);
      // Debería ser llamado una sola vez porque es el mismo reference
      expect(mockLoadFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('once option', () => {
    it('should only initialize elements once', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      mockRoot.appendChild(element);

      const mockMount = jest.fn();
      const mockLoadFn = jest.fn().mockResolvedValue({ 
        default: jest.fn(),
      });

      const loaderWithMount = new DomImporter({
        rootNode: mockRoot,
        mount: mockMount,
      });

      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
          once: true,
        },
      ];

      await loaderWithMount.scan(definitions);
      expect(mockMount).toHaveBeenCalledTimes(1);

      // Intentar procesar el mismo elemento nuevamente
      await loaderWithMount.scan(definitions);
      // No debe volver a inicializarse
      expect(mockMount).toHaveBeenCalledTimes(1);
    });
  });

  describe('init option', () => {
    it('should use init with elements', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'react-comp');
      element.setAttribute('data-title', 'Hello');
      mockRoot.appendChild(element);

      const init = jest.fn();
      const loaderWithInit = new DomImporter<{ isReact?: boolean }>({
        rootNode: mockRoot,
        init,
      });

      const mockLoadFn = jest.fn().mockResolvedValue({ default: jest.fn() });
      const definitions: ModuleDefinition<{ isReact?: boolean }>[] = [
        {
          selector: '[data-module="react-comp"]',
          load: mockLoadFn,
          isReact: true,
        },
      ];

      await loaderWithInit.scan(definitions);

      expect(init).toHaveBeenCalledTimes(1);
      expect(init).toHaveBeenCalledWith(
        expect.any(Object),
        [element],
        definitions[0]
      );
    });

    it('should call both init and mount by default', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'react-comp');
      mockRoot.appendChild(element);

      const init = jest.fn();
      const moduleMount = jest.fn();

      const loaderWithInitAndMount = new DomImporter({
        rootNode: mockRoot,
        init,
        mount: moduleMount,
      });

      const mockLoadFn = jest.fn().mockResolvedValue({ default: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="react-comp"]',
          load: mockLoadFn,
        },
      ];

      await loaderWithInitAndMount.scan(definitions);

      expect(moduleMount).toHaveBeenCalledTimes(1);
      expect(init).toHaveBeenCalledTimes(1);
    });

    it('should call mount per element with props', async () => {
      const el1 = document.createElement('button');
      el1.setAttribute('data-module', 'react-comp');
      el1.setAttribute('data-title', 'One');

      const el2 = document.createElement('button');
      el2.setAttribute('data-module', 'react-comp');
      el2.setAttribute('data-title', 'Two');

      mockRoot.appendChild(el1);
      mockRoot.appendChild(el2);

      const moduleMount = jest.fn();

      const loaderWithInitAndMount = new DomImporter({
        rootNode: mockRoot,
        init: jest.fn(),
        mount: moduleMount,
      });

      const mockLoadFn = jest.fn().mockResolvedValue({ default: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="react-comp"]',
          load: mockLoadFn,
        },
      ];

      await loaderWithInitAndMount.scan(definitions);

      expect(moduleMount).toHaveBeenCalledTimes(2);
      expect(moduleMount).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        el1,
        expect.objectContaining({ title: 'One' }),
        definitions[0]
      );
      expect(moduleMount).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        el2,
        expect.objectContaining({ title: 'Two' }),
        definitions[0]
      );
    });

    it('should skip mount when init returns true', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'react-comp');
      mockRoot.appendChild(element);

      const init = jest.fn().mockReturnValue(true);
      const moduleMount = jest.fn();

      const loaderWithInitAndMount = new DomImporter({
        rootNode: mockRoot,
        init,
        mount: moduleMount,
      });

      const mockLoadFn = jest.fn().mockResolvedValue({ default: jest.fn() });
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="react-comp"]',
          load: mockLoadFn,
        },
      ];

      await loaderWithInitAndMount.scan(definitions);

      expect(init).toHaveBeenCalledTimes(1);
      expect(moduleMount).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should call onError handler on import failure', async () => {
      const error = new Error('Custom error');
      const onError = jest.fn();
      
      const loaderWithError = new DomImporter({
        rootNode: mockRoot,
        onError,
      });

      const mockLoadFn = jest.fn().mockRejectedValue(error);
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      await loaderWithError.prefetch(definitions);
      expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should handle missing init function gracefully', async () => {
      const element = document.createElement('button');
      element.setAttribute('data-module', 'test');
      mockRoot.appendChild(element);

      const mockLoadFn = jest.fn().mockResolvedValue({}); // Sin init
      const definitions: ModuleDefinition[] = [
        {
          selector: '[data-module="test"]',
          load: mockLoadFn,
        },
      ];

      // No debe lanzar error
      await expect(loader.scan(definitions)).resolves.not.toThrow();
    });
  });
});

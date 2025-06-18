#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ts = __importStar(require("typescript"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const commander_1 = require("commander");
class TestGenerator {
    constructor(filePath) {
        this.filePath = filePath;
        this.sourceFile = null;
        this.exportedItems = [];
    }
    async generate() {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.sourceFile = ts.createSourceFile(this.filePath, fileContent, ts.ScriptTarget.Latest, true);
        this.extractExports();
        const fileType = this.detectFileType();
        let template;
        switch (fileType) {
            case 'hook':
                template = this.generateHookTest();
                break;
            case 'api':
                template = this.generateApiTest();
                break;
            case 'store':
                template = this.generateStoreTest();
                break;
            case 'component':
                template = this.generateComponentTest();
                break;
            default:
                template = this.generateUtilTest();
        }
        return this.formatTest(template);
    }
    extractExports() {
        if (!this.sourceFile)
            return;
        const visit = (node) => {
            if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
                node.exportClause.elements.forEach(element => {
                    this.exportedItems.push({
                        name: element.name.text,
                        type: 'const',
                        isAsync: false
                    });
                });
            }
            if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                const name = node.name?.text || 'anonymous';
                const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
                const parameters = node.parameters.map(p => p.name.getText());
                this.exportedItems.push({
                    name,
                    type: 'function',
                    isAsync,
                    parameters,
                    isDefault: node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
                });
            }
            if (ts.isClassDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                const name = node.name?.text || 'anonymous';
                this.exportedItems.push({
                    name,
                    type: 'class',
                    isAsync: false,
                    isDefault: node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
                });
            }
            if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                node.declarationList.declarations.forEach(decl => {
                    if (ts.isIdentifier(decl.name)) {
                        this.exportedItems.push({
                            name: decl.name.text,
                            type: 'const',
                            isAsync: false
                        });
                    }
                });
            }
            ts.forEachChild(node, visit);
        };
        visit(this.sourceFile);
    }
    detectFileType() {
        const fileName = path.basename(this.filePath);
        if (fileName.includes('.hook.') || fileName.startsWith('use'))
            return 'hook';
        if (this.filePath.includes('/api/') || fileName.includes('.api.'))
            return 'api';
        if (fileName.includes('.store.') || fileName.includes('store'))
            return 'store';
        if (fileName.endsWith('.tsx') && !fileName.includes('.test.'))
            return 'component';
        return 'util';
    }
    generateHookTest() {
        const hookName = this.exportedItems.find(item => item.name.startsWith('use'))?.name || 'useHook';
        const fileName = path.basename(this.filePath, path.extname(this.filePath));
        return {
            imports: `import { renderHook, act } from '@testing-library/react';
import { ${hookName} } from './${fileName}';`,
            describe: `describe('${hookName}', () => {`,
            tests: [
                `  it('should initialize with default values', () => {
    const { result } = renderHook(() => ${hookName}());
    
    expect(result.current).toBeDefined();
  });`,
                `  it('should handle state updates', async () => {
    const { result } = renderHook(() => ${hookName}());
    
    await act(async () => {
      // Add state update logic here
    });
    
    // Add assertions here
  });`,
                `  it('should handle edge cases', () => {
    const { result } = renderHook(() => ${hookName}());
    
    // Test edge cases like null, undefined, empty arrays
  });`
            ]
        };
    }
    generateApiTest() {
        const fileName = path.basename(this.filePath, path.extname(this.filePath));
        const isRouteFile = fileName === 'route';
        // Detect HTTP method handlers
        const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        const exportedMethods = this.exportedItems
            .filter(item => httpMethods.includes(item.name))
            .map(item => item.name);
        const imports = isRouteFile
            ? `import { NextRequest } from 'next/server';
import { ${exportedMethods.length > 0 ? exportedMethods.join(', ') : 'GET'} } from './${fileName}';
import { getServerSession } from 'next-auth';
import { server } from '@/tests/mocks/server';
import { rest } from 'msw';`
            : `import { createMocks } from 'node-mocks-http';
import { handler } from './${fileName}';
import { server } from '@/tests/mocks/server';
import { rest } from 'msw';`;
        const tests = [
            `  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());`,
            `  // Mock getServerSession for authenticated routes
  jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
  }));`
        ];
        // Generate tests for each exported HTTP method
        if (isRouteFile && exportedMethods.length > 0) {
            exportedMethods.forEach(method => {
                tests.push(this.generateMethodTest(method));
            });
        }
        else {
            // Fallback for non-route API files
            tests.push(...this.generateGenericApiTests());
        }
        // Add authentication tests
        tests.push(`  describe('Authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should allow authenticated requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: '123', email: 'test@example.com' },
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });`);
        // Add validation tests
        tests.push(`  describe('Validation', () => {
    it('should validate request body schema', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should validate query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/test?invalid=true', {
        method: 'GET',
      });

      const response = await GET(request);
      // Adjust based on your validation logic
    });
  });`);
        // Add error handling tests
        tests.push(`  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      server.use(
        rest.get('*/api/*', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Database error' }));
        })
      );

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should handle rate limiting', async () => {
      // Mock rate limit exceeded
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });

      // Simulate multiple requests to trigger rate limit
      for (let i = 0; i < 10; i++) {
        await GET(request);
      }

      const response = await GET(request);
      expect(response.status).toBe(429);
    });
  });`);
        return {
            imports,
            describe: `describe('API Route: ${this.filePath}', () => {`,
            tests
        };
    }
    generateMethodTest(method) {
        const methodLower = method.toLowerCase();
        return `  describe('${method} /${methodLower}', () => {
    it('should handle ${method} request successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: '${method}',
        headers: {
          'Content-Type': 'application/json',
        },
        ${method !== 'GET' && method !== 'DELETE' ? `body: JSON.stringify({
          // Add test data based on your schema
          name: 'Test',
          value: 123,
        }),` : ''}
      });

      const response = await ${method}(request);
      expect(response.status).toBe(${method === 'POST' ? '201' : '200'});
      
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      // Add more specific assertions based on your API response
    });

    it('should handle ${method} request with invalid data', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: '${method}',
        ${method !== 'GET' && method !== 'DELETE' ? `body: JSON.stringify({
          // Invalid data
        }),` : ''}
      });

      const response = await ${method}(request);
      expect(response.status).toBe(400);
    });
  });`;
    }
    generateGenericApiTests() {
        return [
            `  it('should handle GET request successfully', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toHaveProperty('success', true);
  });`,
            `  it('should handle POST request with valid data', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        // Add test data here
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
  });`,
            `  it('should handle errors gracefully', async () => {
    server.use(
      rest.get('*', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Internal Server Error' }));
      })
    );

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
  });`
        ];
    }
    generateStoreTest() {
        const fileName = path.basename(this.filePath, path.extname(this.filePath));
        const storeName = this.exportedItems.find(item => item.name.includes('Store') || item.name.includes('store'))?.name || 'useStore';
        return {
            imports: `import { act, renderHook } from '@testing-library/react';
import { ${storeName} } from './${fileName}';`,
            describe: `describe('Store: ${storeName}', () => {`,
            tests: [
                `  beforeEach(() => {
    ${storeName}.setState(${storeName}.getInitialState());
  });`,
                `  it('should have initial state', () => {
    const { result } = renderHook(() => ${storeName}());
    
    expect(result.current).toBeDefined();
    // Add specific initial state checks
  });`,
                `  it('should update state correctly', () => {
    const { result } = renderHook(() => ${storeName}());
    
    act(() => {
      // Add state update action
    });
    
    // Add assertions for updated state
  });`,
                `  it('should handle async actions', async () => {
    const { result } = renderHook(() => ${storeName}());
    
    await act(async () => {
      // Add async action
    });
    
    // Add assertions
  });`,
                `  it('should persist state changes', () => {
    const { result: result1 } = renderHook(() => ${storeName}());
    
    act(() => {
      // Update state
    });
    
    const { result: result2 } = renderHook(() => ${storeName}());
    
    // Verify state persists across different hook instances
  });`
            ]
        };
    }
    generateComponentTest() {
        const fileName = path.basename(this.filePath, path.extname(this.filePath));
        const componentName = this.exportedItems.find(item => item.type === 'function' && item.name[0] === item.name[0].toUpperCase())?.name || fileName;
        return {
            imports: `import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ${componentName} } from './${fileName}';`,
            describe: `describe('${componentName}', () => {`,
            tests: [
                `  it('should render without crashing', () => {
    render(<${componentName} />);
    
    expect(screen.getByRole('main')).toBeInTheDocument();
  });`,
                `  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    render(<${componentName} />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    // Add assertions for interaction results
  });`,
                `  it('should display loading state', () => {
    render(<${componentName} isLoading />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });`,
                `  it('should handle error state', () => {
    render(<${componentName} error="Something went wrong" />);
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });`
            ]
        };
    }
    generateUtilTest() {
        const fileName = path.basename(this.filePath, path.extname(this.filePath));
        const functions = this.exportedItems.filter(item => item.type === 'function');
        const imports = functions.length > 0
            ? `import { ${functions.map(f => f.name).join(', ')} } from './${fileName}';`
            : `import * as utils from './${fileName}';`;
        const tests = [];
        functions.forEach(func => {
            tests.push(`  describe('${func.name}', () => {
    it('should work with valid input', ${func.isAsync ? 'async ' : ''}() => {
      ${func.isAsync ? 'const result = await' : 'const result ='} ${func.name}(/* add test params */);
      
      expect(result).toBeDefined();
      // Add specific assertions
    });

    it('should handle edge cases', ${func.isAsync ? 'async ' : ''}() => {
      // Test with null/undefined
      ${func.isAsync ? 'await expect(' : 'expect(() =>'}${func.name}(null)${func.isAsync ? ')' : ')'}.${func.isAsync ? 'rejects.' : ''}toThrow();
      
      // Test with empty values
      ${func.isAsync ? 'const result = await' : 'const result ='} ${func.name}(/* empty value */);
      expect(result).toBe(/* expected */);
    });

    it('should handle invalid input', ${func.isAsync ? 'async ' : ''}() => {
      ${func.isAsync ? 'await expect(' : 'expect(() =>'}${func.name}(/* invalid input */)${func.isAsync ? ')' : ')'}.${func.isAsync ? 'rejects.' : ''}toThrow();
    });
  });`);
        });
        if (tests.length === 0) {
            tests.push(`  it('should export expected utilities', () => {
    expect(utils).toBeDefined();
    // Add checks for specific exports
  });`);
        }
        return {
            imports,
            describe: `describe('${fileName}', () => {`,
            tests
        };
    }
    formatTest(template) {
        return `${template.imports}

${template.describe}
${template.tests.join('\n\n')}
});
`;
    }
}
// CLI setup
commander_1.program
    .name('generate-tests')
    .description('Generate test files for TypeScript/JavaScript files')
    .version('1.0.0')
    .argument('<file>', 'Path to the file to generate tests for')
    .option('-o, --output <path>', 'Output path for the test file')
    .option('-f, --force', 'Overwrite existing test file')
    .action(async (file, options) => {
    try {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found: ${filePath}`);
            process.exit(1);
        }
        const generator = new TestGenerator(filePath);
        const testContent = await generator.generate();
        // Determine output path
        let outputPath;
        if (options.output) {
            outputPath = path.resolve(options.output);
        }
        else {
            const dir = path.dirname(filePath);
            const ext = path.extname(filePath);
            const baseName = path.basename(filePath, ext);
            outputPath = path.join(dir, `${baseName}.test${ext}`);
        }
        // Check if file exists
        if (fs.existsSync(outputPath) && !options.force) {
            console.error(`Error: Test file already exists: ${outputPath}`);
            console.error('Use --force to overwrite');
            process.exit(1);
        }
        // Write test file
        fs.writeFileSync(outputPath, testContent, 'utf-8');
        console.log(`✅ Test file generated: ${outputPath}`);
    }
    catch (error) {
        console.error('Error generating test:', error);
        process.exit(1);
    }
});
commander_1.program.parse();

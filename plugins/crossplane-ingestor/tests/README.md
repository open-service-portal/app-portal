# Kubernetes Ingestor Plugin Tests

This directory contains all tests for the kubernetes-ingestor plugin.

## Structure

```
tests/
├── transformers/        # Unit tests for transformer classes
│   ├── CrossplaneDetector.test.ts
│   ├── ParameterExtractor.test.ts
│   ├── StepGenerator.test.ts
│   ├── StepGeneratorV2.test.ts
│   ├── TemplateBuilder.test.ts
│   └── XRDTransformer.test.ts
├── integration/         # Integration tests
│   └── integration.test.ts
└── helpers/            # Test utilities and fixtures
    └── fixtures.ts
```

## Running Tests

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests in watch mode
yarn test:watch

# Run specific test file
yarn test CrossplaneDetector

# Run integration tests only
yarn test integration
```

## Test Coverage

Current coverage thresholds:
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

## Writing Tests

### Unit Tests

Unit tests should focus on testing individual classes and methods in isolation:

```typescript
import { CrossplaneDetector } from '../../src/transformers/CrossplaneDetector';
import { createMockXRD } from '../helpers/fixtures';

describe('CrossplaneDetector', () => {
  let detector: CrossplaneDetector;

  beforeEach(() => {
    detector = new CrossplaneDetector();
  });

  it('should detect v1 API version', () => {
    const xrd = createMockXRD();
    const result = detector.detect(xrd);
    expect(result.version).toBe('v1');
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly:

```typescript
import { XRDTransformer } from '../../src/transformers';
import { createMockXRD } from '../helpers/fixtures';

describe('XRD Transformation Pipeline', () => {
  it('should transform XRD to Backstage template', () => {
    const transformer = new XRDTransformer();
    const xrd = createMockXRD();
    const templates = transformer.transform(xrd);
    
    expect(templates).toHaveLength(1);
    expect(templates[0].kind).toBe('Template');
  });
});
```

## Test Fixtures

Use the fixtures provided in `helpers/fixtures.ts`:

- `createMockXRD()` - Creates a basic v1 XRD
- `createMockXRDv2()` - Creates a v2 cluster-scoped XRD
- `createMockXRDv2Namespaced()` - Creates a v2 namespaced XRD
- `createMockXRDWithClaims()` - Creates an XRD with claim names
- `createMockXRDVersion()` - Creates an XRD version object

## Mocking

For external dependencies, use Jest mocks:

```typescript
jest.mock('../../src/utils', () => ({
  parseYaml: jest.fn(),
  toYaml: jest.fn(),
}));
```

## Debugging Tests

To debug tests in VS Code:

1. Set breakpoints in your test or source code
2. Open the test file
3. Press F5 or use "Debug: Start Debugging"
4. Select "Jest Current File" configuration

## CI/CD

Tests are automatically run in CI on:
- Pull requests
- Commits to main branch
- Release builds

Failed tests will block merging and deployment.
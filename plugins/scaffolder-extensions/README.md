# @internal/scaffolder-extensions

Custom Backstage Scaffolder field extensions for the portal application.

## Overview

This package contains reusable custom field extensions that extend the Backstage Scaffolder functionality.

## Available Extensions

### ValidateKebabCase

A form field for validating kebab-case formatted strings according to Kubernetes naming conventions.

**Features:**
- Validates lowercase letters, numbers, hyphens, and underscores
- Ensures strings start and end with alphanumeric characters
- Enforces 253-character maximum length (Kubernetes limit)
- Warns about consecutive hyphens/underscores

**Usage in templates:**

```yaml
parameters:
  - title: Resource Configuration
    required:
      - resourceName
    properties:
      resourceName:
        type: string
        ui:field: ValidateKebabCase
        title: Resource Name
        description: Name for your Kubernetes resource
```

## Development

### Adding New Custom Fields

1. Create a new directory under `src/fields/YourFieldName/`
2. Add your field component and validation in `YourFieldNameExtension.tsx`
3. Create an index using `createFormField`:

```typescript
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { YourFieldName, yourFieldNameValidation } from './YourFieldNameExtension';

export const YourFieldName = createFormField({
  component: YourFieldName,
  name: 'YourFieldName',
  validation: yourFieldNameValidation,
});
```

4. Export from `src/index.ts`
5. Register in `packages/app/src/modules/scaffolderExtensions.ts`

## Architecture

This package follows Backstage's New Frontend System architecture with:
- Form field extensions using `createFormField` from `@backstage/plugin-scaffolder-react/alpha`
- Integration via Frontend Modules in the main app
- Clean separation from the official scaffolder plugin

## License

Apache-2.0

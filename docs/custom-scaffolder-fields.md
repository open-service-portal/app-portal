# Custom Scaffolder Fields - Implementation Guide

**Date:** 2024-11-11
**Status:** ✅ Working
**Backstage Version:** 1.42+ (New Frontend System)

## Summary

Successfully implemented custom scaffolder field extensions for Backstage using the New Frontend System architecture.

## What Was Implemented

### ValidateKebabCase Field
Custom field for validating Kubernetes-compatible resource names:
- Only lowercase letters, numbers, hyphens, underscores
- Must start and end with alphanumeric characters
- Maximum 253 characters (Kubernetes limit)
- Warns about consecutive hyphens/underscores

## Architecture

```
packages/
├── scaffolder-extensions/          # Reusable custom fields plugin
│   ├── package.json
│   ├── README.md
│   └── src/
│       ├── index.ts               # Main export
│       └── fields/
│           └── ValidateKebabCase/
│               ├── index.ts       # Field creation with createFormField
│               └── ValidateKebabCaseExtension.tsx
│
└── app/
    └── src/
        ├── App.tsx                 # Registers scaffolderExtensionsModule
        └── modules/
            └── scaffolderExtensions.ts  # Extension module
```

## Critical Implementation Details

### 1. ✅ Blueprint Name vs Field Name

**This was the key issue!**

```typescript
// Blueprint registration (internal name)
FormFieldBlueprint.make({
  name: 'validate-kebab-case',  // ✅ lowercase-with-dashes
  params: { ... }
});

// Field object (for templates)
createFormField({
  name: 'ValidateKebabCase',  // ✅ PascalCase
  component: Component,
  validation: validateKebabCaseValidation,
});
```

**In templates, use the Field name (PascalCase):**
```yaml
ui:field: ValidateKebabCase  # ✅ Correct
```

### 2. ✅ Package.json Exports Field

Required for ES Modules:
```json
{
  "name": "@internal/scaffolder-extensions",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": {
      "default": "./src/index.ts"
    }
  }
}
```

### 3. ✅ Correct Export Chain

```typescript
// plugins/scaffolder-extensions/src/fields/ValidateKebabCase/index.ts
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
export const ValidateKebabCase = createFormField({ ... });

// plugins/scaffolder-extensions/src/index.ts
export { ValidateKebabCase } from './fields/ValidateKebabCase';

// packages/app/src/modules/scaffolderExtensions.ts
FormFieldBlueprint.make({
  params: {
    field: () => import('@internal/scaffolder-extensions').then(m => m.ValidateKebabCase)
  }
});
```

### 4. ✅ Module Registration

```typescript
// packages/app/src/App.tsx
import { scaffolderExtensionsModule } from './modules/scaffolderExtensions';

const app = createApp({
  features: [
    scaffolderPlugin,           // Official plugin first
    scaffolderExtensionsModule, // Then extensions
    // ...
  ],
});
```

## Critical Lessons Learned

### ❌ Field Explorer Does NOT Show Extension Fields

**Important:** The Field Explorer at `/create/edit` only shows fields from the main scaffolder plugin, NOT from extension modules.

**To verify custom fields work:**
1. Create a template using `ui:field: YourFieldName`
2. Test the template directly
3. The field will work even if not listed in Field Explorer

This is **expected behavior** in the New Frontend System.

### ✅ What Was Required

| Requirement | Solution |
|------------|----------|
| Package structure | Created `@internal/scaffolder-extensions` |
| Package exports | Added `exports` field to package.json |
| Field creation | Used `createFormField` from scaffolder-react/alpha |
| Blueprint naming | lowercase-with-dashes for Blueprint name |
| Field naming | PascalCase for field name (used in templates) |
| Module registration | Created Frontend Module with FormFieldBlueprint |
| Workspace linking | Yarn workspace with `workspace:*` dependency |

## Usage in Templates

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: my-template
spec:
  parameters:
    - title: Configuration
      required:
        - resourceName
      properties:
        resourceName:
          type: string
          ui:field: ValidateKebabCase
          title: Resource Name
          description: Name for your Kubernetes resource
```

## Adding New Custom Fields

### 1. Create Field Component

```typescript
// plugins/scaffolder-extensions/src/fields/MyField/MyFieldExtension.tsx
import React from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

export const MyField = (props: FieldExtensionComponentProps<string>) => {
  // Component implementation
};

export const myFieldValidation = (value: string, validation) => {
  // Validation logic
};
```

### 2. Create Field with createFormField

```typescript
// plugins/scaffolder-extensions/src/fields/MyField/index.ts
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { MyField as Component, myFieldValidation } from './MyFieldExtension';

export const MyField = createFormField({
  component: Component,
  name: 'MyField',  // PascalCase - used in templates
  validation: myFieldValidation,
});
```

### 3. Export from Package

```typescript
// plugins/scaffolder-extensions/src/index.ts
export { MyField } from './fields/MyField';
```

### 4. Register in Module

```typescript
// packages/app/src/modules/scaffolderExtensions.ts
FormFieldBlueprint.make({
  name: 'my-field',  // lowercase-with-dashes - internal Blueprint name
  params: {
    field: () => import('@internal/scaffolder-extensions').then(m => m.MyField),
  },
}),
```

## Troubleshooting

### Field doesn't appear in templates

1. **Check Blueprint name**: Must be lowercase-with-dashes
2. **Check Field name in template**: Must match `createFormField({ name: '...' })`
3. **Verify package exports**: Must have `exports` field in package.json
4. **Check workspace link**: `ls -la node_modules/@internal/scaffolder-extensions`
5. **Clear cache**: `rm -rf node_modules/.cache && yarn start`

### Import errors

1. **Check exports chain**: Each level must export correctly
2. **Verify package.json**: Must have `main`, `types`, and `exports`
3. **Check module registration**: Must be in App.tsx features array

## Files Created/Modified

- ✅ `plugins/scaffolder-extensions/` - New package created
- ✅ `packages/app/package.json` - Added dependency
- ✅ `packages/app/src/App.tsx` - Registered module
- ✅ `packages/app/src/modules/scaffolderExtensions.ts` - Created module
- ✅ `plugins/scaffolder.backup/` - Old internal fork backed up

## EntraIdEmailPicker Field

Custom autocomplete field for selecting user email addresses from Microsoft Entra ID (Azure AD).

**Features:**
- Real-time user search via Microsoft Graph API
- Searches across email, display name, and UPN
- Debounced search (300ms delay)
- Shows display name + email in dropdown
- Only saves the email address
- Email validation

### Backend Setup

The backend module provides the `/api/entra-id/users/search` endpoint.

**Required Azure AD App Registration:**
1. Create App Registration in Azure Portal
2. Add API Permission: `User.Read.All` (Application permission)
3. Grant admin consent
4. Create client secret

**Configuration:**

Add to `app-config.local.yaml`:
```yaml
entraId:
  tenantId: ${ENTRA_TENANT_ID}
  clientId: ${ENTRA_CLIENT_ID}
  clientSecret: ${ENTRA_CLIENT_SECRET}
```

Set environment variables:
```bash
export ENTRA_TENANT_ID="your-tenant-id"
export ENTRA_CLIENT_ID="your-client-id"
export ENTRA_CLIENT_SECRET="your-client-secret"
```

### Usage in Templates

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: my-template
spec:
  parameters:
    - title: Owner Information
      required:
        - ownerEmail
      properties:
        ownerEmail:
          type: string
          ui:field: EntraIdEmailPicker
          title: Owner Email
          description: Email address of the resource owner
```

### How It Works

1. **User types**: e.g., "pri"
2. **Frontend debounces**: Waits 300ms
3. **Backend queries Graph API**:
   ```
   GET /users?$filter=startswith(mail,'pri') or startswith(displayName,'pri')
   ```
4. **Results shown**: "Pascal Rimann <primann@cloudpunks.de>"
5. **User selects**: Only email saved: "primann@cloudpunks.de"

### Files Created

Backend:
- `packages/backend/src/modules/entra-id-user-search/router.ts` - API endpoint
- `packages/backend/src/modules/entra-id-user-search/index.ts` - Module registration
- Registered in: `packages/backend/src/index.ts`

Frontend:
- `plugins/scaffolder-extensions/src/fields/EntraIdEmailPicker/EntraIdEmailPickerExtension.tsx` - Component
- `plugins/scaffolder-extensions/src/fields/EntraIdEmailPicker/index.ts` - Field creation
- Exported from: `plugins/scaffolder-extensions/src/index.ts`
- Registered in: `packages/app/src/modules/scaffolderExtensions.ts`

### API Endpoints

**Search users:**
```bash
GET /api/entra-id/users/search?q=pri
```

**Response:**
```json
[
  {
    "mail": "primann@cloudpunks.de",
    "displayName": "Pascal Rimann",
    "userPrincipalName": "primann@cloudpunks.de"
  }
]
```

**Health check:**
```bash
GET /api/entra-id/users/health
```

### Troubleshooting

**Field not working:**
- Check backend logs for API errors
- Verify EntraID credentials in config
- Test API endpoint directly: `curl http://localhost:7007/api/entra-id/users/search?q=test`

**No results:**
- Verify App Registration has `User.Read.All` permission
- Check admin consent was granted
- Verify users exist in EntraID with email addresses

**Authentication errors:**
- Check tenant ID, client ID, client secret
- Verify client secret hasn't expired
- Check token endpoint: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`

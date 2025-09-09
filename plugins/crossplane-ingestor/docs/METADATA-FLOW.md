# XRD to Backstage Template: Metadata Flow Documentation

## Overview

This document describes the complete information flow from Crossplane XRDs (Composite Resource Definitions) to Backstage Software Templates in the kubernetes-ingestor plugin.

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Kubernetes    │────▶│  XRDDataProvider │────▶│  XRD Objects    │
│    Cluster      │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                        ┌─────────────────────────────────────────┐
                        │         XRDTransformer                  │
                        │  ┌─────────────────────────────────┐    │
                        │  │   CrossplaneDetector            │    │
                        │  │   - Detects v1 vs v2            │    │
                        │  │   - Determines scope            │    │
                        │  │   - Identifies claims usage     │    │
                        │  └─────────────────────────────────┘    │
                        │                                          │
                        │  ┌─────────────────────────────────┐    │
                        │  │   ParameterExtractor            │    │
                        │  │   - Extracts metadata params    │    │
                        │  │   - Processes OpenAPI schema    │    │
                        │  │   - Handles publishing config   │    │
                        │  └─────────────────────────────────┘    │
                        │                                          │
                        │  ┌─────────────────────────────────┐    │
                        │  │   StepGeneratorV1/V2            │    │
                        │  │   - Generates scaffolder steps  │    │
                        │  │   - Handles GitOps workflow     │    │
                        │  │   - Creates resource manifests  │    │
                        │  └─────────────────────────────────┘    │
                        │                                          │
                        │  ┌─────────────────────────────────┐    │
                        │  │   TemplateBuilder               │    │
                        │  │   - Assembles final template    │    │
                        │  │   - Adds metadata & links       │    │
                        │  │   - Configures output section   │    │
                        │  └─────────────────────────────────┘    │
                        └────────────────┬────────────────────────┘
                                        │
                                        ▼
                        ┌─────────────────────────────────────────┐
                        │      Backstage Software Template       │
                        └─────────────────────────────────────────┘
```

## Metadata Extraction Points

### 1. XRD Metadata → Template Metadata

#### Annotations Mapping

| XRD Location | XRD Field | Template Field | Description |
|-------------|-----------|----------------|-------------|
| `metadata.annotations` | `backstage.io/title` | `metadata.title` | Human-readable template name |
| `metadata.annotations` | `backstage.io/description` | `metadata.description` | Template description |
| `metadata.annotations` | `backstage.io/icon` | `metadata.annotations['backstage.io/icon']` | Icon identifier |
| `metadata.annotations` | `backstage.io/template-name` | `metadata.name` | Template identifier override |
| `metadata.annotations` | `backstage.io/docs-url` | `metadata.links[].url` | Documentation link |
| `metadata.annotations` | `backstage.io/source-location` | `metadata.annotations['backstage.io/source-location']` | Source repository |
| `metadata.annotations` | `backstage.io/lifecycle` | `metadata.annotations['backstage.io/lifecycle']` | Lifecycle stage |
| `metadata.annotations` | `openportal.dev/docs-url` | `metadata.links[].url` | Alternative docs link |
| `metadata.annotations` | `openportal.dev/source-url` | `metadata.links[].url` | Source code link |
| `metadata.annotations` | `openportal.dev/support-url` | `metadata.links[].url` | Support link |

#### Labels Mapping

| XRD Location | XRD Field | Template Field | Description |
|-------------|-----------|----------------|-------------|
| `metadata.labels` | `openportal.dev/tags` | `metadata.tags[]` | Comma-separated tags |
| `metadata.labels` | `backstage.io/tags` | `metadata.tags[]` | Alternative tag location |

### 2. XRD Spec → Template Parameters

#### Crossplane Version Detection

```typescript
// CrossplaneDetector logic
if (xrd.apiVersion === 'apiextensions.crossplane.io/v2') {
  // v2 XRD - uses direct XRs
  if (xrd.spec.scope === 'Namespaced') {
    // Namespaced XRs require namespace parameter
  } else if (xrd.spec.scope === 'Cluster') {
    // Cluster-scoped XRs don't need namespace
  }
} else {
  // v1 XRD - always uses claims (namespaced)
  // Always requires namespace parameter
}
```

#### OpenAPI Schema Transformation

```yaml
# Input: XRD OpenAPI Schema
spec:
  versions:
  - name: v1alpha1
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: ["type", "name"]
            properties:
              type:
                type: string
                description: "Record type"
                enum: ["A", "AAAA", "CNAME"]
                default: "A"
              name:
                type: string
                description: "DNS name"
                pattern: "^[a-z0-9.-]+$"
              ttl:
                type: integer
                description: "Time to live"
                minimum: 60
                maximum: 86400
                default: 300

# Output: Backstage Template Parameters
spec:
  parameters:
  - title: "Resource Configuration"
    required: ["type", "name"]
    properties:
      type:
        title: "Type"
        type: string
        description: "Record type"
        enum: ["A", "AAAA", "CNAME"]
        enumNames: ["A", "AAAA", "CNAME"]
        default: "A"
      name:
        title: "Name"
        type: string
        description: "DNS name"
        pattern: "^[a-z0-9.-]+$"
      ttl:
        title: "TTL"
        type: number
        description: "Time to live"
        minimum: 60
        maximum: 86400
        default: 300
```

### 3. Automatic Tag Generation

The system automatically adds contextual tags based on XRD properties:

```typescript
// TemplateBuilder.extractTags()
tags.add('crossplane');                    // Always added
tags.add('infrastructure');                // Always added
tags.add(`crossplane-${version}`);         // e.g., 'crossplane-v2'
tags.add(scope.toLowerCase());             // e.g., 'namespaced', 'cluster'

// From XRD labels/annotations
if (labels['openportal.dev/tags']) {
  labels['openportal.dev/tags'].split(',').forEach(tag => tags.add(tag.trim()));
}
```

### 4. Step Generation Logic

#### For Crossplane v1 (StepGeneratorV1)

```typescript
// Always generates claim creation steps
{
  id: 'create-claim',
  name: `Create ${claimKind}`,
  action: 'kubernetes:apply',
  input: {
    manifest: {
      apiVersion: `${group}/${version}`,
      kind: claimKind,
      metadata: {
        name: '${{ parameters.xrName }}',
        namespace: '${{ parameters.namespace }}' // Always namespaced
      },
      spec: {
        compositionRef: { name: compositionName },
        // Parameters mapped from OpenAPI schema
      }
    }
  }
}
```

#### For Crossplane v2 (StepGeneratorV2)

```typescript
// Generates direct XR creation steps
{
  id: 'create-xr',
  name: `Create ${xrKind} XR`,
  action: 'kubernetes:apply',
  input: {
    manifest: {
      apiVersion: `${group}/${version}`,
      kind: xrKind,
      metadata: {
        name: '${{ parameters.xrName }}',
        // namespace only if scope === 'Namespaced'
        ...(isNamespaced && { namespace: '${{ parameters.namespace }}' })
      },
      spec: {
        compositionSelector: {
          matchLabels: {
            'crossplane.io/xrd': xrdName
          }
        },
        // Parameters mapped from OpenAPI schema
      }
    }
  }
}
```

### 5. Publishing Configuration

When `includePublishing` is enabled, additional steps are generated:

```typescript
// Git Publishing Step
{
  id: 'publish-git',
  name: 'Publish to Git',
  action: 'publish:github:pull-request',
  input: {
    repoUrl: '${{ parameters.repoUrl }}',
    title: `Create ${resourceKind}: ${{ parameters.xrName }}`,
    branchName: 'create-${{ parameters.xrName }}',
    targetPath: isNamespaced ? 
      'namespaced/${{ parameters.namespace }}' : 
      'cluster'
  }
}

// Flux Reconciliation Step
{
  id: 'reconcile-flux',
  name: 'Trigger Flux Reconciliation',
  action: 'flux:reconcile',
  input: {
    kustomization: 'catalog-orders',
    namespace: 'flux-system'
  }
}
```

## Configuration Options

### Plugin Configuration

```yaml
kubernetesIngestor:
  # Core settings
  annotationPrefix: 'backstage.io'
  convertDefaultValuesToPlaceholders: true
  
  # Template generation
  includePublishing: true
  includeFetch: true
  includeRegister: false
  
  # Naming conventions
  templateNamePrefix: ''
  templateNameSuffix: '-template'
  defaultOwner: 'platform-team'
  
  # Additional metadata
  additionalTags:
    - 'gitops'
    - 'self-service'
  
  # Publishing configuration
  publishPhase:
    git:
      repoUrl: 'github.com?owner=org&repo=catalog-orders'
      targetBranch: 'main'
      createPR: true
    flux:
      kustomization: 'catalog-orders'
      namespace: 'flux-system'
```

### XRD Enhancement

To optimize template generation, enhance your XRDs with these annotations:

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: databases.platform.io
  annotations:
    # Template metadata
    backstage.io/title: "Database Instance"
    backstage.io/description: "Create managed database instances"
    backstage.io/icon: "database"
    
    # Documentation
    backstage.io/docs-url: "https://docs.platform.io/databases"
    openportal.dev/source-url: "https://github.com/org/platform"
    
    # Lifecycle
    backstage.io/lifecycle: "production"
    
  labels:
    # Categorization
    openportal.dev/tags: "database,managed,aws,rds"
    
spec:
  # ... XRD specification
```

## Data Flow Examples

### Example 1: Simple v2 Namespaced XRD

```yaml
# Input XRD
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: apps.example.com
spec:
  group: example.com
  names:
    kind: App
  scope: Namespaced
  versions:
  - name: v1
    served: true
    schema:
      openAPIV3Schema:
        properties:
          spec:
            properties:
              replicas:
                type: integer
                default: 1

# Processing Steps:
# 1. CrossplaneDetector: { version: 'v2', scope: 'Namespaced', usesClaims: false }
# 2. ParameterExtractor: Creates namespace parameter + replicas parameter
# 3. StepGeneratorV2: Generates direct XR creation step
# 4. TemplateBuilder: Assembles template with auto-tags

# Output Template Parameters
parameters:
  - title: "Resource Metadata"
    properties:
      xrName: { type: string }
      namespace: { type: string, default: 'default' }
      owner: { type: string }
  - title: "Resource Configuration"  
    properties:
      replicas: { type: number, default: 1 }
```

### Example 2: v1 XRD with Claims

```yaml
# Input XRD
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: databases.example.com
spec:
  group: example.com
  names:
    kind: Database
  claimNames:
    kind: DatabaseClaim
  versions:
  - name: v1alpha1
    served: true

# Processing Steps:
# 1. CrossplaneDetector: { version: 'v1', scope: 'Cluster', usesClaims: true }
# 2. ParameterExtractor: Always adds namespace (claims are namespaced)
# 3. StepGeneratorV1: Generates claim creation step
# 4. TemplateBuilder: Uses claim kind in title

# Output Template
metadata:
  title: "DatabaseClaim Template"
spec:
  steps:
    - id: create-claim
      name: "Create DatabaseClaim"
      action: kubernetes:apply
```

## Troubleshooting Guide

### Issue: Parameters not appearing in template

**Check:**
1. OpenAPI schema is under `spec.versions[].schema.openAPIV3Schema`
2. Properties are under `properties.spec.properties`
3. Field types are supported (string, number, boolean, integer)

### Issue: Template not generated

**Check:**
1. XRD version has `served: true`
2. XRD passes validation in `XRDTransformer.canTransform()`
3. No errors in transformation pipeline

### Issue: Wrong resource type in steps

**Check:**
1. Crossplane version detection is correct
2. For v1: Should use claim kind if available
3. For v2: Should use XR kind directly
4. Scope detection matches XRD specification

## API Reference

### Key Interfaces

```typescript
interface CrossplaneVersion {
  version: 'v1' | 'v2';
  scope: 'Cluster' | 'Namespaced' | 'LegacyCluster';
  usesClaims: boolean;
}

interface ParameterSection {
  title: string;
  description?: string;
  required?: string[];
  properties: Record<string, ParameterProperty>;
}

interface BackstageTemplateStep {
  id: string;
  name: string;
  action: string;
  input: Record<string, any>;
}
```

### Transformer Methods

```typescript
class XRDTransformer {
  transform(xrd: XRD): BackstageTemplate[]
  canTransform(xrd: XRD): { valid: boolean; reasons: string[] }
  preview(xrd: XRD): TransformationPreview
}
```

## Performance Considerations

- XRD discovery runs on configurable schedule (default: 30 minutes)
- Transformation is performed in-memory
- Templates are cached in Backstage catalog
- Large OpenAPI schemas may impact form rendering performance

## Security Considerations

- XRD annotations are sanitized before template generation
- Parameter patterns are preserved for input validation
- GitOps workflows use PR-based approval by default
- Namespace isolation is enforced for namespaced resources
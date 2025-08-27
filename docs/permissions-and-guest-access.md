# Permissions and Guest Access Configuration

## Overview

This document explains how we configured Backstage permissions to allow guest users to access catalog entities and templates, and how to make authenticated API calls.

## Permission Policy Implementation

### Custom Permission Policy

We replaced the default "allow-all" policy with a custom policy that provides controlled access for guest users.

**Location:** `packages/backend/src/permissions/index.ts`

### Key Features

1. **Guest Read Access:** Unauthenticated users can view catalog entities and templates
2. **Authenticated Write Access:** Only authenticated users can create new entities
3. **Flexible Extension:** Easy to add more granular permissions as needed

## Guest User Configuration

### Frontend Configuration

Guest authentication is enabled in the sign-in page

### Backend Configuration

Guest users are automatically handled by the permission policy without additional configuration.

## API Authentication

### Getting a Guest Token

Guest users receive a token automatically when accessing the frontend. To get a token programmatically:

```bash
# Get guest token
curl -X POST http://localhost:7007/api/auth/guest/refresh \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.backstageIdentity.token'
```

### Using the Token for API Calls

```bash
# Store the token
TOKEN=$(curl -X POST http://localhost:7007/api/auth/guest/refresh \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.backstageIdentity.token')

# Use the token for authenticated requests
curl http://localhost:7007/api/catalog/entities \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Common API Endpoints

#### Catalog API

```bash
# List all entities
curl http://localhost:7007/api/catalog/entities \
  -H "Authorization: Bearer $TOKEN"

# Get a specific entity
curl http://localhost:7007/api/catalog/entities/by-name/template/default/template-dns-record-v2 \
  -H "Authorization: Bearer $TOKEN"

# Query entities with filters
curl "http://localhost:7007/api/catalog/entities?filter=kind=Template" \
  -H "Authorization: Bearer $TOKEN"
```

#### Scaffolder API

```bash
# List available templates
curl http://localhost:7007/api/scaffolder/v2/templates \
  -H "Authorization: Bearer $TOKEN"

# Get scaffolder actions
curl http://localhost:7007/api/scaffolder/v2/actions \
  -H "Authorization: Bearer $TOKEN"

# List tasks (requires authentication)
curl http://localhost:7007/api/scaffolder/v2/tasks \
  -H "Authorization: Bearer $TOKEN"
```

## Testing as Claude

When testing API endpoints as Claude (or any automated system), follow this pattern:

### 1. Get Authentication Token

```bash
# Get guest token for testing
export BACKSTAGE_TOKEN=$(curl -s -X POST http://localhost:7007/api/auth/guest/refresh \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.backstageIdentity.token')

echo "Token acquired: ${BACKSTAGE_TOKEN:0:20}..."
```

### 2. Test Catalog Access

```bash
# Test reading templates
curl -s http://localhost:7007/api/catalog/entities \
  -H "Authorization: Bearer $BACKSTAGE_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.items[] | select(.kind == "Template") | {name: .metadata.name, version: .metadata.labels["openportal.dev/version"]}'
```

### 3. Test Template Rendering

```bash
# Get template with version label
curl -s http://localhost:7007/api/catalog/entities/by-name/template/default/template-dns-record-v2 \
  -H "Authorization: Bearer $BACKSTAGE_TOKEN" \
  | jq '{
    name: .metadata.name,
    title: .metadata.title,
    version: .metadata.labels["openportal.dev/version"],
    type: .spec.type
  }'
```

## Security Considerations

### Current Implementation

1. **Read-Only Guest Access:** Guests can view but not modify
2. **Token Expiration:** Guest tokens expire after 1 hour
3. **CORS Protection:** API is protected against cross-origin requests

### Production Recommendations

1. **Disable Guest Access:** Remove 'guest' from sign-in providers
2. **Implement RBAC:** Use role-based access control for fine-grained permissions
3. **Add Rate Limiting:** Protect APIs from abuse
4. **Enable HTTPS:** Use TLS for all API communications
5. **Audit Logging:** Track all API access and modifications

## Debugging Permission Issues

### Check Current Permissions

```bash
# Test permission for reading catalog
curl -X POST http://localhost:7007/api/permission/authorize \
  -H "Authorization: Bearer $BACKSTAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{
    "permission": {
      "type": "catalog-entity",
      "name": "catalog.entity.read"
    }
  }]'
```

### Common Issues

1. **403 Forbidden:** Token expired or invalid
   - Solution: Refresh the token

2. **401 Unauthorized:** No token provided
   - Solution: Include Authorization header

3. **Permission Denied:** Policy blocks the action
   - Solution: Check permission policy implementation

## Summary

The permission system allows:
- Guest users to browse the catalog and view templates
- Authenticated users to create and modify entities
- API access via Bearer tokens
- Flexible permission policies for different user roles

This configuration balances accessibility for development with security controls that can be tightened for production deployments.
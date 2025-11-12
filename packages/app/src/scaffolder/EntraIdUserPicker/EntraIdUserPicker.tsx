import { useState, useCallback, useEffect } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  FormControl,
  TextField,
  CircularProgress,
  FormHelperText,
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import { useApi, configApiRef, identityApiRef } from '@backstage/core-plugin-api';

/**
 * EntraIdUserPicker - Custom scaffolder field for selecting users from Microsoft Entra ID
 *
 * Features:
 * - Autocomplete with search as you type
 * - Case-insensitive search
 * - Returns exact email address from Entra ID (preserving case)
 * - Domain restriction support
 *
 * UI Options:
 * - domain: Restrict search to specific domain (e.g., 'cloudpunks.de')
 * - validateEmail: Whether to validate email format (default: true)
 * - caseSensitive: Whether to preserve case from Entra ID (default: true)
 */

interface EntraIdUser {
  id: string;
  userPrincipalName: string;
  mail: string | null;
  displayName: string;
}

/**
 * Note: Token management and Microsoft Graph API calls are handled by the backend proxy
 * at /api/entra-id/search. This keeps credentials secure and enables token caching.
 */

export const EntraIdUserPicker = (props: FieldExtensionComponentProps<string>) => {
  const { onChange, rawErrors, required, formData, uiSchema } = props;
  const configApi = useApi(configApiRef);
  const identityApi = useApi(identityApiRef);
  const backendUrl = configApi.getString('backend.baseUrl');

  const [inputValue, setInputValue] = useState(formData || '');
  const [options, setOptions] = useState<EntraIdUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get configuration from uiSchema
  const domain = uiSchema?.['ui:options']?.domain as string | undefined;

  // Search users as user types
  const searchUsers = useCallback(
    async (searchTerm: string) => {
      if (!searchTerm || searchTerm.length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Get user's authentication token
        const { token } = await identityApi.getCredentials();

        // Call backend proxy endpoint with authentication
        const params = new URLSearchParams({ q: searchTerm });
        if (domain) {
          params.append('domain', domain);
        }

        const response = await fetch(`${backendUrl}/api/proxy/entra-id/search?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const users = await response.json() as EntraIdUser[];
        setOptions(users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search users');
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [backendUrl, domain],
  );

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(inputValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, searchUsers]);

  return (
    <FormControl
      margin="normal"
      required={required}
      error={rawErrors?.length > 0 && !formData}
    >
      <Autocomplete<EntraIdUser | string, false, false, true>
        freeSolo
        options={options}
        loading={loading}
        inputValue={inputValue}
        onInputChange={(_event: any, newInputValue: string) => {
          setInputValue(newInputValue);
        }}
        onChange={(_event: any, newValue: EntraIdUser | string | null) => {
          if (typeof newValue === 'string') {
            onChange(newValue);
          } else if (newValue && typeof newValue === 'object') {
            // User selected from dropdown - use exact email from Entra ID
            const email = newValue.mail || newValue.userPrincipalName;
            onChange(email);
            setInputValue(email);
          }
        }}
        getOptionLabel={(option: EntraIdUser | string) => {
          if (typeof option === 'string') {
            return option;
          }
          const email = option.mail || option.userPrincipalName;
          return `${option.displayName} (${email})`;
        }}
        renderInput={(params: any) => (
          <TextField
            {...params}
            label="User Email"
            placeholder={domain ? `username@${domain}` : 'user@example.com'}
            required={required}
            error={rawErrors?.length > 0 && !formData}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {error && (
        <FormHelperText error>{error}</FormHelperText>
      )}
      {rawErrors?.length > 0 && !formData && (
        <FormHelperText error>This field is required</FormHelperText>
      )}
      {domain && (
        <FormHelperText>
          Search for users in domain: {domain}
        </FormHelperText>
      )}
    </FormControl>
  );
};

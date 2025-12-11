import { useState, useCallback, useEffect } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import FormControl from '@material-ui/core/FormControl';
import Autocomplete from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import Chip from '@material-ui/core/Chip';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  option: {
    fontSize: '0.875rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  optionTitle: {
    fontWeight: 500,
    marginBottom: theme.spacing(0.5),
  },
  optionSubtitle: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  statusChip: {
    height: 18,
    fontSize: '0.65rem',
  },
  readyChip: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  },
  notReadyChip: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
}));

interface CrossplaneXR {
  name: string;
  namespace?: string;
  apiVersion: string;
  kind: string;
  cluster: string;
  labels: Record<string, string>;
  status: {
    ready: boolean;
    conditions: Array<{
      type: string;
      status: string;
      reason?: string;
    }>;
  };
}

export const CrossplaneXRPicker = ({
  onChange,
  rawErrors,
  required,
  formData,
  schema,
  uiSchema,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [options, setOptions] = useState<CrossplaneXR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedXR, setSelectedXR] = useState<CrossplaneXR | null>(null);

  // Extract UI options
  const apiVersion = uiSchema?.['ui:options']?.apiVersion as string | undefined;
  const kind = uiSchema?.['ui:options']?.kind as string | undefined;
  const namespace = uiSchema?.['ui:options']?.namespace as string | undefined;
  const cluster = uiSchema?.['ui:options']?.cluster as string | undefined;
  const labelSelector = uiSchema?.['ui:options']?.labelSelector as string | undefined;

  const hasError = rawErrors && rawErrors.length > 0;
  const label = schema.title || 'Crossplane Resource';
  const description = schema.description || 'Select an existing Crossplane resource';

  // Validate required ui:options
  useEffect(() => {
    if (!apiVersion || !kind) {
      setError('CrossplaneXRPicker requires ui:options.apiVersion and ui:options.kind');
      setLoading(false);
    }
  }, [apiVersion, kind]);

  const fetchXRs = useCallback(async () => {
    if (!apiVersion || !kind) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        apiVersion,
        kind,
      });

      if (namespace) {
        params.append('namespace', namespace);
      }
      if (cluster) {
        params.append('cluster', cluster);
      }
      if (labelSelector) {
        params.append('labelSelector', labelSelector);
      }

      // Use Discovery API to get the correct backend URL
      const baseUrl = await discoveryApi.getBaseUrl('crossplane-backend');
      const url = `${baseUrl}/xrs?${params.toString()}`;

      // Use Backstage fetchApi for proper authentication handling
      const response = await fetchApi.fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch XRs: ${response.statusText}`);
      }

      const data = await response.json();
      setOptions(data.items || []);
    } catch (err: any) {
      console.error('Failed to fetch Crossplane XRs:', err);
      setError(err.message || 'Failed to load resources');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, fetchApi, apiVersion, kind, namespace, cluster, labelSelector]);

  // Fetch XRs on mount and when filters change
  useEffect(() => {
    if (apiVersion && kind) {
      fetchXRs();
    }
  }, [apiVersion, kind, fetchXRs]);

  // Set initial value if formData exists
  // Only initialize once to prevent overwriting user selection when options refetch
  useEffect(() => {
    // Only set if we have formData, no current selection, and options available
    if (!formData || selectedXR || options.length === 0) {
      return;
    }

    // Find matching XR by name
    // If multiple matches exist (same name in different clusters/namespaces),
    // prefer the one from the currently selected cluster/namespace if specified
    const matchingXRs = options.filter(xr => xr.name === formData);

    if (matchingXRs.length === 0) {
      return;
    }

    // If only one match, use it
    if (matchingXRs.length === 1) {
      setSelectedXR(matchingXRs[0]);
      return;
    }

    // Multiple matches: prefer cluster/namespace match if filters are set
    const preferredXR = matchingXRs.find(xr => {
      const clusterMatch = !cluster || xr.cluster === cluster;
      const namespaceMatch = !namespace || xr.namespace === namespace;
      return clusterMatch && namespaceMatch;
    });

    setSelectedXR(preferredXR || matchingXRs[0]);
  }, [formData, options, cluster, namespace]);

  return (
    <FormControl
      className={classes.formControl}
      required={required}
      error={hasError || !!error}
      fullWidth
    >
      <Autocomplete
        value={selectedXR}
        onChange={(_, newValue) => {
          setSelectedXR(newValue);
          onChange(newValue?.name || '');
        }}
        options={options}
        getOptionLabel={(option) => {
          const parts = [option.name];
          if (option.namespace) {
            parts.push(`(${option.namespace})`);
          }
          return parts.join(' ');
        }}
        getOptionSelected={(option, value) => option.name === value.name}
        loading={loading}
        loadingText="Loading resources..."
        noOptionsText={
          error
            ? error
            : loading
            ? 'Loading...'
            : 'No resources found'
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Select a resource..."
            helperText={hasError ? rawErrors?.join(', ') : error || description}
            error={hasError || !!error}
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
        renderOption={(option) => (
          <div className={classes.option}>
            <div className={classes.optionTitle}>
              {option.name}
            </div>
            <div className={classes.optionSubtitle}>
              {option.namespace && (
                <span>Namespace: {option.namespace}</span>
              )}
              {option.cluster && (
                <span>Cluster: {option.cluster}</span>
              )}
              <Chip
                label={option.status.ready ? 'Ready' : 'Not Ready'}
                size="small"
                className={`${classes.statusChip} ${
                  option.status.ready ? classes.readyChip : classes.notReadyChip
                }`}
              />
            </div>
          </div>
        )}
      />
    </FormControl>
  );
};

export const crossplaneXRPickerValidation = (
  value: string,
  validation: { addError: (message: string) => void },
): void => {
  // Basic validation - value should be non-empty if required
  if (!value || value.trim() === '') {
    validation.addError('Please select a Crossplane resource');
  }
};

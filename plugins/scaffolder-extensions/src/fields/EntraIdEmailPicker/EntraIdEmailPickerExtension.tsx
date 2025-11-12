import { useState, useCallback, useEffect } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import FormControl from '@material-ui/core/FormControl';
import Autocomplete from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  option: {
    fontSize: '0.875rem',
    '& > span': {
      marginRight: 10,
      fontSize: '0.75rem',
      color: theme.palette.text.secondary,
    },
  },
}));

interface EntraIdUser {
  mail: string;
  displayName: string;
  userPrincipalName: string;
}

export const EntraIdEmailPicker = ({
  onChange,
  rawErrors,
  required,
  formData,
  schema,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const [options, setOptions] = useState<EntraIdUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedUser, setSelectedUser] = useState<EntraIdUser | null>(null);

  const hasError = rawErrors && rawErrors.length > 0;
  const label = schema.title || 'Email Address';
  const description = schema.description || 'Search for a user by email, name, or UPN';

  const searchUsers = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);

      try {
        // Use Discovery API to get the correct backend URL
        const baseUrl = await discoveryApi.getBaseUrl('app');
        const url = `${baseUrl}/entra-id/users/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Search failed: ' + response.statusText);
        }

        const users: EntraIdUser[] = await response.json();
        setOptions(users);
      } catch (error) {
        console.error('Failed to search EntraID users:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [discoveryApi],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(inputValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, searchUsers]);

  useEffect(() => {
    if (formData && !selectedUser) {
      const existingUser = options.find(u => u.mail === formData);
      if (existingUser) {
        setSelectedUser(existingUser);
      } else {
        setSelectedUser({
          mail: formData,
          displayName: formData,
          userPrincipalName: formData,
        });
      }
    }
  }, [formData, selectedUser, options]);

  return (
    <FormControl
      className={classes.formControl}
      required={required}
      error={hasError}
      fullWidth
    >
      <Autocomplete
        value={selectedUser}
        onChange={(_, newValue) => {
          setSelectedUser(newValue);
          onChange(newValue?.mail || '');
          // Update input to show the selected email
          if (newValue) {
            setInputValue(newValue.mail);
          }
        }}
        inputValue={inputValue}
        onInputChange={(_, newInputValue, reason) => {
          if (reason === 'input') {
            setInputValue(newInputValue);
          }
        }}
        options={options}
        getOptionLabel={(option) => {
          return option.displayName
            ? option.displayName + ' <' + option.mail + '>'
            : option.mail;
        }}
        getOptionSelected={(option, value) => option.mail === value.mail}
        loading={loading}
        loadingText="Searching..."
        noOptionsText={inputValue.length < 2 ? "Type to search..." : "No users found"}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Start typing to search..."
            helperText={hasError ? rawErrors?.join(', ') : description}
            error={hasError}
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
            <strong>{option.displayName}</strong>
            <br />
            <span>{option.mail}</span>
          </div>
        )}
      />
    </FormControl>
  );
};

export const entraIdEmailPickerValidation = (
  value: string,
  validation: { addError: (message: string) => void },
): void => {
  if (!value) {
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    validation.addError('Please enter a valid email address');
  }
};

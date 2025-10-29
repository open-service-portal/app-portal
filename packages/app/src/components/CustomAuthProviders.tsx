import React, { useState, useEffect } from 'react';
import { ProviderSettingsItem } from '@backstage/plugin-user-settings';
import { githubAuthApiRef, useApi, configApiRef, discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Grid,
  Typography,
  Button,
  Avatar,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import LockIcon from '@material-ui/icons/Lock';
import Star from '@material-ui/icons/Star';
import CloudIcon from '@material-ui/icons/Cloud';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

const useStyles = makeStyles(theme => ({
  avatar: {
    width: theme.spacing(6),
    height: theme.spacing(6),
  },
  button: {
    border: `1px solid ${theme.palette.divider}`,
    marginLeft: theme.spacing(1),
  },
  successIcon: {
    color: theme.palette.success.main,
    marginRight: theme.spacing(0.5),
  },
}));

/**
 * Custom K8s Cluster Authentication Provider
 * Opens localhost:8000 directly for OIDC authentication
 */
const K8sClusterAuthProvider = () => {
  const classes = useStyles();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      // Get Backstage auth token
      const { token } = await identityApi.getCredentials();

      // Use discovery API to get the backend base URL, then construct the cluster-auth endpoint
      const baseUrl = await discoveryApi.getBaseUrl('cluster-auth');
      const response = await fetch(`${baseUrl}/status`, {
        credentials: 'include',  // Include cookies for authentication
        headers: {
          Authorization: `Bearer ${token}`,  // Include Backstage auth token
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAuthenticated(data.authenticated);
        setExpiresAt(data.expiresAt);
      } else {
        // Not authenticated or error - this is normal on first load
        setAuthenticated(false);
        setExpiresAt(null);
      }
    } catch (err) {
      // Silently handle errors - user might not be logged in yet
      console.debug('Cluster auth status check failed (this is normal if not authenticated):', err);
      setAuthenticated(false);
      setExpiresAt(null);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleSignOut = async () => {
    try {
      setLoading(true);

      // Get Backstage auth token
      const { token } = await identityApi.getCredentials();

      // Use discovery API to get the backend base URL
      const baseUrl = await discoveryApi.getBaseUrl('cluster-auth');
      const response = await fetch(`${baseUrl}/tokens`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        console.log('✅ Signed out successfully');
        setAuthenticated(false);
        setExpiresAt(null);
      } else {
        console.error('Failed to sign out');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticate = () => {
    // Open authentication window to get cluster tokens
    // The daemon will handle OIDC flow and return tokens via postMessage
    const authWindow = window.open(
      'http://localhost:8000?mode=return-tokens',
      'cluster-auth',
      'width=600,height=700,resizable=yes,scrollbars=yes'
    );

    if (!authWindow) {
      alert('Failed to open authentication window. Please allow popups for this site.');
      return;
    }

    setLoading(true);

    // Listen for tokens from the auth daemon
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== 'http://localhost:8000') {
        return;
      }

      if (event.data.type === 'cluster-tokens') {
        window.removeEventListener('message', handleMessage);

        // Send tokens to Backstage backend using discovery API
        try {
          console.log('Sending tokens to backend:', event.data.tokens);

          // Get Backstage auth token
          const { token } = await identityApi.getCredentials();

          // Use discovery API to get the backend base URL for cluster-auth plugin
          const baseUrl = await discoveryApi.getBaseUrl('cluster-auth');
          const response = await fetch(`${baseUrl}/tokens`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,  // Include Backstage auth token
            },
            credentials: 'include',  // Include cookies for authentication
            body: JSON.stringify(event.data.tokens),
          });

          console.log('Backend response status:', response.status);

          if (response.ok) {
            console.log('✅ Tokens stored successfully');
            await checkAuthStatus();
            authWindow.close();
          } else {
            const errorText = await response.text();
            console.error('Failed to store tokens. Status:', response.status, 'Response:', errorText);
            let errorMessage = 'Unknown error';
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error?.message || errorJson.message || errorText;
            } catch {
              errorMessage = errorText || `HTTP ${response.status}`;
            }
            console.error(`❌ Failed to authenticate: ${errorMessage}`);
          }
        } catch (error) {
          console.error('Error sending tokens to backend:', error);
          console.error(`❌ Failed to communicate with backend: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          setLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback: Poll for completion if postMessage doesn't work
    const pollInterval = setInterval(async () => {
      if (authWindow.closed) {
        clearInterval(pollInterval);
        window.removeEventListener('message', handleMessage);
        setLoading(false);
        await checkAuthStatus();
        return;
      }
    }, 2000);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      window.removeEventListener('message', handleMessage);
      setLoading(false);
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
    }, 5 * 60 * 1000);
  };

  return (
    <ListItem dense>
      <ListItemIcon>
        <Star />
      </ListItemIcon>
      <ListItemText
        primary="K8s Cluster"
        secondary={
          <Grid
            container
            spacing={6}
            title="Sign in using Kubernetes cluster credentials"
          >
            <Grid item>
              <Avatar className={classes.avatar}>
                <CloudIcon />
              </Avatar>
            </Grid>
            <Grid item container spacing={2} xs={12} sm>
              <Grid item container direction="column" xs>
                <Grid item xs>
                  <div style={{ fontWeight: 500, marginBottom: 4, color: 'rgba(255, 255, 255, 0.87)' }}>
                    {authenticated ? 'Authenticated' : 'Not Authenticated'}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center' }}>
                    {authenticated && expiresAt ? (
                      <>
                        <CheckCircleIcon className={classes.successIcon} fontSize="small" />
                        Expires {new Date(expiresAt).toLocaleString()}
                      </>
                    ) : (
                      'Sign in using Kubernetes cluster credentials'
                    )}
                  </div>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        }
        secondaryTypographyProps={{
          component: 'div',
          style: { width: '80%' },
        }}
      />
      <ListItemSecondaryAction>
        {authenticated ? (
          <>
            <Button
              variant="outlined"
              className={classes.button}
              onClick={handleAuthenticate}
              disabled={loading}
              startIcon={<CloudIcon />}
            >
              {loading ? 'Authenticating...' : 'Re-authenticate'}
            </Button>
            <Button
              variant="outlined"
              className={classes.button}
              onClick={handleSignOut}
              disabled={loading}
            >
              Sign Out
            </Button>
          </>
        ) : (
          <Button
            variant="outlined"
            className={classes.button}
            onClick={handleAuthenticate}
            disabled={loading}
            startIcon={<CloudIcon />}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        )}
      </ListItemSecondaryAction>
    </ListItem>
  );
};

/**
 * Custom Authentication Provider Settings
 *
 * Extends the default provider list to include custom providers like OIDC.
 * The default Backstage settings page only includes a hardcoded list of providers,
 * so custom providers need to be explicitly added here.
 *
 * This component is used in the user-settings extension to override the default
 * provider settings in the Settings > Authentication Providers page.
 */
export const CustomAuthProviders = () => {
  const configApi = useApi(configApiRef);
  const providersConfig = configApi.getOptionalConfig('auth.providers');
  const configuredProviders = providersConfig?.keys() || [];

  return (
    <>
      {configuredProviders.includes('github') && (
        <ProviderSettingsItem
          title="GitHub"
          description="Provides authentication towards GitHub APIs and identities"
          apiRef={githubAuthApiRef}
          icon={Star}
        />
      )}
      {configuredProviders.includes('oidc') && (
        <K8sClusterAuthProvider />
      )}
    </>
  );
};

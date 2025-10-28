/**
 * Cluster Authentication Button Component
 *
 * Provides a button to trigger cluster authentication via the oidc-authenticator daemon.
 * This is separate from Backstage user authentication and is used specifically for
 * obtaining OIDC tokens for Kubernetes cluster access.
 *
 * Usage:
 *   import { ClusterAuthButton } from './components/ClusterAuthButton';
 *   <ClusterAuthButton />
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloudIcon from '@material-ui/icons/Cloud';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';

const useStyles = makeStyles(theme => ({
  button: {
    margin: theme.spacing(1),
  },
  dialogContent: {
    minWidth: '400px',
  },
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  successIcon: {
    color: theme.palette.success.main,
  },
  errorIcon: {
    color: theme.palette.error.main,
  },
  codeBlock: {
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    marginTop: theme.spacing(2),
  },
}));

interface ClusterAuthStatus {
  authenticated: boolean;
  expiresAt?: number;
}

interface DaemonHealth {
  status: string;
  issuer?: string;
}

export const ClusterAuthButton = () => {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [daemonRunning, setDaemonRunning] = useState<boolean | null>(null);
  const [authStatus, setAuthStatus] = useState<ClusterAuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check daemon health
  const checkDaemonHealth = async (): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (!response.ok) return false;

      const data: DaemonHealth = await response.json();
      return data.status === 'running';
    } catch {
      return false;
    }
  };

  // Check authentication status with backend
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/cluster-auth/status');
      if (response.ok) {
        const data: ClusterAuthStatus = await response.json();
        setAuthStatus(data);
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
  };

  // Check daemon and auth status on mount
  useEffect(() => {
    const check = async () => {
      const running = await checkDaemonHealth();
      setDaemonRunning(running);
      await checkAuthStatus();
    };
    check();
  }, []);

  // Handle authentication flow
  const handleAuthenticate = async () => {
    setLoading(true);
    setError(null);

    // Check if daemon is running
    const running = await checkDaemonHealth();
    if (!running) {
      setDaemonRunning(false);
      setLoading(false);
      return;
    }

    setDaemonRunning(true);

    // Open authentication window
    const authWindow = window.open(
      'http://localhost:8000',
      'cluster-auth',
      'width=600,height=700,resizable=yes,scrollbars=yes'
    );

    if (!authWindow) {
      setError('Failed to open authentication window. Please allow popups for this site.');
      setLoading(false);
      return;
    }

    // Poll for completion
    const pollInterval = setInterval(async () => {
      // Check if window was closed
      if (authWindow.closed) {
        clearInterval(pollInterval);
        setLoading(false);

        // Check if authentication succeeded
        await checkAuthStatus();

        if (authStatus?.authenticated) {
          setOpen(false);
        }
        return;
      }

      // Check auth status
      await checkAuthStatus();

      if (authStatus?.authenticated) {
        clearInterval(pollInterval);
        setLoading(false);
        authWindow.close();
        setOpen(false);
      }
    }, 2000);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setLoading(false);
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      setError('Authentication timeout. Please try again.');
    }, 5 * 60 * 1000);
  };

  const handleOpen = () => {
    setOpen(true);
    setError(null);
  };

  const handleClose = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        startIcon={<CloudIcon />}
        onClick={handleOpen}
        className={classes.button}
      >
        Authenticate with Cluster
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Cluster Authentication</DialogTitle>
        <DialogContent className={classes.dialogContent}>
          {loading ? (
            <Box className={classes.statusBox}>
              <CircularProgress size={24} />
              <Typography>
                Authenticating... Please complete the login in the popup window.
              </Typography>
            </Box>
          ) : daemonRunning === false ? (
            <Alert severity="warning">
              <Typography variant="h6" gutterBottom>
                OIDC Authenticator Not Running
              </Typography>
              <Typography variant="body2" paragraph>
                The OIDC authenticator daemon is not running on your laptop.
                Please start it first:
              </Typography>
              <Box className={classes.codeBlock}>
                cd oidc-authenticator<br />
                node bin/cli.js start --verbose
              </Box>
              <Typography variant="body2" style={{ marginTop: 16 }}>
                The daemon will run on <code>http://localhost:8000</code> and
                handle authentication for your Kubernetes clusters.
              </Typography>
            </Alert>
          ) : authStatus?.authenticated ? (
            <Box className={classes.statusBox}>
              <CheckCircleIcon className={classes.successIcon} fontSize="large" />
              <div>
                <Typography variant="h6">
                  Already Authenticated
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  You have valid cluster credentials.
                </Typography>
              </div>
            </Box>
          ) : (
            <>
              <Typography variant="body1" paragraph>
                Click "Authenticate" to log in with your OIDC provider and obtain
                credentials for accessing Kubernetes clusters.
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                A popup window will open to complete the authentication. Make sure
                popups are enabled for this site.
              </Typography>
            </>
          )}

          {error && (
            <Alert severity="error" style={{ marginTop: 16 }}>
              <Box className={classes.statusBox}>
                <ErrorIcon className={classes.errorIcon} />
                <Typography>{error}</Typography>
              </Box>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="default">
            Cancel
          </Button>
          {!loading && daemonRunning !== false && !authStatus?.authenticated && (
            <Button
              onClick={handleAuthenticate}
              color="primary"
              variant="contained"
              startIcon={<CloudIcon />}
            >
              Authenticate
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

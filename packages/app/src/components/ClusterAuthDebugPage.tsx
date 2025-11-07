import React, { useState, useEffect } from 'react';
import {
  Page,
  Header,
  Content,
  InfoCard,
  CodeSnippet,
} from '@backstage/core-components';
import { useApi, configApiRef, identityApiRef } from '@backstage/core-plugin-api';
import {
  Grid,
  Button,
  TextField,
  Typography,
  Chip,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';

// Helper function to decode JWT token
function decodeJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { error: 'Invalid JWT format' };
    }
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    return { error: 'Failed to decode JWT', details: String(error) };
  }
}

const useStyles = makeStyles(theme => ({
  refreshButton: {
    marginLeft: theme.spacing(2),
  },
  statusChip: {
    marginLeft: theme.spacing(1),
  },
  codeBlock: {
    fontFamily: 'monospace',
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
  },
  section: {
    marginBottom: theme.spacing(3),
  },
}));

interface UserInfo {
  user: string;
  authenticated: boolean;
  tokenInfo?: {
    issuer: string;
    expiresAt: string;
    isExpired: boolean;
    hoursUntilExpiry: number;
    hasRefreshToken: boolean;
  };
  tokenPreviews?: {
    accessToken: string;
    idToken: string;
  };
  message?: string;
}

interface ApiRequest {
  timestamp: string;
  user: string;
  method: string;
  url: string;
  tokenPreview: string;
}

interface ClusterTestResult {
  success: boolean;
  username?: string;
  groups?: string[];
  authenticated?: boolean;
  error?: string;
  statusCode?: number;
}

export const ClusterAuthDebugPage = () => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const identityApi = useApi(identityApiRef);

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [apiRequests, setApiRequests] = useState<ApiRequest[]>([]);
  const [clusterTestResult, setClusterTestResult] = useState<ClusterTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to get cluster URL from config, fallback to localhost
  const defaultClusterUrl = React.useMemo(() => {
    try {
      console.log('=== ClusterAuthDebugPage: Loading cluster URL from config ===');

      // Get the clusterLocatorMethods array
      const clusterLocatorMethods = config.getOptionalConfigArray('kubernetes.clusterLocatorMethods');
      console.log('clusterLocatorMethods:', clusterLocatorMethods);

      if (clusterLocatorMethods && clusterLocatorMethods.length > 0) {
        // Get the first locator method
        const firstMethod = clusterLocatorMethods[0];
        console.log('firstMethod:', firstMethod);

        // Get the clusters array from the first method
        const clusters = firstMethod.getOptionalConfigArray('clusters');
        console.log('clusters:', clusters);

        if (clusters && clusters.length > 0) {
          const firstCluster = clusters[0];
          const url = firstCluster.getString('url');
          console.log('Found cluster URL from config:', url);
          return url;
        }
      }
    } catch (e) {
      console.error('Error reading cluster URL from config:', e);
    }
    console.log('Using default cluster URL: https://127.0.0.1:6443');
    return 'https://127.0.0.1:6443';
  }, [config]);

  const [clusterUrl, setClusterUrl] = useState(defaultClusterUrl);
  const [skipTLSVerify, setSkipTLSVerify] = useState(true);

  const backendUrl = config.getString('backend.baseUrl');

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const { token } = await identityApi.getCredentials();

      const response = await fetch(`${backendUrl}/api/cluster-auth/debug/user-info`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUserInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchApiRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const { token } = await identityApi.getCredentials();

      const response = await fetch(`${backendUrl}/api/cluster-auth/debug/api-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setApiRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testClusterAccess = async () => {
    try {
      setLoading(true);
      setError(null);
      setClusterTestResult(null);

      const { token } = await identityApi.getCredentials();

      const response = await fetch(`${backendUrl}/api/cluster-auth/debug/test-cluster`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clusterUrl,
          skipTLSVerify,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setClusterTestResult(data.testResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    fetchApiRequests();
  }, []);

  return (
    <Page themeId="tool">
      <Header title="Cluster Auth Debug" subtitle="Kubernetes User Authentication Debug Information" />
      <Content>
        <Grid container spacing={3}>
          {error && (
            <Grid item xs={12}>
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </Grid>
          )}

          {/* User Info Card */}
          <Grid item xs={12} md={6}>
            <InfoCard
              title="User Token Status"
              action={
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={fetchUserInfo}
                  disabled={loading}
                >
                  Refresh
                </Button>
              }
            >
              {loading && <CircularProgress />}
              {userInfo && (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>User:</strong> {userInfo.user}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Authenticated:</strong>{' '}
                    {userInfo.authenticated ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Yes"
                        color="primary"
                        size="small"
                        className={classes.statusChip}
                      />
                    ) : (
                      <Chip
                        icon={<ErrorIcon />}
                        label="No"
                        color="default"
                        size="small"
                        className={classes.statusChip}
                      />
                    )}
                  </Typography>

                  {userInfo.authenticated && userInfo.tokenInfo && (
                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Token Details:
                      </Typography>
                      <Typography variant="body2">
                        <strong>Issuer:</strong> {userInfo.tokenInfo.issuer}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Expires:</strong> {new Date(userInfo.tokenInfo.expiresAt).toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Hours Until Expiry:</strong> {userInfo.tokenInfo.hoursUntilExpiry}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Is Expired:</strong>{' '}
                        {userInfo.tokenInfo.isExpired ? (
                          <Chip label="Expired" color="secondary" size="small" />
                        ) : (
                          <Chip label="Valid" color="primary" size="small" />
                        )}
                      </Typography>
                    </Box>
                  )}

                  {userInfo.authenticated && userInfo.tokenPreviews && (
                    <Box mt={2}>
                      <Alert severity="warning" style={{ marginBottom: 16 }}>
                        <strong>Security Notice:</strong> Full tokens are shown below for debugging.
                        Do not share these tokens or commit them to version control.
                      </Alert>

                      <Typography variant="subtitle2" gutterBottom>
                        ID Token (✅ USE THIS for Kubernetes API):
                      </Typography>
                      <CodeSnippet
                        language="text"
                        text={userInfo.tokenPreviews.idToken}
                        showCopyCodeButton
                      />
                      <Alert severity="success" style={{ marginTop: 8, marginBottom: 16 }}>
                        <strong>✅ This is the token you need for Kubernetes API authentication</strong>
                        <Typography variant="body2">
                          This is a signed JWT (RS256) that Kubernetes can validate using the OIDC provider's public keys.
                        </Typography>
                      </Alert>

                      <Box mt={2} mb={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Token Claims (What Kubernetes sees):
                        </Typography>
                        <CodeSnippet
                          language="json"
                          text={JSON.stringify(decodeJwt(userInfo.tokenPreviews.idToken), null, 2)}
                          showCopyCodeButton
                        />
                      </Box>

                      <Typography variant="subtitle2" gutterBottom>
                        Access Token (⚠️ DO NOT USE for Kubernetes):
                      </Typography>
                      <CodeSnippet
                        language="text"
                        text={userInfo.tokenPreviews.accessToken}
                        showCopyCodeButton
                      />
                      <Alert severity="warning" style={{ marginTop: 8 }}>
                        <strong>⚠️ This token is encrypted (JWE) and cannot be used for cluster access</strong>
                        <Typography variant="body2">
                          Kubernetes cannot validate encrypted tokens. Use the ID Token above instead.
                        </Typography>
                      </Alert>
                    </Box>
                  )}

                  {!userInfo.authenticated && userInfo.message && (
                    <Alert severity="info" style={{ marginTop: 16 }}>
                      {userInfo.message}
                    </Alert>
                  )}
                </Box>
              )}
            </InfoCard>
          </Grid>

          {/* Test Cluster Access Card */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Test Cluster Access">
              <Box>
                {defaultClusterUrl !== 'https://127.0.0.1:6443' && (
                  <Alert severity="info" style={{ marginBottom: 16 }}>
                    <strong>Using cluster from config: {clusterUrl}</strong>
                    <Typography variant="body2">
                      Configuration loaded from app-config files
                    </Typography>
                  </Alert>
                )}
                <TextField
                  label="Cluster URL"
                  fullWidth
                  value={clusterUrl}
                  onChange={e => setClusterUrl(e.target.value)}
                  margin="normal"
                  helperText="Kubernetes API server URL (auto-loaded from config)"
                />
                <Box mt={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={testClusterAccess}
                    disabled={loading || !userInfo?.authenticated}
                    fullWidth
                  >
                    Test Access
                  </Button>
                </Box>

                {clusterTestResult && (
                  <Box mt={2}>
                    <Alert severity={clusterTestResult.success ? 'success' : 'error'}>
                      <strong>Status:</strong> {clusterTestResult.success ? 'Authenticated' : 'Failed'}
                      {clusterTestResult.error && (
                        <Typography variant="body2">{clusterTestResult.error}</Typography>
                      )}
                    </Alert>

                    {clusterTestResult.success && clusterTestResult.username && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Identity (kubectl auth whoami):
                        </Typography>
                        <Typography variant="body2">
                          <strong>Username:</strong> {clusterTestResult.username}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Authenticated:</strong>{' '}
                          {clusterTestResult.authenticated ? (
                            <Chip label="Yes" color="primary" size="small" />
                          ) : (
                            <Chip label="No" color="default" size="small" />
                          )}
                        </Typography>
                        {clusterTestResult.groups && clusterTestResult.groups.length > 0 && (
                          <Box mt={1}>
                            <Typography variant="body2">
                              <strong>Groups:</strong>
                            </Typography>
                            {clusterTestResult.groups.map((group, idx) => (
                              <Chip key={idx} label={group} size="small" style={{ margin: 4 }} />
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </InfoCard>
          </Grid>

          {/* API Requests Log */}
          <Grid item xs={12}>
            <InfoCard
              title="Recent Kubernetes API Requests"
              subheader="Shows which tokens were used for Kubernetes API calls"
              action={
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={fetchApiRequests}
                  disabled={loading}
                >
                  Refresh
                </Button>
              }
            >
              {apiRequests.length === 0 ? (
                <Alert severity="info">
                  No API requests recorded yet. Navigate to an entity's Kubernetes tab to trigger requests.
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Cluster</TableCell>
                        <TableCell>Token Preview</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apiRequests.map((req, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{new Date(req.timestamp).toLocaleTimeString()}</TableCell>
                          <TableCell>{req.method}</TableCell>
                          <TableCell>{req.url}</TableCell>
                          <TableCell style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>
                            {req.tokenPreview}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </InfoCard>
          </Grid>

          {/* Manual Test Command */}
          {userInfo?.authenticated && userInfo.tokenPreviews && (
            <Grid item xs={12}>
              <InfoCard title="Manual Cluster Test">
                <Typography variant="body2" paragraph>
                  Copy these curl commands to manually test cluster access from your terminal:
                </Typography>
                <CodeSnippet
                  language="bash"
                  text={`# IMPORTANT: Using ID Token (the one that works with Kubernetes)
ID_TOKEN="${userInfo.tokenPreviews.idToken}"

# Test 1: Basic cluster API access (tests authentication)
curl -k '${clusterUrl}/api' \\
  -H "Authorization: Bearer \${ID_TOKEN}"

# Test 2: List namespaces (tests RBAC permissions)
curl -k '${clusterUrl}/api/v1/namespaces' \\
  -H "Authorization: Bearer \${ID_TOKEN}"

# Test 3: Get current user info (see how Kubernetes identifies you)
curl -k '${clusterUrl}/apis/authentication.k8s.io/v1/tokenreviews' \\
  -X POST \\
  -H "Authorization: Bearer \${ID_TOKEN}" \\
  -H 'Content-Type: application/json' \\
  -d '{"kind":"TokenReview","apiVersion":"authentication.k8s.io/v1","spec":{"token":"'"\${ID_TOKEN}"'"}}'`}
                  showCopyCodeButton
                />
                <Alert severity="info" style={{ marginTop: 16 }}>
                  <strong>Testing tips:</strong>
                  <ul>
                    <li><code>-k</code> skips TLS verification (equivalent to skipTLSVerify: true)</li>
                    <li><strong>Test 1:</strong> Should return API versions (confirms token is accepted)</li>
                    <li><strong>Test 2:</strong> Lists namespaces you have access to (shows RBAC scope)</li>
                    <li><strong>Test 3:</strong> Shows your username and groups as seen by Kubernetes</li>
                  </ul>
                </Alert>
              </InfoCard>
            </Grid>
          )}

          {/* Token Information */}
          {userInfo?.authenticated && userInfo.tokenPreviews && (
            <Grid item xs={12}>
              <InfoCard title="Token Explanation">
                <Typography variant="h6" gutterBottom>
                  Why Two Tokens?
                </Typography>
                <Typography variant="body2" paragraph>
                  OIDC providers issue different types of tokens for different purposes:
                </Typography>

                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    <strong>1. ID Token (OpenID Connect)</strong>
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Format:</strong> Signed JWT (JSON Web Token) using RS256<br />
                    <strong>Purpose:</strong> Proves your identity to applications<br />
                    <strong>Kubernetes Use:</strong> ✅ YES - Kubernetes validates the signature using the OIDC provider's public keys<br />
                    <strong>Contains:</strong> Your email, name, groups, and other identity claims
                  </Typography>
                  <Alert severity="success">
                    <strong>This token works with Kubernetes because:</strong>
                    <ul style={{ marginTop: 8, marginBottom: 0 }}>
                      <li>It's signed (not encrypted)</li>
                      <li>Kubernetes can verify the signature</li>
                      <li>Contains username and group claims needed for RBAC</li>
                    </ul>
                  </Alert>
                </Box>

                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    <strong>2. Access Token (OAuth2)</strong>
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Format:</strong> Encrypted JWE (JSON Web Encryption) using A256GCM<br />
                    <strong>Purpose:</strong> Access the OIDC provider's APIs (userinfo endpoint, Rackspace APIs, etc.)<br />
                    <strong>Kubernetes Use:</strong> ❌ NO - Kubernetes cannot decrypt or validate encrypted tokens<br />
                    <strong>Contains:</strong> Encrypted data only the OIDC provider (login.spot.rackspace.com) can read<br />
                    <strong>Actual Use:</strong> Could be used to call Rackspace APIs or get extended user info from the provider
                  </Typography>
                  <Alert severity="warning">
                    <strong>This token does NOT work with Kubernetes because:</strong>
                    <ul style={{ marginTop: 8, marginBottom: 0 }}>
                      <li>It's encrypted (JWE), not signed (JWT)</li>
                      <li>Kubernetes has no way to decrypt it</li>
                      <li>Only the OIDC provider can read its contents</li>
                      <li>It's meant for accessing the provider's APIs, not Kubernetes</li>
                    </ul>
                  </Alert>
                  <Typography variant="body2" style={{ marginTop: 16 }}>
                    <strong>Example usage:</strong> <code>curl https://login.spot.rackspace.com/userinfo -H "Authorization: Bearer ACCESS_TOKEN"</code>
                  </Typography>
                </Box>
              </InfoCard>
            </Grid>
          )}

          {/* Instructions */}
          <Grid item xs={12}>
            <InfoCard title="How to Use">
              <Typography variant="body2" paragraph>
                This page helps you debug the cluster authentication integration:
              </Typography>
              <ol>
                <li>
                  <Typography variant="body2">
                    <strong>Check Token Status:</strong> See if you have valid cluster tokens
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Test Cluster Access:</strong> Verify your token works with the cluster
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Manual Test:</strong> Copy the curl command above to test directly from terminal
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>View API Requests:</strong> See which tokens are being used for Kubernetes API calls
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Compare Token Previews:</strong> The token preview in "User Token Status" should match
                    the token preview in "Recent API Requests" - this confirms the clusterAuth provider is working
                  </Typography>
                </li>
              </ol>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

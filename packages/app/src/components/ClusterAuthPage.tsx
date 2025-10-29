/**
 * Cluster Authentication Page
 *
 * Dedicated page for cluster authentication that appears in the sidebar navigation.
 * This provides a clean UX for users to authenticate with Kubernetes clusters
 * via the oidc-authenticator daemon.
 */

import React from 'react';
import { Header, Page, Content, HeaderLabel } from '@backstage/core-components';
import { ClusterAuthButton } from './ClusterAuthButton';
import { Grid, Card, CardContent, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  card: {
    marginTop: theme.spacing(2),
  },
  section: {
    marginBottom: theme.spacing(3),
  },
}));

export const ClusterAuthPage = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Header title="Cluster Authentication" subtitle="Authenticate with Kubernetes clusters">
        <HeaderLabel label="Authentication" value="OIDC" />
      </Header>
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card className={classes.card}>
              <CardContent>
                <div className={classes.section}>
                  <Typography variant="h5" gutterBottom>
                    Kubernetes Cluster Access
                  </Typography>
                  <Typography variant="body1" paragraph>
                    To access Kubernetes clusters, you need to authenticate with your OIDC provider.
                    This authentication is separate from your Backstage login and provides credentials
                    specifically for kubectl and Kubernetes API access.
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Click the button below to start the authentication process. You'll need to have
                    the oidc-authenticator daemon running on your local machine.
                  </Typography>
                </div>

                <ClusterAuthButton />

                <div className={classes.section} style={{ marginTop: 32 }}>
                  <Typography variant="h6" gutterBottom>
                    Prerequisites
                  </Typography>
                  <Typography variant="body2" component="div">
                    <ul>
                      <li>oidc-authenticator daemon must be running on localhost:8000</li>
                      <li>Popups must be enabled for this site</li>
                      <li>You need valid credentials for your OIDC provider</li>
                    </ul>
                  </Typography>
                </div>

                <div className={classes.section}>
                  <Typography variant="h6" gutterBottom>
                    Starting the Daemon
                  </Typography>
                  <Typography variant="body2" component="pre" style={{
                    backgroundColor: '#f5f5f5',
                    padding: 16,
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    overflow: 'auto',
                  }}>
{`cd oidc-authenticator
node bin/cli.js start --verbose`}
                  </Typography>
                </div>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card className={classes.card}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  How It Works
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Step 1:</strong> Click "Authenticate with Cluster"
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Step 2:</strong> A popup opens to localhost:8000 (the daemon)
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Step 3:</strong> Log in with your OIDC provider
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Step 4:</strong> Tokens are stored in Backstage
                </Typography>
                <Typography variant="body2">
                  <strong>Step 5:</strong> Use kubectl with your authenticated credentials
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

import React from 'react';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { Grid } from '@material-ui/core';

// TODO: Integrate with @backstage/plugin-kubernetes components
// The plugin doesn't export a standalone page component yet
// For now, this is a placeholder page
export const KubernetesPage = () => {
  return (
    <Page themeId="tool">
      <Header title="Kubernetes Resources" subtitle="View Kubernetes resources across your clusters" />
      <Content>
        <ContentHeader title="Cluster Resources">
          <SupportButton>View Kubernetes resources from your connected clusters.</SupportButton>
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <p>
              The Kubernetes backend is configured and running. The API is available at:
            </p>
            <pre>http://localhost:7007/api/kubernetes/clusters</pre>
            <p>
              To see Kubernetes resources for specific entities, add the following annotations to your catalog entities:
            </p>
            <pre>
              {`metadata:
  annotations:
    backstage.io/kubernetes-id: my-service
    backstage.io/kubernetes-namespace: default`}
            </pre>
            <p>
              The TeraSky Kubernetes Ingestor is actively discovering XRDs and generating templates automatically.
            </p>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
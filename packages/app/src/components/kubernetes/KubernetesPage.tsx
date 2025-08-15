import React from 'react';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { Grid } from '@material-ui/core';

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
              Kubernetes integration is configured but no entities with Kubernetes annotations are currently in the catalog.
            </p>
            <p>
              To see Kubernetes resources here, add the following annotations to your catalog entities:
            </p>
            <pre>
              {`metadata:
  annotations:
    backstage.io/kubernetes-id: my-service
    backstage.io/kubernetes-namespace: default`}
            </pre>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
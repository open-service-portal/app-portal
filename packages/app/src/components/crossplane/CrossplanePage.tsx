import React from 'react';
import { 
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  Link
} from '@backstage/core-components';
import { Grid } from '@material-ui/core';

export const CrossplanePage = () => (
  <Page themeId="tool">
    <Header title="Crossplane Resources" subtitle="Infrastructure as Code with Kubernetes">
      <SupportButton>Learn about Crossplane integration</SupportButton>
    </Header>
    <Content>
      <ContentHeader title="TeraSky Crossplane Integration Status">
        ✅ Active - Automatically discovering XRDs and generating templates
      </ContentHeader>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <InfoCard title="🎯 What's Working">
            <p><strong>Automatic Template Generation:</strong></p>
            <ul>
              <li>✅ XRDs with label <code>terasky.backstage.io/generate-form=true</code> are discovered</li>
              <li>✅ Templates are auto-generated from XRD schemas</li>
              <li>✅ Templates appear in <Link to="/create">Create Component</Link> page</li>
              <li>✅ Each API version gets its own template (e.g., -v1alpha1)</li>
            </ul>
            <p><strong>Current XRD Templates Generated:</strong></p>
            <ul>
              <li>xclusters.platform.example.com-v1alpha1</li>
              <li>xmongodbs.platform.example.com-v1alpha1</li>
              <li>xfirewallrules.platform.example.com-v1alpha1</li>
            </ul>
          </InfoCard>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <InfoCard title="📊 Resource Visibility">
            <p><strong>Where to Find Crossplane Resources:</strong></p>
            <ul>
              <li><Link to="/create?filters%5Bkind%5D=template">Templates</Link> - Auto-generated from XRDs</li>
              <li><Link to="/catalog?filters%5Bkind%5D=component">Components</Link> - When Claims are created</li>
              <li>Entity Pages - Crossplane tabs for annotated entities</li>
            </ul>
            <p><strong>Required Entity Annotations:</strong></p>
            <pre style={{ fontSize: '0.85em' }}>
{`metadata:
  annotations:
    # For Crossplane v1 Claims
    crossplane.terasky.io/claim-namespace: default
    crossplane.terasky.io/claim-name: my-database
    
    # For Crossplane v2 XRs
    crossplane.terasky.io/xr-name: my-cluster-xyz
    crossplane.terasky.io/xr-apiversion: v1alpha1
    crossplane.terasky.io/xr-kind: XCluster`}
            </pre>
          </InfoCard>
        </Grid>
        
        <Grid item xs={12}>
          <InfoCard title="🔧 Configuration Details">
            <p>The TeraSky Kubernetes Ingestor is configured with:</p>
            <ul>
              <li><strong>Scan Frequency:</strong> Every 10 seconds for Kubernetes resources</li>
              <li><strong>XRD Template Generation:</strong> Every 600 seconds (10 minutes)</li>
              <li><strong>Crossplane Version:</strong> v2.0 (without Claims in XRDs)</li>
              <li><strong>Cluster:</strong> rancher-desktop (local development)</li>
            </ul>
            <p>
              <strong>Note:</strong> The <code>numOfCustomResources=0</code> in logs refers to Kubernetes workloads, 
              not XRDs. XRD discovery and template generation is working correctly.
            </p>
          </InfoCard>
        </Grid>
      </Grid>
    </Content>
  </Page>
);
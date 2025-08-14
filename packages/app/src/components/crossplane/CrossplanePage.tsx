import React from 'react';
import { 
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard
} from '@backstage/core-components';

export const CrossplanePage = () => (
  <Page themeId="tool">
    <Header title="Crossplane Resources" subtitle="Manage your Crossplane XRDs and Claims">
      <SupportButton>Manage your Crossplane resources</SupportButton>
    </Header>
    <Content>
      <ContentHeader title="Crossplane Integration">
        Kubernetes Ingestor for Crossplane Resources
      </ContentHeader>
      <InfoCard title="About Crossplane Integration">
        <p>
          The TeraSky Kubernetes Ingestor plugin automatically discovers and imports Crossplane resources:
        </p>
        <ul>
          <li>Automatically ingests all Crossplane Claims as components</li>
          <li>Generates Backstage templates from XRDs</li>
          <li>Creates API entities for all XRDs</li>
          <li>Defines relationships between claims and APIs</li>
        </ul>
        <p>
          <strong>Configuration:</strong> The plugin is configured to scan clusters every 10 seconds 
          and will automatically create templates for XRDs with the label 
          <code>terasky.backstage.io/generate-form=true</code>
        </p>
      </InfoCard>
      
      <ContentHeader title="How to View Crossplane Resources">
        Navigate to specific components to see their Crossplane details
      </ContentHeader>
      <InfoCard title="Viewing Resources">
        <p>
          Crossplane resources are visible in the following locations:
        </p>
        <ul>
          <li><strong>Software Catalog:</strong> All Crossplane Claims appear as components</li>
          <li><strong>Entity Pages:</strong> Navigate to a specific component to see its Crossplane resources</li>
          <li><strong>Templates:</strong> Generated templates appear in the "Create..." section</li>
          <li><strong>API Docs:</strong> XRDs are documented as API entities</li>
        </ul>
        <p>
          The Crossplane resource tables and graphs are displayed within the context of individual 
          entities in the catalog, not as a standalone page.
        </p>
      </InfoCard>
    </Content>
  </Page>
);
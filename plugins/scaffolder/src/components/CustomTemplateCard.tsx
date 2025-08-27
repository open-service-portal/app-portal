import React from 'react';
import { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';
import { TemplateCard } from '@backstage/plugin-scaffolder-react/alpha';

interface CustomTemplateCardProps {
  template: TemplateEntityV1beta3;
}

/**
 * Custom Template Card component that displays version labels
 */
export const CustomTemplateCard = ({ template }: CustomTemplateCardProps) => {
  // Extract version from labels
  const version = template.metadata.labels?.['openportal.dev/version'];
  
  // Create a modified template with version in the title
  const modifiedTemplate: TemplateEntityV1beta3 = {
    ...template,
    metadata: {
      ...template.metadata,
      title: version 
        ? `${template.metadata.title || template.metadata.name} v${version.replace(/^v/, '')}`
        : template.metadata.title || template.metadata.name,
    },
  };
  
  // For Crossplane XRD templates, add the XRD name as the first tag
  if (template.spec?.type === 'crossplane-xrd') {
    const templateName = template.metadata.name;
    const xrdName = templateName.replace(/-v\d+(\w+\d*)?$/, '');
    const xrdDisplayName = template.metadata.annotations?.['openportal.dev/xrd-name'] 
      || template.metadata.labels?.['openportal.dev/xrd-name']
      || xrdName;
    
    const existingTags = template.metadata.tags || [];
    modifiedTemplate.metadata.tags = [
      `XRD: ${xrdDisplayName}`,
      ...existingTags.filter(tag => !tag.startsWith('XRD:'))
    ];
  }
  
  // Keep single log for monitoring version modifications
  if (version) {
    console.log(`[CustomTemplateCard] ${template.metadata.name}: v${version.replace(/^v/, '')}`);
  }
  
  // Use the standard TemplateCard with our modified template
  return <TemplateCard template={modifiedTemplate} />;
};
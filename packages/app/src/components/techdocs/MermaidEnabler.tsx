import { useMermaidEffect } from './useMermaidEffect';

/**
 * Component that enables mermaid rendering globally
 */
export const MermaidEnabler = () => {
  useMermaidEffect();
  
  // This component doesn't render anything
  return null;
};
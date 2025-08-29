/**
 * @packageDocumentation
 * 
 * Catalog Backend Module for automatic source tagging of entities.
 * 
 * This module provides a processor that automatically adds metadata tags
 * to catalog entities based on their import source (GitHub, Kubernetes, etc.)
 */

export { catalogModuleSourceTagger as default } from './module';

// Export the processor for testing or direct use
export { SourceTagProcessor } from './processor/SourceTagProcessor';
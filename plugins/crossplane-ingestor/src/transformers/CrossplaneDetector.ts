/**
 * Detects Crossplane version and configuration from XRD
 */

import { XRD, CrossplaneVersion } from '../types';

export class CrossplaneDetector {
  /**
   * Detects the Crossplane version and scope configuration from an XRD
   */
  detect(xrd: XRD): CrossplaneVersion {
    const isV2 = this.isV2(xrd);
    const scope = this.getScope(xrd, isV2);
    const isLegacyCluster = isV2 && scope === 'LegacyCluster';
    const usesClaims = this.determineIfUsesClaims(isV2, isLegacyCluster);

    return {
      version: isV2 ? 'v2' : 'v1',
      scope,
      usesClaims
    };
  }

  /**
   * Determines if this is a Crossplane v2 XRD
   */
  private isV2(xrd: XRD): boolean {
    // V2 XRDs have apiVersion v2 or have an explicit scope field
    return xrd.apiVersion === 'apiextensions.crossplane.io/v2' || 
           !!xrd.spec?.scope;
  }

  /**
   * Gets the scope of the XRD
   */
  private getScope(xrd: XRD, isV2: boolean): 'Cluster' | 'Namespaced' | 'LegacyCluster' {
    if (xrd.spec?.scope) {
      return xrd.spec.scope as 'Cluster' | 'Namespaced';
    }
    
    // Default scope based on version
    if (isV2) {
      // V2 defaults to Namespaced if not specified
      return 'Namespaced';
    }
    
    // V1 is always Cluster scoped (but we call it LegacyCluster for v2 compatibility mode)
    return 'Cluster';
  }

  /**
   * Determines if the XRD uses claims or direct XRs
   */
  private determineIfUsesClaims(isV2: boolean, isLegacyCluster: boolean): boolean {
    // V1 always uses claims
    if (!isV2) {
      return true;
    }
    
    // V2 LegacyCluster mode uses claims for backward compatibility
    if (isLegacyCluster) {
      return true;
    }
    
    // V2 Cluster and Namespaced use direct XRs
    return false;
  }

  /**
   * Gets the resource kind that users will create
   */
  getResourceKind(xrd: XRD): string {
    const version = this.detect(xrd);
    
    if (version.usesClaims && xrd.spec.claimNames?.kind) {
      return xrd.spec.claimNames.kind;
    }
    
    return xrd.spec.names.kind;
  }

  /**
   * Gets the resource plural name
   */
  getResourcePlural(xrd: XRD): string {
    const version = this.detect(xrd);
    
    if (version.usesClaims && xrd.spec.claimNames?.plural) {
      return xrd.spec.claimNames.plural;
    }
    
    return xrd.spec.names.plural;
  }

  /**
   * Determines if namespace parameter is needed
   */
  needsNamespaceParameter(xrd: XRD): boolean {
    const version = this.detect(xrd);
    
    // Claims always need namespace
    if (version.usesClaims) {
      return true;
    }
    
    // Namespaced XRs need namespace
    if (version.scope === 'Namespaced') {
      return true;
    }
    
    // Cluster-scoped XRs don't need namespace
    return false;
  }
}
/**
 * Configuration options for the Crossplane backend plugin
 */
export interface Config {
  /**
   * Crossplane plugin configuration
   */
  crossplane?: {
    /**
     * Allow unauthenticated access to Crossplane API endpoints
     *
     * @default false
     * @remarks
     * When false (default), requires user authentication via cookie/token.
     * When true, allows unauthenticated access (only for development).
     *
     * SECURITY WARNING: Only enable in development environments.
     * Production deployments should always require authentication.
     */
    allowUnauthenticated?: boolean;
  };

  /**
   * Kubernetes configuration (shared with kubernetes plugin)
   */
  kubernetes?: {
    /**
     * Service locator method
     */
    serviceLocatorMethod?: {
      type: string;
    };
    /**
     * Cluster locator methods
     */
    clusterLocatorMethods?: Array<{
      /**
       * Type of cluster locator
       */
      type: 'config' | 'localKubectlProxy';
      /**
       * Cluster configurations (for type: config)
       */
      clusters?: Array<{
        /**
         * Cluster name
         */
        name: string;
        /**
         * Kubernetes API URL
         */
        url: string;
        /**
         * Authentication provider
         */
        authProvider: 'serviceAccount' | 'google' | 'aws' | 'azure';
        /**
         * Service account token (for authProvider: serviceAccount)
         */
        serviceAccountToken?: string;
        /**
         * Skip TLS verification (not recommended for production)
         */
        skipTLSVerify?: boolean;
      }>;
    }>;
  };
}

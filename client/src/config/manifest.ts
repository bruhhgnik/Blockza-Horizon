

import mainnet from "../config/manifest_mainnet.json"; // change for the right mainnet manifest


// Define valid deploy types
type DeployType = keyof typeof manifests;

// Create the manifests object
const manifests = {

  mainnet

};

// Get deployment type from environment with fallback
const deployType = import.meta.env.VITE_PUBLIC_DEPLOY_TYPE as string;

// Export the appropriate manifest with a fallback
export const manifest = deployType in manifests
  ? manifests[deployType as DeployType]
  : manifests.mainnet;
export type Manifest = typeof manifest;
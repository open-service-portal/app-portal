#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default values
OUTPUT_DIR=".local/deploy/kubernetes"
DRY_RUN=false
CONFIG_FILE=""

# Help message
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy App Portal (Backstage) to Kubernetes

OPTIONS:
    -d, --dry-run           Only generate manifests, don't apply to cluster
    -o, --output DIR        Output directory for generated manifests (default: .local/deploy/kubernetes)
    -n, --hostname HOST     Application hostname (e.g., app.example.com)
    -i, --image IMAGE       Docker image to deploy (e.g., ghcr.io/org/app:v1.0.0)
    -c, --config FILE       Config file with deployment settings (default: .env.kubernetes if exists)
    -h, --help              Show this help message

REQUIRED ENVIRONMENT VARIABLES (from .envrc):
    AUTH_GITHUB_APP_ID              GitHub App ID
    AUTH_GITHUB_CLIENT_ID           GitHub App Client ID
    AUTH_GITHUB_CLIENT_SECRET       GitHub App Client Secret
    AUTH_GITHUB_APP_INSTALLATION_ID GitHub App Installation ID
    AUTH_GITHUB_APP_PRIVATE_KEY     GitHub App private key (PEM format)

REQUIRED DEPLOYMENT SETTINGS (via --hostname/--image or config file):
    APP_HOSTNAME                    Application hostname
    DOCKER_IMAGE                    Docker image to deploy

OPTIONAL ENVIRONMENT VARIABLES:
    APP_BASE_URL                    Frontend URL (default: https://\${APP_HOSTNAME})
    BACKEND_BASE_URL                Backend URL (default: https://\${APP_HOSTNAME})

EXAMPLE:
    # Deploy with command-line options
    $0 --hostname app.example.com --image ghcr.io/org/app:v1.0.0

    # Deploy using config file
    cp examples/kubernetes/.env.kubernetes.example .env.kubernetes
    vim .env.kubernetes  # update with your values
    $0

    # Dry run - only generate manifests
    $0 --hostname app.example.com --image ghcr.io/org/app:v1.0.0 --dry-run

    # Override config file values with command-line
    $0 --config .env.production --hostname staging.example.com
EOF
}

# Parse command line arguments
CLI_HOSTNAME=""
CLI_IMAGE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -n|--hostname)
            CLI_HOSTNAME="$2"
            shift 2
            ;;
        -i|--image)
            CLI_IMAGE="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Load config file if specified or if default exists
if [[ -z "$CONFIG_FILE" && -f ".env.kubernetes" ]]; then
    CONFIG_FILE=".env.kubernetes"
fi

if [[ -n "$CONFIG_FILE" ]]; then
    if [[ -f "$CONFIG_FILE" ]]; then
        info "Loading config from: $CONFIG_FILE"
        source "$CONFIG_FILE"
    else
        error "Config file not found: $CONFIG_FILE"
        exit 1
    fi
fi

# Command-line arguments take precedence over config file
if [[ -n "$CLI_HOSTNAME" ]]; then
    export APP_HOSTNAME="$CLI_HOSTNAME"
fi
if [[ -n "$CLI_IMAGE" ]]; then
    export DOCKER_IMAGE="$CLI_IMAGE"
fi

# Set default values for optional variables
export APP_BASE_URL="${APP_BASE_URL:-https://${APP_HOSTNAME}}"
export BACKEND_BASE_URL="${BACKEND_BASE_URL:-https://${APP_HOSTNAME}}"

# Validate GitHub auth variables (should come from .envrc)
github_vars=(
    "AUTH_GITHUB_APP_ID"
    "AUTH_GITHUB_CLIENT_ID"
    "AUTH_GITHUB_CLIENT_SECRET"
    "AUTH_GITHUB_APP_INSTALLATION_ID"
    "AUTH_GITHUB_APP_PRIVATE_KEY"
)

missing_github_vars=()
for var in "${github_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_github_vars+=("$var")
    fi
done

if [[ ${#missing_github_vars[@]} -gt 0 ]]; then
    error "Missing GitHub App environment variables (should be set by .envrc):"
    for var in "${missing_github_vars[@]}"; do
        echo "  - $var"
    done
    echo
    echo "Make sure you're in the app-portal directory with direnv enabled"
    exit 1
fi

# Validate deployment settings
deployment_vars=(
    "APP_HOSTNAME"
    "DOCKER_IMAGE"
)

missing_deployment_vars=()
for var in "${deployment_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_deployment_vars+=("$var")
    fi
done

if [[ ${#missing_deployment_vars[@]} -gt 0 ]]; then
    error "Missing deployment settings:"
    for var in "${missing_deployment_vars[@]}"; do
        echo "  - $var"
    done
    echo
    echo "Provide these via command-line options or config file:"
    echo "  $0 --hostname app.example.com --image ghcr.io/org/app:v1.0.0"
    echo "  or"
    echo "  cp examples/kubernetes/.env.kubernetes.example .env.kubernetes"
    echo "  vim .env.kubernetes  # update with your values"
    echo "  $0"
    exit 1
fi

# Create output directory
info "Creating output directory: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Process templates
info "Processing Kubernetes manifests..."
for template in examples/kubernetes/base/*.yaml; do
    if [[ ! -f "$template" ]]; then
        error "Template files not found in examples/kubernetes/base/"
        exit 1
    fi
    
    filename=$(basename "$template")
    output="$OUTPUT_DIR/$filename"
    
    # Use envsubst to replace variables
    envsubst < "$template" > "$output"
    
    info "  Generated: $output"
done

# Show summary
echo
info "Manifest generation complete!"
echo "  Hostname: $APP_HOSTNAME"
echo "  Docker Image: $DOCKER_IMAGE"
echo "  Output Directory: $OUTPUT_DIR"

# Apply to cluster unless dry-run
if [[ "$DRY_RUN" == true ]]; then
    echo
    info "Dry run mode - manifests generated but not applied"
    echo "To apply to cluster, run without --dry-run:"
    echo "  $0"
else
    echo
    info "Applying manifests to Kubernetes cluster..."
    
    # Check kubectl access
    if ! kubectl cluster-info &>/dev/null; then
        error "Cannot connect to Kubernetes cluster. Check your kubectl configuration."
        exit 1
    fi
    
    # Apply using kubectl
    kubectl apply -f "$OUTPUT_DIR/"
    
    echo
    info "Deployment complete! Check status with:"
    echo "  kubectl get pods -n app-portal"
    echo "  kubectl logs -n app-portal -l app.kubernetes.io/name=app-portal"
fi
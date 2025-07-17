ROOTDIR=$(cd "$(dirname "$0")" && pwd)
pushd $ROOTDIR > /dev/null

# Check if script is running as sudo
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as sudo."
    echo "Please run: sudo $0"
    exit 1
fi

prerequisites() {
    echo "Checking and installing prerequisites for the fabric network simulation environment"
    
    # Check if fabric-samples folder is empty
    if [ ! -d "fabric-samples" ] || [ -z "$(ls -A fabric-samples 2>/dev/null)" ]; then
        echo "fabric-samples is not initialized. Trying to initialize it now..."
        git submodule update --init --recursive

        if [ $? -ne 0 ]; then
            echo "Failed to initialize fabric-samples. Please try again."
            rf -rfv ./fabric-samples 2>/dev/null
            exit 1
        fi
    fi

    if [ ! -d "fabric-samples/bin" ] || [ -z "$(ls -A "fabric-samples/bin" 2>/dev/null)" ]; then
        . ./scripts/install-fabric.sh binary docker
        if [ $? -ne 0 ]; then
            echo "Failed to install Fabric binaries. Please try again."
            exit 1
        fi
    fi

    source ./fabric-samples/test-network/scripts/utils.sh

    if [ ! -f "./fabric-samples/PATCH_APPLIED" ]; then
        infoln "Applying modifications to the fabric testnetwork"
        pushd ./fabric-samples > /dev/null
        patch -p1 < ../fabric-samples.diff
        infoln "Modifications applied successfully"
        popd > /dev/null
    fi

    infoln "All prerequisites are satisfied for the fabric network simulation environment"
    echo ""
}

setCredentials() {
    if [ -d "./credentials" ]; then
        rm -rf ./credentials 2>/dev/null
    fi

    mkdir -p ./credentials/{vesselowner,processor,wholesaler,government,orderer}/{tls,msp,users}

    FABRIC_PEERS_PATH="./fabric-samples/test-network/organizations/peerOrganizations"
    FABRIC_ORDERER_PATH="./fabric-samples/test-network/organizations/ordererOrganizations"

    infoln "Copying vesselowner credentials"
    PEER_CREDENTIAL_SOURCE="${FABRIC_PEERS_PATH}/vesselowner.example.com/peers/peer0.vesselowner.example.com"
    cp -r "${PEER_CREDENTIAL_SOURCE}/tls" ./credentials/vesselowner/tls
    cp -r "${PEER_CREDENTIAL_SOURCE}/msp" ./credentials/vesselowner/msp
    PEER_CREDENTIAL_SOURCE="$(cd "${PEER_CREDENTIAL_SOURCE}/../.." && pwd)"
    cp -r "${PEER_CREDENTIAL_SOURCE}/users" ./credentials/vesselowner/

    infoln "Copying processor credentials"
    PEER_CREDENTIAL_SOURCE="${FABRIC_PEERS_PATH}/processor.example.com/peers/peer0.processor.example.com"
    cp -r "${PEER_CREDENTIAL_SOURCE}/tls" ./credentials/processor/tls
    cp -r "${PEER_CREDENTIAL_SOURCE}/msp" ./credentials/processor/msp
    PEER_CREDENTIAL_SOURCE="$(cd "${PEER_CREDENTIAL_SOURCE}/../.." && pwd)"
    cp -r "${PEER_CREDENTIAL_SOURCE}/users" ./credentials/processor/

    infoln "Copying wholesaler credentials"
    PEER_CREDENTIAL_SOURCE="${FABRIC_PEERS_PATH}/wholesaler.example.com/peers/peer0.wholesaler.example.com"
    cp -r "${PEER_CREDENTIAL_SOURCE}/tls" ./credentials/wholesaler/tls
    cp -r "${PEER_CREDENTIAL_SOURCE}/msp" ./credentials/wholesaler/msp
    PEER_CREDENTIAL_SOURCE="$(cd "${PEER_CREDENTIAL_SOURCE}/../.." && pwd)"
    cp -r "${PEER_CREDENTIAL_SOURCE}/users" ./credentials/wholesaler/

    infoln "Copying government credentials"
    PEER_CREDENTIAL_SOURCE="${FABRIC_PEERS_PATH}/government.example.com/peers/peer0.government.example.com"
    cp -r "${PEER_CREDENTIAL_SOURCE}/tls" ./credentials/government/tls
    cp -r "${PEER_CREDENTIAL_SOURCE}/msp" ./credentials/government/msp
    PEER_CREDENTIAL_SOURCE="$(cd "${PEER_CREDENTIAL_SOURCE}/../.." && pwd)"
    cp -r "${PEER_CREDENTIAL_SOURCE}/users" ./credentials/government/
}

environmentUp() {
    infoln "Starting the fabric network simulation environment"    

    pushd ./fabric-samples/test-network > /dev/null

    ./network.sh up createChannel -c mychannel -ca
    ./network.sh deployCC -ccn basic -ccp $(cd ../../chaincode && pwd) -ccl typescript

    chmod +x+r -R ./organizations

    infoln "Setting up credentials"
    setCredentials

    popd > /dev/null
}

environmentDown() {
    infoln "Stopping the fabric network simulation environment"

    pushd ./fabric-samples/test-network > /dev/null

    ./network.sh down

    popd > /dev/null

    infoln "Cleaning up credentials"
    rm -rf ./credentials 2>/dev/null
}

# Check if at least one parameter is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <up|down>"
    echo "  up   - Start the fabric network simulation environment"
    echo "  down - Stop the fabric network simulation environment"
    exit 1
fi

prerequisites

MODE=$1

if [ "$MODE" == "up" ]; then
    environmentUp
elif [ "$MODE" == "down" ]; then
    environmentDown
else
    echo "Usage: $0 <up|down>"
fi

popd > /dev/null
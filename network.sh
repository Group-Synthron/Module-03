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

    if [ ! -d "fabric-samples/bin" ] || [ -z "$(ls -A "fabric-samples/bin" 2>/dev/null)"]; then
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

environmentUp() {
    infoln "Starting the fabric network simulation environment"    

    pushd ./fabric-samples/test-network > /dev/null

    ./network.sh up createChannel -c mychannel -ca
    ./network.sh deployCC -ccn basic -ccp ../../chaincode -ccl typescript
    ./network.sh deployCC -ccn basic -ccp $CHAINCODE -ccl $CCLANG

    popd > /dev/null
}

environmentDown() {
    infoln "Stopping the fabric network simulation environment"

    pushd ./fabric-samples/test-network > /dev/null

    ./network.sh down

    popd > /dev/null
}

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
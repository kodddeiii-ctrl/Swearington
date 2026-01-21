#!/bin/bash

# Check if an argument was provided
if [ $# -eq 0 ]; then
    echo "Usage: ./toolage.sh <command>"
    echo "Available commands: build, publish, run"
    exit 1
fi

# Handle commands
case "$1" in
    build)
        echo "Building..."
        docker build -t swearington .
        ;;
    publish)
        echo "Publishing..."
        docker build -t swearington .
        docker tag swearington justingarey/swearington:latest
        docker push justingarey/swearington:latest
        ;;
    run)
        echo "Running..."
        docker compose up -d
        ;;
    dev)
        echo "Running in development mode..."
        docker compose -f dev-compose.yaml up -d --build
        ;;
    stop)
        echo "Stopping..."
        docker compose down
        ;;
    *)
        echo "Unknown command: $1"
        echo "Available commands: build, publish, run, dev, stop"
        exit 1
        ;;
esac
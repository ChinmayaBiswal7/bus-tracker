#!/usr/bin/env bash
# Exit on error
set -o errexit

# Upgrade pip and build tools to avoid metadata generation errors
pip install -U pip setuptools wheel

# Install dependencies
pip install -r requirements.txt

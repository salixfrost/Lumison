#!/bin/bash
# YouTube Music setup helper script

echo "Installing ytmusicapi..."
pip install ytmusicapi

echo ""
echo "To set up authentication, run:"
echo "  ytmusicapi oauth"
echo ""
echo "This will open a browser for YouTube Music authentication."
echo "After authentication, rename the generated 'oauth.json' to 'scripts/ytmusic/oauth.json'"
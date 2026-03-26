#!/usr/bin/env python3
"""
YouTube Music API Wrapper
Based on ytmusicapi: https://github.com/sigma67/ytmusicapi

Usage:
    python ytmusic_wrapper.py search "Oasis Wonderwall"
    python ytmusic_wrapper.py playlist create "My Playlist" "description"
    python ytmusic_wrapper.py playlist add "playlist_id" "video_id"
"""

import json
import sys
import os
from pathlib import Path

try:
    from ytmusicapi import YTMusic
except ImportError:
    print("Error: ytmusicapi not installed. Run: pip install ytmusicapi")
    sys.exit(1)

OAUTH_FILE = 'oauth.json'
CREDS_FILE = 'credentials.json'

def get_ytmusic():
    """Initialize YTMusic with available authentication."""
    if os.path.exists(OAUTH_FILE):
        return YTMusic(OAUTH_FILE)
    elif os.path.exists(CREDS_FILE):
        with open(CREDS_FILE, 'r') as f:
            creds = json.load(f)
        return YTMusic(creds.get('headers'), creds.get('body'))
    else:
        # Initialize with emptycreds to get browser authentication setup instructions
        yt = YTMusic('browser.json')
        print("No authentication file found. To set up:")
        print("1. Run: ytmusicapi oauth")
        print("2. Follow the instructions to authenticate")
        print("3. Rename the generated oauth.json to this directory")
        sys.exit(1)

def search(query: str, limit: int = 10):
    """Search for tracks."""
    yt = get_ytmusic()
    results = yt.search(query, filter='songs', limit=limit)
    
    tracks = []
    for item in results:
        if item.get('resultType') == 'song':
            tracks.append({
                'videoId': item.get('videoId'),
                'title': item.get('title'),
                'artists': [a.get('name') for a in item.get('artists', [])],
                'album': item.get('album', {}).get('name') if item.get('album') else None,
                'duration': item.get('duration'),
                'thumbnails': item.get('thumbnails', [])
            })
    
    return tracks

def create_playlist(title: str, description: str = ""):
    """Create a new playlist."""
    yt = get_ytmusic()
    playlist_id = yt.create_playlist(title, description)
    return playlist_id

def add_to_playlist(playlist_id: str, video_ids: list):
    """Add tracks to a playlist."""
    yt = get_ytmusic()
    result = yt.add_playlist_items(playlist_id, video_ids)
    return result

def get_playlist(playlist_id: str):
    """Get playlist details."""
    yt = get_ytmusic()
    return yt.get_playlist(playlist_id)

def get_track(video_id: str):
    """Get track details."""
    yt = get_ytmusic()
    return yt.get_track(video_id)

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'search':
        if len(sys.argv) < 3:
            print("Usage: search <query> [limit]")
            sys.exit(1)
        query = sys.argv[2]
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        results = search(query, limit)
        print(json.dumps(results, indent=2, ensure_ascii=False))
    
    elif command == 'playlist':
        if len(sys.argv) < 3:
            print("Usage: playlist <create|add|get> ...")
            sys.exit(1)
        
        action = sys.argv[2]
        
        if action == 'create':
            if len(sys.argv) < 4:
                print("Usage: playlist create <title> [description]")
                sys.exit(1)
            title = sys.argv[3]
            description = sys.argv[4] if len(sys.argv) > 4 else ""
            playlist_id = create_playlist(title, description)
            print(json.dumps({'playlistId': playlist_id}))
        
        elif action == 'add':
            if len(sys.argv) < 5:
                print("Usage: playlist add <playlist_id> <video_id> [video_id ...]")
                sys.exit(1)
            playlist_id = sys.argv[3]
            video_ids = sys.argv[4:]
            result = add_to_playlist(playlist_id, video_ids)
            print(json.dumps(result))
        
        elif action == 'get':
            if len(sys.argv) < 4:
                print("Usage: playlist get <playlist_id>")
                sys.exit(1)
            playlist_id = sys.argv[3]
            playlist = get_playlist(playlist_id)
            print(json.dumps(playlist, indent=2, ensure_ascii=False))
    
    elif command == 'track':
        if len(sys.argv) < 3:
            print("Usage: track <video_id>")
            sys.exit(1)
        video_id = sys.argv[2]
        track = get_track(video_id)
        print(json.dumps(track, indent=2, ensure_ascii=False))
    
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)

if __name__ == '__main__':
    main()
#!/bin/bash
# deploy.sh - Build locally, upload to Dreamhost

REMOTE_USER="dh_k6h6ca"
REMOTE_HOST="pdx1-shared-a1-34.dreamhost.com"
REMOTE_DIR="daylightviz.org"
SSH_KEY="$HOME/.ssh/dreamhost_key"

echo "🏗️  Building locally..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - no dist/ directory found"
    exit 1
fi

echo "🧹 Cleaning remote directory..."
ssh -T -i "$SSH_KEY" $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
cd ~/daylightviz.org
rm -rf *
ENDSSH

echo "📤 Uploading built files..."
scp -i "$SSH_KEY" -r dist/* $REMOTE_USER@$REMOTE_HOST:~/$REMOTE_DIR/

echo "✅ Verifying deployment..."
ssh -T -i "$SSH_KEY" $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
cd ~/daylightviz.org
ls -lh
ENDSSH

echo "🎉 Deployment complete!"
echo "🌐 Check: https://daylightviz.org"
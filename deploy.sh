#!/bin/bash
# deploy.sh

REMOTE_USER="dh_k6h6ca"
REMOTE_HOST="pdx1-shared-a1-34.dreamhost.com"
REMOTE_DIR="daylightviz.org"
SSH_KEY="$HOME/.ssh/dreamhost_key"

echo "🚀 Deploying to Dreamhost..."

ssh -i "$SSH_KEY" $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
set -e

cd ~/daylightviz.org

echo "📥 Setting up git repository..."
if [ ! -d .git ]; then
    # Backup existing files
    mkdir -p ../backup_daylightviz
    cp -r * ../backup_daylightviz/ 2>/dev/null || true
    
    # Remove all files (except hidden ones)
    rm -rf *
    
    # Clone fresh
    git clone https://github.com/jblarson/dayAndNight.git .
else
    echo "🔄 Pulling latest changes..."
    git fetch origin
    git reset --hard origin/main
    git clean -fd
fi

echo "📦 Installing dependencies..."
npm install

echo "🏗️  Building..."
npm run build

echo "✅ Deployment complete!"
ENDSSH

echo "🎉 Done! Check https://daylightviz.org"
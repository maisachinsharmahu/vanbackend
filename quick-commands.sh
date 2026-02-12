#!/bin/bash

# Quick Deployment Commands Reference
# Save this file and make it executable: chmod +x quick-commands.sh

echo "=== VanTribe Atlas Backend - Quick Commands ==="
echo ""

# Function to display menu
show_menu() {
    echo "Select an option:"
    echo "1) Check application status"
    echo "2) View live logs"
    echo "3) Restart application"
    echo "4) Deploy latest from stage branch"
    echo "5) Stop application"
    echo "6) Start application"
    echo "7) View error logs only"
    echo "8) Check disk space"
    echo "9) Check memory usage"
    echo "10) Exit"
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Enter choice [1-10]: " choice
    echo ""
    
    case $choice in
        1)
            echo "📊 Application Status:"
            pm2 status
            ;;
        2)
            echo "📋 Live Logs (Ctrl+C to exit):"
            pm2 logs atlas-backend
            ;;
        3)
            echo "🔄 Restarting application..."
            pm2 restart atlas-backend
            echo "✅ Application restarted"
            pm2 status
            ;;
        4)
            echo "🚀 Deploying latest from stage branch..."
            ./deploy.sh
            ;;
        5)
            echo "⏸️  Stopping application..."
            pm2 stop atlas-backend
            echo "✅ Application stopped"
            ;;
        6)
            echo "▶️  Starting application..."
            pm2 start src/server.js --name atlas-backend
            echo "✅ Application started"
            ;;
        7)
            echo "❌ Error Logs (last 50 lines):"
            pm2 logs atlas-backend --err --lines 50 --nostream
            ;;
        8)
            echo "💾 Disk Space:"
            df -h
            ;;
        9)
            echo "🧠 Memory Usage:"
            free -h
            echo ""
            echo "PM2 Memory:"
            pm2 status
            ;;
        10)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please try again."
            ;;
    esac
    
    echo ""
    echo "Press Enter to continue..."
    read
    clear
done

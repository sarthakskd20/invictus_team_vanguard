#!/bin/bash

echo "🔌 PCB Component Parser - Quick Start"
echo "======================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✅ Python found: $(python3 --version)"
echo ""

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip is not installed. Please install pip."
    exit 1
fi

echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Create necessary directories
mkdir -p uploads outputs

echo "🚀 Starting backend server..."
echo "   Backend URL: http://localhost:5000"
echo ""

# Start the Flask server
python3 app.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

echo "🌐 Opening frontend in browser..."
echo "   Frontend URL: http://localhost:8000"
echo ""

# Start a simple HTTP server for the frontend
python3 -m http.server 8000 &
FRONTEND_PID=$!

echo ""
echo "✅ System is running!"
echo ""
echo "📝 Usage:"
echo "   1. Open http://localhost:8000 in your browser"
echo "   2. Upload a PCB schematic file"
echo "   3. Click 'Parse Components'"
echo "   4. View and export the BOM"
echo ""
echo "🛑 To stop the system, press Ctrl+C"
echo ""

# Wait for user to stop
trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

wait

#!/bin/zsh

SESSION="myproject-dev"
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Parse flags
WITH_DOCKER=false
for arg in "$@"; do
    case "$arg" in
        --docker|-d) WITH_DOCKER=true ;;
        --help|-h)
            echo "Usage: ./dev.sh [options]"
            echo ""
            echo "Options:"
            echo "  -d, --docker   Start Docker services (PostgreSQL, Meilisearch, etc.)"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Run ./dev.sh --help for usage"
            exit 1
            ;;
    esac
done

if ! command -v tmux &>/dev/null; then
    echo "tmux is required: brew install tmux"
    exit 1
fi

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null

# Start Docker services only if --docker flag is passed
if $WITH_DOCKER; then
    echo "Starting Docker services..."
    (cd "$ROOT/services" && yarn start)
fi

# Create tmux session with backend in first pane
tmux new-session -d -s "$SESSION" -c "$ROOT/backend" "yarn dev"

# Split: frontend (waits for backend via port check)
tmux split-window -t "$SESSION" -v -c "$ROOT/frontend" \
    'echo "Waiting for backend on :3000..."; while ! lsof -ti:3000 >/dev/null 2>&1; do sleep 1; done; echo "Backend ready"; yarn dev'

# OPTIONAL: Split: stripe listener
# tmux split-window -t "$SESSION" -v -c "$ROOT/backend" "yarn stripe:listen"

# Equal pane heights
tmux select-layout -t "$SESSION" even-vertical

# Pane titles in borders
tmux select-pane -t "$SESSION:0.0" -T "backend :3000"
tmux select-pane -t "$SESSION:0.1" -T "frontend :5173"
# tmux select-pane -t "$SESSION:0.2" -T "stripe"
tmux set-option -t "$SESSION" pane-border-status top
tmux set-option -t "$SESSION" pane-border-format " #{pane_title} "

# When any pane exits (Ctrl+C), kill the entire session
tmux set-hook -t "$SESSION" pane-exited "kill-session -t $SESSION"

# Focus backend pane
tmux select-pane -t "$SESSION:0.0"

# Attach (blocks until session ends)
tmux attach -t "$SESSION"

# Cleanup after session ends
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

if $WITH_DOCKER; then
    echo "Stopping Docker services..."
    (cd "$ROOT/services" && yarn stop)
fi

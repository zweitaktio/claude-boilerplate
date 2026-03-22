#!/bin/bash

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
            echo "Starts backend and frontend dev servers in a tmux session."
            echo "Logs are captured to .logs/dev-server.log in each workspace."
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

# --- OS detection ---

OS="$(uname -s)"

if ! command -v tmux &>/dev/null; then
    case "$OS" in
        Darwin) echo "tmux is required: brew install tmux" ;;
        *)      echo "tmux is required: apt install tmux / dnf install tmux" ;;
    esac
    exit 1
fi

# Clipboard command for tmux copy-mode
case "$OS" in
    Darwin) CLIP_CMD="pbcopy" ;;
    *)
        if command -v wl-copy &>/dev/null; then
            CLIP_CMD="wl-copy"
        elif command -v xclip &>/dev/null; then
            CLIP_CMD="xclip -selection clipboard"
        elif command -v xsel &>/dev/null; then
            CLIP_CMD="xsel --clipboard --input"
        else
            CLIP_CMD=""
        fi
        ;;
esac

# Port check: lsof (macOS/some Linux) or ss (Linux fallback)
port_in_use() {
    if command -v lsof &>/dev/null; then
        lsof -ti:"$1" >/dev/null 2>&1
    else
        ss -tlnp 2>/dev/null | grep -q ":$1 "
    fi
}

# Kill process on port (tolerates empty input on both BSD and GNU xargs)
kill_port() {
    if command -v lsof &>/dev/null; then
        lsof -ti:"$1" 2>/dev/null | xargs kill -9 2>/dev/null
    else
        local pids
        pids=$(ss -tlnp 2>/dev/null | grep ":$1 " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null
        fi
    fi
}

# --- Session setup ---

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null

# Start Docker services only if --docker flag is passed
if $WITH_DOCKER; then
    echo "Starting Docker services..."
    (cd "$ROOT/services" && yarn start)
fi

# Set terminal capabilities before creating session (must precede new-session)
tmux set-option -g default-terminal "tmux-256color"

# Create tmux session with backend in first pane
tmux new-session -d -s "$SESSION" -c "$ROOT/backend" "yarn dev; read -p 'Press Enter to close...'"
tmux set-option -t "$SESSION" mouse on
tmux set-option -t "$SESSION" set-clipboard on
if [ -n "$CLIP_CMD" ]; then
    tmux bind-key -T copy-mode MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "$CLIP_CMD"
    tmux bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "$CLIP_CMD"
fi

# Split: frontend (waits for backend via port check)
# Uses bash -c with /dev/tcp as a portable port check (no lsof/ss dependency)
tmux split-window -t "$SESSION" -v -c "$ROOT/frontend" \
    'echo "Waiting for backend on :3000..."; while ! bash -c ">/dev/tcp/localhost/3000" 2>/dev/null; do sleep 1; done; echo "Backend ready"; yarn dev; read -p "Press Enter to close..."'

# OPTIONAL: Split: stripe listener
# tmux split-window -t "$SESSION" -v -c "$ROOT/backend" "yarn stripe:listen"

# Log pane output to files (preserves TTY — no pipe in dev scripts)
mkdir -p "$ROOT/backend/.logs" "$ROOT/frontend/.logs"
: > "$ROOT/backend/.logs/dev-server.log"
: > "$ROOT/frontend/.logs/dev-server.log"
tmux pipe-pane -t "$SESSION:0.0" -o "cat >> $ROOT/backend/.logs/dev-server.log"
tmux pipe-pane -t "$SESSION:0.1" -o "cat >> $ROOT/frontend/.logs/dev-server.log"

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
tmux -2 attach -t "$SESSION"

# Cleanup after session ends
kill_port 3000
kill_port 5173

if $WITH_DOCKER; then
    echo "Stopping Docker services..."
    (cd "$ROOT/services" && yarn stop)
fi

#!/usr/bin/env bash
# CPU per request for an HttpArena style server.
#   run.sh <name> <dir> <start command...>
# Env: PROFILES (space separated, default all), DURATION (10), CONNS (256), THREADS (4), URL (http://localhost:8080)
# Each profile runs wrk and reports rps, p99 and server CPU microseconds per request, measured as
# the cpu time delta of the server process tree divided by requests completed.
set -e
NAME="$1"; DIR="$2"; shift 2
HERE="$(cd "$(dirname "$0")" && pwd)"
DURATION="${DURATION:-10}"; CONNS="${CONNS:-256}"; THREADS="${THREADS:-4}"; URL="${URL:-http://localhost:8080}"
PROFILES="${PROFILES:-baseline-get baseline-post pipelined json json-comp delay static}"
cd "$DIR"
"$@" > "/tmp/bench-$NAME.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; pkill -P $SERVER 2>/dev/null; wait $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 50); do curl -sf "$URL/baseline11?a=1&b=2" >/dev/null 2>&1 && break; sleep 0.2; done
sleep 1
printf '%-14s %-14s %10s %10s %10s %12s\n' server profile rps p99 errors cpu_us/req
for profile in $PROFILES; do
  args=()
  case $profile in
    baseline-get) path="/baseline11?a=13&b=42" ;;
    baseline-post) path="/baseline11?a=13&b=42"; args=(-s "$HERE/post.lua") ;;
    pipelined) path="/pipeline"; args=(-s "$HERE/pipeline.lua") ;;
    json) path="/json/50?m=6"; args=(-s "$HERE/json.lua") ;;
    json-comp) path="/json/50?m=6"; args=(-s "$HERE/jsoncomp.lua") ;;
    delay) path="/delay/10" ;;
    static) path="/static/reset.css"; args=(-s "$HERE/static.lua") ;;
    echo-tls) path="/echo"; args=(-s "$ECHO_LUA") ;;
    *) echo "unknown profile $profile"; exit 1 ;;
  esac
  conns=$CONNS; [ "$profile" = delay ] && conns=2000
  base=$URL; [ "$profile" = echo-tls ] && base="${TLS_URL:-https://localhost:8081}"
  # warm up
  wrk -t"$THREADS" -c"$conns" -d2 "${args[@]}" "$base$path" >/dev/null 2>&1
  before=$(python3 "$HERE/cputree.py" $SERVER)
  out=$(wrk -t"$THREADS" -c"$conns" -d"$DURATION" --latency "${args[@]}" "$base$path" 2>&1)
  after=$(python3 "$HERE/cputree.py" $SERVER)
  reqs=$(echo "$out" | awk '/requests in/ {print $1}')
  rps=$(echo "$out" | awk '/Requests\/sec/ {print $2}')
  p99=$(echo "$out" | awk '$1=="99%" {print $2}')
  errs=$(echo "$out" | grep -o 'Non-2xx or 3xx responses: [0-9]*' | awk '{print $NF}'); errs=${errs:-0}
  sock=$(echo "$out" | grep -o 'Socket errors.*' || true)
  cpu=$(python3 -c "print(f'{($after - $before) * 1e6 / max(1, $reqs):.2f}')")
  printf '%-14s %-14s %10s %10s %10s %12s %s\n' "$NAME" "$profile" "$rps" "$p99" "$errs" "$cpu" "$sock"
done

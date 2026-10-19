#!/bin/sh
# Runs the three routes of the web-frameworks benchmark with wrk against raw uWebSockets.js, spliffy
# with function handlers and spliffy with declarative responses. Each server runs alone, five runs
# per route, and the max and median requests/sec are printed. Needs wrk on the path.
cd "$(dirname "$0")"
runs=${RUNS:-5}; dur=${DURATION:-3}

bench () {
  label=$1; shift
  "$@" >/dev/null 2>&1 & pid=$!
  sleep 1.2
  wrk -t4 -c64 -d2s http://127.0.0.1:3000/ >/dev/null
  for route in "/" "/user/42" "POST /user"; do
    vals=""
    i=0
    while [ $i -lt $runs ]; do
      case $route in
        POST*) out=$(wrk -t4 -c64 -d${dur}s -s post.lua http://127.0.0.1:3000/user) ;;
        *) out=$(wrk -t4 -c64 -d${dur}s http://127.0.0.1:3000$route) ;;
      esac
      vals="$vals $(echo "$out" | awk '/Requests\/sec/ {print int($2)}')"
      i=$((i + 1))
    done
    sorted=$(echo $vals | tr ' ' '\n' | sort -n)
    max=$(echo "$sorted" | tail -1)
    median=$(echo "$sorted" | sed -n "$(( (runs + 1) / 2 ))p")
    printf "%-20s %-11s max %7s  median %7s\n" "$label" "$route" "$max" "$median"
  done
  kill $pid 2>/dev/null
  wait $pid 2>/dev/null
}

bench "uWebSockets.js" node uws.mjs
bench "spliffy" node spliffy.mjs
WWW=www_declarative bench "spliffy declarative" node spliffy.mjs

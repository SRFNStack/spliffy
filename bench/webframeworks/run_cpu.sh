#!/bin/sh
# Like run.sh, but reports server cpu microseconds per request instead of throughput. Throughput on
# a laptop swings with whatever else is running; cpu time per request barely moves, so this is the
# number to compare when the machine is not quiet. Needs wrk on the path.
cd "$(dirname "$0")"
dur=${DURATION:-4}

cputime () {
  # centiseconds of cpu the server has used so far (ps prints [[hh:]mm:]ss.cc)
  ps -p $1 -o time= | awk -F'[:.]' '{ if (NF==3) print ($1*60+$2)*100+$3; else print (($1*60+$2)*60+$3)*100+$4 }'
}

bench () {
  label=$1; shift
  "$@" >/dev/null 2>&1 & pid=$!
  sleep 1.2
  wrk -t4 -c64 -d2s http://127.0.0.1:3000/ >/dev/null
  for route in "/" "/user/42" "POST /user"; do
    before=$(cputime $pid)
    case $route in
      POST*) out=$(wrk -t4 -c64 -d${dur}s -s post.lua http://127.0.0.1:3000/user) ;;
      *) out=$(wrk -t4 -c64 -d${dur}s http://127.0.0.1:3000$route) ;;
    esac
    after=$(cputime $pid)
    reqs=$(echo "$out" | awk '/requests in/ {print $1}')
    rps=$(echo "$out" | awk '/Requests\/sec/ {print int($2)}')
    printf "%-20s %-11s %s us/req  (%s req/s)\n" "$label" "$route" "$(awk "BEGIN { printf \"%.2f\", ($after - $before) * 10000 / $reqs }")" "$rps"
  done
  kill $pid 2>/dev/null
  wait $pid 2>/dev/null
}

bench "uWebSockets.js" node uws.mjs
bench "spliffy" node spliffy.mjs
WWW=www_declarative bench "spliffy declarative" node spliffy.mjs

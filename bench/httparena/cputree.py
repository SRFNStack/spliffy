# total cpu seconds of a process and all its descendants, from ps
import subprocess, sys
root = int(sys.argv[1])
out = subprocess.run(['ps', '-axo', 'pid=,ppid=,cputime='], capture_output=True, text=True).stdout
children = {}
cpu = {}
for line in out.splitlines():
    parts = line.split()
    if len(parts) < 3: continue
    pid, ppid, t = int(parts[0]), int(parts[1]), parts[2]
    children.setdefault(ppid, []).append(pid)
    # [[dd-]hh:]mm:ss.cc
    days = 0
    if '-' in t:
        d, t = t.split('-'); days = int(d)
    f = [float(x) for x in t.split(':')]
    secs = f[-1] + 60 * f[-2] + (3600 * f[-3] if len(f) > 2 else 0) + 86400 * days
    cpu[pid] = secs
total = 0.0
stack = [root]
while stack:
    p = stack.pop()
    total += cpu.get(p, 0.0)
    stack.extend(children.get(p, []))
print(f'{total:.2f}')

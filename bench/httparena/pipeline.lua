-- 16 pipelined GET /pipeline per write
local reqs = nil
init = function(args)
  local r = {}
  for i = 1, 16 do r[#r + 1] = wrk.format("GET", "/pipeline") end
  reqs = table.concat(r)
end
request = function() return reqs end

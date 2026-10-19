-- the json-tls rotation, no Accept-Encoding
local paths = { "/json/1?m=3", "/json/5?m=7", "/json/10?m=2", "/json/15?m=5", "/json/25?m=4", "/json/40?m=8", "/json/50?m=6" }
local n = 0
request = function()
  n = n + 1
  return wrk.format("GET", paths[(n % 7) + 1])
end

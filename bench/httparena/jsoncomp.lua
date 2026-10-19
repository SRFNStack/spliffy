-- the json-comp rotation with Accept-Encoding
local paths = { "/json/25?m=4", "/json/40?m=8", "/json/50?m=6" }
local n = 0
request = function()
  n = n + 1
  return wrk.format("GET", paths[(n % 3) + 1], { ["Accept-Encoding"] = "gzip, br" })
end

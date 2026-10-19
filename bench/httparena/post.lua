-- POST /baseline11 with a content-length body, the second shape of the baseline mix
wrk.method = "POST"
wrk.body = "20"
wrk.headers["Content-Type"] = "text/plain"

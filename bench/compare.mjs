import { spawn } from 'child_process'
import autocannon from 'autocannon'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runBench (name, script, port) {
  console.log(`Starting ${name} benchmark...`)
  const server = spawn('node', [path.join(__dirname, script)], { stdio: 'inherit' })
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000))

  const result = await autocannon({
    url: `http://localhost:${port}`,
    connections: 100,
    duration: 10
  })

  console.log(`${name} Results:`)
  console.log(`  Requests/sec: ${result.requests.average}`)
  console.log(`  Latency (avg): ${result.latency.average} ms`)
  console.log(`  Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`)

  server.kill()
  await new Promise(resolve => setTimeout(resolve, 1000))
  return result
}

async function run () {
  try {
    const uwsResult = await runBench('uWebSockets.js', 'bench_uws.mjs', 11421)
    const spliffyResult = await runBench('Spliffy', 'bench_spliffy.mjs', 11420)

    console.log('\n========================================')
    console.log('FINAL COMPARISON')
    console.log('========================================')
    console.log(`uWebSockets.js: ${uwsResult.requests.average.toLocaleString()} req/s`)
    console.log(`Spliffy:       ${spliffyResult.requests.average.toLocaleString()} req/s`)
    const diff = ((spliffyResult.requests.average / uwsResult.requests.average) * 100).toFixed(2)
    console.log(`Performance:    ${diff}% of uWS speed`)
    console.log('========================================')
  } catch (e) {
    console.error('Benchmark failed', e)
    process.exit(1)
  }
}

run()
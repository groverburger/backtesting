import fs from 'fs'
import path from 'path'
import Worker from 'web-worker'
import JSZip from 'jszip'

// need to use the web-worker package to use the same code in browser and node
// also, need to name simulate as a cjs file so it isn't loaded like a module by node
const simulator = new Worker(new URL('./simulate.cjs', import.meta.url))
const strategy = './strategies/hotshotdiversify7-1.js'
const ticket = [
  {
    type: "transfer-in",
    money: 1000,
    date: "2017-01-01T00:00:00.000Z"
  }
]

simulator.onmessage = ({ data }) => {
  const { type, payload } = data

  if (type === 'simulation-result') {
    console.log(JSON.stringify(payload, null, 2))
    process.exit(0)
  }

  if (type === 'dataset-loaded') {
    simulate()
  }
}

simulator.onerror = (event) => {
  console.error(event)
  alert(`${event.message}\nline: ${event.lineno}\ncolumn: ${event.colno}`)
  setRunnable(true)
}

loadData()

async function loadData () {
  const { files } = await JSZip.loadAsync(fs.readFileSync('./dataset-fetching/dataset.zip'))
  const dataset = {}
  const length = Object.entries(files).length
  for (const [name, data] of Object.entries(files)) {
    dataset[name] = JSON.parse(await data.async('text'))
  }

  simulator.postMessage({
    action: 'load',
    args: [dataset]
  })
}

function simulate () {
  simulator.postMessage({
    action: 'simulate',
    args: [fs.readFileSync(strategy).toString(), ticket]
  })
}

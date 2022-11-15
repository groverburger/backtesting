import { simulate, loadData } from './simulate.js'

const editor = ace.edit('editor', { mode: 'ace/mode/javascript' })
//editor.setTheme("ace/theme/monokai")
let results
let ticket = [
  {
    type: "transfer-in",
    money: 1000,
    date: "2017-01-01T00:00:00.000Z"
  }
]

document.querySelector('#run').disabled = true

document.querySelector('#run').onclick = (event) => {
  const strat = Function('api', editor.getValue())
  results = simulate(strat, JSON.parse(JSON.stringify(ticket)))
  console.log('simulation done')
  document.querySelector('#results').innerHTML = JSON.stringify(results.results, null, 2)
  document.querySelector('#history').innerHTML = JSON.stringify(results.ticket, null, 2)
  graph()
}

function graph () {
  if (!results) { return }

  const graphs = [{
    x: results.returns.map(e => e[0]),
    y: results.returns.map(e => e[1]),
    type: 'scatter',
    mode: 'lines',
    name: 'strat'
  }]

  document.querySelector('#plot').innerHTML = ''
  Plotly.newPlot(
    'plot',
    graphs,
    {
      xaxis: {
        autorange: true
      },
      yaxis: {
        type: 'log',
        autorange: true
      }
    }
  )
}

window.onresize = graph

let dataset
document.querySelector('#upload').onclick = (event) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = async (event) => {
    const { files } = await JSZip.loadAsync(input.files[0])
    console.log('loading dataset...')
    dataset = {}
    for (const [name, data] of Object.entries(files)) {
      dataset[name] = JSON.parse(await data.async('text'))
    }
    loadData(dataset)
    document.querySelector('#run').disabled = false
  }
  input.click()
}

document.querySelector('#upload-ticket').onclick = (event) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = async (event) => {
    ticket = JSON.parse(await input.files[0].text())
    console.log(ticket)
  }
  input.click()
}

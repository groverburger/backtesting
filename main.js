let editor
let results
let curveList = []
let ticket = [
  {
    type: "transfer-in",
    money: 1000,
    date: "2017-01-01T00:00:00.000Z"
  }
]

layout()
setup()
render()
window.onresize = render
setRunnable(false)

function setup () {
  const simulator = new Worker('simulate.js')
  simulator.postMessage(['test'])

  simulator.onmessage = ({ data }) => {
    const { type, payload } = data

    if (type === 'simulation-result') {
      results = payload
      curveList.push({
        x: results.returns.map(e => e[0]),
        y: results.returns.map(e => e[1])
      })
      setRunnable(true)
      render()
    }

    if (type === 'simulation-progress') {
      document.querySelector('#loadingBackground progress').value = payload
    }

    if (type === 'dataset-loaded') {
      setRunnable(true)
    }
  }

  simulator.onerror = (event) => {
    console.error(event)
    alert(event.message)
    setRunnable(true)
  }

  document.querySelector('#run').onclick = (event) => {
    createLoadingBackground()
    simulator.postMessage({
      action: 'simulate',
      args: [editor.getValue(), ticket]
    })
    setRunnable(false)
  }

  document.querySelector('#clear').onclick = (event) => {
    curveList = []
    render()
  }

  document.querySelector('#addSpy').onclick = (event) => {
    createLoadingBackground()
    simulator.postMessage({
      action: 'simulate',
      args: ['api.buy("SPY")', ticket]
    })
    setRunnable(false)
  }

  let dataset
  document.querySelector('#upload').onclick = (event) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async (event) => {
      const { files } = await JSZip.loadAsync(input.files[0])
      createLoadingBackground()

      // hopefully this should prevent the not being able to load datasets bug
      input.value = null

      dataset = {}
      const length = Object.entries(files).length
      let i = 0
      for (const [name, data] of Object.entries(files)) {
        dataset[name] = JSON.parse(await data.async('text'))
        i += 1
        document.querySelector('#loadingBackground progress').value = Math.round(i * 100 / length)
      }
      simulator.postMessage({
        action: 'load',
        args: [dataset]
      })
    }
    input.click()
  }

  document.querySelector('#startDate').value = '2017-01-01'
  document.querySelector('#startDate').onchange = (event) => {
    let date = new Date(event.target.value)
    if (date < new Date('Jan 1 2000')) {
      date = new Date('Jan 1 2000')
    }
    ticket = [
      {
        type: "transfer-in",
        money: 1000,
        date: date.toISOString()
      }
    ]
  }

  document.querySelector('#layout').onchange = (event) => {
    layout()
    render()
  }
}

function setRunnable (value = false) {
  document.querySelector('#run').disabled = !value
  document.querySelector('#addSpy').disabled = !value

  if (value) {
    document.querySelector('#loadingBackground').remove()
  }
}

function createLoadingBackground () {
  const bg = document.createElement('div')
  bg.id = 'loadingBackground'
  const title = document.createElement('div')
  title.style = 'font: italic 2rem Arial'
  title.innerHTML = 'Loading...'
  bg.appendChild(title)
  const progress = document.createElement('progress')
  progress.max = 100
  progress.value = 0
  bg.appendChild(progress)
  document.querySelector('body').appendChild(bg)
}

function layout (mode = document.querySelector('#layout').value) {
  const grid = document.querySelector('#gridWrapper')
  const editor = document.querySelector('#editor')
  const results = document.querySelector('#results')
  const history = document.querySelector('#history')
  const plot = document.querySelector('#plot')
  plot.hidden = true
  editor.hidden = true
  results.hidden = true
  history.hidden = true

  if (mode === 'graph') {
    plot.style = 'grid-column: 1 / 13; grid-row: 1 / 3;'
    plot.hidden = false
  }

  if (mode === 'code') {
    editor.style = 'grid-column: 1 / 13; grid-row: 1 / 3;'
    editor.hidden = false
  }

  if (mode === 'code+graph') {
    editor.style = 'grid-column: 1 / 5; grid-row: 1 / 3;'
    plot.style = 'grid-column: 5 / 13; grid-row: 1 / 3;'
    editor.hidden = false
    plot.hidden = false
  }

  if (mode === 'results') {
    results.style = 'grid-column: 1 / 7; grid-row: 1 / 3;'
    history.style = 'grid-column: 7 / 13; grid-row: 1 / 3;'
    results.hidden = false
    history.hidden = false
  }

  if (mode === 'full') {
    editor.style = 'grid-column: 1 / 7; grid-row: 1 / 2;'
    results.style = 'grid-column: 7 / 10; grid-row: 1 / 2;'
    history.style = 'grid-column: 10 / 13; grid-row: 1 / 2;'
    plot.style = 'grid-column: 1 / 13; grid-row: 2 / 3;'
    editor.hidden = false
    results.hidden = false
    history.hidden = false
    plot.hidden = false
  }
}

function render () {
  if (document.querySelector('#editor')) {
    editor = ace.edit('editor', {
      mode: 'ace/mode/javascript',
      tabSize: 2,
      useSoftTabs: true
    })
    //editor.setTheme("ace/theme/monokai")
  }

  if (!results) { return }

  const formattedResults = {
    ...results.results,
    yearly: results.yearlyStatus
  }
  if (document.querySelector('#results')) {
    document.querySelector('#results').innerHTML = JSON.stringify(formattedResults, null, 2)
  }
  if (document.querySelector('#history')) {
    document.querySelector('#history').innerHTML = JSON.stringify(results.ticket, null, 2)
  }

  /*
  const graphs = [{
    x: results.returns.map(e => e[0]),
    y: results.returns.map(e => e[1]),
    type: 'scatter',
    mode: 'lines',
    name: 'strat'
  }]
  */

  const graphs = curveList.map(({ x, y }) => ({
    type: 'scatter',
    mode: 'lines',
    x,
    y
  }))

  document.querySelector('#plot').innerHTML = ''
  if (graphs.length === 0) { return }
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

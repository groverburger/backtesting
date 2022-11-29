import fetch from 'node-fetch'
import fs from 'fs'

function yahoo (text, dividendsText) {
  const list = text.split(/\r?\n/).slice(1)
  const divs = Object.fromEntries(
    dividendsText.split(/\r?\n/).slice(1).map(line => line.split(','))
  )
  return JSON.stringify(list.map(line => {
    const values = line.split(',')
    const ret = {
      date: (new Date(values[0])).toISOString(),
      open: Number(values[1]),
      high: Number(values[2]),
      low: Number(values[3]),
      close: Number(values[4]),
      // skip adjusted close
      volume: Number(values[6])
    }
    if (divs[values[0]]) { ret.dividend = Number(divs[values[0]]) }
    return ret
  }))
}

async function timer (time) {
  return new Promise(resolve => (
    setTimeout(resolve, time * 1000)
  ))
}

const companies = JSON.parse(fs.readFileSync('fetchlist.json'))
const then = (new Date(2000, 0, 1)).valueOf() / 1000
const now = Date.now()
const folder = 'stocks'
try {fs.mkdirSync(folder)} catch (e) {}

for (const symbol of companies) {
  if (symbol.includes('/')) { continue }
  console.log(symbol)
  let text
  let dividendsText
  try {
    const result = await fetch(`https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${then}&period2=${now}&interval=1d&events=history&includeAdjustedClose=true`)
    text = await result.text()
  } catch (e) {}
  try {
    const dividends = await fetch(`https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${then}&period2=${now}&interval=1d&events=div&includeAdjustedClose=true`)
    dividendsText = await dividends.text()
  } catch (e) {}
  fs.writeFileSync(`${folder}/${symbol}.json`, yahoo(text, dividendsText))
  await timer(0.25)
}

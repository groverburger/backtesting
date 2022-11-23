import fetch from 'node-fetch'
import fs from 'fs'

function alpha (text) {
  const json = JSON.parse(text)
  const series = json[Object.keys(json).filter(s => s.match(/[Tt]ime/))]
  return JSON.stringify(Object.entries(series).reverse().map(([date, v]) => ({
    price: Number(Object.values(v)[0]),
    date: (new Date(date)).toISOString()
  })))
}

function yahoo (text, dividendsText) {
  const list = text.split(/\r?\n/).slice(1)
  const divs = Object.fromEntries(
    dividendsText.split(/\r?\n/).slice(1).map(line => line.split(','))
  )
  return JSON.stringify(list.map(line => {
    const values = line.split(',')
    const ret = [
      date: (new Date(values[0])).toISOString(),
      price: Number(values[4]),
      volume: Number(values[6])
    ]
    if (divs[values[0]]) { ret.dividend = Number(divs[values[0]]) }
    return ret
  }))
}

const spHistory = JSON.parse(fs.readFileSync('other/sphistory.json').toString())
const nasdaq = JSON.parse(fs.readFileSync('other/nasdaq.json').toString())
const excludes = [
  'UA/UAA', // symbol doesn't work great with yahoo
  'CBE', // acquired by ETN
  'SLR', // acquired by FLEX
  'BMC', // data is corrupt on yahoo
  'TIE', // data is corrupt on yahoo
  'GR', // data is corrupt on yahoo
  'TRB', // data is corrupt on yahoo
  'MEE', // data is corrupt on yahoo
  'SGP', // data is corrupt on yahoo
  'PCL' // data is corrupt on yahoo
]
const companies = [...(new Set(spHistory.flatMap(x => x.sp500).filter(x => !excludes.includes(x))))]
console.log(companies.length)
companies.push('ETN')
companies.push('FLEX')
companies.push('LHX')
companies.push('SPY')
companies.push('SH')
companies.push('SDS')
companies.push('SPXU')
companies.push('UPRO')
companies.push('SSO')
companies.push('QQQ')
companies.push('TQQQ')
companies.push('SQQQ')
companies.push('VYM')
companies.push('JEPI')
companies.push('SCHD')
companies.push('SPHD')
companies.push('QYLD')
companies.push('NUSI')

const timer = async (time) => new Promise(resolve => setTimeout(resolve, time * 1000))

/*
for (const symbol of companies) {
  const result = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=full&symbol=${symbol}&apikey=OVVKRB1G6IMRNBA6`)
  console.log(symbol)
  const text = await result.text()
  fs.writeFileSync(`historical-daily-data-raw/${symbol}.txt`, text)
  //fs.writeFileSync(`historical-daily-data/${symbol}.json`, alpha(text))
  //await timer(12)
  await timer(13)
}
*/

// companies = ["UPRO"]

// const then = 1504483200
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
  await timer(0.025)
}

/*
for (const symbol of companies.slice(0, 20)) {
  const result = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=OVVKRB1G6IMRNBA6`)
  console.log(symbol)
  const text = await result.text()
  fs.writeFileSync(`intraday-data/${symbol}.json`, alpha(text))
  await timer(0.025)
}
*/

// fs.writeFileSync("test.txt", "test data")
// const result = await fetch("https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&apikey=OVVKRB1G6IMRNBA6")
// const result = await fetch("https://api.weather.gov/gridpoints/TOP/31,80/forecast")
// console.log(await result.text())

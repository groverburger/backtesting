let data = {}
let userdata = {}
let timeArray = []
let timeHash = {}

onmessage = ({ data }) => {
  const { action, args } = data

  if (action === 'load') {
    loadData(...args)
  }

  if (action === 'simulate') {
    simulate(...args)
  }
}

function loadData (dataSource) {
  let longestLength = 0
  let longestList

  Object.entries(dataSource).forEach(([name, list]) => {
    if (name.includes('stocks/')) {
      name = name.replace('.json', '')
      name = name.replace('stocks/', '')
      longestLength = Math.max(longestLength, list.length)
      if (list.length === longestLength) {
        longestList = list
      }
      data[name] = list
      return
    }

    if (name.includes('other/')) {
      name = name.replace('.json', '')
      name = name.replace('other/', '')
      userdata[name] = JSON.stringify(list)
    }
  })

  // pad out newer stocks to have the full date range
  for (const [name, list] of Object.entries(data)) {
    let i = 0
    while (list.length < longestLength) {
      list.unshift({
        open: 0,
        close: 0,
        high: 0,
        low: 0,
        volume: 0,
        date: longestList[i]
      })
      i += 1
    }
  }

  for (const entry of longestList) {
    timeArray.push(new Date(entry.date))
    for (let i=0; i<16; i++) {
      timeHash[timeHashMapping(timeArray.at(-1)) + i] = timeArray.length
    }
  }

  postMessage({
    type: 'dataset-loaded',
    payload: {}
  })
}

function timeHashMapping (date) {
  return Math.floor(date.valueOf() / (1000 * 60 * 60 * 24))
}

function linearRegression (yAxis) {
  const n = yAxis.length
  const x = n * (n + 1) / 2
  const xx = n * (n + 1) * (2 * n + 1) / 6
  const y = yAxis.reduce((prev, now) => prev + now, 0)
  const xy = yAxis.reduce((prev, now, i) => prev + (i + 1) * now, 0)

  return [
    (y * xx - x * xy) / (n * xx - x),
    (n * xy - x * y) / (n * xx - x ** 2)
  ]
}

function standardDeviation (data) {
  if (data.length === 0) { return NaN }
  const average = data.reduce((t, e) => e + t) / data.length
  const distances = data.reduce((t, e) => t + Math.pow(e - average, 2), 0)
  return Math.sqrt(distances / data.length)
}

function simulate (strategy, ticket) {
  let money = 0
  const stocks = {}
  const costBasis = {}
  let startDate = 0
  const endDate = timeArray.length
  for (const symbol in data) { stocks[symbol] = 0 }
  let date = 0
  const yearlyStatus = []
  const returns = []
  let exposure = 0
  let totalPossibleExposure = 0
  let hasRun = false

  const buy = (symbol, percentage = 1, type = 'buy') => {
    symbol = symbol.toUpperCase()
    percentage = Math.min(1, percentage)
    let moneyDown = percentage * money
    if (moneyDown <= 0 || money < 0.01) { return }

    const price = getPrice(symbol)
    if (!price || price === Infinity) return

    money -= moneyDown
    stocks[symbol] += moneyDown / price

    costBasis[symbol] = costBasis[symbol] || 0
    costBasis[symbol] += moneyDown

    ticket.push({
      type,
      symbol,
      money: moneyDown,
      percentage,
      date: timeArray[date].toISOString()
    })

    return true
  }

  const sell = (symbol, percentage = 1) => {
    symbol = symbol.toUpperCase()
    percentage = Math.min(percentage, 1)
    let amount = percentage * stocks[symbol]
    if (amount <= 0 || !stocks[symbol]) { return }

    let price = getPrice(symbol)
    let i = 1
    while (!price && date - i >= 0) {
      price = getPrice(symbol, i)
      i += 1
    }

    const moneyUp = price * amount
    // 20% capital gains tax rough calculation
    //money += moneyUp > costBasis[symbol] ? moneyUp - (moneyUp - costBasis[symbol]) * 0.2 : moneyUp
    money += moneyUp
    stocks[symbol] -= amount

    const roi = moneyUp / costBasis[symbol]

    costBasis[symbol] -= moneyUp
    if (costBasis[symbol] <= 0.00001 || stocks[symbol] <= 0.00001) {
      delete costBasis[symbol]
    }

    ticket.push({
      type: 'sell',
      symbol,
      money: moneyUp,
      percentage,
      roi,
      date: timeArray[date].toISOString()
    })

    return moneyUp
  }

  const getDateIndex = () => date

  const getPotential = (datatype = 'close') => {
    let potential = 0
    for (const stock in stocks) {
      const amount = stocks[stock]
      if (amount > 0) {
        potential += getPriceData(stock, datatype) * amount
      }
    }
    return potential
  }

  const getPortfolio = () => {
    return Object.fromEntries(Object.entries(stocks).filter(([name, value]) => value))
  }

  const status = () => {
    const portfolio = getPortfolio()
    const potential = getPotential()
    const total = potential + money
    return {
      portfolio,
      myStocks: portfolio,
      costBasis,
      money,
      potential,
      total
    }
  }

  const getPriceData = (symbol, datatype = 'close', index = 0) => {
    symbol = symbol.toUpperCase()
    if (!data[symbol]) { return undefined }
    if (index instanceof Date) {
      index = timeHash[timeHashMapping(index)]
    } else {
      index = date - index
    }
    index = Math.min(Math.max(index, 0), date)
    if (index !== index) { return undefined }
    if (!data[symbol][index]) { return undefined }
    return data[symbol][index][datatype]
  }

  const getPrice = (symbol, index = 0) => getPriceData(symbol, 'close', index)

  const newYear = () => {
    const total = status().total
    const delta = total - yearlyStatus.at(-1).money
    const percentage = Math.round(delta * 100 / yearlyStatus.at(-1).money)
    const tax = 0 // delta > 0 ? delta / 3 : 0

    yearlyStatus.push({
      money: total,
      delta,
      percentage,
      tax,
      date: timeArray[date]
    })
  }

  const run = (strat) => {
    hasRun = true

    while (date < endDate) {
      if (strat) {
        strat(timeArray[date])
      }

      returns.push([
        timeArray[date].toISOString(),
        getPotential() + money,
      ])

      let isExposed = false
      for (const stock in stocks) {
        if (stocks[stock]) {
          isExposed = true

          // dividend calculation
          const div = (data[stock][date].dividend || 0) * stocks[stock]
          money += div

          // dividend reinvestment (DRIP)
          buy(stock, div, 'drip')
        }
      }
      if (isExposed) { exposure += 1 }
      totalPossibleExposure += 1
      date += 1

      const progress = Math.round((date - startDate) * 100 / (endDate - startDate))
      const lastProgress = Math.round(((date - 1) - startDate) * 100 / (endDate - startDate))

      if (progress > lastProgress) {
        postMessage({
          type: 'simulation-progress',
          payload: progress
        })
      }

      // start a new year and calculate tax
      if (timeArray[date] && date > 1) {
        if (timeArray[date].getFullYear() !== timeArray[date - 1].getFullYear()) {
          newYear()
        }
      }
    }
    date -= 1
  }

  const goToDate = (target) => {
    const originalTarget = new Date(target)
    target = originalTarget.valueOf()

    if (timeArray[date].valueOf() > target) {
      throw new Error('Target ' + originalTarget.toISOString() + ' is before ' + timeArray[date].toISOString())
    }

    while (timeArray[date].valueOf() < target) {
      date += 1
      if (date >= timeArray.length) {
        throw new Error(`Date is in the future! Most recent date is ${timeArray.at(-1).toISOString()}`)
      }
    }
  }

  // run through the ticket
  for (const entry of ticket) {
    goToDate(entry.date)
    startDate = Math.max(date, startDate)

    if (entry.type === 'transfer-in') {
      money += entry.money
    }

    if (entry.type === 'transfer-out') {
      money -= entry.money
    }

    if (entry.type === 'buy') {
      buy(entry.symbol, entry.money)
      ticket.pop()
    }

    if (entry.type === 'sell') {
      sell(entry.symbol, entry.amount)
      ticket.pop()
    }
  }

  /*
  if (ticket.description.endDate) {
    endDate = (new Date(ticket.description.endDate)).valueOf()
  }
  */

  yearlyStatus.push({
    money: status().total
  })

  const getSlope = (symbol, length = 10) => (
    linearRegression(
      Array(length).fill(0).map((_, i) => getPrice(symbol, i)).reverse()
    )[1]
  )

  const movingAverage = (symbol, length = 10) => {
    let total = 0
    for (let i = 0; i < length; i += 1) {
      total += getPrice(symbol, i)
    }
    return total /= length
  }

  // execute the strategy
  strategy = Function('api', strategy)
  const customResults = strategy({
    run,
    buy,
    sell,
    sellAll: () => Object.keys(status().portfolio).forEach(stock => sell(stock)),
    status,
    getStatus: status,
    getPrice,
    getSlope,
    movingAverage,
    getMovingAverage: movingAverage,
    getUserdata: (name) => userdata[name],
    getCostBasis: (symbol) => costBasis[symbol],
    getHoldingPotential: (symbol) => stocks[symbol] * getPrice(symbol),
    getPortfolio
  })
  if (!hasRun) { run() }

  // so that we can test within the span of one year
  if (yearlyStatus.length === 1) {
    newYear()
  }

  const years = yearlyStatus.length - 1
  const stdDev = standardDeviation(yearlyStatus.filter(x => x.percentage).map(x => x.percentage))
  //const percentReturn = (status().total / 1000) * 100 - 100
  //const riskFreeReturn = Math.pow(1.04, years) * 100 - 100
  const percentReturn = Math.pow(status().total / 1000, 1 / years) * 100 - 100
  const riskFreeReturn = 3
  const sharpeRatio = (percentReturn - riskFreeReturn) / stdDev

  postMessage({
    type: 'simulation-result',
    payload: {
      returns,
      ticket,
      yearlyStatus,
      results: {
        ...status(),
        ...(typeof customResults === 'object' ? customResults : {}),
        exposure: exposure / totalPossibleExposure,
        buys: ticket.filter(e => e.type === 'buy').length,
        sells: ticket.filter(e => e.type === 'sell').length,
        percentReturn,
        riskFreeReturn,
        stdDev,
        sharpeRatio
      }
    }
  })
}

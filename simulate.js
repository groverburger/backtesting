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
      userdata[name] = list
    }
  })

  // pad out newer stocks to have the full date range
  for (const [name, list] of Object.entries(data)) {
    let i = 0
    while (list.length < longestLength) {
      list.unshift({
        price: 0,
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
  const buyIn = {}
  let startDate = 0
  const endDate = timeArray.length
  for (const symbol in data) { stocks[symbol] = 0 }
  let date = 0
  const yearlyStatus = []
  const returns = []
  let exposure = 0
  let totalPossibleExposure = 0
  let hasRun = false

  const buy = (symbol, moneyDown = Infinity, type = 'buy') => {
    moneyDown = Math.min(money, moneyDown)
    if (moneyDown <= 0) return
    const price = getPrice(symbol, date)
    if (!price || price === Infinity) return
    if (money < 0.01) return

    money -= moneyDown
    stocks[symbol] += moneyDown / price

    buyIn[symbol] = buyIn[symbol] || 0
    buyIn[symbol] += moneyDown

    ticket.push({
      type,
      symbol,
      amount: moneyDown / price,
      money: moneyDown,
      date: timeArray[date].toISOString()
    })

    return true
  }

  const sell = (symbol, amount = Infinity) => {
    if (!stocks[symbol]) return
    let price = getPrice(symbol, date)
    let i = 1
    while (!price && date - i >= 0) {
      price = getPrice(symbol, date - i)
      i += 1
    }
    amount = Math.min(amount * stocks[symbol], stocks[symbol])

    const moneyUp = price * amount
    // 20% capital gains tax rough calculation
    //money += moneyUp > buyIn[symbol] ? moneyUp - (moneyUp - buyIn[symbol]) * 0.2 : moneyUp
    money += moneyUp
    stocks[symbol] -= amount

    buyIn[symbol] -= moneyUp
    if (buyIn[symbol] <= 0.00001 || stocks[symbol] <= 0.00001) {
      delete buyIn[symbol]
    }

    ticket.push({
      type: 'sell',
      symbol,
      amount,
      money: moneyUp,
      date: timeArray[date].toISOString()
    })

    return moneyUp
  }

  const getDateIndex = () => date

  const getPotential = () => {
    return Object.entries(stocks).reduce(
      (prev, [symbol, amount]) => prev + getPrice(symbol, date) * amount,
      0
    )
  }

  const status = () => {
    const myStocks = Object.fromEntries(Object.entries(stocks).filter(([name, value]) => value))
    const potential = getPotential()
    const total = potential + money
    const yearlyReturn = yearlyStatus.slice(1).reduce((prev, { percentage }) => prev + percentage, 0) / (yearlyStatus.length - 1)
    return { myStocks, buyIn, money, potential, total, yearlyReturn, date: timeArray[date] }
  }

  const getPrice = (symbol, index = date) => {
    if (!data[symbol]) { return undefined }
    if (index instanceof Date) {
      index = timeHash[timeHashMapping(index)]
    }
    index = Math.min(Math.max(index, 0), date)
    if (index !== index) { return undefined }
    while (typeof data[symbol][index].price !== 'number' && index > 0) {
      index -= 1
    }
    if (!data[symbol][index]) { return undefined }
    return data[symbol][index].price
  }

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

      returns.push([timeArray[date].toISOString(), getPotential() + money])
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
      Array(length).fill(0).map((_, i) => getPrice(symbol, getDateIndex() - i)).reverse()
    )[1]
  )

  const movingAverage = (symbol, length = 10) => {
    let total = 0
    for (let i = 0; i < length; i += 1) {
      total += getPrice(symbol, date - i)
    }
    return total /= length
  }

  // execute the strategy
  strategy = Function('api', strategy)
  const customResults = strategy({
    buy,
    sell,
    status,
    getStatus: status,
    run,
    getPrice,
    getDateIndex,
    getSlope,
    movingAverage,
    getUserdata: (name) => userdata[name]
  })
  if (!hasRun) { run() }

  // so that we can test within the span of one year
  if (yearlyStatus.length === 1) {
    newYear()
  }

  const stdDev = standardDeviation(yearlyStatus.filter(x => x.percentage).map(x => x.percentage))
  const sharpeRatio = ((status().total / 1000) - (1.04 ** yearlyStatus.length)) / stdDev

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
        stdDev,
        sharpeRatio
      }
    }
  })
}

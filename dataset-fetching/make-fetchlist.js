import fs from 'fs'

const spHistory = JSON.parse(fs.readFileSync('other/sphistory.json').toString())
const nasdaq = JSON.parse(fs.readFileSync('other/nasdaq.json').toString())
const excludes = [
  'UA/UAA', // yahoo doesn't like the slash
  'BRK.B', // yahoo doesn't like the dot
  'BF.B', // yahoo doesn't like the dot
  'CBE', // acquired by ETN
  'SLR', // acquired by FLEX
  'LLL', // renamed to LHX

  // the rest of these have corrupt data on yahoo
  'BMC',
  'TIE',
  'GR',
  'TRB',
  'MEE',
  'SGP',
  'PCL',
  'EP',
  'HNZ'
]

// combine the nasdaq and historical S&P listings
const companies = [...(new Set(spHistory.flatMap(x => x.sp500).filter(x => !excludes.includes(x))))]

// fill in the gaps of some companies that were excluded
companies.push('UA')
companies.push('UAA')
companies.push('ETN')
companies.push('FLEX')
companies.push('LHX')
companies.push('BRK-B')
companies.push('BF-B')

// add a bunch of ETFs that i like
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
companies.push('SCHD')
companies.push('QYLD')
companies.push('NUSI')

// write out the final result
fs.writeFileSync('fetchlist.json', JSON.stringify(companies, null, 2))

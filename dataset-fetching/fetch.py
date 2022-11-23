import urllib.request
import json
import datetime
import time

symbol = 'IBM'
then = str(int(time.mktime(datetime.date(2000, 1, 1).timetuple())))
now = str(int(datetime.datetime.timestamp(datetime.datetime.now()) * 1000))
price_url = (
    'https://query1.finance.yahoo.com/v7/finance/download/'
    + symbol
    + '?period1='
    + then
    + '&period2='
    + now
    + '&interval=1d&events=history&includeAdjustedClose=true'
)
dividend_url = (
    'https://query1.finance.yahoo.com/v7/finance/download/'
    + symbol
    + '?period1='
    + then
    + '&period2='
    + now
    + '&interval=1d&events=div&includeAdjustedClose=true'
)

with urllib.request.urlopen(price_url) as response:
    data = response.read().decode()
    data = list(map(lambda x : x.split(','), data.split('\n')))[1:]
    data = list(map(lambda x : { "date": x[0], "price": float(x[1]) }, data))
    with urllib.request.urlopen(dividend_url) as response:
        div = response.read().decode()
        div = list(map(lambda x : x.split(','), div.split('\n')))[1:]
        div_object = {div[i][0]: div[i][1] for i in range(len(div))}
        for entry in data:
            if entry["date"] in div_object:
                entry["dividend"] = div_object[entry["date"]]
        with open(symbol + '.json', 'w') as file:
            file.write(json.dumps(data, indent=2))

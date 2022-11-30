import urllib.request
import json
import datetime
import time
import sys
import os
import zipfile

then = str(int(time.mktime(datetime.date(2000, 1, 1).timetuple())))
now = str(int(datetime.datetime.timestamp(datetime.datetime.now()) * 1000))

if not os.path.exists('stocks'):
    os.makedirs('stocks')

def fetch_symbol(symbol):
    if os.path.exists(f'stocks/{symbol}.json'):
        return False
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
        data = list(map(lambda x : ({
            "date": x[0],
            "open": float(x[1]) if x[1] != 'null' else 0,
            "high": float(x[2]) if x[2] != 'null' else 0,
            "low": float(x[3]) if x[3] != 'null' else 0,
            "close": float(x[4]) if x[4] != 'null' else 0,
            "volume": float(x[6]) if x[6] != 'null' else 0,
        }), data))
        with urllib.request.urlopen(dividend_url) as response:
            div = response.read().decode()
            div = list(map(lambda x : x.split(','), div.split('\n')))[1:]
            div_object = {div[i][0]: div[i][1] for i in range(len(div))}
            for entry in data:
                if entry["date"] in div_object:
                    entry["dividend"] = div_object[entry["date"]]
            with open('stocks/' + symbol + '.json', 'w') as file:
                file.write(json.dumps(data))
    return True

# read the fetchlist, and fetch each stock listed
with open('fetchlist.json', 'r') as file:
    fetchlist = json.load(file)
    for entry in fetchlist:
        try:
            if fetch_symbol(entry):
                print(entry)
                # we have to wait more than 1/5 sec bt fetches
                # or else yahoo will block us for DDOSing
                time.sleep(1 / 4)
        except:
            print(f'couldn\'t fetch {entry}!')
        sys.stdout.flush() # so that stdout is updated while running

# write updated metadata for this dataset
with open('metadata.json', 'w') as file:
    file.write(json.dumps({
        "version": 1,
        "fetchDate": str(datetime.datetime.now())
    }))

# zip the fetched stocks and userdata
with zipfile.ZipFile('dataset.zip', 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path, directories, files in os.walk('stocks'):
        for f in files:
            z.write(os.path.join(path, f))
    for path, directories, files in os.walk('other'):
        for f in files:
            z.write(os.path.join(path, f))
    z.write('metadata.json')

var buttons = require('sdk/ui/button/action')
//var tabs = require('sdk/tabs')
var self = require('sdk/self')
var timers = require('sdk/timers')
var prefs = require('sdk/simple-prefs')

const {Cc, Ci} = require('chrome')

var idPrefix = self.name
var addonCaption = 'Volatile Storage'

var promptService = Cc['@mozilla.org/embedcomp/prompt-service;1']
  .getService(Ci.nsIPromptService)

var button
var localStorage

function LocalStorage() {
  var self = this
  var tableName = 'webappsstore2'
  var db

  self.checkDB = function () {
    if (!db) {
      self.initDB()
    } else if (!db.connectionReady) {
      fail('Local Storage connection is not ready for an operation.')
    }
  }

  self.initDB = function () {
    var lsFile = Cc['@mozilla.org/file/directory_service;1']
      .getService(Ci.nsIProperties)
      .get('ProfD', Ci.nsIFile)

    if (!lsFile) {
      fail('Cannot get profile location nsIFile.')
    }

    lsFile.append('webappsstore.sqlite')

    console.log('LocalStorage.init(), file = ' + lsFile.path)

    if (!lsFile || !lsFile.exists()) {
      fail('Local Storage SQLite file doesn\'t exist.')
    }

    lsService = Cc['@mozilla.org/storage/service;1']
      .getService(Ci.mozIStorageService)

    if (!lsService) {
      fail('Cannot obtain IStorageService of the Local Storage SQLite file.')
    }

    try {
      db = lsService.openDatabase(lsFile)
    } catch (e) {
      fail('Cannot open Local Storage SQLite database, error: ' + e)
    }

    if (!db.connectionReady) {
      fail('Local Storage connection is not ready after being opened.')
    } else if (!db.tableExists(tableName)) {
      fail('Local Storage database has no ' + tableName + ' table.')
    }
  }

  self.deinit = function () {
    console.log('LocalStorage.deinit(), ' + (db ? 'has DB' : 'no DB'))

    if (db) {
      db.asyncClose()
      db = null
    }
  }

  // onRow(row) = {
  //   rowid: 123,
  //   scope: 'reverse.hostname.:http:80'
  //      = reverse-domain ['.'] ':' scheme ':' port
  //      e.g. google.com = moc.elgoog
  //   scopeParts: {host: 'google.com', scheme: 'https', port: 443, url: 'https://google.com'},
  //   key: 'localstorevarkey',
  //   value: 'the value',
  //   secure: 0/1,
  //   owner: '...' - are always empty
  // }
  self.list = function (onRow, onFinish) {
    self.checkDB()

    var columns = ['rowid', 'scope', 'key', 'value', 'secure', 'owner']
    var sql = 'SELECT ' + columns.join() + ' FROM ' + tableName
    var stmt = db.createAsyncStatement(sql)

    self._list(stmt, onRow, onFinish)
  }

  self._list = function (stmt, onRow, onFinish) {
    stmt.executeAsync({
      handleCompletion: onFinish,
      handleError: self._onSqlError,

      handleResult: function (result) {
        for (var row = result.getNextRow(); row; row = result.getNextRow()) {
          var obj = {}

          for (var i = 0; i < columns.length; i++) {
            var name = columns[i]
            var variant = row.getResultByIndex(i)
            var value

            switch (name) {
            case 'scope':
              obj.scopeParts = self.parseScope(variant + '')
              break
            case 'rowid':
            case 'secure':
              value = +variant
              break
            }

            value === undefined && (value = variant + '')
            obj[name] = value
          }

          onRow(obj)
        }
      },
    })
  }

  self._onSqlError = function (e) {
    fail(e.message)
  }

  self.parseScope = function (str) {
    var [strHost, strScheme, strPort]  = str.split(/:/)

    var obj = {
      host: strHost,
      scheme: strScheme.toLowerCase(),
      port: +strPort,
      url: '',
    }

    for (var i = 0; i < strHost.length; i++) {
      obj.host[i] = strHost[strHost.length - i - 1].toLowerCase()
    }

    obj.url = obj.scheme + '://' + obj.host.replace(/^\.|\.$/g, '')

    if ((obj.scheme != 'http'  || obj.port != 80) &&
        (obj.scheme != 'https' || obj.port != 443)) {
      obj.url += ':' + obj.port
    }

    return obj
  }

  self.clear = function () {
    self._clear('')
  }

  self._clear = function (extra) {
    self.checkDB()
    console.log('LocalStorage._clear(' + extra + ')')
    db.executeSimpleSQL('DELETE FROM ' + tableName)
  }

  self.count = function (onDone) {
    self._count('', onDone)
  },

  self._count = function (extra, onDone) {
    self.checkDB()

    db
      .createAsyncStatement('SELECT COUNT(rowid) FROM ' + tableName + extra)
      .executeAsync({
        handleError: self._onSqlError,
        handleResult: function (result) {
          var count = +result.getNextRow().getResultByIndex(0)
          console.log('LocalStorage._count(' + extra + ') = ' + count)
          onDone(count)
        },
      })
  }
}

function id(suffix) {
  return 'volastor-' + suffix
}

function fail(msg) {
  throw addonCaption + ' error: ' + msg
}

exports.main = function (options) {
  console.log('main(' + options.loadReason + ')')

  init()

  switch (options.loadReason) {
  case 'startup':
    if (prefs.prefs['clearLsOnStartup']) {
      timers.setTimeout(localStorage.clear, 500)
    }
    break
  }
}

exports.onUnload = function (reason){
  console.log('onUnload(' + reason + ')')

  switch (reason) {
  case 'shutdown':
    if (prefs.prefs['clearLsOnShutdown']) {
      localStorage.clear()
    }
    break
  }

  deinit()
}

// http://stackoverflow.com/a/11595838
function getBrowser() {
  var windowsService = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator)

  var currentWindow = windowsService.getMostRecentWindow('navigator:browser')

  return currentWindow.getBrowser();
}

function onClick(state) {
  localStorage.count(function (count) {
    var s = count == 1 ? '' : 's'
    var text = 'Clear Local Storage? It currently has ' + count + ' item' + s + '.'

    if (count < 1) {
      notify('Local Storage is empty - nothing to clear.', true)
    } else if (promptService.confirm(null, 'Volatile Storage', text)) {
      localStorage.clear()
      notify('Removed ' + count + ' item' + s + ' from the Local Storage.', true)
    }
  })
}

function notify(text, autoHide) {
  var box = getBrowser().getNotificationBox()
  var notification = box.getNotificationWithValue(idPrefix)

  if (notification) {
    notification.label = text
  } else {
    notification = box.appendNotification(text, idPrefix,
                                          self.data.url('icon-32.png'),
                                          box.PRIORITY_INFO_MEDIUM, [])
  }

  if (autoHide) {
    timers.setTimeout(function () {
      box.removeNotification(notification)
    }, 3000)
  }

  return notification
}

function init() {
  button = buttons.ActionButton({
    id: id('button'),
    label: addonCaption,
    icon: {'32': './icon-32.png'},
    onClick: onClick,
  })

  localStorage = new LocalStorage
}

function deinit() {
  if (localStorage) {
    localStorage.deinit()
    localStorage = null
  }
}

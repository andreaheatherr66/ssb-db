var ScuttlebuttSecure = require('../')
var Feed = require('../feed')
var level = require('level-test')()
var tape = require('tape')
var ecc  = require('eccjs')
var k256 = ecc.curves.k256
var pull = require('pull-stream')
var proquint = require('proquint-')

var db = ScuttlebuttSecure(
          level('scuttlebutt-secure-feeds', {
            keyEncoding: 'binary', valueEncoding: 'binary'
          })
        )


function writeMessages (feed, ary, cb) {
  pull(
    pull.values(ary),
    pull.asyncMap(function (m, cb) {
      feed.append('message', m, cb)
    }),
    pull.drain(null, cb)
  )
}

function hex (b) {
  var s = b.toString('hex'), o = ''
  while(s.length) {
    if(o) o += '\n'
    o += s.substring(0, 64)
    s = s.substring(64)
  }
  return o

}

function toHuman (msg) {
  return (
    proquint.encode(msg.author).substring(0, 12*4) + ' / ' +
    msg.sequence + '\n' +
    msg.type.toString('utf8') + ' : '+
    new Date(msg.timestamp).toISOString() + '\n' +
    ( msg.type.toString('utf8') == 'INIT'
    ? hex(msg.message) + '\n'
    : msg.message.toString('utf8') + '\n' )
  )
}

tape('3 feeds', function (t) {

  var alice = db.feed(ecc.generate(k256))
  var bob   = db.feed(ecc.generate(k256))

  writeMessages(alice, [
    'hello there',
    'again again',
    'third time lucky'
  ], next)
  writeMessages(bob, [
    'foo bar baz',
    'apple banana cherry durian elderberry',
    'something else'
  ], next)

  var n = 2

  function next () {
    if(--n) return

    //request the feeds
    pull(
      db.createFeedStream(),
      pull.collect(function (err, ary) {
        if(err) throw err
        ary.map(function (e) {
          console.log(toHuman(e))
        })
        var sorted = ary.slice().sort(function (a, b) {
          return a.timestamp - b.timestamp
        })
        //2 INIT + 6 messages
        t.equal(ary.length, 8)
        t.deepEqual(ary, sorted)
        t.end()
      })
    )

  }

})




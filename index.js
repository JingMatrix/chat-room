'use strict'

const config = require('config-yml')
const express = require('express')
const compression = require('compression')
const path = require('path')
const IO = require('socket.io')
const xss = require('xss')
const db = require('./db')
const filter = require('./utils/filter')
const counter = require('./counter')
const bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')


const push = require('./utils/webpush')
const app = express()

const roomRouter = require('./router/room')

app.use(compression())
app.use(cookieParser())
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'assets')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')



const server = require('http').Server(app)
const socketIO = IO(server)

const roomList = {}
let tokenList = db.tokenList;
// When new connection incoming
socketIO.on('connection', socket => {
  // Get Room ID / Session ID
  const { roomId='default', t: sid } = socket.handshake.query

  const { cookie } = socket.handshake.headers
  // Get nickname from the cookie or generate a random name
  const name = processInput(getCookie(cookie, 'name').trim().substring(0, 32) || `user_${Math.random().toString(36).substr(2, 5)}`)
  // Get uid from the cookies or set the uid to be the same as the session ID on the first connection
  const uid = processInput(getCookie(cookie, 'uid').trim().substring(0, 7) || sid)

  socket.join(roomId)

  let user = { session: [sid], uid, name }

  if (!roomList[roomId]) roomList[roomId] = []

  // Reuse user info if uid exists
  const index = roomList[roomId].findIndex(obj => obj.uid === user.uid)
  if (index !== -1) {
    roomList[roomId][index]['session'].push(sid)
    user = roomList[roomId][index]
  }else{
    roomList[roomId].push(user)
    socketIO.to(roomId).emit('sys', `${user.name}(${user.uid}) join the chat.`)
    console.log(`${user.name}(${user.uid})::${sid} join the room(${roomId})`)
  }
  socketIO.to(roomId).emit('init', user)
  socketIO.to(roomId).emit('online', roomList[roomId])
  socket.on('change-name', name => {
    name = processInput(name.trim()).substring(0, 32)

    const index = roomList[roomId].findIndex(obj => obj.uid === user.uid)
    const oldName = roomList[roomId][index]['name'].substring(0, 32)

    if(oldName === name) return

    roomList[roomId][index]['name'] = name

    socketIO.to(roomId).emit('rename', { uid: processInput(user.uid), name })
    socketIO.to(roomId).emit('online', roomList[roomId])

    const msg = `${oldName}(${user.uid}) changed the name from ${oldName} to ${name}.`
    socketIO.to(roomId).emit('sys', processInput(msg))
    console.log(msg)
  })

  socket.on('leave', () => {
    socket.emit('disconnect')
  })

  socket.on('disconnect', () => {
    // Socket session leave chat room
    socket.leave(roomId) 

    // Mark the user offline if the last session leaves
    const userIndex = roomList[roomId].findIndex(item => item.uid === uid)
    if (userIndex !== -1) {
      const user = roomList[roomId][userIndex]
      const sessionIndex = user.session.findIndex(item => item === sid)
      user.session.splice(sessionIndex, 1)

      if(user.session.length === 0) {
        roomList[roomId].splice(userIndex, 1)

        socketIO.to(roomId).emit('sys', `${processInput(user.name)}(${processInput(user.uid)}) leave the chat.`)
        socketIO.to(roomId).emit('online', roomList[roomId])
      }

      console.log(`${user.name}(${user.uid})::${sid} leave the room(${roomId})`)
    }

    // Clean the room if no one is chatting
    if(roomList[roomId].length === 0) delete roomList[roomId]
  })

  // Broadcast the message to everyone in the room when it is received
  socket.on('message', msg => {
    const msgItem = {
      ...msg,
      sid,
      room: roomId,
      ts: Date.now() / 1000 | 0,
      name: processInput(msg.name, true).substring(0, 32),
      msg: processInput(msg.msg, true).substring(0, 1000)
    }

    socketIO.to(roomId).emit('msg', msgItem)
    if (roomId === 'demo') return
    // if (roomList[roomId].length == 1) {
    // console.log(msgItem.name + " is alone, start web push");
    // console.log("List of token", tokenList[roomId]);
    push.broadcast(tokenList[roomId], msgItem);
    // }
    // Log message into the database
    db.setRecord(msgItem)
  })

})

// Print room list to console
setInterval(() => {
  console.log('room list:', JSON.stringify(roomList))
}, 1000 * 30)

app.set('roomList', roomList)
app.use('/room', roomRouter)

app.get('/', (req, res) => {
  res.redirect('/room/@demo')
});
app.get('/filter', (req, res) => {
  const { q } = req.query
  res.send(processInput(q))
});

server.listen(config.app.port, () => {
  console.log(`server listening on port ${config.app.port}`)
})

function getCookie(cookie, name) {
  cookie = `; ${cookie}`
  const parts = cookie.split(`; ${name}=`)
  if (parts.length === 2) {
    try {
      return decodeURIComponent(parts.pop().split(';').shift())
    } catch {
      return 'wrong_name'
    }
  }
  return ''
}

function processInput(source, flag){
  if(flag) source = xss(source)

  return filter(source)
}

// counter

app.get('/count/@:name', async (req, res) => {
  const name = req.params.name;
  res.set({
    'content-type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  console.log(name, " is counted");
  counter.getCount(name).then(result => {
    console.log("Current count index: ", result);
    res.send({
      "name": name,
      "count": result,
    });
  });
});

app.post('/token', (req, res) => {
  let newToken = req.body;
  // console.log(newToken);
  let uid = req.cookies.uid;
  let roomId = req.cookies.roomId;
  if (roomId == undefined || uid == undefined) {
    console.log("Lack cookie info, user should refresh browser");
    return res.send("Cannot get your room or uid from cookie, token will be used next time");
  }
  if (newToken.endpoint != undefined) {
    if (tokenList[roomId] == undefined) {
      console.log("Add token to a new room: ", roomId)
      tokenList[roomId] = {}
    }
    if (tokenList[roomId][uid] == undefined) {
      console.log(`No token exits for ${uid}, so bind new token with him`);
    } else if (tokenList[roomId][uid] != newToken) {
      console.log(`Attention, ${uid} at ${roomId} update his token`);
    } else {
      console.log("Use firebase token");
      return res.send("Your token is already in cloud")
    }
    tokenList[roomId][uid] = newToken;
    db.sendToken(JSON.stringify(newToken), roomId, uid);
    console.log("get New token")
    socketIO.to(roomId).emit('sys', `${processInput(uid)} subscribed web-push notification. Please then refresh your page to make everything work!`)
    res.send("Good Token")
    app.set("room", "");
  } else {
    return res.send("Bad Token")
  }
})
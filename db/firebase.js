const config = require('config-yml');
const mail = require('../utils/sendmail');
// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
var firebase = require("firebase/app");
var online = {};
// Add the Firebase products that you want to use
require("firebase/firestore");
// Initialize Firebase
firebase.initializeApp(config.firebase);
// firebase.analytics();
var db = firebase.firestore();
// data manipulation

var docRef = db.collection("chatroom");

async function getRecord(roomId, limit = 100) {
    let result = [];
    await docRef.where("room", "==", roomId).orderBy("time","desc").limit(+limit).get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            // doc.data() is never undefined for query doc snapshots
            // console.log(doc.id, " => ", doc.data());
            result.push(doc.data());
        });
    }).catch(function (error) {
        console.log("Error getting documents: ", error);
    });
    return result;
}

function setRecord(msgItem) {
    msgItem.time = msgItem.ts;
    delete msgItem.ts;
    if ( msgItem.name != "Jing" && checkRoom(msgItem.room) ) {
        mail.notifyMe(msgItem);
    }
    docRef.add(msgItem)
}

function checkRoom(room) {
    if (online[room] == undefined) {
        online[room] = new Date();
        return true
    } else {
        let now = new Date();
        let diffms = now - online.room;
        if(diffms > 2e6) {
            online.room = now;
            return true;
        }
        return false;
    }
}
module.exports = {
    getRecord,
    setRecord
}


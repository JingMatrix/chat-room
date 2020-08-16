var firebase = require("firebase/app");
require("firebase/firestore");
var db = firebase.firestore();
var docRef = db.collection("visit").doc("count");
exports.getCount = async function (name) {
    var count = 1;
    var obj = {};
    await docRef.get().then(function (doc) {
        if (doc.exists) {
            // Here you can get your data
            // console.log("Document data:", doc.data());
            if (doc.data()[name] != undefined) {
                count = doc.data()[name] + 1;
            }
            obj[name] = count;
            docRef.set(obj, {
                merge: true
            });
        } else {
            // doc.data() will be undefined in this case
            console.log("No such document!");
        }
    });
    return count;
}
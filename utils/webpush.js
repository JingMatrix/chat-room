const webpush = require('web-push');
const {
    compile
} = require('ejs');

// VAPID keys should only be generated only once.
// const vapidKeys = webpush.generateVAPIDKeys();

// webpush.setGCMAPIKey('<Your GCM API Key Here>');
webpush.setVapidDetails(
    '...',
    '#you public Vapid key',
    '#you private Vapid key'
);

// This is the same output of calling JSON.stringify on a PushSubscription

function broadcast(tokens, msgItem) {
    if (tokens == undefined) {
        console.log("No good tokens found");
        return 0;
    }
    for (const [uid, subscription] of Object.entries(tokens)) {
        if (uid == msgItem.uid) {
            continue;
        }
        if (subscription.endpoint != undefined) {
            console.log("Broadcast to ", uid)
            webpush.sendNotification(subscription, JSON.stringify(msgItem)).then(() => console.log("success")).catch(err => console.log(err));
        }
    }

}
module.exports = {
    broadcast
}
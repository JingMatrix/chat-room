/*
 *
 *  Push Notifications codelab
 *  Copyright 2015 Google Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 */

/* eslint-env browser, serviceworker, es6 */

'use strict';

/* eslint-disable max-len */

const applicationServerPublicKey = '#your public Vapid key';

/* eslint-enable max-len */
var url = "https://jingmatrix.github.io/private/";

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');
    console.log(`[Service Worker] Push had this data: "${event.data.text()}"`);
    const msgItem = JSON.parse(event.data.text())
    const title = msgItem.msg;
    const options = {
        body: msgItem.name,
        icon: 'https://jingmatrix.github.io/assets/favicon.ico',
        badge: 'https://jingmatrix.github.io/assets/favicon.ico'
    };
    url = `https://peaceful-basin-72806.herokuapp.com/room/@${msgItem.room}?title=Jing%27s%20Chat-Room`
    clients.matchAll().then(function (clientList) {
        console.log("Clients number: ", clientList.length)
        if (clientList.length == 0) {
            event.waitUntil(self.registration.showNotification(title, options));
        }
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.focused) {
                console.log("Use is chatting, no need for notification")
                break;
            }
            if (client.url == url ) {
                client.focus();
            } else {
                clients.openWindow(url);
            }
            event.waitUntil(self.registration.showNotification(title, options));
        }
    });
});

self.onnotificationclick = function (event) {
    console.log('On notification click: ', event.notification.tag);
    event.notification.close();

    // This looks to see if the current is already open and
    // focuses if it is
    event.waitUntil(clients.matchAll({
        type: "window"
    }).then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url == url )
                return client.focus();
        }
        if (clients.openWindow)
            return clients.openWindow(url);
    }));
};

self.addEventListener('pushsubscriptionchange', function (event) {
    console.log('[Service Worker]: \'pushsubscriptionchange\' event fired.');
    const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey);
    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        })
        .then(function (newSubscription) {
            // TODO: Send to application server
            fetch("/token", {
                method: "post",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription
                })
            });
            console.log('[Service Worker] New subscription: ', newSubscription);
        })
    );
});

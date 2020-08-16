const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function notifyMe(msgItem) {
  let msg = {
    from: 'your seeting',
    to: 'your setting',
    subject: msgItem.name + ' at ' + msgItem.room + ' wants to chat with you',
    text: msgItem.msg,
  };
    sgMail.send(msg);
}

module.exports = {
  notifyMe
}
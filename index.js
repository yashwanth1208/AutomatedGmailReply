// Importing required packages
const { google } = require("googleapis");

// Importing credentials from credentials.js
const {
  CLIENT_ID,
  CLEINT_SECRET,
  REDIRECT_URI,
  REFRESH_TOKEN,
} = require("./credentials");

// Initializing OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLEINT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Keeping track of users already replied to using repliedUsers
const repliedUsers = new Set();

// Checking for new emails and send replies
async function checkEmailsAndSendReplies() {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Getting the list of unread messages
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });
    const messages = res.data.messages;

    if (messages && messages.length > 0) {
      // Iterating through unread messages
      for (const message of messages) {
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
        });
        // Extracting necessary email details
        const from = email.data.payload.headers.find(
          (header) => header.name === "From"
        );
        const toHeader = email.data.payload.headers.find(
          (header) => header.name === "To"
        );
        const Subject = email.data.payload.headers.find(
          (header) => header.name === "Subject"
        );
        const From = from.value;
        const toEmail = toHeader.value;
        const subject = Subject.value;
        console.log("email come From", From);
        console.log("to Email", toEmail);
        // Checking if the user has already been replied to
        if (repliedUsers.has(From)) {
          console.log("Already replied to : ", From);
          continue;
        }
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: message.threadId,
        });

        const replies = thread.data.messages.slice(1);

        if (replies.length === 0) {
          // Reply to the email.
          await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: await createReplyRaw(toEmail, From, subject),
            },
          });

          // Adding a label to the email.
          const labelName = "onVacation_AutoReply";
          await gmail.users.messages.modify({
            userId: "me",
            id: message.id,
            requestBody: {
              addLabelIds: [await createLabelIfNeeded(labelName)],
            },
          });

          console.log("Sent reply to :", From);
          // Add the user to replied users set
          repliedUsers.add(From);
        }
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Createing reply in base64EncodedEmail format
async function createReplyRaw(from, to, subject) {
  const emailContent = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\nThanks for reaching out! I'm currently away on vacation and will get back to you as soon as I return.`;
  const base64EncodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return base64EncodedEmail;
}

// Create a Label for emails if it doesn't exist
async function createLabelIfNeeded(labelName) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels;

  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    return existingLabel.id;
  }

  // Create the label if it doesn't exist.
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  return newLabel.data.id;
}

function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
setInterval(checkEmailsAndSendReplies, getRandomInterval(45, 120) * 1000);



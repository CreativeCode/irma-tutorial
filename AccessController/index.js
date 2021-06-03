const express = require('express');
const session = require('express-session');
const IrmaBackend = require('@privacybydesign/irma-backend');

// Express.js setup
const app = express();
const port = 3000;

// NOTE: The settings here are not suitable for production. Ensure you are
// aware of how your session storage solution works and how to configure it for
// your production needs
app.use(session({
    secret: 'cookie-secret',
}));

// Irma server setup
const irmaServer = new IrmaBackend('http://localhost:8088', {
    serverToken: 'token_value',
});

app.get('/', (req, res) => {
    console.log("verifying authentication with: ", req.session);
    if (req.session.isVerified) {
        // User has previously been checked, streamline the process now
        res.sendStatus(201).end();
    } else if (req.session.irmaSessionToken) {
        // User has not yet completed the check, but has started a session
        // here we check whether that session was successfull.
        irmaServer.getSessionResult(req.session.irmaSessionToken)
        .then((result) => {
            if (result.status == "DONE" && result.proofStatus == "VALID") {
                req.session.isVerified = true;
                res.sendStatus(201).end();
            } else {
                console.log('user did not successfully complete irma session');
                res.sendStatus(403).end();
            }
        })
        .catch((e) => {
            // On error, log that error, then deny access as that is the safest thing to do
            console.log(e);
            console.log('something failed with the  irma session, denying access.');
            res.sendStatus(403).end();
        });
    } else {
        // User hasn't even started an irma session yet, so they definitely won't have access.
        res.sendStatus(403).end();
    }
});

app.get('/startAuth', (req, res) => {
    console.log("starting session");
    // Start an irma session for the user
    irmaServer.startSession({
        "@context": "https://irma.app/ld/request/disclosure/v2",
        "disclose": [
            [
                [{type: "pbdf.gemeente.personalData.over18", value: "Yes"}],
                [{type: "pbdf.pbdf.idin.over18", value: "yes"}],
                [{type: "pbdf.pbdf.ageLimits.over18", value: "yes"}],
            ]
        ],
    })
    .then(({sessionPtr, token})=>{
        // Send session pointer to frontend, and store token for later
        req.session.irmaSessionToken = token
        res.send(sessionPtr).end();
    })
    .catch((e) => {
        // An error occured.
        console.log(`Error ${e} when starting session`);
        res.sendStatus(500).end();
    });
});

app.listen(port, () => {
    console.log(`Listening at localhost:${port}`);
});
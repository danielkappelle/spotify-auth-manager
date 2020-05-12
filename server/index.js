const { MongoClient } = require('mongodb');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const axios = require('axios').default;
const querystring = require('querystring');
const moment = require('moment');

const app = express();

const url = `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}`;

const config = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
};

MongoClient.connect(url, {
  useUnifiedTopology: true
}, function (err, client) {
  if (err) return console.error(err);
  console.log('Connected to database');
  const db = client.db('auth');
  const collection = db.collection('auth');

  app.use(bodyParser.json());
  app.use(cors());

  app.get('/getConfig', (req, res) => {
    res.json({clientId: config.clientId, redirectUri: config.redirectUri});
  });
  
  app.get('/callback', async (req, res) =>  {
    const code = req.query.code;
    const buff = Buffer.from(req.query.state, 'base64');
    const state = JSON.parse(buff.toString('ascii'));
    const pass = await bcrypt.hash(state.pass, saltRounds);

    const tokens = await getAccessToken(code);
    
    const record = await collection.insertOne({
      user: state.user,
      pass,
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      expires: moment().add(tokens.expires_in, 'seconds').toDate(),
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      createdAt: new Date()
    });

    // res.redirect(state.callback);
    res.json(record);
  });

  app.get('/accessToken', async (req, res) => {
    const authB64 = req.header('Authorization').match(/Basic (.*)$/)[1];
    const buff = Buffer.from(authB64, 'base64');
    const auth = buff.toString('ascii').split(':');
    const user = auth[0];
    const pass = auth[1];

    const record = await collection.findOne({user: user});

    // Verify password
    if (!await bcrypt.compare(pass, record.pass)) {
      res.status(401);
      res.send('Password incorrect');
      return
    }

    let accessToken = record.accessToken;

    if (moment(record.expires).isBefore(moment().subtract(10, 'minutes'))) {
      // Update token
      const tokens = await refreshToken(record.refreshToken);
      accessToken = tokens.access_token;

      await collection.updateOne({id: record.id}, {
        expires: moment().add(tokens.expires_in, 'seconds').toDate(),
        accessToken: accessToken,
        tokenType: tokens.token_type,
        scope: tokens.scope
      });
    }

    res.json({accessToken, expires: record.expires, scope: record.scope});
  });

  app.listen(3000, function () {
    console.log('Listening on 3000');
  });
});

async function getAccessToken(code) {
  const buff = Buffer.from(`${config.clientId}:${config.clientSecret}`);
  const authB64 = buff.toString('base64');

  const res = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri
  }),{
    headers: {
      Authorization: `Basic ${authB64}`
    }
  });

  return res.data;
}

async function refreshToken(token) {
  const buff = Buffer.from(`${config.clientId}:${config.clientSecret}`);
  const authB64 = buff.toString('base64');

  const res = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token: token
  }),{
    headers: {
      Authorization: `Basic ${authB64}`
    }
  });

  return res.data;
}
/**
 * Created by liekkas on 16/4/28.
 */
const path = require('path');
const express = require('express');
//const bodyParser = require('body-parser');
const _ = require('lodash');
import fs from 'fs'

const host = 'localhost'
const port = 6666

const app = express();

//app.use(bodyParser.urlencoded({ extended: true }));
//app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");

  console.log('>>> handle an question!uri:', req.url, ' method:', req.method);
  next();
});

app.get('/pili/role/small/:name', function (req, res) {
  var filePath = 'pili/images/role/small/' + res.params.name + '.gif'
  fs.exists(filePath, exists =>
    res.sendfile(exists ? filePath : '')
  )
})


app.listen(port, host, function (err) {
  if (err) {
    console.log(err);
    return;
  }

  console.log(`Listening at http://${host}:${port}`);
});

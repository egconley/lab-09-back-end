'use strict';
// 3rd party dependencies
require('dotenv').config();
const express = require('express');
const pg = require('pg');
const superagent = require('superagent');
const cors = require('cors');

// application constants
const app = express();
const PORT = process.env.PORT;
app.use(cors());

// DB setup
const client = new pg.Client(process.env.DATABASE_URL);
client.on('err', err => { throw err; });
// table name: location_table

// Route Definitions
app.get('/location', locationHandler);
app.get('/weather', weatherHandler);
app.get('/location_table', tableHandler);
app.use('*', notFoundHandler);
app.use(errorHandler);

let locations = {};

function locationHandler(request,response) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;
  console.log(locations[url]);
  if ( locations[url] ) {
    console.log(url);
    response.send(locations[url]);
  }
  else {
    console.log('THE URL',url);
    superagent.get(url)
      .then(data => {
        const geoData = data.body;
        const location = new Location(request.query.data, geoData);
        let latitude = location.latitude;
        let longitude = location.longitude;
        let place_id = location.place_id;
        let SQL = `INSERT INTO location_table (latitude, longitude, place_id) VALUES ($1, $2, $3) RETURNING *`;
        let safeValues = [latitude, longitude, place_id];
        client.query(SQL, safeValues).then( results => {
          response.status(200).json(results);
        }).catch( err => console.error(err));
        locations[url] = location;
        response.send(location);
      })
      .catch( () => {
        errorHandler(`So sorry, something went wrong. url: ${url}`, request, response);
      });
  }
}



function tableHandler(req, res) {
  let SQL = `SELECT * FROM location_table`;
  client.query(SQL)
    .then( results => {
      res.status(200).json(results.rows);
    })
    .catch( err => console.err(err));
}

function Location(query, geoData) {
  this.search_query = query;
  this.formatted_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lng;
  this.place_id = geoData.results[0].place_id;
}

function weatherHandler(request,response) {

  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

  superagent.get(url)
    .then( data => {
      const weatherSummaries = data.body.daily.data.map(day => {
        return new Weather(day);
      });
      response.status(200).json(weatherSummaries);
    })
    .catch( () => {
      errorHandler(`So sorry, something went wrong. url: ${url}`, request, response);
    });
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

function notFoundHandler(request,response) {
  response.status(404).send('huh?');
}

function errorHandler(error,request,response) {
  response.status(500).send(error);
}

client.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`listening on ${PORT}`);
    })
  })
  .catch(err => {
    throw `PG startup error ${err.message}`
  })

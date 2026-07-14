const googleMapsScraper = require('./googleMaps.scraper');

const scrapers = {
  'Google Maps': googleMapsScraper,
  // More scrapers can be added here later (e.g. 'Justdial', 'Sulekha')
};

function getScraper(sourceName) {
  return scrapers[sourceName] || null;
}

module.exports = { getScraper };

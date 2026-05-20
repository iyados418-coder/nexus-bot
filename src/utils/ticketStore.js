const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('./logger');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

function loadTickets() {
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const raw = fs.readFileSync(TICKETS_FILE, 'utf8');
      const data = JSON.parse(raw);
      const coll = new Collection();
      for (const [key, val] of Object.entries(data)) {
        coll.set(key, val);
      }
      logger.info(`Loaded ${coll.size} tickets from storage`);
      return coll;
    }
  } catch (err) {
    logger.error(`Failed to load tickets: ${err.message}`);
  }
  return new Collection();
}

function saveTickets(tickets) {
  try {
    const obj = {};
    for (const [key, val] of tickets) {
      obj[key] = val;
    }
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    logger.error(`Failed to save tickets: ${err.message}`);
  }
}

module.exports = { loadTickets, saveTickets };

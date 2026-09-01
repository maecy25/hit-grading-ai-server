require('../../config');

const knex = require('knex');

const user = process.env.DB_USER
const pass = process.env.DB_PASSWORD
const host = process.env.DB_HOST
const port = process.env.DB_PORT
const dbname = process.env.DB_NAME

const db = knex({
    client: 'pg',
    connection: `postgresql://${user}:${pass}@${host}:${port}/${dbname}`,
    searchPath: `${process.env.DB_SEARCH_PATH}`.split(',')
});

module.exports = db;
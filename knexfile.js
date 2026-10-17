require('./config');

const user = process.env.DB_USER
const pass = process.env.DB_PASSWORD
const host = process.env.DB_HOST
const port = process.env.DB_PORT
const dbname = process.env.DB_NAME
const sslmode = process.env.DB_SSLMODE || (process.env.NODE_ENV === 'production' ? 'require' : 'disable')
const ssl = sslmode === 'disable' ? false : {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
}

module.exports = {
    client: 'pg',
    connection: {
        host,
        port,
        user,
        password: pass,
        database: dbname,
        ssl
    },
    searchPath: `${process.env.DB_SEARCH_PATH}`.split(','),
    migrations: {
        directory: './src/database/migrations',
        tableName: 'migrations'
    },
    seeds: {
        directory: './src/database/migrations/seeds',
    },
}

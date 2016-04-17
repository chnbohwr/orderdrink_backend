var production_sql_data = {
	dbname:process.env.OPENSHIFT_APP_NAME,
	user:process.env.OPENSHIFT_MYSQL_DB_USERNAME,
	password:process.env.OPENSHIFT_MYSQL_DB_PASSWORD,
	host:process.env.OPENSHIFT_MYSQL_DB_HOST,
    port:process.env.OPENSHIFT_MYSQL_DB_PORT,
	dialect: 'mysql'
};

var dev_sql_data = {
    dbname:'orderdrink',
	user:'root',
	password:undefined,
	host:'localhost',
    port:'3306',
	dialect: 'mysql'
};

var dev_enviroment_data = {
    ip: '127.0.0.1',
    port: '8888'
    
}

var production_enviroment_data = {
    ip: process.env.OPENSHIFT_NODEJS_IP,
    port: process.env.OPENSHIFT_NODEJS_PORT
};

module.exports = {
    production: {
        env: production_enviroment_data,
        sql: production_sql_data
    },
    dev: {
        env: dev_enviroment_data,
        sql: dev_sql_data
    }
};
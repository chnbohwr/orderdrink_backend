var data = {
	dbname:process.env.OPENSHIFT_APP_NAME,
	user:process.env.OPENSHIFT_MYSQL_DB_USERNAME,
	password:process.env.OPENSHIFT_MYSQL_DB_PASSWORD,
	host:process.env.OPENSHIFT_MYSQL_DB_HOST,
    port:process.env.OPENSHIFT_MYSQL_DB_PORT,
	dialect: 'mysql'
};

module.exports = data;
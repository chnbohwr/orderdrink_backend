var Sequelize = require('sequelize');
//load config file
var config = require('../config.js');


var sql_config, export_dat = {};

if (process.env.OPENSHIFT_APP_NAME) {
    sql_config = config.production.sql;
} else {
    sql_config = config.dev.sql;
}

var sequelize = new Sequelize(sql_config.dbname, sql_config.user, sql_config.password, {
    host: sql_config.host,
    port: sql_config.port,
    dialect: sql_config.dialect,
    logging: false
});

export_dat.sequelize = sequelize;

export_dat.Menu = sequelize.define('menu', {
    name: Sequelize.STRING,
    list: Sequelize.TEXT
});

export_dat.User = sequelize.define('user', {
    facebook_id: Sequelize.STRING,
    email: Sequelize.STRING,
    nickname: Sequelize.STRING,
    link: Sequelize.STRING,
    locale: Sequelize.STRING,
    token: Sequelize.STRING,
    favoriteCompany: Sequelize.TEXT,
    avatar: Sequelize.STRING,
    avatar_thumb: Sequelize.STRING,
    background: Sequelize.STRING,
    password: Sequelize.STRING,
});

export_dat.Comment = sequelize.define('comment', {
    user_id: Sequelize.INTEGER,
    shop_id: Sequelize.INTEGER,
    message: Sequelize.STRING,
    star: Sequelize.INTEGER,
});

export_dat.Report = sequelize.define('report', {
    option: Sequelize.INTEGER,
    message: Sequelize.STRING,
    user_id: Sequelize.INTEGER
});


export_dat.Shop = sequelize.define('shop', {
    company_id: Sequelize.INTEGER,
    company_name: Sequelize.STRING,
    name: Sequelize.STRING,
    address: Sequelize.STRING,
    city: Sequelize.STRING,
    lat: Sequelize.STRING,
    lng: Sequelize.STRING,
    phone: Sequelize.STRING,
    menu_id: Sequelize.INTEGER
});

export_dat.Company = sequelize.define('company', {
    name: Sequelize.STRING,
    menu_id: Sequelize.INTEGER
});

module.exports = export_dat;
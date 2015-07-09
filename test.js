var loki = require('lokijs')
var lokidb = new loki('shop.json');
//import sequlize
var Sequelize = require('sequelize');
var SqlConfig = require('./sqlconfig.js');

var shop, company, menu, user, comment, report;


var sequelize = new Sequelize(SqlConfig.dbname, SqlConfig.user, SqlConfig.password, {
    host: SqlConfig.host,
    dialect: SqlConfig.dialect
});

var Shop = sequelize.define('shop', {
    company_id:Sequelize.INTEGER ,
    company_name:Sequelize.STRING,
    name:Sequelize.STRING,
    address:Sequelize.STRING,
    city:Sequelize.STRING,
    lat:Sequelize.STRING,
    lng:Sequelize.STRING,
    phone:Sequelize.STRING,
    menu_id:Sequelize.INTEGER 
});

var Company = sequelize.define('company',{
    name:Sequelize.STRING,
    menu_id:Sequelize.INTEGER
});


sequelize.sync().then(initialLokidb);


function initialLokidb() {
    lokidb.loadDatabase({}, function () {
        shop = lokidb.getCollection('shop');
        company = lokidb.getCollection('company');
        start();
    });
}

function start(){
    var shops = shop.find();
    var companys = company.find();
    console.log(shops.length,companys.length)
    companys.forEach(companysync);
    shops.forEach(shopsync);
}

function companysync(company_data){
    Company.build(company_data).save();
    checkSync();
}

function shopsync(shop_data){
    Shop.build(shop_data).save();
    checkSync();
}

var timeout;

function checkSync(){
    if(timeout){
        clearTimeout(timeout);
    }
    
    timeout = setTimeout(function(){
        console.log('all finish');
    },1000)
}

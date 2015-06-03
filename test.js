var loki = require('lokijs')
var lokidb = new loki('mydatabase.json');
var shop, company, menu;
console.log('initial lokijs Database success');
lokidb.loadDatabase({}, function () {
    shop = lokidb.getCollection('shop');
    company = lokidb.getCollection('company');
    menu = lokidb.getCollection('menu');

    if (shop === null) {
        shop = lokidb.addCollection('shop');
    }
    if (company === null) {
        company = lokidb.addCollection('company');
    }
    if (menu === null) {
        menu = lokidb.addCollection('menu');
    }

    console.log('load shop items', shop.idIndex.length);
    console.log('load company items', company.idIndex.length);
    console.log('load menu items', menu.idIndex.length);
});
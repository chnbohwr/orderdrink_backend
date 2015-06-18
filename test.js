var loki = require('lokijs')
var lokidb = new loki('shop.json');
var userdb = new loki('user.json');

var shop, company, menu,user,comment,report;
lokidb.loadDatabase({}, function () {
    console.log('initial lokijs Database success');

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
userdb.loadDatabase({}, function () {
    user = userdb.getCollection('user');
    comment = userdb.getCollection('comment');
    report = userdb.getCollection('report');
    if (comment === null) {
        comment = userdb.addCollection('comment');
    }
    if (user === null) {
        user = userdb.addCollection('user');
    }
    if (report === null) {
        report = userdb.addCollection('report');
    }
    console.log('load user items', user.idIndex.length);
    console.log('load comment items', comment.idIndex.length);
    console.log('load report items', report.idIndex.length);
});
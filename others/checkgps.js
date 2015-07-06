var loki = require('lokijs')
var lokidb = new loki('mydatabase.json');
var https = require('https');
var webdriverio = require('webdriverio');
var client = webdriverio.remote();

var shop, company, menu, shops;
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
    shops = shop.find();
    initWebDriver();
});

function initWebDriver() {
    client.init().url('https://www.google.com.tw/maps/', initialSeleniumOk);
}

var index = 0;

function initialSeleniumOk() {
    if (index > (shops.length - 1)) {
        console.log('process end all finish');
        return;
    }
    console.log('now shop id ', index);
    //if has google gps ;
    if (shops[index].googlegps) {
        console.log('this shop has updated');
        index += 1;
        setTimeout(initialSeleniumOk, 10);
        return;
    }
    var address = shops[index].address;
    client.setValue('#searchboxinput', address).click('.searchbutton').pause(2000).execute('return location.href', function (err, data) {
        if (data) {
            var url_window = decodeURIComponent(data.value);
            console.log(url_window);
            var latlng = url_window.match(/\w+.\w+,\w+.\w+/)[0];
            if (latlng) {
                var array_latlng = latlng.split(',');
                shops[index].lat = parseFloat(array_latlng[0]);
                shops[index].lng = parseFloat(array_latlng[1]);
                shops[index].googlegps = true;
                console.log('update shop geolocation,', shops[index]);
                lokidb.save();
            }
            index += 1;
            setTimeout(initialSeleniumOk, 500);
            return;
        }
    });
}
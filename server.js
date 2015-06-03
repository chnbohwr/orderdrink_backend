//  OpenShift sample Node application
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var loki = require('lokijs')
var lokidb = new loki('mydatabase.json');

/**
 *  Define the sample application.
 */
var SampleApp = function () {

    //  Scope.
    var self = this;
    var shop, company, menu;



    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function () {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function () {
        if (typeof self.zcache === "undefined") {
            self.zcache = {
                'index.html': ''
            };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function (key) {
        return self.zcache[key];
    };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function (sig) {
        if (typeof sig === "string") {
            console.log('%s: Received %s - terminating sample app ...',
                Date(Date.now()), sig);
            process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()));
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function () {
        //  Process on exit and signals.
        process.on('exit', function () {
            self.terminator();
        });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function (element, index, array) {
            process.on(element, function () {
                self.terminator(element);
            });
        });
    };

    self.initialDatabase = function () {
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
    };

    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function () {
        app.use(bodyParser.json()); // to support JSON-encoded bodies
        app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
            extended: true
        }));
        app.get('/api/location/', getShopInfoByLocation);
        app.get('/api/shop/:shop_id/menu/', getMenuByShopId);
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function () {
        self.setupVariables();
        //self.populateCache();
        self.setupTerminationHandlers();
        self.initialDatabase();
        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function () {
        //  Start the app on the specific interface (and port).
        app.listen(self.port, self.ipaddress, function () {
            console.log('%s: Node server started on %s:%d ...',
                Date(Date.now()), self.ipaddress, self.port);
        });
    };

    function getShopInfoByLocation(req, res) {
        console.time('locationFindShop');
        console.log(req.body);
        var lat = req.query.lat || 0;
        var lng = req.query.lng || 0;
        var offset = req.query.offset || 0;
        var return_list = shop.chain().find().sort(sortByLocation).offset(offset).limit(30).data();

        function sortByLocation(obj1, obj2) {
            var dif_obj1 = Math.abs(obj1.lat - lat) + Math.abs(obj1.lng - lng);
            var dif_obj2 = Math.abs(obj2.lat - lat) + Math.abs(obj2.lng - lng);
            if (dif_obj1 > dif_obj2) {
                return 1;
            }
            if (dif_obj1 < dif_obj2) {
                return -1;
            }
            return 0;
        }
        console.timeEnd('locationFindShop');
        res.json(return_list);
    }

    function getMenuByShopId(req, res) {
        var shop_id = req.params.shop_id;
        console.log(shop_id);
        var shop_data = shop.get(shop_id);
        console.log(shop_data);
        res.json({});
    }

}; /*  Sample Application.  */





/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
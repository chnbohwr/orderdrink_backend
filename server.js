'use strict'
//  OpenShift sample Node application
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var loki = require('lokijs');
var lokidb = new loki('mydatabase.json');
var uuid = require('node-uuid');
var sha256 = require('sha256');

/**
 *  Define the sample application.
 */
var SampleApp = function () {

    var self = this;
    var shop, company, menu, user, comment, report;

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function () {
        //檢查有沒有設定環境常數，如果沒有就用指定的
        self.ipaddress = process.env.IP || "127.0.0.1";
        self.port = process.env.PORT || 8080;
    };

    /**
     *  快取一些資料，未來後台管理介面要使用網站會需要用到
     */
    self.populateCache = function () {
        //如果沒有zcache就先做個初始化的出來
        if (typeof self.zcache === "undefined") {
            self.zcache = {
                'index.html': ''
            };
        }

        //把檔案讀取成字串先存進去記憶體
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
     *  設定關閉程式的接收資訊，把檔案放在雲端平台的時候方便管理
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

    //初始化database 
    self.initialDatabase = function () {
        lokidb.loadDatabase({}, function () {
            console.log('initial lokijs Database success');

            shop = lokidb.getCollection('shop');
            company = lokidb.getCollection('company');
            menu = lokidb.getCollection('menu');
            user = lokidb.getCollection('user');
            comment = lokidb.getCollection('comment');
            report = lokidb.getCollection('report');

            if (shop === null) {
                shop = lokidb.addCollection('shop');
            }
            if (company === null) {
                company = lokidb.addCollection('company');
            }
            if (menu === null) {
                menu = lokidb.addCollection('menu');
            }
            if (comment === null) {
                comment = lokidb.addCollection('comment');
            }
            if (user === null) {
                user = lokidb.addCollection('user');
            }
            if (report === null) {
                report = lokidb.addCollection('report');
            }

            console.log('load shop items', shop.idIndex.length);
            console.log('load company items', company.idIndex.length);
            console.log('load menu items', menu.idIndex.length);
            console.log('load user items', user.idIndex.length);
            console.log('load comment items', comment.idIndex.length);
            console.log('load report items', report.idIndex.length);

        });
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

    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function () {
        app.use(bodyParser.json()); // to support JSON-encoded bodies
        app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
            extended: true
        }));
        app.use(accewssOrigin);
        app.get('/api/location/', checkToken, getShopInfoByLocation);
        app.get('/api/shop/:shop_id/menu/', checkToken, getMenuByShopId);
        app.post('/signup/', signup);
        app.post('/login/', login);
    };

    function getShopInfoByLocation(req, res) {
        console.time('locationFindShop');
        var lat = req.query.lat || 0;
        var lng = req.query.lng || 0;
        var offset = req.query.offset || 0;
        console.log('getShopInfoByLocation', req.query);
        var return_list = shop.chain().find().sort(sortByLocation).offset(offset).limit(30).data();
        //根據GPS資訊重新排列
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
        var shop_data = shop.get(shop_id);
        var menu_id = shop_data.menu;

        //取不到商店的 menu 就去取得公司
        if (!menu_id) {
            var company_data = company.get(shop.company_id);
            menu_id = company_data.menu;
        }

        //如果有取得menuid 從 menu資料庫拉資料出來
        if (menu_id) {
            var menu_data = menu.get(menu_id);
        } else {
            //如果沒有店家資料就
            res.status(404).send('no menu found')
        }
    }

    function signup(req, res) {
        var email = req.body.email;
        var password = req.body.password;
        //check email password
        if (!email || !password) {
            res.status(401).send('no email or password')
        }
        //find user 
        var user_data = user.findOne({
            email: email
        });
        //如果使用者已經存在就不給通過
        if (user_data) {
            res.status(402).send('can not signup')
        } else {
            //make uuid token
            var uuid_token = uuid.v4();
            var encryt_password = sha256(password);
            var user_data = {
                email: email,
                password: encryt_password,
                token: uuid_token
            };
            //存進資料庫裡面
            user.insert(user_data);
        }
    }

    function login(req, res) {
        var email = req.body.email;
        var password = req.body.password;
        //check email password
        if (!email || !password) {
            loginerror();
        }
        var user_data = user.findOne({
            email: email
        });

        //檢查使用者資料有沒有找到
        if (user_data) {
            //配對密碼有無錯誤
            var encryt_password = sha256(password);
            //正確會回傳TOKEN
            if (user_data.password === encryt_password) {
                res.json({
                    token: user_data.token
                });
            } else {
                loginerror();
            }
        } else {
            loginerror();
        }

        //任何錯誤就回傳401 登入失敗
        function loginerror() {
            res.status(401).send('login error');
        }
    }

    //上傳評論
    function uploadComment(req, res) {
        //尋找使用者ID
        var user_token = req.headers.token;
        var user_data = user.findOne({
            token: user_token
        });
        var user_id = user_data.$loki;
        //評論文字
        var comment_text = req.body.comment_text;
        //店家ID
        var shop_id = req.body.shop_id;
        //星星評分數目
        var star = req.body.star;

    }

    //刪除評論
    function deleteComment(req, res) {
        var comment_id = req.body.comment_id;

    }

    //檢查token
    function checkToken(req, res, next) {
        var token = req.headers.token;
        var users = user.find({
            token: token
        });
        if (users.length) {
            next();
        } else {
            res.status(401).send('no permission');
        }
    }

    // Add headers
    function accewssOrigin(req, res, next) {
        // Website you wish to allow to connect
        res.setHeader('Access-Control-Allow-Origin', '*');
        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
        // Set to true if you need the website to include cookies in the requests sent
        // to the API (e.g. in case you use sessions)
        res.setHeader('Access-Control-Allow-Credentials', true);
        // Pass to next layer of middleware
        next();
    }


}; /*  Sample Application.  */


/**
 * @class DatabaseBackup
 */
var DatabaseBackup = function () {
    /**
     * 啟動監看db自動備份
     * @method start
     */
    this.start = function start() {

    };
    /**
     * @private
     * @method copyFile
     * @param {string} source
     * @param {string} target
     * source and trarget means file path
     */
    function copyFile(source, target) {
        return new Promise(function (resolve, reject) {
            var rd = fs.createReadStream(source);
            rd.on('error', reject);
            var wr = fs.createWriteStream(target);
            wr.on('error', reject);
            wr.on('close', resolve);
            rd.pipe(wr);
        });
    }
};


/**
 *  主程式
 */
var mainApp = new SampleApp();
mainApp.initialize();
mainApp.start();
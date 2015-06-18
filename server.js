'use strict'
//  OpenShift sample Node application
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var loki = require('lokijs');
var lokidb = new loki('shop.json');
var userdb = new loki('user.json');
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
        self.ipaddress = process.env.IP || "orderdrink.ddns.net";
        //                self.ipaddress = process.env.IP || "127.0.0.1";
        self.port = process.env.PORT || 14789;
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
        app.get('/api/shop/:shop_id/', checkToken, getShopData);
        app.get('/api/shop/:shop_id/comment/', checkToken, getShopComment);
        app.post('/api/shop/:shop_id/comment/', checkToken, createShopComment);
        app.get('/api/user/:user_id/', checkToken, getUserData);
        app.post('/api/profile/', checkToken, setProfile);
        app.post('/api/uploadPhoto/', checkToken, uploadPhoto);
        app.post('/api/report/', checkToken, reportApp);
        app.post('/signup/', signup);
        app.post('/login/', login);
        app.post('/login/facebook/', loginByFacebook);
        app.get('/', test)
    };

    function test(req, res) {
        res.send('ok it\'s work');
    }

    function uploadPhoto(req, res) {
        console.log(req.files);
        res.send('ok')
    }

    function reportApp(req, res) {
        var data = req.body;
        data.user_id = req.user_data.$loki;
        data.create_on = new Date();
        report.insert(data);
        res.send('ok');
    }

    function setProfile(req, res) {
        var nickname = req.body.nickname;
        req.user_data.nickname = nickname;
        res.send('ok');
    }

    function getShopInfoByLocation(req, res) {
        console.log('user:' + req.user_data.nickname + 'find shops by location');
        var lat = req.query.lat || 0;
        var lng = req.query.lng || 0;
        //檢查是不是自串要把字串轉變成浮點數
        if (typeof (lat) !== 'number') {
            lat = parseFloat(lat);
            lng = parseFloat(lng);
        }
        var offset = req.query.offset || 0;
        console.log('getShopInfoByLocation', req.query);
        var return_list = shop.chain().find().sort(sortByLocation).offset(offset).limit(30).data();
        //        var return_list = shop.chain().find().sort(sortByLocation).offset(offset).data();
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

        res.json(return_list);
    }

    //取得使用者的資料
    function getUserData(req, res) {
        var user_id = parseInt(req.params.user_id);
        console.log('user:' + req.user_data.nickname + 'get user data:' + user_id);
        var user_data = user.get(user_id);
        //如果找到資料了
        if (user_data) {
            var data = {
                nickname: user_data.nickname
            };
            res.json(data);
        } else {
            res.status(404).send('can not find user');
        }
    }

    function getMenuByShopId(req, res) {
        var shop_id = parseInt(req.params.shop_id);

        var shop_data = shop.get(shop_id);

        var menu_id = shop_data.menu_id;


        //取不到商店的 menu 就去取得公司
        if (!menu_id) {

            var company_data = company.get(shop_data.company_id);

            menu_id = company_data.menu_id;
        }

        //如果有取得menuid 從 menu資料庫拉資料出來
        if (menu_id) {
            var menu_data = menu.get(menu_id);
            res.json(menu_data);
        } else {
            //如果沒有店家資料就
            res.status(404).send('no menu found')
        }
    }

    //取得店家詳細資料
    function getShopData(req, res) {
        var shop_id = req.params.shop_id;
        console.log('user:' + req.user_data.nickname + 'get shop data:' + shop_id);
        var shop_data = shop.get(shop_id);
        res.json(shop_data);
    }

    function getShopComment(req, res) {

        var shop_id = req.params.shop_id;
        console.log('user:' + req.user_data.nickname + 'get shop comment:' + shop_id);
        var offset = req.params.offset;

        function sortByDatetime(obj1, obj2) {
            var diff = obj1.create_on - obj2.create_on;
            if (diff > 0) {
                return -1;
            } else if (diff < 0) {
                return 1;
            } else {
                return 0;
            }
        }
        var data = comment.chain().find({
            shop_id: shop_id
        }).sort(sortByDatetime).offset(offset).limit(30).data();
        console.log('getShopComment data', data);
        res.json(data);
    }

    function createShopComment(req, res) {

        var user_id = req.user_data.$loki
            //評論文字
        var message = req.body.message;
        //店家ID
        var shop_id = req.params.shop_id;
        //星星評分數目
        var star = req.body.star;

        console.log('user:' + req.user_data.nickname + 'send shop comment:' + shop_id);

        var object = {
            user_id: user_id,
            shop_id: shop_id,
            message: message,
            star: star,
            create_on: new Date()
        };

        comment.insert(object);
        userdb.save();
        res.json(object);
    }

    function signup(req, res) {
        var nickname = req.body.nickname;
        var email = req.body.email;
        var password = req.body.password;
        //check email password
        if (!nickname || !email || !password) {
            res.status(401).send('no email or password');
            //記得要return 不然會繼續執行下面的程式
            return;
        }
        //find user 
        var user_data = user.findOne({
            email: email
        });
        //如果使用者已經存在就不給通過
        if (user_data) {
            res.status(401).send('can not signup')
        } else {
            //make uuid token
            var uuid_token = uuid.v4();
            var encryt_password = sha256(password);
            var user_data = {
                nickname: nickname,
                email: email,
                password: encryt_password,
                token: uuid_token
            };
            //存進資料庫裡面
            user.insert(user_data);
            //回傳 token 回去
            userdb.save();
            res.json({
                token: uuid_token
            });
        }
    }

    function login(req, res) {
        var email = req.body.email;
        var password = req.body.password;
        //check email password
        if (!email || !password) {
            loginerror();
            return;
        }
        var user_data = user.findOne({
            email: email
        });

        //檢查使用者資料有沒有找到
        if (user_data) {
            //如果是FACEBOOK 註冊帳號的話 就不能用普通的方式登入了
            if (user_data.facebook_id) {
                loginerror();
                return;
            }
            //配對密碼有無錯誤
            var encryt_password = sha256(password);
            //正確會回傳TOKEN
            if (user_data.password === encryt_password) {
                res.json(user_data);
                return;
            } else {
                loginerror();
                return;
            }
        } else {
            loginerror();
            return;
        }

        //任何錯誤就回傳401 登入失敗
        function loginerror() {
            res.status(401).send('login error');
        }
    }

    //從 FACEBOOK 登入的
    //    {"id":"106191296386841","email":"imffqsz_zuckerson_1434104811@tfbnw.net","first_name":"Margaret","gender":"female","last_name":"Zuckerson","link":"https://www.facebook.com/app_scoped_user_id/106191296386841/","locale":"zh_TW","middle_name":"Amihgiabdejd","name":"Margaret Amihgiabdejd Zuckerson","timezone":0,"updated_time":"2015-06-12T10:27:01+0000","verified":false}

    function loginByFacebook(req, res) {
        //尋找有沒有使用者的facebook_id符合
        var user_data = user.findOne({
            facebook_id: req.body.id
        });

        //有在我的server裡面有資訊就直接回傳 沒有的話幫他註冊以後回傳
        if (user_data) {
            res.json(user_data);
        } else {
            var data = {
                facebook_id: req.body.id,
                email: req.body.email,
                nickname: req.body.name,
                link: req.body.link,
                locale: req.body.locale,
                token: uuid.v4()
            };
            user.insert(data);
            userdb.save();
            console.log('user:' + data.nickname + ' register');
            res.json(data);
        }
    }


    //刪除評論
    function deleteComment(req, res) {
        var comment_id = req.body.comment_id;
        var dbcomment = comment.get(comment_id);
        if (dbcomment) {
            dbcomment.remove = true;
            userdb.save();
        }
    }

    //檢查token
    function checkToken(req, res, next) {
        var token = req.headers.token;
        var user_data = user.findOne({
            token: token
        });
        if (user_data) {
            //pass data to next middleware
            req.user_data = user_data;
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
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,token');
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
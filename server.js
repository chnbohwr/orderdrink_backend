'use strict'
//  OpenShift sample Node application
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var multer = require('multer')
var fs = require('fs');
var gm = require('gm').subClass({
    imageMagick: true
});
var loki = require('lokijs');
var lokidb = new loki('shop.json');
var uuid = require('node-uuid');
var sha256 = require('sha256');

//import sequlize
var Sequelize = require('sequelize');
var SqlConfig = require('./sqlconfig.js');

/**
 *  Define the sample application.
 */
var SampleApp = function () {

    var self = this;
    var shop, company, Menu, User, Comment, Report;
    var pictureDir = './pic';

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function () {
        //檢查有沒有設定環境常數，如果沒有就用指定的
        self.ipaddress = process.env.IP || "orderdrink.ddns.net";
        //                self.ipaddress = process.env.IP || "127.0.0.1";
        self.port = process.env.PORT || 14789;

        if (!fs.existsSync(pictureDir)) {
            fs.mkdirSync(pictureDir);
        }
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

        function initialMariadb() {
            var sequelize = new Sequelize(SqlConfig.dbname, SqlConfig.user, SqlConfig.password, {
                host: SqlConfig.host,
                dialect: SqlConfig.dialect
            });

            Menu = sequelize.define('menu', {
                name: Sequelize.STRING,
                list: Sequelize.TEXT
            });

            User = sequelize.define('user', {
                facebook_id: Sequelize.STRING,
                email: Sequelize.STRING,
                nickname: Sequelize.STRING,
                link: Sequelize.STRING,
                locale: Sequelize.STRING,
                token: Sequelize.STRING,
                favoriteCompany: Sequelize.TEXT,
                avatar: Sequelize.STRING,
                avatar_thumb: Sequelize.STRING,
                background: Sequelize.STRING
            });

            Comment = sequelize.define('comment', {
                user_id: Sequelize.INTEGER,
                shop_id: Sequelize.INTEGER,
                message: Sequelize.STRING,
                star: Sequelize.INTEGER,
            });

            sequelize.sync().then(initialLokidb);
        }

        function initialLokidb() {
            //initial lokidb shop data 
            lokidb.loadDatabase({}, function () {

                shop = lokidb.getCollection('shop');
                company = lokidb.getCollection('company');

                if (shop === null) {
                    shop = lokidb.addCollection('shop');
                }
                if (company === null) {
                    company = lokidb.addCollection('company');
                }

                console.log('load shop items', shop.idIndex.length);
                console.log('load company items', company.idIndex.length);

            });

            self.initializeServer();
        }

        initialMariadb();
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
        app.use(express.static('pic'));
        app.use(multer({
            dest: './uploads/'
        }))
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
        app.get('/api/comapnies/', checkToken, getComapnies)
        app.get('/api/user/:user_id/', checkToken, getUserData);
        app.post('/api/profile/', checkToken, setProfile);
        app.post('/api/uploadAvatar/', checkToken, uploadAvatar);
        app.post('/api/uploadBackground', checkToken, uploadBackground);
        app.post('/api/uploadFavorite/', checkToken, uploadFavorite)
        app.post('/api/report/', checkToken, reportApp);
        //app.post('/signup/', signup);
        //app.post('/login/', login);
        app.post('/login/facebook/', loginByFacebook);
        app.get('/', test)
    };

    function test(req, res) {
        res.send('ok it\'s work');
    }


    function uploadFavorite(req, res) {
        var user = req.user_data;
        var array = req.body.favoriteCompany;
        if (Array.isArray(array)) {
            user.favoriteCompany = JSON.stringify(array);
            user.save();
            res.json(user);
        } else {
            res.status(400).send('type error')
        }
        console.log('使用者:' + req.user_data.nickname + '更新喜好列表');
    }

    function getComapnies(req, res) {
        var companies = company.find();
        res.json(companies);
    }


    function uploadAvatar(req, res) {
        var filename = req.files.files.name;
        var newpath = './pic/' + filename;
        gm(req.files.files.path).resize(600).quality(50).strip().write(newpath + '_big.jpg', function (err) {
            if (!err) {
                gm(req.files.files.path).resize(200).quality(30).strip().write(newpath + '_small.jpg', function (err) {
                    if (!err) {
                        var user_data = req.user_data;
                        if (user_data.avatar) {
                            fs.unlink('./pic/' + user_data.avatar, function () {});
                            fs.unlink('./pic/' + user_data.avatar_thumb, function () {});
                        }
                        user_data.avatar_thumb = filename + '_small.jpg';
                        user_data.avatar = filename + '_big.jpg';
                        user_data.save();
                        console.log('user_data', user_data);
                        fs.unlink(req.files.files.path, function () {});
                        res.json(user_data);
                    }
                });
            } else {
                res.status(400).send('no ok');
            }
        })
    }


    function uploadBackground(req, res) {
        var filename = req.files.files.name;
        var newpath = './pic/' + filename;
        gm(req.files.files.path).resize(800).quality(50).strip().write(newpath + '_back.jpg', function (err) {
            if (!err) {
                var user_data = req.user_data;
                if (user_data.background) {
                    fs.unlink('./pic/' + user_data.background, function () {});
                }
                user_data.background = filename + '_back.jpg';
                user_data.save();
                console.log('user_data', user_data);
                fs.unlink(req.files.files.path, function () {});
                res.json(user_data);
            } else {
                res.status(400).send('no ok');
            }
        })
    }

    //todo
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
        req.user_data.save();
        res.send('ok');
    }

    function getShopInfoByLocation(req, res) {

        //前處理request資料
        console.log('使用者:' + req.user_data.nickname + '搜尋附近的店家');
        console.time('getShopInfoByLocation');
        var lat = req.query.lat || 0;
        var lng = req.query.lng || 0;
        var offset = req.query.offset || 0;

        //檢查是不是自串要把字串轉變成浮點數
        if (typeof (lat) !== 'number') {
            lat = parseFloat(lat);
            lng = parseFloat(lng);
            offset = parseInt(offset);
        }

        //檢查使用者有沒有設定過喜愛店家
        var favoriteCompany = JSON.parse(req.user_data.favoriteCompany);

        //過濾喜歡的店家
        function getFavorite(db_data) {
            var comp_id = db_data.company_id;
            var index = favoriteCompany.indexOf(comp_id);
            if (index === -1) {
                return false;
            } else {
                return true;
            }
        }

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

        var return_list = shop.chain().where(getFavorite).sort(sortByLocation).offset(offset).limit(30).data();

        res.json(return_list);
        console.timeEnd('getShopInfoByLocation');
    }

    
    function getUserData(req, res) {
        var user_id = parseInt(req.params.user_id);
        User.findById(user_id).then(function (user_data) {
            console.log(user_data);
            //如果找到資料了
            if (user_data) {
                var data = {
                    id:user_data.id,
                    nickname: user_data.nickname,
                    avatar_thumb: user_data.avatar_thumb,
                    avatar: user_data.avatar,
                    background:user_data.background
                };
                res.json(data);
            } else {
                res.status(404).send('can not find user');
            }
        });
    }

    function getMenuByShopId(req, res) {

        var shop_id = parseInt(req.params.shop_id);

        var shop_data = shop.get(shop_id);

        var menu_id = shop_data.menu_id;


        //取不到商店的 menu 就去取得公司
        if (!menu_id) {
            var company_data = company.get(shop_data.company_id)
            menu_id = company_data.menu_id;
        }

        //如果有取得menuid 從 menu資料庫拉資料出來
        if (menu_id) {
            Menu.findById(menu_id).then(function (data) {
                data.list = JSON.parse(data.list);
                res.json(data);
            });
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

    //todo
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

    //todo
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

    //todo
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
        User.findOne({
            where: {
                token: token
            }
        }).then(function (data) {
            if (data) {
                req.user_data = data;
                //pass data to next middleware
                next();
            } else {
                res.status(401).send('no permission');
            }
        });
    }

    //從 FACEBOOK 登入的
    //    {"id":"106191296386841","email":"imffqsz_zuckerson_1434104811@tfbnw.net","first_name":"Margaret","gender":"female","last_name":"Zuckerson","link":"https://www.facebook.com/app_scoped_user_id/106191296386841/","locale":"zh_TW","middle_name":"Amihgiabdejd","name":"Margaret Amihgiabdejd Zuckerson","timezone":0,"updated_time":"2015-06-12T10:27:01+0000","verified":false}

    function loginByFacebook(req, res) {
        //初始化喜好店家
        var comps = company.find();
        var favcomp = [];
        for (var i in comps) {
            favcomp.push(comps[i].$loki);
        }
        //尋找或是創建
        User.findOrCreate({
            where: {
                facebook_id: req.body.id
            },
            defaults: {
                email: req.body.email,
                nickname: req.body.name,
                link: req.body.link,
                locale: req.body.locale,
                token: uuid.v4(),
                //喜歡的店家
                favoriteCompany: JSON.stringify(favcomp)
            }
        }).spread(function (userdata, create) {
            res.json(userdata);
        });
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
 *  主程式
 */
var mainApp = new SampleApp();
mainApp.initialize();
mainApp.start();
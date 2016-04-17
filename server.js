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
var uuid = require('node-uuid');
var sha256 = require('sha256');
var Sequelize = require('sequelize');

//load config file
var config = require('./config.js');

// define classname
var Shop, Company, Menu, User, Comment, Report, shops, companies;
var pictureDir = './pic';


/**
 *  Initializes the sample application.
 */
function initialize() {
    
    if (!fs.existsSync(pictureDir)) {
        fs.mkdirSync(pictureDir);
    }
    
    //setupTerminationHandlers();
    //讀取db
    initialDatabase();
    //設定路由
    initializeServer();
    //啟動
    start();
};


//var terminator = function () {
//    if (typeof sig === "string") {
//        console.log('%s: Received %s - terminating sample app ...',
//            Date(Date.now()), sig);
//        process.exit();
//    }
//    console.log('%s: Node server stopped.', Date(Date.now()));
//};
//
//
///**
// *  設定關閉程式的接收資訊，把檔案放在雲端平台的時候方便管理
// */
//var setupTerminationHandlers = function () {
//    //  Process on exit and signals.
//    process.on('exit', function () {
//        terminator();
//    });
//
//    // Removed 'SIGPIPE' from the list - bugz 852598.
//    ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
//     'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
//    ].forEach(function (element, index, array) {
//        process.on(element, function () {
//            terminator();
//        });
//    });
//};

//初始化database 
var initialDatabase = function () {    
    var sql_config;
    
    if (process.env.OPENSHIFT_APP_NAME) {
        sql_config = config.production.sql;
    } else {
        sql_config = config.dev.sql;
    }
    
    var sequelize = new Sequelize(sql_config.dbname, sql_config.user, sql_config.password, {
        host: sql_config.host,
        port: sql_config.port,
        dialect: sql_config.dialect
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
        background: Sequelize.STRING,
        password: Sequelize.STRING,
    });

    Comment = sequelize.define('comment', {
        user_id: Sequelize.INTEGER,
        shop_id: Sequelize.INTEGER,
        message: Sequelize.STRING,
        star: Sequelize.INTEGER,
    });

    Report = sequelize.define('report', {
        option: Sequelize.INTEGER,
        message: Sequelize.STRING,
        user_id: Sequelize.INTEGER
    });


    Shop = sequelize.define('shop', {
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

    Company = sequelize.define('company', {
        name: Sequelize.STRING,
        menu_id: Sequelize.INTEGER
    });

    sequelize.sync().then(function () {
        Shop.findAll().then(function (data) {
            shops = data;
        });

        Company.findAll().then(function (data) {
            companies = data;
        });
    });

};

/**
 *  Start the server (starts up the sample application).
 */
var start = function () {
    var ip, port;
    if(process.env.OPENSHIFT_APP_NAME) {
        ip = config.production.env.ip;
        port = config.production.env.port;
    } else {
        ip = config.dev.env.ip;
        port = config.dev.env.port;
    }
    //  Start the app on the specific interface (and port).
    app.listen(port, ip, function () {
        console.log('%s: Node server started on %s:%d ...',
            Date(Date.now()), ip, port);
    });
};

/**
 *  Initialize the server (express) and create the routes and register
 *  the handlers.
 */
var initializeServer = function () {
    app.use(express.static('pic'));
    app.use(multer({
        dest: './uploads/'
    }))
    app.use(bodyParser.json()); // to support JSON-encoded bodies
    app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
        extended: true
    }));
    app.use(accewssOrigin);
    app.get('/api/location/', softCheckToken, getShopInfoByLocation);
    app.get('/api/shop/:shop_id/menu/', softCheckToken, getMenuByShopId);
    app.get('/api/shop/:shop_id/', softCheckToken, getShopData);
    app.get('/api/shop/:shop_id/comment/', softCheckToken, getShopComment);
    app.get('/api/comapnies/', softCheckToken, getComapnies)
    app.get('/api/user/:user_id/', softCheckToken, getUserData);
    app.post('/api/shop/:shop_id/comment/', checkToken, createShopComment);
    app.post('/api/profile/', checkToken, setProfile);
    app.post('/api/uploadAvatar/', checkToken, uploadAvatar);
    app.post('/api/uploadBackground', checkToken, uploadBackground);
    app.post('/api/uploadFavorite/', checkToken, uploadFavorite)
    app.post('/api/report/', checkToken, reportApp);
    app.post('/signup/', signup);
    app.post('/login/', login);
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
            fs.unlink(req.files.files.path, function () {});
            res.json(user_data);
        } else {
            res.status(400).send('no ok');
        }
    })
}

//todo
function reportApp(req, res) {
    var message = req.body.message;
    var option = req.body.option;
    var user_id = req.user_data.id;

    Report.create({
        user_id: user_id,
        message: message,
        option: option
    });

    res.sendStatus(200);
}


function setProfile(req, res) {
    var nickname = req.body.nickname;
    req.user_data.nickname = nickname;
    req.user_data.save();
    res.sendStatus(200);
}

function getShopInfoByLocation(req, res) {
    console.time('getShopInfoByLocation');
    var lat = req.query.lat || 0;
    var lng = req.query.lng || 0;
    var offset = req.query.offset || 0;
    var favoriteCompany = undefined;

    //檢查是不是自串要把字串轉變成浮點數
    if (typeof (lat) !== 'number') {
        lat = parseFloat(lat);
        lng = parseFloat(lng);
        offset = parseInt(offset);
    }
    
    // 如果有使用者資料才拿
    if (req.user_data) {
        favoriteCompany = JSON.parse(req.user_data.favoriteCompany);
    }
    

    //過濾喜歡的店家
    function getFavorite(db_data) {
        
        //如果沒有登入就預設每個店家都印出來
        if (!favoriteCompany) {
            return true;
        }
        
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

    var newdata = shops.filter(getFavorite).sort(sortByLocation).splice(0, 30);

    console.log('newdata.length', newdata.length, '  shops.length', shops.length);

    res.json(newdata);

    console.timeEnd('getShopInfoByLocation');
}


function getUserData(req, res) {
    var user_id = parseInt(req.params.user_id);
    User.findById(user_id).then(function (user_data) {
        //如果找到資料了
        if (user_data) {
            var data = {
                id: user_data.id,
                nickname: user_data.nickname,
                avatar_thumb: user_data.avatar_thumb,
                avatar: user_data.avatar,
                background: user_data.background
            };
            res.json(data);
        } else {
            res.status(404).send('can not find user');
        }
    });
}

function getMenuByShopId(req, res) {
    console.time('getMenuByShopId');
    var shop_id = parseInt(req.params.shop_id);
    var shop_data, company_data;

    for (var i in shops) {
        var shopnow = shops[i];
        if (shopnow.id === shop_id) {
            shop_data = shopnow;
            break;
        }
    }

    var menu_id = shop_data.menu_id;

    //取不到商店的 menu 就去取得公司
    if (!menu_id) {
        for (var j in companies) {
            var companynow = companies[j];
            if (companynow.id === shop_data.company_id) {
                company_data = companynow;
                menu_id = company_data.menu_id;
                break;
            }
        }
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

    console.timeEnd('getMenuByShopId');
}

//取得店家詳細資料
function getShopData(req, res) {
    var shop_id = req.params.shop_id;
    Shop.findById(shop_id).then(function (shop_data) {
        res.json(shop_data);
    });

}

//todo
function getShopComment(req, res) {

    var shop_id = req.params.shop_id;

    var offset = req.params.offset;

    Comment.findAll({
        where: {
            shop_id: shop_id
        },
        limit: 30,
        order: [['createdAt', 'DESC']]
    }).then(function (datas) {
        res.json(datas);
    });

}


function createShopComment(req, res) {

    var user_id = req.user_data.id;
    //評論文字
    var message = req.body.message;
    //店家ID
    var shop_id = req.params.shop_id;
    //星星評分數目
    var star = req.body.star;

    var object = {
        user_id: user_id,
        shop_id: shop_id,
        message: message,
        star: star
    };

    Comment.create(object).then(function (comment) {
        res.json(comment);
    });
}


function deleteComment(req, res) {
    var comment_id = req.body.comment_id;
    Comment.destroy({
        where: {
            id: comment_id
        }
    });
    res.sendStatus(200);
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

//不強制產生 error401 的檢查登入
function softCheckToken (req, res, next){
    var token = req.headers.token;
    
    //如果有 token 就直接用 checktoken 的功能
    if(token) {
        checkToken(req, res, next);
    } else {
        next();
    }
}

//從 FACEBOOK 登入的
//    {"id":"106191296386841","email":"imffqsz_zuckerson_1434104811@tfbnw.net","first_name":"Margaret","gender":"female","last_name":"Zuckerson","link":"https://www.facebook.com/app_scoped_user_id/106191296386841/","locale":"zh_TW","middle_name":"Amihgiabdejd","name":"Margaret Amihgiabdejd Zuckerson","timezone":0,"updated_time":"2015-06-12T10:27:01+0000","verified":false}

function loginByFacebook(req, res) {
    //初始化喜好店家
    var favcomp = [];
    for (var i in companies) {
        favcomp.push(companies[i].id);
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

//用使用者名稱密碼登入
function login(req, res) {
    var email = req.body.email;
    var password = sha256(req.body.password);
    User.findOne({
        where: {
            email: email
        }
    }).then(function (user_data) {
        if (user_data) {
            if (user_data.password === password) {
                res.json(user_data);
            } else {
                if (user_data.facebook_id) {
                    res.status(402).send('facebook');
                } else {
                    res.status(401).send('no permission');
                }
            }
        } else {
            res.status(400).send('no username');
        }

    });
}

//檢查 username 有沒有重複
function checkEmail(req, res) {

}

//註冊
function signup(req, res) {
    //初始化喜好店家
    var favcomp = [];
    for (var i in companies) {
        favcomp.push(companies[i].id);
    }

    var email = req.body.email;
    var nickname = req.body.nickname;
    var password = sha256(req.body.password);
    User.findOne({
        where: {
            email: email
        }
    }).then(function (user_data) {
        if (user_data) {
            if (user_data.facebook_id) {
                res.status(402).send('facebook');
            } else {
                res.status(403).send('user has reg');
            }
        } else {
            User.create({
                nickname: nickname,
                email: email,
                password: password,
                token: uuid.v4(),
                //喜歡的店家
                favoriteCompany: JSON.stringify(favcomp)
            }).then(function (user_data) {
                res.json(user_data);
            });
        }
    });
}

function forgetPassword(req, res) {

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


initialize();
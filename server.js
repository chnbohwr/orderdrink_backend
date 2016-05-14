'use strict'
//  OpenShift sample Node application
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var multer = require('multer');
var download = require('download-file');
var fs = require('fs');
var gm = require('gm').subClass({
    imageMagick: true
});
var uuid = require('node-uuid');
var sha256 = require('sha256');
var sqlModel = require('./model/sqlmodel.js');
var config = require('./config.js');

// define classname
var Shop, Company, Menu, User, Comment, Report, shops, companies;
var pictureDir = './pic/';


var white_list = ['/login/facebook/'];

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

//初始化database 
var initialDatabase = function () {
    
    Shop = sqlModel.Shop;
    Menu = sqlModel.Menu;
    Company = sqlModel.Company;
    Comment = sqlModel.Comment;
    User = sqlModel.User;
    Report = sqlModel.Report;

    sqlModel.sequelize.sync().then(function () {
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
    if (process.env.OPENSHIFT_APP_NAME) {
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
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(accewssOrigin);
    app.use(checkToken);
    app.use(logger);
    app.get('/api/location/', getShopInfoByLocation);
    app.get('/api/shop/:shop_id/menu/', getMenuByShopId);
    app.get('/api/shop/:shop_id/', getShopData);
    app.get('/api/shop/:shop_id/comment/', getShopComment);
    app.get('/api/comapnies/', getComapnies)
    app.get('/api/user/:user_id/', getUserData);
    app.post('/api/shop/:shop_id/comment/', createShopComment);
    app.post('/api/profile/', setProfile);
    //app.post('/api/uploadAvatar/', uploadAvatar);
    //app.post('/api/uploadBackground', uploadBackground);
    app.post('/api/uploadFavorite/', uploadFavorite)
    app.post('/api/report/', reportApp);
    //app.post('/signup/', signup);
    //app.post('/login/', login);
    app.post('/login/facebook/', loginByFacebook);
    app.post('/api/testToken/',testToken);
    app.get('/', test);
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
}

function getComapnies(req, res) {
    res.json(companies);
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


    res.json(newdata);

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

    if (req.method === 'GET') {
        if (token) {
            check(true);
        } else {
            next();
        }

    } else {
        //white list
        if (white_list.indexOf(req.url) > -1) {
            check(true);
        } else {
            check(false);
        }
    }

    function check(allow_pass) {
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
                if (allow_pass === true) {
                    next();
                } else {
                    res.status(401).send('no permission');
                }
            }
        });
    }

}

function logger(req, res, next) {
    var nickname;
    if (req.user_data) {
        nickname = req.user_data.nickname;
    } else {
        nickname = 'Anonymous';
    }

    console.log('Date: ' + new Date());
    console.log('User: ' + nickname);
    console.log('Token: ', req.headers.token);
    console.log('IP: ' + req.ip);
    console.log('Method: ' + req.method);
    console.log('Path: ' + req.url);
    console.log('======================================');
    next();
}

//test token 
function testToken(req, res) {
    var token = req.headers.token;
    if (token) {
        User.findOne({
            where: {
                token: token
            }
        }).then(function (user) {
            if (user) {
                res.status(200).send();
            } else {
                testError();
            }
        });
    } else {
        testError();
    }

    function testError() {
        res.status(401).send();
    }
}

/*從 FACEBOOK 登入的
{
  "picture": {
    "data": {
      "is_silhouette": false,
      "url": "https://scontent.xx.fbcdn.net/v/t1.0-1/p200x200/11406851_10152978155886375_2082500097674482510_n.jpg?oh=aff7f64b662e7772b938c5d660c5a556&oe=57A8D78C"
    }
  },
  "id": "1234",
  "name": "asdf",
  "email": "asdf@yahoo.com.tw",
  "cover": {
    "id": "1234",
    "offset_y": 30,
    "source": "https://scontent.xx.fbcdn.net/v/t1.0-9/p720x720/11426494_10152978155731375_4238593846195340341_n.jpg?oh=4bfd3d04ad5d143c75a126a55566d516&oe=57A644B5"
  }
}
*/

function loginByFacebook(req, res) {
    //初始化喜好店家
    var favcomp = [];
    var picture_url = req.body.picture.data.url;
    for (var i in companies) {
        favcomp.push(companies[i].id);
    }
    //尋找或是創建
    User.findOne({
        where: {
            facebook_id: req.body.id
        }
    }).then(function (userdata) {

        // 如果已經有了就更新，反之新增
        if (userdata) {
            userdata.name = req.body.name;
            userdata.email = req.body.email;
            userdata.locale = req.body.locale;
            userdata.link = req.body.link;
            downloadAvatar(userdata);
        } else {
            User.create({
                facebook_id: req.body.id,
                nickname: req.body.name,
                email: req.body.email,
                token: uuid.v4(),
                favoriteCompany: JSON.stringify(favcomp),
                locale: req.body.locale,
                link: req.body.link
            }).then(function (user_data, b) {
                downloadAvatar(user_data);
            });
        }
    });

    function downloadAvatar(userdata) {
        var options = {
            directory: pictureDir,
            filename: uuid.v4()
        };
        var thumb_filename = uuid.v4();
        userdata.avatar = options.filename;
        userdata.avatar_thumb = thumb_filename;
        userdata.save();
        download(picture_url, options, function (err) {
            if (err) {
                res.status(400).send('download avatar error');
            }
            //resize image
            gm(pictureDir + options.filename).resizeExact(50, 50).write(pictureDir + thumb_filename, function () {});
        });
        res.json(userdata);
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


initialize();
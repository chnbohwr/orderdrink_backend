    function signup(req, res) {
        var nickname = req.body.nickname;
        var email = req.body.email;
        var password = req.body.password;
        //check email password
        if (!nickname || !email || !password) {
            res.status(401).json({
                code: 0 //格式有問題
            });
            //記得要return 不然會繼續執行下面的程式
            return;
        }
        //find user 
        var user_data = user.findOne({
            email: email
        });
        //如果使用者已經存在就不給通過
        if (user_data) {
            if (user_data.facebook_id) {
                res.status(401).json({
                    code: 1 //使用臉書註冊的用戶
                });
            } else {
                res.status(401).json({
                    code: 2 //重複註冊了
                });
            }
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
                res.status(401).json({
                    code: 1
                });
                return;
            }
            //配對密碼有無錯誤
            var encryt_password = sha256(password);
            //正確會回傳TOKEN
            if (user_data.password === encryt_password) {
                res.json(user_data);
                return;
            } else {
                res.status(401).json({
                    code: 0
                });
                return;
            }
        } else {
            res.status(401).json({
                code: 0
            });
            return;
        }

        //任何錯誤就回傳401 登入失敗
        function loginerror() {
            res.status(401).send('login error');
        }
    }
var crypto = require('crypto')
var key = '7297815881928192'
var iv = new Buffer(16).fill(0);
var algorithm = 'aes-128-cbc'
var text = '049-2327011'
 
var cipher = crypto.createCipheriv(algorithm, key, iv)
var output = cipher.update(text, 'utf8', 'base64')
output += cipher.final('base64')

console.log(output);


var decipher = crypto.createDecipheriv(algorithm, key, iv);
var ouput2 = decipher.update(output,'base64','utf-8');
ouput2+= decipher.final('utf8');

console.log(ouput2);
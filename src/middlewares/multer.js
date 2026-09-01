require('../../config');
const multer = require('multer')
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync("public/tmp-files/")){
            fs.mkdirSync("public/tmp-files/", { recursive: true });
        }

        cb(null, 'public/tmp-files/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
    }
})

exports.upload = multer({ storage: storage })
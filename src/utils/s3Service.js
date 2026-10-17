require('../../config');

const { S3 } = require('@aws-sdk/client-s3');

const sharp = require('sharp');
const fs = require('fs');

exports.s3UploadBase64File = async (filename, fileBuf, filePath) => {
    const s3 = new S3({'region': process.env.AWS_BUCKET_REGION});

    // RESIZE IMAGE
    const newBuffer = await sharp(fileBuf).resize({height: 150, width: 350, fit: 'inside'}).withMetadata().toBuffer();

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: filePath + filename,
        Body: newBuffer,
        ContentEncoding: 'base64',
        ContentType: 'image/png'
    }

    return await s3.putObject(params);
}

exports.s3UploadFile = async (filePath, file, tmpOutput, reportType) => {
    const s3 = new S3({'region': process.env.AWS_BUCKET_REGION});

    let params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: filePath + file.originalname,
        ContentType: file.mimetype
    }

    const fileContent = fs.readFileSync(file.path)

    params.Body = await sharp(fileContent).resize(500,500, {fit: 'fill'}).jpeg({ mozjpeg: true, force: true }).withMetadata().toBuffer();

    
    return await s3.putObject(params);
}

exports.s3UploadBase64Photo = async (filename, fileBuf, filePath, isEdited) => {
    const s3 = new S3({'region': process.env.AWS_BUCKET_REGION});

    // RESIZE IMAGE
    const newBuffer = isEdited ? await sharp(fileBuf).withMetadata().toBuffer() : await sharp(fileBuf).resize(500,500, {fit: 'fill'}).jpeg({ mozjpeg: true, force: true }).withMetadata().toBuffer();

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: filePath + filename,
        Body: newBuffer,
        ContentType: 'image/jpeg'
    }

    return await s3.putObject(params);
}
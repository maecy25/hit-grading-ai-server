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
    const s3 = new S3({
        region: process.env.AWS_BUCKET_REGION
    });

    const key = filePath + file.originalname;

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        ContentType: 'image/jpeg'
    };

    const fileContent = fs.readFileSync(file.path);

    params.Body = await sharp(fileContent)
        .jpeg({ mozjpeg: true, force: true })
        .withMetadata()
        .toBuffer();

    await s3.putObject(params);

    const url = `https://${params.Bucket}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${key
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;

    return url;
};

exports.s3UploadBase64Photo = async (
    filename,
    fileBuf,
    filePath,
    isEdited
) => {
    const s3 = new S3({
        region: process.env.AWS_BUCKET_REGION
    });

    const newBuffer = isEdited
        ? await sharp(fileBuf).withMetadata().toBuffer()
        : await sharp(fileBuf)
            .jpeg({ mozjpeg: true, force: true })
            .withMetadata()
            .toBuffer();

    const key = 'public/uploaded-photos/' + filename;

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: newBuffer,
        ContentType: 'image/jpeg'
    };

    await s3.putObject(params);

    const url = `https://${params.Bucket}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${key
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;

    return url;
};


exports.s3DeleteDirectFile = async (filePath) => {
    const s3 = new S3({
        region: process.env.AWS_BUCKET_REGION
    });

    return await s3.send(
        new (require('@aws-sdk/client-s3').DeleteObjectCommand)({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: filePath
        })
    );
};

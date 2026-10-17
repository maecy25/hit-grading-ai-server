require('../../config');
const db = require('../database');
const sharp = require('sharp');
const { promisify } = require('util');
const heicConvert = require('heic-convert');



const fs = require('fs');

const s3Util = require('../utils/s3Service');

exports.checkTCG = async (req, res) => {
    await Promise.all(req.files.map(async (file) => {
        if (!fs.existsSync(file.path)) {
            return res.send({type: 'error', message: `File ${file.originalname} not found. Please re-upload image and try again.`});
        }
    }));

    const filePath = `public/tmp-files/`;

    //TRANSFER PHOTOS TO S3
    await Promise.all(
        req.files.map(async (photo) => {
            let photoFinalFileName = photo.originalname;
            const splitOGName = photo.originalname.split('.');
            const ogMimeType = photo.mimetype;

            if( !['image/jpeg', 'image/jpg'].includes(photo.mimetype) ){
                photoFinalFileName = photoFinalFileName.replace(splitOGName[splitOGName.length - 1], 'jpeg');
                photo.originalname = photoFinalFileName
                photo.mimetype = 'image/jpeg'

            }
                
            if( ['image/heic', 'image/heif'].includes(ogMimeType) ){
                const inputBuffer = await promisify(fs.readFile)(photo.path);
                const outputBuffer = await heicConvert({
                    buffer: inputBuffer,
                    format: 'JPEG',
                    quality: 0.5
                });

                await s3Util.s3UploadBase64Photo(photoFinalFileName, outputBuffer, filePath, false)
            } else {
                await s3Util.s3UploadFile(filePath, photo)
            }
            return fs.unlinkSync(photo.path);
        })
    )

    // const frontImage = req.files.find(file => file.originalname.includes('front_'));
    // const backImage = req.files.find(file => file.originalname.includes('back_'));
    // console.log(`http://localhost:3001/${frontImage.path}`)
    // const url = 'https://chck.ai/api/public/v1/gradings';
  
    // const payload = {
    //     external_ref: 'order-1042',
    //     front_image: { url: `http://localhost:3000${frontImage.path}` },
    //     back_image: { url: `http://localhost:3000${backImage.path}` }
    // };

    // try {
    //     const response = await fetch(url, {
    //     method: 'POST',
    //     headers: {
    //         'x-api-key': process.env.CHCK_API_KEY, // Access your environment variable
    //         'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify(payload)
    //     });

    //     if (!response.ok) {
    //         throw new Error(`HTTP error! Status: ${response.status}`);
    //     }

    //     const data = await response.json();
    //     console.log('Grading response:', data);
    //     return data;
    // } catch (error) {
    //     console.error('Error creating grading:', error);
    // }

    return res.send({ message: 'TCG checker is working' });
}


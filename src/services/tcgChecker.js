require('../../config');
const db = require('../database');
const sharp = require('sharp');
const { promisify } = require('util');
const heicConvert = require('heic-convert');

const fs = require('fs');

const s3Util = require('../utils/s3Service');


exports.checkTCG = async (req, res) => {
    const uploadedKeys = [];
    const filePath = 'public/tmp-files/';
    const files = req.files || [];

    let responseSent = false;

    try {
        // Validate uploaded files before processing.
        for (const file of files) {
            if (!fs.existsSync(file.path)) {
                return res.status(400).send({
                    type: 'error',
                    message: `File ${file.originalname} not found. Please re-upload image and try again.`
                });
            }
        }

        if (files.length === 0) {
            return res.status(400).send({
                type: 'error',
                message: 'Please upload the front and back images.'
            });
        }

        // Upload images to S3 and keep track of their object keys.
        const uploadedFiles = await Promise.all(
            files.map(async (photo) => {
                const originalName = photo.originalname;
                const originalMimeType = photo.mimetype;

                let photoFinalFileName = originalName;

                if (!['image/jpeg', 'image/jpg'].includes(originalMimeType)) {
                    const lastDot = originalName.lastIndexOf('.');

                    photoFinalFileName =
                        lastDot >= 0
                            ? originalName.substring(0, lastDot) + '.jpeg'
                            : originalName + '.jpeg';

                    photo.originalname = photoFinalFileName;
                    photo.mimetype = 'image/jpeg';
                }

                let url;
                let key;

                if (
                    ['image/heic', 'image/heif'].includes(
                        originalMimeType
                    )
                ) {
                    const inputBuffer = await promisify(fs.readFile)(
                        photo.path
                    );

                    const outputBuffer = await heicConvert({
                        buffer: inputBuffer,
                        format: 'JPEG',
                        quality: 0.8
                    });

                    // s3UploadBase64Photo uses this exact S3 key prefix.
                    key = `public/uploaded-photos/${photoFinalFileName}`;

                    url = await s3Util.s3UploadBase64Photo(
                        photoFinalFileName,
                        outputBuffer,
                        filePath,
                        false
                    );

                    uploadedKeys.push(key);
                } else {
                    key = `${filePath}${photo.originalname}`;

                    url = await s3Util.s3UploadFile(
                        filePath,
                        photo
                    );

                    uploadedKeys.push(key);
                }

                // Remove local temporary file after upload.
                try {
                    if (fs.existsSync(photo.path)) {
                        fs.unlinkSync(photo.path);
                    }
                } catch (cleanupError) {
                    console.error(
                        `Failed to remove temporary file ${photo.path}:`,
                        cleanupError
                    );
                }

                return {
                    originalName,
                    key,
                    url
                };
            })
        );

        // Match images by their original filenames.
        const frontImage = uploadedFiles.find(
            file => /^front_/i.test(file.originalName)
        );

        const backImage = uploadedFiles.find(
            file => /^back_/i.test(file.originalName)
        );

        if (!frontImage || !backImage) {
            return res.status(400).send({
                type: 'error',
                message: 'Both front and back images are required. Please upload both images.'
            });
        }

        // Send images to CHCK AI.
        const chckResponse = await fetch(
            'https://chck.ai/api/public/v1/gradings',
            {
                method: 'POST',
                headers: {
                    'x-api-key': process.env.CHCK_API_KEY,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    external_ref: 'order-1042',
                    front_image: {
                        url: frontImage.url
                    },
                    back_image: {
                        url: backImage.url
                    }
                })
            }
        );

        const data = await chckResponse.json();

        // Delete uploaded photos before saving or returning the result.
        const deletionResults = await Promise.allSettled(
            uploadedKeys.map(key =>
                s3Util.s3DeleteDirectFile(key)
            )
        );

        const failedDeletions = deletionResults
            .map((result, index) => ({
                result,
                key: uploadedKeys[index]
            }))
            .filter(item => item.result.status === 'rejected');

        if (failedDeletions.length > 0) {
            failedDeletions.forEach(({ key, result }) => {
                console.error(
                    `Failed to delete S3 object ${key}:`,
                    result.reason
                );
            });
        }

        if( data.status === 'complete'){
            // Save analysis to database.
            const sqlInsert = `
                INSERT INTO history_tbl
                    (tcg_type, card_name, card_code, chck_ai_data)
                VALUES (?, ?, ?, ?)
            `;
            console.log(data)
            const sqlValues = [
                data.certificate.card.brand,
                data.certificate.card.player,
                data.certificate.card.card_number,
                JSON.stringify(data)
            ];

            console.log(sqlValues)

            await db.raw(sqlInsert, sqlValues);
        }

        // Return result only after deletion has been attempted.
        return res.send({
            type: 'success',
            message: 'Success',
            data
        });

    } catch (error) {
        console.error('checkTCG error:', error);

        return res.status(500).send({
            type: 'error',
            message: 'An error occurred while analyzing your card. Please try again.'
        });

    } finally {
        // Retry deletion for any tracked S3 objects if an earlier step failed.
        // This also covers failures during analysis or database insertion.
        if (uploadedKeys.length > 0) {
            const cleanupResults = await Promise.allSettled(
                uploadedKeys.map(key =>
                    s3Util.s3DeleteDirectFile(key)
                )
            );

            cleanupResults.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.log(
                        `Final S3 cleanup failed for ${uploadedKeys[index]}:`,
                        result.reason
                    );
                }
            });
        }

        // Remove any remaining local temporary files.
        for (const file of files) {
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (cleanupError) {
                console.error(
                    `Failed to clean up temporary file ${file.path}:`,
                    cleanupError
                );
            }
        }
    }
};



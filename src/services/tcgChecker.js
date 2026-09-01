require('../../config');
const db = require('../database');
const fs = require('fs');

exports.checkTCG = async (req, res) => {
    await Promise.all(req.files.map(async (file) => {
        if (!fs.existsSync(file.path)) {
            return res.send({type: 'error', message: `File ${file.originalname} not found. Please re-upload image and try again.`});
        }
    }));

    const frontImage = req.files.find(file => file.originalname.includes('front_'));
    const backImage = req.files.find(file => file.originalname.includes('back_'));
    console.log(`http://localhost:3001/${frontImage.path}`)
    const url = 'https://chck.ai/api/public/v1/gradings';
  
    const payload = {
        external_ref: 'order-1042',
        front_image: { url: `http://localhost:3000${frontImage.path}` },
        back_image: { url: `http://localhost:3000${backImage.path}` }
    };

    try {
        const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-api-key': process.env.CHCK_API_KEY, // Access your environment variable
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Grading response:', data);
        return data;
    } catch (error) {
        console.error('Error creating grading:', error);
    }

    return res.send({ message: 'TCG checker is working' });
}


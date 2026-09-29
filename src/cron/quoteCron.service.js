const axios = require('axios');
const cron = require('node-cron');
const { Quote } = require('../models');

let apiRequestCounter = 0;

const fetchAndStoreQuotes = async () => {
    try {
        console.log('Fetching quotes from ZenQuotes...');

        apiRequestCounter++;
        console.log(`ZenQuotes API called ${apiRequestCounter} times since restart`);

        const response = await axios.get('https://zenquotes.io/api/quotes', {
            timeout: 10000
        });

        if (!Array.isArray(response.data)) {
            console.log('Invalid response format');
            return;
        }

        const formattedQuotes = response.data
            .filter(item => item.q)
            .map(item => ({
                author: item.a || null,
                quote: item.q.trim(),
                desc: item.h || null,
                character_count: parseInt(item.c) || item.q.length,
                req_count: 0,
                is_active: true
            }));

        if (formattedQuotes.length > 0) {
            await Quote.bulkCreate(formattedQuotes, {
                ignoreDuplicates: true
            });

            console.log(`${formattedQuotes.length} quotes processed.`);
        }

    } catch (error) {
        console.error('Error fetching quotes:', error.message);
    }
};

// Cron job → runs every 1 minute
const startQuoteCron = () => {
    cron.schedule('* * * * *', async () => {
        await fetchAndStoreQuotes();
    });

    console.log('Quote Cron started (every 1 minute)');
};

module.exports = startQuoteCron;
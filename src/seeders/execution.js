/*[TIPS]
    || => || First Modify The MySQL to send large packet write data. 
    || => || common locations include /etc/my.cnf, /etc/mysql/my.cnf, or my.ini. 
    || => || You may need root or administrator privileges to edit this file.
    || => || Increate SHOW VARIABLES LIKE 'max_allowed_packet';
    || => || sudo systemctl restart mysql
    || => || sudo service mysql restart
*/


const fs = require('fs');
const path = require('path');

async function executeSQLDump(sequelize) {
    let arr = ['roles.sql', 'departments.sql', 'timezones.sql', 'languages.sql'];

    for (let i = 0; i < arr.length; i++) {
        await new Promise((resolve) => {
            setTimeout(async () => {
                const sqlFilePath = path.join(__dirname, `./dumps/${arr[i]}`);
                const sql = fs.readFileSync(sqlFilePath, 'utf-8');
                await sequelize.query(sql);
                resolve();
            }, 4000);
        });
    };
};


module.exports = async function initialSeedData(sequelize) {
    try {
        await executeSQLDump(sequelize);
        console.log('Data Seeding Completed.');
    } catch (error) {
        console.log('Error While Initial Seeding ::-> ', error);
        return;
    };
};




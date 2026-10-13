const { adminAuthService } = require('../services/Admin');
const config = require('../config/config');

async function createSuperAdmin(){
    const adminObj = {
        name : config.SUPER_ADMIN_NAME,
        email : config.SUPER_ADMIN_EMAIL,
        role_id : config.SUP_ADM_ROLE_ID,
        department_id : config.ADM_DEPT_ID
    };
    try{
        await adminAuthService.createAdminUser(adminObj);
        console.log(`Super Admin created. A temporary password has been emailed to ${config.SUPER_ADMIN_EMAIL}.`);
        process.exit(0);
    }catch(error){
        console.log('Error : Super Admin Creation Failed', error.message);
        process.exit(1);
    };
};

/* Create Super Admin */
createSuperAdmin();

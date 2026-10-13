const dotenv = require('dotenv')
const path = require('path')
const Joi = require('joi')

dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });

const roleId = () => Joi.number().integer().positive().required();

const envVarsSchema = Joi.object()
    .keys({
        APP_NAME: Joi.string().required().description('Your Application Name'),
        NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
        PORT: Joi.number().default(5000),
        SQL_LOGGING: Joi.boolean().default(false).description('log every SQL query (local debugging only)'),
        TRUST_PROXY: Joi.number().integer().min(0).default(0).description('Number of reverse proxies in front of the app (1 behind nginx)'),

        CENTRAL_MYSQL_HOST: Joi.string().required().description('Central Mysql Host'),
        CENTRAL_MYSQL_USER: Joi.string().required().description('Central Mysql User'),
        CENTRAL_MYSQL_PASSWORD: Joi.string().allow('').required().description('Central Mysql Password'),
        CENTRAL_MYSQL_DB: Joi.string().required().description('Central Mysql DB'),
        CENTRAL_MYSQL_PORT: Joi.number().integer().default(3306).description('Central Mysql Port'),

        JWT_SECRET: Joi.string().min(32).required().description('JWT secret key (at least 32 characters)'),
        JWT_ACCESS_EXPIRATION_DAYS: Joi.number().positive().required().description('days after which user access tokens expire'),
        ADMIN_JWT_EXPIRATION: Joi.string().default('5d').description('lifetime of admin access tokens, e.g. 12h or 5d'),

        OTP_LENGTH: Joi.number().integer().min(4).max(10).default(6).description('digits in email OTP codes'),
        OTP_EXPIRATION_MINUTES: Joi.number().integer().positive().default(10).description('minutes an OTP stays valid'),
        OTP_MAX_ATTEMPTS: Joi.number().integer().positive().default(5).description('wrong guesses allowed before an OTP is invalidated'),
        OTP_RESEND_COOLDOWN_SECONDS: Joi.number().integer().min(0).default(60).description('minimum seconds between OTP emails to the same address'),
        PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES: Joi.number().integer().positive().default(15).description('minutes a verified password-reset token stays valid'),
        AUTH_RATE_LIMIT_MAX: Joi.number().integer().positive().default(20).description('failed auth requests allowed per IP per 15 minutes'),

        SMTP_HOST: Joi.string().required().description('server that will send the emails'),
        SMTP_PORT: Joi.number().required().description('port to connect to the email server'),
        SMTP_SECURE: Joi.boolean().default(false).description('true for implicit TLS (port 465), false for STARTTLS'),
        SMTP_USERNAME: Joi.string().required().description('username for email server'),
        SMTP_PASSWORD: Joi.string().required().description('password for email server'),
        EMAIL_FROM: Joi.string().required().description('the from field in the emails sent by the app'),
        ADMIN_NOTIFICATION_EMAIL: Joi.string().email().required().description('receives new-signup notifications'),
        SUPPORT_EMAIL: Joi.string().email().required().description('support address shown in emails to users'),

        DEFAULT_API_DATA_LIMIT: Joi.number().default(15),
        ACCESSDOMAINS: Joi.string().required().description('All allowed origin URLs, comma separated'),
        DEFAULT_TIMEZONE: Joi.string().default('UTC').description('Default Timezone for application'),

        STRIPE_SECRET_KEY: Joi.string().required().description('Stripe Secret Credential'),
        STRIPE_WEBHOOK_SECRET_INTENT_CHARGE: Joi.string().required().description('Stripe webhook signing secret'),
        STRIPE_PRICE_STARTER: Joi.string().required().description('Stripe price ID for the starter package'),
        STRIPE_PRICE_AUTHOR: Joi.string().required().description('Stripe price ID for the author package'),
        STRIPE_PRICE_PRO_AUTHOR: Joi.string().required().description('Stripe price ID for the pro_author package'),
        STRIPE_PRICE_STUDIO: Joi.string().required().description('Stripe price ID for the studio package'),

        SUP_ADM_ROLE_ID: roleId(),
        USR_ROLE_ID: roleId(),
        SENIOR_EDITOR_ROLE_ID: roleId(),
        ASSISTANT_EDITOR_ROLE_ID: roleId(),

        ADM_DEPT_ID: Joi.string(),
        SUPER_ADMIN_NAME: Joi.string(),
        SUPER_ADMIN_EMAIL: Joi.string(),

        GEMINI_API_KEY: Joi.string().required(),
        GROK_API_KEY: Joi.string().required(),
        OPENAI_API_KEY: Joi.string().required(),
        GOWINSTON_API_KEY: Joi.string().required(),

        GROK_MODEL: Joi.string().required().description('xAI model for fact-check, consistency and summaries'),
        GEMINI_TEXT_MODEL: Joi.string().required().description('Gemini model for chapter generation and TAV'),
        GEMINI_IMAGE_MODEL: Joi.string().required().description('Gemini model for book cover images'),
        GEMINI_IMAGE_SIZE: Joi.string().valid('1K', '2K', '4K').default('1K').description('book cover resolution; larger sizes cost more'),
        GEMINI_FACT_CHECK_MODEL: Joi.string().required().description('Gemini model used with Google Search grounding'),
        OPENAI_CHAT_MODEL: Joi.string().required().description('OpenAI model for the writing assistant chat'),

        FIREBASE_PROJECT_ID: Joi.string().required(),
        FIREBASE_PRIVATE_KEY_ID: Joi.string().required(),
        FIREBASE_PRIVATE_KEY: Joi.string().required(),
        FIREBASE_CLIENT_EMAIL: Joi.string().required(),
        FIREBASE_CLIENT_ID: Joi.string().required(),

        STORAGE_PATH: Joi.string().description('Absolute path to uploaded files storage directory'),
    })
    .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);


if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
    app_name: envVars.APP_NAME,
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    trustProxy: envVars.TRUST_PROXY,
    sqlLogging: envVars.SQL_LOGGING,
    databases: {
        central: {
            db: envVars.CENTRAL_MYSQL_DB,
            port: envVars.CENTRAL_MYSQL_PORT,
            host: envVars.CENTRAL_MYSQL_HOST,
            user: envVars.CENTRAL_MYSQL_USER,
            passwd: envVars.CENTRAL_MYSQL_PASSWORD
        },
    },
    jwt: {
        secret: envVars.JWT_SECRET,
        accessExpirationDays: envVars.JWT_ACCESS_EXPIRATION_DAYS,
        adminExpiration: envVars.ADMIN_JWT_EXPIRATION,
    },
    otp: {
        length: envVars.OTP_LENGTH,
        expirationMinutes: envVars.OTP_EXPIRATION_MINUTES,
        maxAttempts: envVars.OTP_MAX_ATTEMPTS,
        resendCooldownSeconds: envVars.OTP_RESEND_COOLDOWN_SECONDS,
        resetTokenExpirationMinutes: envVars.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES,
    },
    authRateLimitMax: envVars.AUTH_RATE_LIMIT_MAX,
    email: {
        smtp: {
            host: envVars.SMTP_HOST,
            port: envVars.SMTP_PORT,
            secure: envVars.SMTP_SECURE,
            requireTLS: !envVars.SMTP_SECURE,
            auth: {
                user: envVars.SMTP_USERNAME,
                pass: envVars.SMTP_PASSWORD,
            },
        },
        from: envVars.EMAIL_FROM,
        adminNotificationTo: envVars.ADMIN_NOTIFICATION_EMAIL,
        supportAddress: envVars.SUPPORT_EMAIL,
    },
    accessDomains: envVars.ACCESSDOMAINS,
    defaultLimit: envVars.DEFAULT_API_DATA_LIMIT,
    DEFAULT_TIMEZONE: envVars.DEFAULT_TIMEZONE,

    STRIPE_SECRET_KEY: envVars.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET_INTENT_CHARGE: envVars.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE,
    stripePrices: {
        starter: envVars.STRIPE_PRICE_STARTER,
        author: envVars.STRIPE_PRICE_AUTHOR,
        pro_author: envVars.STRIPE_PRICE_PRO_AUTHOR,
        studio: envVars.STRIPE_PRICE_STUDIO,
    },

    SUP_ADM_ROLE_ID: envVars.SUP_ADM_ROLE_ID,
    USR_ROLE_ID: envVars.USR_ROLE_ID,
    SENIOR_EDITOR_ROLE_ID: envVars.SENIOR_EDITOR_ROLE_ID,
    ASSISTANT_EDITOR_ROLE_ID: envVars.ASSISTANT_EDITOR_ROLE_ID,

    ADM_DEPT_ID: envVars.ADM_DEPT_ID,
    SUPER_ADMIN_NAME: envVars.SUPER_ADMIN_NAME,
    SUPER_ADMIN_EMAIL: envVars.SUPER_ADMIN_EMAIL,

    GEMINI_API_KEY: envVars.GEMINI_API_KEY,
    GROK_API_KEY: envVars.GROK_API_KEY,
    OPENAI_API_KEY: envVars.OPENAI_API_KEY,
    GOWINSTON_API_KEY: envVars.GOWINSTON_API_KEY,

    geminiImageSize: envVars.GEMINI_IMAGE_SIZE,
    models: {
        grok: envVars.GROK_MODEL,
        geminiText: envVars.GEMINI_TEXT_MODEL,
        geminiImage: envVars.GEMINI_IMAGE_MODEL,
        geminiFactCheck: envVars.GEMINI_FACT_CHECK_MODEL,
        openaiChat: envVars.OPENAI_CHAT_MODEL,
    },

    firebase: {
        projectId: envVars.FIREBASE_PROJECT_ID,
        privateKeyId: envVars.FIREBASE_PRIVATE_KEY_ID,
        privateKey: envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
        clientId: envVars.FIREBASE_CLIENT_ID,
    },

    // Defaults to a "storage" folder next to the project root (e.g. /var/www/storage)
    STORAGE_DIR: envVars.STORAGE_PATH || path.resolve(__dirname, '../../../storage'),
};

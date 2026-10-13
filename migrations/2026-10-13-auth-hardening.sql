-- Auth hardening (security phase 1 & 2). Run once, before deploying this release.
-- MySQL 5.7+/8.0. Back up the database first.

-- OTPs: count wrong guesses so a code can be invalidated after OTP_MAX_ATTEMPTS
ALTER TABLE `otps`
  ADD COLUMN `attempts` INT NOT NULL DEFAULT 0 AFTER `otp_expiration_time`;

-- Admin OTP / password reset: expiry, attempt counting, and session invalidation on password change
ALTER TABLE `admins`
  ADD COLUMN `otp_expires_at` DATETIME NULL AFTER `is_otp_valid`,
  ADD COLUMN `otp_attempts` INT NOT NULL DEFAULT 0 AFTER `otp_expires_at`,
  ADD COLUMN `reset_token_expires_at` DATETIME NULL AFTER `otp_attempts`,
  ADD COLUMN `password_changed_at` DATETIME NULL AFTER `reset_token_expires_at`;

-- OTPs and reset tokens are now stored hashed; codes issued before this release can no longer match.
-- Clear them so users simply request a new code.
DELETE FROM `otps`;
UPDATE `admins` SET `otp` = NULL, `is_otp_valid` = 0, `remember_token` = NULL;

-- Optional: SSO was removed from the app. These columns are no longer read or written.
-- ALTER TABLE `users` DROP COLUMN `provider`, DROP COLUMN `provider_id`;

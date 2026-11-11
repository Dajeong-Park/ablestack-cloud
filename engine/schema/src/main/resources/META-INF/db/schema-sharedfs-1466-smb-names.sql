-- Licensed under the Apache License, Version 2.0. See NOTICE.
CREATE TABLE IF NOT EXISTS cloud.storage_smb_service_name (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 uuid VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 instance_id BIGINT UNSIGNED NOT NULL,
 name_kind VARCHAR(16) NOT NULL,
 binding_type VARCHAR(16) NOT NULL,
 endpoint_uuid VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
 fqdn VARCHAR(253) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 canonical_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(32) NOT NULL,
 revision BIGINT NOT NULL DEFAULT 1,
 desired_json MEDIUMTEXT NOT NULL,
 ownership_json MEDIUMTEXT NOT NULL,
 observed_json MEDIUMTEXT NOT NULL,
 created DATETIME NOT NULL,
 updated DATETIME NULL,
 UNIQUE KEY uk_smb_name_uuid(uuid),
 UNIQUE KEY uk_smb_name_instance(instance_id,canonical_hash),
 CONSTRAINT fk_smb_name_instance FOREIGN KEY(instance_id) REFERENCES cloud.storage_service_instance(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

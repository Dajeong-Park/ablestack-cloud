-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License. You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations
-- under the License.

-- Explicit additive deployment for Mold clusters already on Europa.
-- A restart at the same codename does not rerun its version upgrade hook.
-- Keep legacy rows Unknown; no UPDATE, DELETE, DROP or status backfill.

SET @bucket_usage_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud' AND table_name='bucket' AND column_name='usage_last_updated')=0,
 'ALTER TABLE cloud.bucket ADD COLUMN usage_last_updated DATETIME(3) DEFAULT NULL', 'SELECT 1');
PREPARE bucket_usage_statement FROM @bucket_usage_ddl;
EXECUTE bucket_usage_statement;
DEALLOCATE PREPARE bucket_usage_statement;

SET @bucket_usage_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud' AND table_name='bucket' AND column_name='usage_last_attempt')=0,
 'ALTER TABLE cloud.bucket ADD COLUMN usage_last_attempt DATETIME(3) DEFAULT NULL', 'SELECT 1');
PREPARE bucket_usage_statement FROM @bucket_usage_ddl;
EXECUTE bucket_usage_statement;
DEALLOCATE PREPARE bucket_usage_statement;

SET @bucket_usage_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud' AND table_name='bucket' AND column_name='usage_status')=0,
 'ALTER TABLE cloud.bucket ADD COLUMN usage_status VARCHAR(16) DEFAULT NULL', 'SELECT 1');
PREPARE bucket_usage_statement FROM @bucket_usage_ddl;
EXECUTE bucket_usage_statement;
DEALLOCATE PREPARE bucket_usage_statement;

SET @bucket_usage_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud' AND table_name='bucket' AND column_name='usage_source')=0,
 'ALTER TABLE cloud.bucket ADD COLUMN usage_source VARCHAR(32) DEFAULT NULL', 'SELECT 1');
PREPARE bucket_usage_statement FROM @bucket_usage_ddl;
EXECUTE bucket_usage_statement;
DEALLOCATE PREPARE bucket_usage_statement;

SET @bucket_usage_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud' AND table_name='bucket' AND column_name='usage_last_attempt_ms')=0,
 'ALTER TABLE cloud.bucket ADD COLUMN usage_last_attempt_ms BIGINT DEFAULT NULL', 'SELECT 1');
PREPARE bucket_usage_statement FROM @bucket_usage_ddl;
EXECUTE bucket_usage_statement;
DEALLOCATE PREPARE bucket_usage_statement;

-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements.  See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership.  The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License.  You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied.  See the License for the
-- specific language governing permissions and limitations
-- under the License.

-- #1532 same-version migration; safe to reapply.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='cloud' AND table_name='bucket_quota_operation' AND column_name='purge_progress')=0, 'ALTER TABLE cloud.bucket_quota_operation ADD COLUMN purge_progress MEDIUMTEXT DEFAULT NULL', 'SELECT 1');
PREPARE bkt_purge_ddl FROM @ddl;
EXECUTE bkt_purge_ddl;
DEALLOCATE PREPARE bkt_purge_ddl;

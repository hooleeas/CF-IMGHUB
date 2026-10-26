/**
 * D1 数据库操作工具类
 */
import {
    deleteSystemConfigCategory,
    getSystemConfigStorageKeys,
    readSystemConfig,
    writeSystemConfigCategory,
} from './sysConfigStorage.js';

const schemaInitialization = new WeakMap();
const INDEX_METADATA_MIGRATION_PREFIX = '__cf_imghub_internal_index_metadata__:';

class D1Database {
    constructor(db) {
        this.db = db;
    }

    ensureSchema() {
        let initialized = schemaInitialization.get(this.db);
        if (!initialized) {
            initialized = (async () => {
                const statements = [
                    `CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, value TEXT, metadata TEXT NOT NULL DEFAULT '{}', file_name TEXT, file_type TEXT, file_size TEXT, upload_ip TEXT, upload_address TEXT, list_type TEXT, timestamp INTEGER, label TEXT, directory TEXT, channel TEXT, channel_name TEXT, tg_file_id TEXT, tg_chat_id TEXT, tg_bot_token TEXT, is_chunked BOOLEAN DEFAULT FALSE, tags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, category TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                    `CREATE TABLE IF NOT EXISTS index_operations (id TEXT PRIMARY KEY, type TEXT NOT NULL, timestamp INTEGER NOT NULL, data TEXT NOT NULL, processed BOOLEAN DEFAULT FALSE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                    `CREATE TABLE IF NOT EXISTS index_metadata (key TEXT PRIMARY KEY, last_updated INTEGER, total_count INTEGER DEFAULT 0, last_operation_id TEXT, chunk_count INTEGER DEFAULT 0, chunk_size INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                    `CREATE TABLE IF NOT EXISTS other_data (key TEXT PRIMARY KEY, value TEXT NOT NULL, type TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                ];
                for (const sql of statements) await this.db.prepare(sql).run();
                const columns = await this.db.prepare('PRAGMA table_info(files)').all();
                if (!(columns.results || []).some((column) => column.name === 'tags')) {
                    await this.db.prepare('ALTER TABLE files ADD COLUMN tags TEXT').run();
                }
                for (const sql of [
                    'CREATE INDEX IF NOT EXISTS idx_files_timestamp ON files(timestamp DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory)',
                    'CREATE INDEX IF NOT EXISTS idx_files_channel ON files(channel)',
                    'CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type)',
                    'CREATE INDEX IF NOT EXISTS idx_files_upload_ip ON files(upload_ip)',
                    'CREATE INDEX IF NOT EXISTS idx_files_tags ON files(tags)',
                    'CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category)',
                    'CREATE INDEX IF NOT EXISTS idx_index_operations_timestamp ON index_operations(timestamp)',
                    'CREATE INDEX IF NOT EXISTS idx_index_operations_processed ON index_operations(processed)',
                    'CREATE INDEX IF NOT EXISTS idx_index_operations_type ON index_operations(type)',
                    'CREATE INDEX IF NOT EXISTS idx_other_data_type ON other_data(type)',
                ]) await this.db.prepare(sql).run();
            })();
            schemaInitialization.set(this.db, initialized);
        }
        return initialized;
    }

    async normalizeSystemConfig() {
        const [settings, legacyFile] = await Promise.all([
            this.db.prepare(`SELECT key FROM settings
                WHERE key = 'CONFIG' OR key LIKE 'manage@sysConfig@%' OR key LIKE 'MANAGE@SYSCONFIG@%' LIMIT 1`).first(),
            this.db.prepare("SELECT id FROM files WHERE id = 'CONFIG' LIMIT 1").first(),
        ]);
        if (!settings && !legacyFile) return;
        await readSystemConfig(
            this.getSetting.bind(this),
            (key, value) => this.putSetting(key, value, 'SYSCONFIG'),
            this.deleteSetting.bind(this)
        );
        if (legacyFile) await this.deleteFile('CONFIG');
    }

    async listMigrationRecords() {
        await this.normalizeSystemConfig();
        const [files, settings, operations, indexMetadata, otherData] = await Promise.all([
            this.db.prepare('SELECT id, value, metadata FROM files ORDER BY id').all(),
            this.db.prepare('SELECT key, value FROM settings ORDER BY key').all(),
            this.db.prepare('SELECT id, type, timestamp, data FROM index_operations ORDER BY id').all(),
            this.db.prepare('SELECT * FROM index_metadata ORDER BY key').all(),
            this.db.prepare('SELECT key, value FROM other_data ORDER BY key').all(),
        ]);
        const records = new Map();
        // Preserve records from the legacy `other_data` table, then let the
        // storage table used by the active adapter win on duplicate logical keys.
        for (const row of otherData.results || []) {
            records.set(row.key, { name: row.key, value: row.value ?? '', metadata: null });
        }
        for (const row of files.results || []) {
            let metadata = {};
            try { metadata = JSON.parse(row.metadata || '{}'); } catch { throw new Error(`D1 图片记录“${row.id}”的 metadata JSON 无效。`); }
            records.set(row.id, { name: row.id, value: row.value ?? '', metadata });
        }
        for (const row of settings.results || []) records.set(row.key, { name: row.key, value: row.value ?? '', metadata: null });
        for (const row of operations.results || []) {
            const record = {
                name: `manage@index@operation_${row.id}`,
                value: JSON.stringify({ type: row.type, timestamp: row.timestamp, data: JSON.parse(row.data || 'null') }),
                metadata: null,
            };
            records.set(record.name, record);
        }
        for (const row of indexMetadata.results || []) {
            const record = {
                name: INDEX_METADATA_MIGRATION_PREFIX + row.key,
                value: JSON.stringify({
                    last_updated: row.last_updated,
                    total_count: row.total_count,
                    last_operation_id: row.last_operation_id,
                    chunk_count: row.chunk_count,
                    chunk_size: row.chunk_size,
                }),
                metadata: null,
            };
            records.set(record.name, record);
        }
        return [...records.values()].sort((left, right) => left.name.localeCompare(right.name));
    }

    async listMigrationRecordKeys(offset = 0, limit = 100) {
        await this.normalizeSystemConfig();
        const result = await this.db.prepare(`
            SELECT id AS name FROM files
            UNION SELECT key AS name FROM settings WHERE key != ?
            UNION SELECT 'manage@index@operation_' || id AS name FROM index_operations
            UNION SELECT '__cf_imghub_internal_index_metadata__:' || key AS name FROM index_metadata
            UNION SELECT key AS name FROM other_data
            ORDER BY name LIMIT ? OFFSET ?
        `).bind('manage@system@databaseProvider', limit, offset).all();
        return (result.results || []).map((row) => row.name);
    }
}

// ==================== 文件操作 ====================

/**
 * 保存文件记录 (替代 KV.put)
 */
D1Database.prototype.putFile = function(fileId, value, options) {
    value = value || '';
    options = options || {};
    var metadata = options.metadata || {};
    
    // 从metadata中提取字段用于索引
    var extractedFields = this.extractMetadataFields(metadata);
    
    var stmt = this.db.prepare(
        'INSERT OR REPLACE INTO files (' +
        'id, value, metadata, file_name, file_type, file_size, ' +
        'upload_ip, upload_address, list_type, timestamp, ' +
        'label, directory, channel, channel_name, ' +
        'tg_file_id, tg_chat_id, tg_bot_token, is_chunked' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    
    return stmt.bind(
        fileId,
        value,
        JSON.stringify(metadata),
        extractedFields.fileName,
        extractedFields.fileType,
        extractedFields.fileSize,
        extractedFields.uploadIP,
        extractedFields.uploadAddress,
        extractedFields.listType,
        extractedFields.timestamp,
        extractedFields.label,
        extractedFields.directory,
        extractedFields.channel,
        extractedFields.channelName,
        extractedFields.tgFileId,
        extractedFields.tgChatId,
        extractedFields.tgBotToken,
        extractedFields.isChunked
    ).run();
};

/**
 * 获取文件记录 (替代 KV.get)
 */
D1Database.prototype.getFile = function(fileId) {
    var self = this;
    var stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
    return stmt.bind(fileId).first().then(function(result) {
        if (!result) return null;
        
        return {
            value: result.value,
            metadata: JSON.parse(result.metadata || '{}')
        };
    });
};

/**
 * 获取文件记录包含元数据 (替代 KV.getWithMetadata)
 */
D1Database.prototype.getFileWithMetadata = function(fileId) {
    return this.getFile(fileId);
};

/**
 * 删除文件记录 (替代 KV.delete)
 */
D1Database.prototype.deleteFile = function(fileId) {
    var stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
    return stmt.bind(fileId).run();
};

/**
 * 列出文件 (替代 KV.list)
 */
D1Database.prototype.listFiles = function(options) {
    options = options || {};
    var prefix = options.prefix || '';
    var limit = options.limit || 1000;
    var cursor = options.cursor || null;
    
    var query = 'SELECT id, metadata FROM files';
    var params = [];
    
    if (prefix) {
        query += ' WHERE id LIKE ?';
        params.push(prefix + '%');
    }
    
    if (cursor) {
        query += prefix ? ' AND' : ' WHERE';
        query += ' id > ?';
        params.push(cursor);
    }
    
    query += ' ORDER BY id LIMIT ?';
    params.push(limit + 1);
    
    var stmt = this.db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind.apply(stmt, params);
    }
    return stmt.all().then(function(response) {
        var results = response.results || [];
        var hasMore = results.length > limit;
        if (hasMore) {
            results.pop();
        }

        var keys = results.map(function(row) {
            return {
                name: row.id,
                metadata: JSON.parse(row.metadata || '{}')
            };
        });
        
        return {
            keys: keys,
            cursor: hasMore && keys.length > 0 ? keys[keys.length - 1].name : null,
            list_complete: !hasMore
        };
    });
};

// ==================== 设置操作 ====================

/**
 * 保存设置 (替代 KV.put)
 */
D1Database.prototype.putSetting = function(key, value, category) {
    if (!category && key.startsWith('manage@sysConfig@')) {
        category = key.split('@')[2];
    }
    
    var stmt = this.db.prepare(
        'INSERT OR REPLACE INTO settings (key, value, category) VALUES (?, ?, ?)'
    );
    
    return stmt.bind(key, value, category).run();
};

/**
 * 获取设置 (替代 KV.get)
 */
D1Database.prototype.getSetting = function(key) {
    var stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    return stmt.bind(key).first().then(function(result) {
        if (result) return result.value;
        if (key === 'CONFIG') return this.getFile('CONFIG').then(function(file) { return file ? file.value : null; });
        return null;
    }.bind(this));
};

/**
 * 删除设置 (替代 KV.delete)
 */
D1Database.prototype.deleteSetting = function(key) {
    var stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    return stmt.bind(key).run();
};

/**
 * 列出设置 (替代 KV.list)
 */
D1Database.prototype.listSettings = function(options) {
    options = options || {};
    var prefix = options.prefix || '';
    var limit = options.limit || 1000;
    
    var query = 'SELECT key, value FROM settings';
    var params = [];
    
    if (prefix) {
        query += ' WHERE key LIKE ?';
        params.push(prefix + '%');
    }
    
    query += ' ORDER BY key LIMIT ?';
    params.push(limit);
    
    var stmt = this.db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind.apply(stmt, params);
    }
    return stmt.all().then(function(response) {
        var results = response.results || [];
        var keys = results.map(function(row) {
            return {
                name: row.key,
                value: row.value
            };
        });

        return { keys: keys };
    });
};

// ==================== 索引操作 ====================

/**
 * 保存索引操作记录
 */
D1Database.prototype.putIndexOperation = function(operationId, operation) {
    var stmt = this.db.prepare(
        'INSERT OR REPLACE INTO index_operations (id, type, timestamp, data) VALUES (?, ?, ?, ?)'
    );
    
    return stmt.bind(
        operationId,
        operation.type,
        operation.timestamp,
        JSON.stringify(operation.data)
    ).run();
};

/**
 * 获取索引操作记录
 */
D1Database.prototype.getIndexOperation = function(operationId) {
    var stmt = this.db.prepare('SELECT * FROM index_operations WHERE id = ?');
    return stmt.bind(operationId).first().then(function(result) {
        if (!result) return null;
        
        return {
            type: result.type,
            timestamp: result.timestamp,
            data: JSON.parse(result.data)
        };
    });
};

/**
 * 删除索引操作记录
 */
D1Database.prototype.deleteIndexOperation = function(operationId) {
    var stmt = this.db.prepare('DELETE FROM index_operations WHERE id = ?');
    return stmt.bind(operationId).run();
};

/**
 * 列出索引操作记录
 */
D1Database.prototype.listIndexOperations = function(options) {
    options = options || {};
    var limit = options.limit || 1000;
    var processed = options.processed;
    
    var query = 'SELECT * FROM index_operations';
    var params = [];
    
    if (processed !== null && processed !== undefined) {
        query += ' WHERE processed = ?';
        params.push(processed);
    }
    
    query += ' ORDER BY timestamp LIMIT ?';
    params.push(limit);
    
    var stmt = this.db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind.apply(stmt, params);
    }
    return stmt.all().then(function(response) {
        var results = response.results || [];
        return results.map(function(row) {
            return {
                id: row.id,
                type: row.type,
                timestamp: row.timestamp,
                data: JSON.parse(row.data),
                processed: row.processed
            };
        });
    });
};

// ==================== 工具方法 ====================

/**
 * 从metadata中提取字段用于索引
 */
D1Database.prototype.extractMetadataFields = function(metadata) {
    return {
        fileName: metadata.FileName || null,
        fileType: metadata.FileType || null,
        fileSize: metadata.FileSize || null,
        uploadIP: metadata.UploadIP || null,
        uploadAddress: metadata.UploadAddress || null,
        listType: metadata.ListType || null,
        timestamp: metadata.TimeStamp || null,
        label: metadata.Label || null,
        directory: metadata.Directory || null,
        channel: metadata.Channel || null,
        channelName: metadata.ChannelName || null,
        tgFileId: metadata.TgFileId || null,
        tgChatId: null,
        tgBotToken: null,
        isChunked: metadata.IsChunked || false
    };
};

// ==================== 通用方法 ====================

/**
 * 通用的put方法，根据key类型自动选择存储位置
 */
D1Database.prototype.put = function(key, value, options) {
    options = options || {};

    if (key === 'CONFIG') {
        return this.putSetting(key, value, 'SYSCONFIG').then(() => this.deleteFile(key));
    } else if (key.startsWith(INDEX_METADATA_MIGRATION_PREFIX)) {
        var indexMetadataKey = key.slice(INDEX_METADATA_MIGRATION_PREFIX.length);
        var indexMetadata = JSON.parse(value);
        return this.db.prepare(`INSERT OR REPLACE INTO index_metadata
            (key, last_updated, total_count, last_operation_id, chunk_count, chunk_size)
            VALUES (?, ?, ?, ?, ?, ?)`).bind(
            indexMetadataKey,
            indexMetadata.last_updated ?? null,
            indexMetadata.total_count ?? 0,
            indexMetadata.last_operation_id ?? null,
            indexMetadata.chunk_count ?? 0,
            indexMetadata.chunk_size ?? 0
        ).run();
    } else if (key.startsWith('manage@index@operation_')) {
        var operationId = key.replace('manage@index@operation_', '');
        var operation = JSON.parse(value);
        return this.putIndexOperation(operationId, operation);
    } else if (getSystemConfigStorageKeys(key)) {
        var configKeys = getSystemConfigStorageKeys(key);
        var self = this;
        return writeSystemConfigCategory(
            this.getSetting.bind(this),
            function(storageKey, storageValue) {
                return self.putSetting(storageKey, storageValue, 'SYSCONFIG');
            },
            this.deleteSetting.bind(this),
            configKeys.category,
            value
        );
    } else if (key.startsWith('manage@')) {
        // 所有 manage@ 前缀的键统一存入 settings 表
        var category = key.split('@')[1] || '';
        return this.putSetting(key, value, category);
    } else {
        return this.putFile(key, value, options);
    }
};

/**
 * 通用的get方法，根据key类型自动选择获取位置
 */
D1Database.prototype.get = function(key) {
    var self = this;

    if (key === 'CONFIG') {
        return this.getSetting(key);
    } else if (key.startsWith('manage@index@operation_')) {
        var operationId = key.replace('manage@index@operation_', '');
        return this.getIndexOperation(operationId).then(function(operation) {
            return operation ? JSON.stringify(operation) : null;
        });
    } else if (getSystemConfigStorageKeys(key)) {
        var configKeys = getSystemConfigStorageKeys(key);
        return readSystemConfig(
            this.getSetting.bind(this),
            function(storageKey, storageValue) {
                return self.putSetting(storageKey, storageValue, 'SYSCONFIG');
            },
            this.deleteSetting.bind(this)
        ).then(function(config) {
            return Object.hasOwn(config, configKeys.category)
                ? JSON.stringify(config[configKeys.category])
                : null;
        });
    } else if (key.startsWith('manage@')) {
        return this.getSetting(key);
    } else {
        return this.getFile(key).then(function(file) {
            return file ? file.value : null;
        });
    }
};

/**
 * 通用的getWithMetadata方法
 */
D1Database.prototype.getWithMetadata = function(key) {
    if (key.startsWith(INDEX_METADATA_MIGRATION_PREFIX)) {
        const indexMetadataKey = key.slice(INDEX_METADATA_MIGRATION_PREFIX.length);
        return this.db.prepare('SELECT last_updated, total_count, last_operation_id, chunk_count, chunk_size FROM index_metadata WHERE key = ?')
            .bind(indexMetadataKey).first().then((row) => row ? { value: JSON.stringify(row), metadata: {} } : null);
    }
    if (key === 'CONFIG' || key.startsWith('manage@') || getSystemConfigStorageKeys(key)) {
        return this.get(key).then(function(value) {
            if (value !== null && value !== undefined) return { value: value, metadata: {} };
            return this.db.prepare('SELECT value FROM other_data WHERE key = ?').bind(key).first().then(function(row) {
                return row ? { value: row.value, metadata: {} } : null;
            });
        }.bind(this));
    } else {
        return this.getFileWithMetadata(key).then(function(file) {
            if (file) return file;
            return this.db.prepare('SELECT value FROM other_data WHERE key = ?').bind(key).first().then(function(row) {
                return row ? { value: row.value, metadata: {} } : null;
            });
        }.bind(this));
    }
};

/**
 * 通用的delete方法
 */
D1Database.prototype.delete = function(key) {
    if (key === 'CONFIG') {
        return Promise.all([this.deleteSetting(key), this.deleteFile(key)]);
    } else if (key.startsWith(INDEX_METADATA_MIGRATION_PREFIX)) {
        return this.db.prepare('DELETE FROM index_metadata WHERE key = ?')
            .bind(key.slice(INDEX_METADATA_MIGRATION_PREFIX.length)).run();
    } else if (key.startsWith('manage@index@operation_')) {
        var operationId = key.replace('manage@index@operation_', '');
        return this.deleteIndexOperation(operationId);
    } else if (getSystemConfigStorageKeys(key)) {
        var configKeys = getSystemConfigStorageKeys(key);
        var self = this;
        return deleteSystemConfigCategory(
            this.getSetting.bind(this),
            function(storageKey, storageValue) {
                return self.putSetting(storageKey, storageValue, 'SYSCONFIG');
            },
            this.deleteSetting.bind(this),
            configKeys.category
        );
    } else if (key.startsWith('manage@')) {
        return this.deleteSetting(key);
    } else {
        return this.deleteFile(key);
    }
};

/**
 * 通用的list方法
 */
D1Database.prototype.list = function(options) {
    options = options || {};
    var prefix = options.prefix || '';
    var self = this;

    if (prefix.startsWith('manage@index@operation_')) {
        return this.listIndexOperations(options).then(function(operations) {
            var keys = operations.map(function(op) {
                return {
                    name: 'manage@index@operation_' + op.id
                };
            });
            return { keys: keys };
        });
    } else if (prefix.startsWith('manage@')) {
        return this.listSettings(options);
    } else {
        return this.listFiles(options);
    }
};

// D1 bindings are initialized automatically on first use; no dashboard SQL step is needed.
for (const methodName of Object.getOwnPropertyNames(D1Database.prototype)) {
    if (methodName === 'constructor' || methodName === 'ensureSchema') continue;
    const method = D1Database.prototype[methodName];
    if (typeof method !== 'function') continue;
    D1Database.prototype[methodName] = function(...args) {
        return this.ensureSchema().then(() => method.apply(this, args));
    };
}

// 导出构造函数
export { D1Database };

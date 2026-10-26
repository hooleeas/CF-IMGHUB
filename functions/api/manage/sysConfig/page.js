import { getDatabase } from '../../../utils/databaseAdapter.js';
import { getUploadConfig } from './upload.js';
import enPageLocale from '../../../../frontend-src/locales/en/sysPage.json' with { type: 'json' };
import zhCNPageLocale from '../../../../frontend-src/locales/zh-CN/sysPage.json' with { type: 'json' };

const PAGE_SETTING_FIELDS = {
    defaultChannelId: 'channelId',
    defaultConvertToWebp: 'convertToWebp',
    defaultCustomerCompress: 'customerCompress',
    defaultCompressBar: 'compressBar',
    defaultCompressQuality: 'compressQuality',
};

export async function onRequest(context) {
    // 页面设置相关，GET方法读取设置，POST方法保存设置
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;

    const db = getDatabase(env);

    // GET读取设置
    if (request.method === 'GET') {
        const settings = await getPageConfig(db, env)

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST保存设置
    if (request.method === 'POST') {
        const body = await request.json();
        if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.config)) {
            return new Response(JSON.stringify({ error: '客户端设置格式无效。' }), {
                status: 400,
                headers: { 'content-type': 'application/json' },
            });
        }
        const allowedSettingIds = new Set([
            'defaultChannelId',
            'defaultConvertToWebp',
            'defaultCustomerCompress',
            'defaultCompressBar',
            'defaultCompressQuality',
        ]);
        const config = [];
        const storedSettings = {};
        for (const item of body.config) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return new Response(JSON.stringify({ error: '客户端设置格式无效。' }), {
                    status: 400,
                    headers: { 'content-type': 'application/json' },
                });
            }
            if (!allowedSettingIds.has(item.id)) continue;
            if (!Object.hasOwn(item, 'value')) continue;

            let value = item.value;
            if (item.id === 'defaultChannelId') {
                if (typeof value !== 'string' || (value !== '' && !/^[A-Z]{5}$/.test(value))) {
                    return new Response(JSON.stringify({ error: '默认上传渠道无效。' }), {
                        status: 400,
                        headers: { 'content-type': 'application/json' },
                    });
                }
                if (value) {
                    const uploadSettings = await getUploadConfig(db, env);
                    const channelExists = Object.values(uploadSettings).some(({ channels }) =>
                        channels.some((channel) => channel.enabled && channel.id === value)
                    );
                    if (!channelExists) {
                        return new Response(JSON.stringify({ error: '默认上传渠道不存在或已禁用。' }), {
                            status: 400,
                            headers: { 'content-type': 'application/json' },
                        });
                    }
                }
            } else if (item.id === 'defaultConvertToWebp' || item.id === 'defaultCustomerCompress') {
                if (value === 'true') value = true;
                if (value === 'false') value = false;
                if (typeof value !== 'boolean') {
                    return new Response(JSON.stringify({ error: '布尔类型客户端设置无效。' }), {
                        status: 400,
                        headers: { 'content-type': 'application/json' },
                    });
                }
            } else if (item.id === 'defaultCompressBar' || item.id === 'defaultCompressQuality') {
                if (value === '') {
                    config.push({ id: item.id, value });
                    continue;
                }
                const numberValue = Number(value);
                const min = item.id === 'defaultCompressBar' ? 1 : 0.5;
                if (!Number.isFinite(numberValue) || numberValue < min || numberValue > 20) {
                    return new Response(JSON.stringify({ error: '图片压缩设置范围无效。' }), {
                        status: 400,
                        headers: { 'content-type': 'application/json' },
                    });
                }
                value = numberValue;
            }
            config.push({ id: item.id, value });
            const field = PAGE_SETTING_FIELDS[item.id];
            if (field) {
                storedSettings[field] = value;
            } else {
                (storedSettings.config ??= []).push({ id: item.id, value });
            }
        }
        const settings = { config };
        await db.put('manage@sysConfig@page', JSON.stringify(storedSettings))

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getPageConfig(db, env) {
    const settings = {}
    // 读取数据库中的设置
    const settingsStr = await db.get('manage@sysConfig@page')
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {}
    const uploadSettings = await getUploadConfig(db, env);
    const channelOptions = Object.entries(uploadSettings).flatMap(([channelType, typeSettings]) =>
        (typeSettings.channels || [])
            .filter((channel) => channel.enabled)
            .map((channel) => {
                const typeLabel = {
                    telegram: 'Telegram',
                    cfr2: 'R2',
                    s3: 'S3',
                    discord: 'Discord',
                    huggingface: 'HuggingFace',
                    webdav: 'WebDAV',
                }[channelType] || channelType;
                const label = channel.name === typeLabel
                    ? typeLabel
                    : `${typeLabel} — ${channel.name}`;
                return {
                    value: channel.id,
                    label,
                    label_en: label,
                };
            })
    );

    const legacyConfig = Array.isArray(settingsKV.config) ? settingsKV.config : [];
    const legacyType = legacyConfig.find(({ id }) => id === 'defaultUploadChannel')?.value;
    const legacyName = legacyConfig.find(({ id }) => id === 'defaultChannelName')?.value;
    let channelId = settingsKV.channelId || '';
    if (!channelId && legacyType && legacyName) {
        channelId = uploadSettings[legacyType]?.channels
            ?.find((channel) => channel.name === legacyName)?.id || '';
    }
    if (channelId && !channelOptions.some((option) => option.value === channelId)) {
        channelId = '';
    }
    const remainingLegacyConfig = legacyConfig.filter(({ id }) =>
        id !== 'defaultUploadChannel' && id !== 'defaultChannelName'
    );
    if (legacyConfig.length !== remainingLegacyConfig.length || channelId !== (settingsKV.channelId || '')) {
        settingsKV.channelId = channelId;
        if (remainingLegacyConfig.length) settingsKV.config = remainingLegacyConfig;
        else delete settingsKV.config;
        await db.put('manage@sysConfig@page', JSON.stringify(settingsKV));
    }

    const config = []
    settings.config = config
    config.push(
        {
            id: 'defaultChannelId',
            type: 'select',
            options: channelOptions,
            default: '',
        },
        {
            id: 'defaultConvertToWebp',
            type: 'boolean',
            default: false,
        },
        {
            id: 'defaultCustomerCompress',
            type: 'boolean',
            default: true,
        },
        {
            id: 'defaultCompressBar',
            type: 'number',
            default: 5,
        },
        {
            id: 'defaultCompressQuality',
            type: 'number',
            default: 4,
        },
    )

    for (const item of config) {
        item.label = zhCNPageLocale.settingLabels[item.id];
        item.label_en = enPageLocale.settingLabels[item.id];
        item.category = zhCNPageLocale.clientSettings;
        item.category_en = enPageLocale.clientSettings;
        const tooltip = zhCNPageLocale.settingTooltips[item.id];
        const tooltipEn = enPageLocale.settingTooltips[item.id];
        if (tooltip) item.tooltip = tooltip;
        if (tooltipEn) item.tooltip_en = tooltipEn;
        if (item.options) {
            item.options = item.options.map((option) => ({
                ...option,
                label: option.label || zhCNPageLocale.channelTypes[option.value],
                label_en: option.label_en || enPageLocale.channelTypes[option.value],
            }));
        }
    }

    const userConfig = env.USER_CONFIG
    if (userConfig) {
        try {
            const parsedConfig = JSON.parse(userConfig)
            if (typeof parsedConfig === 'object' && parsedConfig !== null) {
                // 搜索config中的id，如果存在则更新
                for (let i = 0; i < config.length; i++) {
                    if (Object.hasOwn(parsedConfig, config[i].id)) {
                        config[i].value = parsedConfig[config[i].id]
                    }
                }
                if (!Object.hasOwn(parsedConfig, 'defaultChannelId')
                    && parsedConfig.defaultUploadChannel
                    && parsedConfig.defaultChannelName) {
                    const legacyChannel = uploadSettings[parsedConfig.defaultUploadChannel]?.channels
                        ?.find((channel) => channel.name === parsedConfig.defaultChannelName);
                    if (legacyChannel) {
                        config.find((item) => item.id === 'defaultChannelId').value = legacyChannel.id;
                    }
                }
            }
        } catch (error) {
            // do nothing
        }
    }

    // 兼容旧的 CONFIG 列表格式，并用 KV 设置覆盖默认值。
    for (let i = 0; i < (settingsKV.config ?? []).length; i++) {
        const item = settingsKV.config[i]
        const index = config.findIndex(x => x.id === item.id)
        if (index !== -1 && Object.hasOwn(item, 'value')) {
            config[index].value = item.value
        }
    }
    for (const [id, field] of Object.entries(PAGE_SETTING_FIELDS)) {
        const index = config.findIndex((item) => item.id === id);
        if (index !== -1 && Object.hasOwn(settingsKV, field)) {
            config[index].value = settingsKV[field];
        }
    }

    return settings
}

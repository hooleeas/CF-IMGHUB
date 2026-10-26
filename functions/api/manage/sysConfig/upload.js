import { getDatabase } from '../../../utils/databaseAdapter.js';
import { normalizeWebDAVHeaders } from '../../../utils/storage/webdavAPI.js';

const UPLOAD_CHANNEL_TYPES = ['telegram', 'cfr2', 's3', 'discord', 'huggingface', 'webdav'];
const CHANNEL_TYPE_NAMES = {
    telegram: 'Telegram',
    cfr2: 'R2',
    s3: 'S3',
    discord: 'Discord',
    huggingface: 'HuggingFace',
    webdav: 'WebDAV',
};
const ENVIRONMENT_OVERRIDE_FIELDS = {
    telegram: ['enabled', 'proxyUrl'],
    s3: ['enabled', 'cdnDomain'],
    discord: ['enabled', 'proxyUrl', 'isNitro'],
    huggingface: ['enabled', 'isPrivate'],
    webdav: ['enabled', 'publicUrl', 'headers', 'createDirectory'],
};

function createChannelId(usedIds) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const bytes = new Uint8Array(5);
        globalThis.crypto.getRandomValues(bytes);
        const id = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
        if (!usedIds.has(id)) {
            usedIds.add(id);
            return id;
        }
    }
    throw new Error('无法生成唯一的渠道 ID。');
}

function toApiChannel(channel, channelType) {
    const apiChannel = { ...channel, type: channelType };
    if (channelType === 'webdav' && apiChannel.baseUrl === undefined && apiChannel.url !== undefined) {
        apiChannel.baseUrl = apiChannel.url;
        delete apiChannel.url;
    }
    return apiChannel;
}

function stripEnvironmentChannels(settings) {
    const persistedSettings = {};
    const usedIds = new Set(['TGAAA', 'R2AAA', 'S3AAA', 'DCAAA', 'HFAAA', 'WDAAA']);
    let hasR2Channel = false;

    for (const channelType of UPLOAD_CHANNEL_TYPES) {
        const channelSettings = settings[channelType];
        if (!channelSettings || typeof channelSettings !== 'object') continue;

        const channels = (Array.isArray(channelSettings.channels) ? channelSettings.channels : [])
            .flatMap((channel) => {
            const isEnvironmentChannel = channel?.fixed === true
                || (channel?.savePath ?? channel?.savepath) === 'environment variable';
            if (isEnvironmentChannel) {
                const overrideFields = ENVIRONMENT_OVERRIDE_FIELDS[channelType];
                if (!overrideFields) return [];
                const overrides = {
                    savePath: 'environment variable',
                    enabled: channel.enabled !== false,
                };
                for (const key of overrideFields) {
                    if (Object.hasOwn(channel, key) && channel[key] !== undefined) {
                        overrides[key] = channel[key];
                    }
                }
                return [overrides];
            }
            if (channelType === 'cfr2' && (channel?.id === 'R2A' || hasR2Channel)) return [];
            if (channelType === 'cfr2') hasR2Channel = true;
            return [channel];
        }).map((channel) => {
            if (channel.savePath === 'environment variable' && !channel.id) return channel;
            const persistedChannel = { ...channel };
            let id = typeof persistedChannel.id === 'string'
                && /^[A-Z]{5}$/.test(persistedChannel.id)
                && !usedIds.has(persistedChannel.id)
                ? persistedChannel.id
                : '';
            if (id) usedIds.add(id);
            else id = createChannelId(usedIds);
            persistedChannel.id = id;
            persistedChannel.type = CHANNEL_TYPE_NAMES[channelType];
            persistedChannel.enabled = channel.enabled !== false;
            delete persistedChannel.fixed;
            delete persistedChannel.savePath;
            delete persistedChannel.savepath;
            if (channelType === 'webdav' && persistedChannel.url === undefined
                && persistedChannel.baseUrl !== undefined) {
                persistedChannel.url = persistedChannel.baseUrl;
                delete persistedChannel.baseUrl;
            }
            if (['cfr2', 's3', 'webdav'].includes(channelType)) {
                delete persistedChannel.quota;
            }
            return persistedChannel;
        });

        const loadBalance = channelSettings.loadBalance;
        const hasLoadBalanceSettings = loadBalance
            && (loadBalance.enabled === true
                || (Array.isArray(loadBalance.channels) && loadBalance.channels.length > 0));
        const normalizedTypeSettings = {};
        if (channels.length > 0) normalizedTypeSettings.channels = channels;
        if (hasLoadBalanceSettings) normalizedTypeSettings.loadBalance = loadBalance;
        if (Object.keys(normalizedTypeSettings).length > 0) {
            persistedSettings[channelType] = normalizedTypeSettings;
        }
    }

    return {
        settings: persistedSettings,
        changed: JSON.stringify(settings) !== JSON.stringify(persistedSettings),
    };
}

function hasDuplicateChannelNames(settings) {
    const names = new Set();
    for (const channelSettings of Object.values(settings)) {
        for (const channel of channelSettings.channels || []) {
            const name = typeof channel.name === 'string' ? channel.name.trim() : '';
            if (!name) continue;
            if (names.has(name)) return true;
            names.add(name);
        }
    }
    return false;
}

export async function onRequest(context) {
    // 上传设置相关，GET方法读取设置，POST方法保存设置
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
        const settings = await getUploadConfig(db, env)
        settings.capabilities = {
            cfr2: typeof env.R2?.put === 'function',
        };

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST保存设置
    if (request.method === 'POST') {
        const body = await request.json()
        const { settings } = stripEnvironmentChannels(body || {});

        if (hasDuplicateChannelNames(settings)) {
            return new Response(JSON.stringify({ error: '渠道名称不可重复。' }), {
                status: 400,
                headers: { 'content-type': 'application/json' },
            });
        }
        const storedSettingsJson = await db.get('manage@sysConfig@upload');
        const storedSettings = storedSettingsJson ? JSON.parse(storedSettingsJson) : {};
        const storedR2Ids = new Set((storedSettings.cfr2?.channels || []).map((channel) => channel.id));
        const hasNewR2Channel = (settings.cfr2?.channels || [])
            .some((channel) => !storedR2Ids.has(channel.id));
        if (hasNewR2Channel && typeof env.R2?.put !== 'function') {
            return new Response(JSON.stringify({ error: '当前项目未绑定 Cloudflare R2 存储桶。' }), {
                status: 400,
                headers: { 'content-type': 'application/json' },
            });
        }

        if (Object.keys(settings).length === 0) {
            await db.delete('manage@sysConfig@upload')
        } else {
            await db.put('manage@sysConfig@upload', JSON.stringify(settings))
        }

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getUploadConfig(db, env) {
    const settings = {}
    // 读取数据库中的设置
    const settingsStr = await db.get('manage@sysConfig@upload')
    const storedSettings = settingsStr ? JSON.parse(settingsStr) : {}
    const { settings: settingsKV } = stripEnvironmentChannels(storedSettings);
    if (JSON.stringify(storedSettings) !== JSON.stringify(settingsKV)) {
        if (Object.keys(settingsKV).length === 0) {
            await db.delete('manage@sysConfig@upload')
        } else {
            await db.put('manage@sysConfig@upload', JSON.stringify(settingsKV))
        }
    }

    // =====================读取tg渠道配置=====================
    const telegram = {}

    const telegramChannels = []
    telegram.channels = telegramChannels
    if (env.TG_BOT_TOKEN) {
        telegramChannels.push({
            id: 'TGAAA',
            name: 'Telegram_env',
            type: 'telegram',
            savePath: 'environment variable',
            botToken: env.TG_BOT_TOKEN,
            chatId: env.TG_CHAT_ID,
            proxyUrl: env.TG_PROXY_URL || '',  // 可选的代理 URL
            enabled: true,
            fixed: true,
        })
    }
    for (const storedTg of settingsKV.telegram?.channels || []) {
        const tg = toApiChannel(storedTg, 'telegram');
        // 如果savePath是environment variable，修改可变参数
        if (tg.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (telegramChannels[0]) {
                telegramChannels[0].enabled = tg.enabled
                telegramChannels[0].proxyUrl = tg.proxyUrl
            }

            continue
        }
        telegramChannels.push(tg)
    }

    // 负载均衡
    const tgLoadBalance = settingsKV.telegram?.loadBalance || {
        enabled: false,
        channels: [],
    }
    telegram.loadBalance = tgLoadBalance



    // =====================读取r2渠道配置=====================
    const cfr2 = {}
    const cfr2Channels = []
    cfr2.channels = cfr2Channels
    for (const storedR2 of settingsKV.cfr2?.channels || []) {
        const r2 = toApiChannel(storedR2, 'cfr2');
        cfr2Channels.push(r2)
    }

    // 负载均衡
    const r2LoadBalance = settingsKV.cfr2?.loadBalance || {
        enabled: false,
        channels: [],
    }
    cfr2.loadBalance = r2LoadBalance


    // =====================读取s3渠道配置=====================
    const s3 = {}
    const s3Channels = []
    s3.channels = s3Channels
    if (env.S3_ACCESS_KEY_ID) {
        s3Channels.push({
            id: 'S3AAA',
            name: 'S3_env',
            type: 's3',
            savePath: 'environment variable',
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            region: env.S3_REGION || 'auto',
            bucketName: env.S3_BUCKET_NAME,
            endpoint: env.S3_ENDPOINT,
            pathStyle: env.S3_PATH_STYLE === 'true',
            cdnDomain: env.S3_CDN_DOMAIN || '',  // 可选的 CDN 域名
            enabled: true,
            fixed: true,
        })
    }
    for (const storedS3 of settingsKV.s3?.channels || []) {
        const s = toApiChannel(storedS3, 's3');
        // 如果savePath是environment variable，修改可变参数
        if (s.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (s3Channels[0]) {
                s3Channels[0].enabled = s.enabled
                s3Channels[0].cdnDomain = s.cdnDomain  // 保留 CDN 域名配置
            }

            continue
        }
        s3Channels.push(s)
    }

    // 负载均衡
    const s3LoadBalance = settingsKV.s3?.loadBalance || {
        enabled: false,
        channels: [],
    }
    s3.loadBalance = s3LoadBalance


    // =====================读取 Discord 渠道配置=====================
    const discord = {}
    const discordChannels = []
    discord.channels = discordChannels

    // 从环境变量读取 Discord 配置
    if (env.DISCORD_BOT_TOKEN) {
        discordChannels.push({
            id: 'DCAAA',
            name: 'Discord_env',
            type: 'discord',
            savePath: 'environment variable',
            botToken: env.DISCORD_BOT_TOKEN,
            channelId: env.DISCORD_CHANNEL_ID,
            proxyUrl: env.DISCORD_PROXY_URL || '',  // 可选的代理 URL
            isNitro: env.DISCORD_IS_NITRO === 'true',  // Nitro 会员，支持 25MB
            enabled: true,
            fixed: true,
        })
    }

    for (const storedDc of settingsKV.discord?.channels || []) {
        const dc = toApiChannel(storedDc, 'discord');
        // 如果 savePath 是 environment variable，修改可变参数
        if (dc.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (discordChannels[0]) {
                discordChannels[0].enabled = dc.enabled
                discordChannels[0].proxyUrl = dc.proxyUrl
                discordChannels[0].isNitro = dc.isNitro
            }
            continue
        }
        discordChannels.push(dc)
    }

    // 负载均衡
    const discordLoadBalance = settingsKV.discord?.loadBalance || {
        enabled: false,
        channels: [],
    }
    discord.loadBalance = discordLoadBalance


    // =====================读取 HuggingFace 渠道配置=====================
    const huggingface = {}
    const huggingfaceChannels = []
    huggingface.channels = huggingfaceChannels

    // 从环境变量读取 HuggingFace 配置
    if (env.HF_TOKEN) {
        huggingfaceChannels.push({
            id: 'HFAAA',
            name: 'HuggingFace_env',
            type: 'huggingface',
            savePath: 'environment variable',
            token: env.HF_TOKEN,
            repo: env.HF_REPO,
            isPrivate: env.HF_PRIVATE === 'true',
            enabled: true,
            fixed: true,
        })
    }

    for (const storedHf of settingsKV.huggingface?.channels || []) {
        const hf = toApiChannel(storedHf, 'huggingface');
        // 如果 savePath 是 environment variable，修改可变参数
        if (hf.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (huggingfaceChannels[0]) {
                huggingfaceChannels[0].enabled = hf.enabled
                huggingfaceChannels[0].isPrivate = hf.isPrivate
            }
            continue
        }
        huggingfaceChannels.push(hf)
    }

    // 负载均衡
    const huggingfaceLoadBalance = settingsKV.huggingface?.loadBalance || {
        enabled: false,
        channels: [],
    }
    huggingface.loadBalance = huggingfaceLoadBalance


    // =====================读取 WebDAV 渠道配置=====================
    const webdav = {}
    const webdavChannels = []
    webdav.channels = webdavChannels

    // 从环境变量读取 WebDAV 配置
    if (env.WEBDAV_BASE_URL) {
        webdavChannels.push({
            id: 'WDAAA',
            name: 'WebDAV_env',
            type: 'webdav',
            savePath: 'environment variable',
            baseUrl: env.WEBDAV_BASE_URL,
            username: env.WEBDAV_USERNAME || '',
            password: env.WEBDAV_PASSWORD || '',
            publicUrl: env.WEBDAV_PUBLIC_URL || '',
            headers: normalizeWebDAVHeaders(env.WEBDAV_HEADERS || {}),
            createDirectory: env.WEBDAV_CREATE_DIRECTORY !== 'false',
            enabled: true,
            fixed: true,
        })
    }

    for (const storedWd of settingsKV.webdav?.channels || []) {
        const wd = toApiChannel(storedWd, 'webdav');
        // 如果 savePath 是 environment variable，修改可变参数
        if (wd.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (webdavChannels[0]) {
                webdavChannels[0].enabled = wd.enabled
                webdavChannels[0].publicUrl = wd.publicUrl || webdavChannels[0].publicUrl
                webdavChannels[0].headers = normalizeWebDAVHeaders(wd.headers || webdavChannels[0].headers)
                webdavChannels[0].createDirectory = wd.createDirectory !== false
            }
            continue
        }
        wd.headers = normalizeWebDAVHeaders(wd.headers || {})
        wd.createDirectory = wd.createDirectory !== false
        webdavChannels.push(wd)
    }

    // 负载均衡
    const webdavLoadBalance = settingsKV.webdav?.loadBalance || {
        enabled: false,
        channels: [],
    }
    webdav.loadBalance = webdavLoadBalance


    settings.telegram = telegram
    settings.cfr2 = cfr2
    settings.s3 = s3
    settings.discord = discord
    settings.huggingface = huggingface
    settings.webdav = webdav

    return settings;
}

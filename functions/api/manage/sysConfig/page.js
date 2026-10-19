import { getDatabase } from '../../../utils/databaseAdapter.js';

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
        const body = await request.json()
        const settings = body
        const REMOVED_PAGE_SETTINGS = new Set([
            'siteTitle',
            'siteIcon',
            'ownerName',
            'logoUrl',
            'logoLink',
            'footerLink',
            'disableFooter',
            'loginBkImg',
            'uploadBkImg',
            'announcement',
            'defaultUploadFolder',
            'defaultUploadNameType',
            'bkInterval',
            'bkOpacity',
            'urlPrefix',
        ])
        settings.config = (settings.config || []).filter(
            (ITEM) => !REMOVED_PAGE_SETTINGS.has(ITEM.id)
        )

        // 写入数据库
        await db.put('manage@sysConfig@page', JSON.stringify(settings))

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

    const config = []
    settings.config = config
    config.push(
        // 客户端设置
        {
            id: 'showDirectorySuggestions',
            label: '目录候选项',
            label_en: 'Directory Suggestions',
            type: 'boolean',
            default: true,
            tooltip: '控制上传页面是否展示目录树选择器',
            tooltip_en: 'Show directory tree picker on upload page',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultUploadChannel',
            label: '默认渠道类型',
            label_en: 'Default Channel Type',
            type: 'select',
            options: [
                { label: 'Telegram', value: 'telegram' },
                { label: 'Cloudflare R2', value: 'cfr2' },
                { label: 'S3', value: 's3' },
                { label: 'Discord', value: 'discord' },
                { label: 'HuggingFace', value: 'huggingface' },
                { label: 'WebDAV', value: 'webdav' },
            ],
            placeholder: 'telegram',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultChannelName',
            label: '默认渠道名称',
            label_en: 'Default Channel Name',
            type: 'channelName',
            tooltip: '指定默认使用的渠道名称，需先选择上传渠道',
            tooltip_en: 'Specify default channel name. Select upload channel first',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultConvertToWebp',
            label: '默认转换WebP',
            label_en: 'Default Convert to WebP',
            type: 'boolean',
            default: false,
            tooltip: '上传前将图片转换为WebP格式，可有效减小文件体积',
            tooltip_en: 'Convert images to WebP before upload to reduce file size',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCustomerCompress',
            label: '默认开启压缩',
            label_en: 'Default Compression',
            type: 'boolean',
            default: true,
            tooltip: '上传前在本地进行压缩，仅对图片文件生效',
            tooltip_en: 'Compress locally before upload, only for images',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCompressBar',
            label: '默认压缩阈值',
            label_en: 'Default Compress Threshold',
            placeholder: '5',
            tooltip: '图片大小超过此值将自动压缩，单位MB，范围1-20',
            tooltip_en: 'Auto-compress when image exceeds this size (MB), range 1-20',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCompressQuality',
            label: '默认压缩期望',
            label_en: 'Default Compress Target',
            placeholder: '4',
            tooltip: '压缩后图片大小期望值，单位MB，范围0.5-压缩阈值',
            tooltip_en: 'Target image size after compression (MB), range 0.5 to threshold',
            category: '客户端设置',
            category_en: 'Client Settings',
        },
    )

    const userConfig = env.USER_CONFIG
    if (userConfig) {
        try {
            const parsedConfig = JSON.parse(userConfig)
            if (typeof parsedConfig === 'object' && parsedConfig !== null) {
                // 搜索config中的id，如果存在则更新
                for (let i = 0; i < config.length; i++) {
                    if (parsedConfig[config[i].id]) {
                        config[i].value = parsedConfig[config[i].id]
                    }
                }
            }
        } catch (error) {
            // do nothing
        }
    }

    // 用KV中的设置覆盖默认设置
    for (let i = 0; i < settingsKV.config?.length; i++) {
        const item = settingsKV.config[i]
        const index = config.findIndex(x => x.id === item.id)
        if (index !== -1) {
            config[index].value = item.value
        }
    }

    return settings
}

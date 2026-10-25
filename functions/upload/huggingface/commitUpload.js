/**
 * HuggingFace 大文件提交 API
 * 
 * 在前端直接上传文件到 S3 后，调用此 API 提交 LFS 文件引用
 */

import { HuggingFaceAPI } from '../../utils/storage/huggingfaceAPI.js';
import { fetchUploadConfig } from '../../utils/sysConfig.js';
import { getDatabase } from '../../utils/databaseAdapter.js';
import { endUpload, getUploadIp, sanitizeUploadFolder, createResponse } from '../uploadTools.js';
import { userAuthCheck, UnauthorizedResponse } from '../../utils/auth/userAuth.js';

export async function onRequestPost(context) {
    const { request, env, waitUntil } = context;
    const url = new URL(request.url);

    try {
        // 鉴权
        const requiredPermission = 'upload';
        if (!await userAuthCheck(env, url, request, requiredPermission)) {
            return UnauthorizedResponse('Unauthorized');
        }

        const body = await request.json();
        const { fullId, filePath, sha256, fileSize, fileName, fileType, channelName } = body;

        if (!fullId || !filePath || !sha256 || !fileSize) {
            return createResponse(JSON.stringify({
                error: 'Missing required fields: fullId, filePath, sha256, fileSize'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (!channelName) {
            return createResponse(JSON.stringify({
                error: '未选择渠道名称，请选择存储渠道后再上传。'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 路径安全处理：使用统一的路径安全函数
        const sanitizedFullId = sanitizeUploadFolder(fullId);
        if (sanitizedFullId !== fullId) {
            return createResponse(JSON.stringify({
                error: 'Invalid fullId: contains illegal path characters'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 获取 HuggingFace 配置
        const uploadConfig = await fetchUploadConfig(env);
        const hfSettings = uploadConfig.huggingface;

        if (!hfSettings || !hfSettings.channels || hfSettings.channels.length === 0) {
            return createResponse(JSON.stringify({ error: 'No HuggingFace channel configured' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 选择明确指定的渠道，不在名称缺失或无效时回退到其他渠道
        const hfChannel = hfSettings.channels.find(c => c.name === channelName);
        if (!hfChannel) {
            return createResponse(JSON.stringify({
                error: '所选渠道名称无效，请重新选择后再上传。'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!hfChannel || !hfChannel.token || !hfChannel.repo) {
            return createResponse(JSON.stringify({ error: 'HuggingFace channel not properly configured' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const huggingfaceAPI = new HuggingFaceAPI(hfChannel.token, hfChannel.repo, hfChannel.isPrivate || false);

        // 提交 LFS 文件引用
        console.log('Committing LFS file...');
        const commitResult = await huggingfaceAPI.commitLfsFile(
            filePath,
            sha256,
            fileSize,
            `Upload ${fileName || fullId}`
        );
        console.log('Commit result:', JSON.stringify(commitResult));

        // 构建文件 URL
        const fileUrl = `https://huggingface.co/datasets/${hfChannel.repo}/resolve/main/${filePath}`;

        // 从 fullId 中提取目录信息
        const dirParts = fullId.split('/').slice(0, -1).join('/');
        const normalizedDirectory = dirParts === '' ? '' : dirParts + '/';

        // 获取上传IP
        const uploadIp = getUploadIp(request) || '';

        // 构建 metadata
        const metadata = {
            FileName: fileName || fullId,
            FileType: fileType || '',
            Channel: "HuggingFace",
            ChannelName: hfChannel.name || "HuggingFace_env",
            FileSize: (fileSize / 1024 / 1024).toFixed(2),
            FileSizeBytes: fileSize,
            UploadIP: uploadIp,
            HfFilePath: filePath,
            TimeStamp: Date.now(),
            ...(normalizedDirectory ? { Directory: normalizedDirectory } : {}),
        };

        // 写入数据库
        const db = getDatabase(env);
        await db.put(fullId, "", { metadata });

        // 结束上传（更新索引等）
        const uploadContext = {
            env,
            waitUntil,
            uploadConfig,
            url
        };
        waitUntil(endUpload(uploadContext, fullId, metadata));

        // 返回成功响应
        const returnLink = `/file/${fullId}`;
        const responseBody = {
            success: true,
            src: returnLink,
            fileUrl,
            fullId
        };

        // 域名使用当前请求来源，文件路由后缀固定为 /file/。
        responseBody.publicUrl = `${new URL(request.url).origin}/file/${fullId}`;

        return createResponse(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('commitUpload error:', error.message);
        return createResponse(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

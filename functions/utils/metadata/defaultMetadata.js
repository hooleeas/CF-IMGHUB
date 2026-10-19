const DEFAULT_METADATA_VALUES = {
    UploadAddress: '未知',
    ListType: 'None',
    Label: 'None',
    Directory: '',
};

export function removeDefaultMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return { metadata, removedFields: [] };
    }

    const cleanedMetadata = { ...metadata };
    const removedFields = [];

    for (const [field, defaultValue] of Object.entries(DEFAULT_METADATA_VALUES)) {
        if (cleanedMetadata[field] === defaultValue) {
            delete cleanedMetadata[field];
            removedFields.push(field);
        }
    }

    if (Array.isArray(cleanedMetadata.Tags) && cleanedMetadata.Tags.length === 0) {
        delete cleanedMetadata.Tags;
        removedFields.push('Tags');
    }

    return { metadata: cleanedMetadata, removedFields };
}

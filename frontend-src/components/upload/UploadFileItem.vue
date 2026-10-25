import { Link, Delete, MoreFilled } from '@element-plus/icons-vue';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico', 'avif', 'heic', 'jfif', 'pjpeg', 'pjp', 'raw', 'cr2', 'nef', 'dng', 'eps', 'ai', 'emf', 'wmf'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mkv'];
export default {
  name: 'UploadFileItem',
  components: {
    Link,
    Delete,
    MoreFilled
  },
  props: {
    file: {
      type: Object,
      required: true
    }
  },
  emits: ['copy', 'remove', 'preview-error'],
  computed: {
    urlSize() {
      return window.innerWidth < 768 ? 'small' : 'default';
    }
  },
  methods: {
    isImage(fileName) {
      const ext = fileName.split('.').pop().toLowerCase();
      return IMAGE_EXTENSIONS.includes(ext);
    },
    isVideo(fileName) {
      const ext = fileName.split('.').pop().toLowerCase();
      return VIDEO_EXTENSIONS.includes(ext);
    },
    truncateFilename(filename, maxLength = 20) {
      if (!filename || filename.length <= maxLength) return filename;
      const lastDotIndex = filename.lastIndexOf('.');
      let name, ext;
      if (lastDotIndex > 0) {
        name = filename.substring(0, lastDotIndex);
        ext = filename.substring(lastDotIndex);
      } else {
        name = filename;
        ext = '';
      }
      const keepEnd = ext.length + 4;
      const keepStart = maxLength - keepEnd - 3;
      if (keepStart <= 0) return filename.substring(0, maxLength - 3) + '...';
      return name.substring(0, keepStart) + '...' + name.slice(-4) + ext;
    },
    copyFormat(format) {
      this.$emit('copy', this.file, format);
    },
    removeFile() {
      this.$emit('remove', this.file);
    }
  }
};
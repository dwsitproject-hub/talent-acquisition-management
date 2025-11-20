import imageCompression from 'browser-image-compression'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB in bytes

/**
 * Compresses a file to under 2MB if possible.
 * - Images: Automatically compressed using browser-image-compression
 * - PDFs and other documents: Cannot be compressed client-side, will return as-is
 * 
 * @param file The file to compress
 * @returns Compressed file (or original if already under 2MB or cannot be compressed)
 */
export async function compressFile(file: File): Promise<File> {
  // If file is already under 2MB, return as is
  if (file.size <= MAX_FILE_SIZE) {
    return file
  }

  // Check if it's an image file (including various image formats)
  const isImage = file.type.startsWith('image/') || 
                  /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.name)
  
  if (isImage) {
    // Compress image using browser-image-compression
    try {
      // Use more aggressive compression settings to ensure we get under 2MB
      const options = {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: file.type, // Preserve original file type
        initialQuality: 0.8, // Start with 80% quality
        alwaysKeepResolution: false // Allow resizing if needed
      }
      
      let compressedFile = await imageCompression(file, options)
      
      // If still too large, try more aggressive compression
      if (compressedFile.size > MAX_FILE_SIZE) {
        console.log(`First compression attempt: ${formatFileSize(compressedFile.size)}, trying more aggressive compression...`)
        const aggressiveOptions = {
          ...options,
          maxSizeMB: 1.8, // Target slightly under 2MB
          initialQuality: 0.6, // Lower quality
          maxWidthOrHeight: 1600 // Smaller dimensions
        }
        compressedFile = await imageCompression(file, aggressiveOptions)
      }
      
      // If still too large after aggressive compression, throw error
      if (compressedFile.size > MAX_FILE_SIZE) {
        throw new Error(`Image file could not be compressed to under 2MB. Original size: ${formatFileSize(file.size)}, Compressed size: ${formatFileSize(compressedFile.size)}. Please use a smaller image or compress it manually.`)
      }
      
      console.log(`Image compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressedFile.size)}`)
      return compressedFile
    } catch (error: any) {
      console.error('Error compressing image:', error)
      if (error.message && error.message.includes('could not be compressed')) {
        throw error
      }
      throw new Error('Failed to compress image file. Please try a smaller file.')
    }
  }

  // For PDF and other documents, we can't compress them client-side effectively
  // Return the file as-is, but the caller should validate the size
  // The validation will happen in the component
  return file
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}


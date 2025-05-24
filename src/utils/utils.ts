import * as fs from 'fs';
import * as path from 'path';

/**
 * Checks if a file exists
 * @param filePath Path to check
 * @returns Promise resolving to boolean
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets all files in a directory recursively
 * @param dir Directory to scan
 * @param fileList Array to store results
 * @returns Array of file paths
 */
export function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
} 
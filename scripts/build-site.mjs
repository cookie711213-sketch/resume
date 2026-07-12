import { access, copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_FILES = [
  'index.html',
  'assets/dajeong-home.png',
  'assets/dingdong-teacher-calendar.jpeg',
];

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

export async function buildSite({
  sourceRoot = projectRoot,
  outputRoot = path.join(sourceRoot, 'site'),
} = {}) {
  for (const relativePath of PUBLIC_FILES) {
    await access(path.join(sourceRoot, relativePath));
  }

  await rm(outputRoot, { recursive: true, force: true });
  for (const relativePath of PUBLIC_FILES) {
    const destination = path.join(outputRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(sourceRoot, relativePath), destination);
  }

  return PUBLIC_FILES.length;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const count = await buildSite();
    console.log(`Built site with ${count} public files.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

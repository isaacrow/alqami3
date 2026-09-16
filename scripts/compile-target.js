import { CompilerBase } from '../node_modules/mind-ar/src/image-target/compiler-base.js';
import { buildTrackingImageList } from '../node_modules/mind-ar/src/image-target/image-list.js';
import { extractTrackingFeatures } from '../node_modules/mind-ar/src/image-target/tracker/extract-utils.js';
import '../node_modules/mind-ar/src/image-target/detector/kernels/cpu/index.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class NodeCompiler extends CompilerBase {
  createProcessCanvas(img) {
    const canvas = createCanvas(img.width, img.height);
    return canvas;
  }

  compileTrack({ progressCallback, targetImages, basePercent }) {
    return new Promise((resolve) => {
      const percentPerImage = (100 - basePercent) / targetImages.length;
      let percent = 0;
      const list = [];
      for (let i = 0; i < targetImages.length; i++) {
        const targetImage = targetImages[i];
        const imageList = buildTrackingImageList(targetImage);
        const percentPerAction = percentPerImage / imageList.length;

        const trackingData = extractTrackingFeatures(imageList, (index) => {
          percent += percentPerAction;
          if (progressCallback) {
            progressCallback(basePercent + percent);
          }
        });
        list.push(trackingData);
      }
      resolve(list);
    });
  }
}

async function compileManuscript() {
  const inputImagePath = path.resolve(__dirname, '../manuscript.jpg');
  const outputDir = path.resolve(__dirname, '../public/targets');
  const outputPath = path.join(outputDir, 'manuscript.mind');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Loading image from ${inputImagePath}...`);
  const image = await loadImage(inputImagePath);
  console.log(`Image loaded: ${image.width}x${image.height} px`);

  const compiler = new NodeCompiler();
  console.log('Compiling target image into .mind format (this extracts multiscale feature points)...');

  await compiler.compileImageTargets([image], (progress) => {
    process.stdout.write(`\rProgress: ${progress.toFixed(1)}%`);
  });

  console.log('\nCompilation finished. Exporting buffer...');
  const buffer = compiler.exportData();

  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`Successfully saved target to ${outputPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
}

compileManuscript().catch((err) => {
  console.error('Error compiling target:', err);
  process.exit(1);
});
